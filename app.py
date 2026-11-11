"""Flask application entrypoint configuring security middleware, CORS, and domain Blueprints."""
from __future__ import annotations

import os
import urllib.parse
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from core import (
    _AUTH_RATE_LIMIT,
    _FAILED_LOGIN_ATTEMPTS,
    _LOOPBACK_HOSTS,
    _ORDER_IDEMPOTENCY,
    _ORDER_RATE_LIMIT,
    _SAFE_REDIRECT_HOST_RE,
    _SHARED_CART_GET_RATE_LIMIT,
    AUTH_SECRET_KEY,
    generate_auth_token,
    get_client_ip,
    get_current_user,
    is_force_https_enabled,
    is_https_request,
    is_loopback_host,
    parse_allowed_origins,
    parse_bool_env,
    sanitize_order_for_role,
    verify_auth_token,
)
from routes import register_blueprints
from storage import (
    _DATA_LOCK,
    RepositoryError,
    get_repository,
    hash_password,
    load_data,
    replace_full_data,
    safe_int,
    save_data,
    verify_password,
)

__all__ = [
    "app",
    "AUTH_SECRET_KEY",
    "_DATA_LOCK",
    "_FAILED_LOGIN_ATTEMPTS",
    "_AUTH_RATE_LIMIT",
    "_ORDER_RATE_LIMIT",
    "_SHARED_CART_GET_RATE_LIMIT",
    "_ORDER_IDEMPOTENCY",
    "verify_password",
    "hash_password",
    "load_data",
    "save_data",
    "replace_full_data",
    "get_repository",
    "parse_allowed_origins",
    "generate_auth_token",
    "verify_auth_token",
    "sanitize_order_for_role",
]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024

_TRUST_PROXY_HOPS = safe_int(os.environ.get("PRINT_CALC_TRUST_PROXY_HOPS", 0), 0, 0, 10)
if _TRUST_PROXY_HOPS > 0:
    app.wsgi_app = ProxyFix(  # type: ignore[assignment]
        app.wsgi_app,
        x_for=_TRUST_PROXY_HOPS,
        x_proto=_TRUST_PROXY_HOPS,
        x_host=_TRUST_PROXY_HOPS,
    )

_FORCE_HTTPS_STARTUP = parse_bool_env("PRINT_CALC_FORCE_HTTPS", False)
_HSTS_MAX_AGE = safe_int(
    os.environ.get("PRINT_CALC_HSTS_MAX_AGE", 31536000), 31536000, 0, 63072000
)

_allowed_origins = parse_allowed_origins(
    os.environ.get("PRINT_CALC_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
    force_https=_FORCE_HTTPS_STARTUP,
)
CORS(app, resources={r"/api/*": {"origins": _allowed_origins}}, supports_credentials=False)


@app.after_request
def apply_security_headers(response):
    is_https = is_https_request()
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if is_https:
        hsts_max_age = safe_int(
            os.environ.get("PRINT_CALC_HSTS_MAX_AGE", _HSTS_MAX_AGE), _HSTS_MAX_AGE, 0, 63072000
        )
        if hsts_max_age > 0:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={hsts_max_age}; includeSubDomains"
            )
    if (
        request.path.startswith("/api/admin")
        or request.path.startswith("/api/manager")
        or request.path.startswith("/api/auth")
        or request.path.startswith("/api/crm")
        or request.path.startswith("/api/orders")
    ):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    elif request.path.startswith("/uploads/"):
        uploads_csp = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
        if is_https:
            uploads_csp += "; upgrade-insecure-requests"
        response.headers["Content-Security-Policy"] = uploads_csp
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    if is_https and "Content-Security-Policy" not in response.headers:
        response.headers["Content-Security-Policy"] = "upgrade-insecure-requests"
    return response


@app.before_request
def _enforce_strict_https():
    if not is_force_https_enabled(app) or is_https_request():
        return None
    raw_host = (request.headers.get("Host") or request.host or "").strip()
    if is_loopback_host(raw_host) and get_client_ip() in _LOOPBACK_HOSTS:
        return None
    has_auth = bool((request.headers.get("Authorization") or "").strip())
    if request.method in ("GET", "HEAD") and not has_auth:
        if (
            not raw_host
            or not _SAFE_REDIRECT_HOST_RE.match(raw_host)
            or not urllib.parse.urlsplit(f"//{raw_host}").hostname
        ):
            return jsonify({"error": "Некорректный заголовок Host"}), 400
        safe_path = "/" + (request.path or "/").lstrip("/")
        query_str = request.query_string.decode("utf-8", errors="ignore")
        if any(ch in safe_path or ch in query_str for ch in ("\r", "\n", "\x00")):
            return jsonify({"error": "Некорректный URL запроса"}), 400
        target_url = f"https://{raw_host}{safe_path}"
        if query_str:
            target_url = f"{target_url}?{query_str}"
        return Response("", status=308, headers={"Location": target_url})
    return jsonify({"error": "Требуется защищённое соединение HTTPS"}), 403


@app.before_request
def _reject_invalid_bearer_on_protected_routes():
    if request.method == "OPTIONS":
        return None
    path = request.path or ""
    if path == "/api/admin/pin":
        return None
    if not (path.startswith("/api/admin/") or path.startswith("/api/crm/")):
        return None
    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        raw_token = auth_header[7:].strip()
        if raw_token and get_current_user() is None:
            return jsonify({"error": "Сессия истекла или недействительна"}), 401
    return None


@app.errorhandler(RepositoryError)
def _handle_repository_error(exc: RepositoryError):
    app.logger.error("Repository error on %s %s: %s", request.method, request.path, exc)
    return jsonify({"error": "Хранилище данных временно недоступно"}), 503


register_blueprints(app)


if __name__ == "__main__":
    is_debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", debug=is_debug, use_reloader=False, port=5000, threaded=True)
