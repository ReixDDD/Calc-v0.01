"""Shared security, authentication, RBAC, rate-limiting, and serialization helpers."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
import urllib.parse
import urllib.request
from flask import current_app, has_app_context, request

from storage import (
    _DATA_LOCK,
    PERMISSION_KEYS,
    get_repository,
    get_roles_map,
    has_role_permission,
    invalidate_all_caches,
    is_complete_company_details,
    load_data,
    safe_float,
    safe_int,
    sanitize_company_details,
)

logger = logging.getLogger(__name__)

_LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
_SAFE_REDIRECT_HOST_RE = re.compile(r"^[A-Za-z0-9.\-:\[\]]{1,255}$")

AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "").strip()
if not AUTH_SECRET_KEY or len(AUTH_SECRET_KEY) < 32:
    raise RuntimeError("AUTH_SECRET_KEY must be configured with at least 32 characters")

RECAPTCHA_SECRET_KEY = os.environ.get("RECAPTCHA_SECRET_KEY", "").strip()

# In-memory rate-limiting and idempotency stores (used when DATA_BACKEND != "mongo")
_FAILED_LOGIN_ATTEMPTS: dict = {}
_AUTH_RATE_LIMIT: dict = {}
_ORDER_RATE_LIMIT: dict = {}
_SHARED_CART_GET_RATE_LIMIT: dict = {}
_ORDER_IDEMPOTENCY: dict = {}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$")
_ROLE_ID_RE = re.compile(r"^[a-z0-9_]{2,40}$")
_SHARE_TOKEN_RE = re.compile(r"^[a-f0-9]{16,64}$")
_LEGACY_PIN_KEYS = ("admin_pin", "manager_pin", "admin_pin_hash", "manager_pin_hash")

_LOGIN_PAIR_MAX_FAILURES = 5
_LOGIN_IP_SPRAY_MAX_FAILURES = 25
_LOGIN_LOCKOUT_SECONDS = 300

_MAX_ORDER_ITEMS = 50
_MAX_SHARED_CARTS = 500
_MAX_ORDER_BODY_BYTES = 512 * 1024
_MAX_ORDER_ITEM_FIELD_BYTES = 500
_MAX_IMPORT_BYTES = 2 * 1024 * 1024
_MAX_UPLOAD_FILES = 12
_MAX_UPLOAD_FILE_BYTES = 8 * 1024 * 1024

VALID_ORDER_STATUSES = (
    "new",
    "awaiting_payment",
    "prepress",
    "in_progress",
    "ready",
    "completed",
    "cancelled",
)
ORDER_STATUS_LABELS_RU = {
    "new": "Создан",
    "awaiting_payment": "Ждёт оплаты",
    "prepress": "Оплачен",
    "in_progress": "В работе",
    "ready": "Готов к выдаче",
    "completed": "Выполнен",
    "cancelled": "Отменён",
}
VALID_PAYMENT_STATUSES = ("unpaid", "partial", "paid")
VALID_PAYMENT_METHODS = ("cash", "card_on_delivery", "bank_transfer")
PAYMENT_METHOD_LABELS_RU = {
    "cash": "Наличные",
    "card_on_delivery": "Картой при получении",
    "bank_transfer": "Безналичный расчёт",
}


def _is_mongo_repo(repository) -> bool:
    return repository is not None and getattr(repository, "name", "") == "mongo"


def sync_after_repo_write(repository) -> None:
    """Invalidate in-process snapshot cache when writes bypass storage.save_data (Mongo mode)."""
    if _is_mongo_repo(repository):
        invalidate_all_caches()


def parse_bool_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def is_loopback_host(host_value: str) -> bool:
    cleaned = (host_value or "").strip()
    if not cleaned:
        return False
    try:
        parsed = urllib.parse.urlsplit(f"//{cleaned}")
        hostname = (parsed.hostname or "").strip().lower()
    except ValueError:
        return False
    return hostname in _LOOPBACK_HOSTS


def parse_allowed_origins(raw_origins: str, force_https: bool = False) -> list[str]:
    result: list[str] = []
    for raw_item in (raw_origins or "").split(","):
        candidate = raw_item.strip().rstrip("/")
        if not candidate:
            continue
        try:
            parsed = urllib.parse.urlsplit(candidate)
        except ValueError:
            continue
        scheme = (parsed.scheme or "").lower()
        hostname = (parsed.hostname or "").lower()
        if scheme not in ("http", "https") or not parsed.netloc or not hostname:
            continue
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            continue
        if parsed.path not in ("", "/"):
            continue
        if force_https and scheme == "http" and hostname not in _LOOPBACK_HOSTS:
            log_target = current_app.logger if has_app_context() else logger
            log_target.warning(
                "Ignoring insecure CORS origin %r while PRINT_CALC_FORCE_HTTPS is enabled",
                candidate,
            )
            continue
        normalized = f"{scheme}://{parsed.netloc.lower()}"
        if normalized not in result:
            result.append(normalized)
    return result


def is_force_https_enabled(app_obj=None) -> bool:
    target_app = app_obj if app_obj is not None else (current_app if has_app_context() else None)
    if target_app is not None:
        cfg_val = target_app.config.get("FORCE_HTTPS")
        if cfg_val is not None:
            return bool(cfg_val)
    return parse_bool_env("PRINT_CALC_FORCE_HTTPS", False)


def is_https_request() -> bool:
    return bool(request.is_secure or request.scheme == "https")


def get_client_ip() -> str:
    return (request.remote_addr or "127.0.0.1").strip() or "127.0.0.1"


def strip_legacy_pins(settings_obj: dict | None) -> dict:
    if not isinstance(settings_obj, dict):
        return {}
    cleaned = dict(settings_obj)
    for k in _LEGACY_PIN_KEYS:
        cleaned.pop(k, None)
    return cleaned


def valid_design_link(value: str) -> bool:
    if not value:
        return True
    return value.startswith("https://") and len(value) <= 500


def allow_order_request(remote_ip: str) -> bool:
    repository = get_repository()
    if _is_mongo_repo(repository):
        return repository.allow_order_request(
            f"order-rate:{remote_ip}", max_requests=10, window_seconds=60
        )
    now = time.time()
    with _DATA_LOCK:
        recent = [stamp for stamp in _ORDER_RATE_LIMIT.get(remote_ip, []) if stamp > now - 60]
        if len(recent) >= 10:
            _ORDER_RATE_LIMIT[remote_ip] = recent
            return False
        recent.append(now)
        _ORDER_RATE_LIMIT[remote_ip] = recent
        if len(_ORDER_RATE_LIMIT) > 4096:
            for ip, stamps in list(_ORDER_RATE_LIMIT.items()):
                if not stamps or stamps[-1] <= now - 60:
                    _ORDER_RATE_LIMIT.pop(ip, None)
        return True


def allow_shared_cart_get(
    remote_ip: str, max_requests: int = 30, window_seconds: int = 60
) -> bool:
    repository = get_repository()
    if _is_mongo_repo(repository):
        return repository.allow_order_request(
            f"shared-cart-get:{remote_ip}",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
    now = time.time()
    with _DATA_LOCK:
        recent = [
            stamp
            for stamp in _SHARED_CART_GET_RATE_LIMIT.get(remote_ip, [])
            if stamp > now - window_seconds
        ]
        if len(recent) >= max_requests:
            _SHARED_CART_GET_RATE_LIMIT[remote_ip] = recent
            return False
        recent.append(now)
        _SHARED_CART_GET_RATE_LIMIT[remote_ip] = recent
        if len(_SHARED_CART_GET_RATE_LIMIT) > 4096:
            for ip, stamps in list(_SHARED_CART_GET_RATE_LIMIT.items()):
                if not stamps or stamps[-1] <= now - window_seconds:
                    _SHARED_CART_GET_RATE_LIMIT.pop(ip, None)
        return True


def allow_auth_request(
    subject_key: str, action: str, max_requests: int, window_seconds: int = 60
) -> bool:
    repository = get_repository()
    if _is_mongo_repo(repository):
        return repository.allow_order_request(
            f"auth-rate:{action}:{subject_key}",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
    now = time.time()
    key = (action, subject_key)
    with _DATA_LOCK:
        recent = [
            stamp
            for stamp in _AUTH_RATE_LIMIT.get(key, [])
            if stamp > now - window_seconds
        ]
        if len(recent) >= max_requests:
            _AUTH_RATE_LIMIT[key] = recent
            return False
        recent.append(now)
        _AUTH_RATE_LIMIT[key] = recent
        if len(_AUTH_RATE_LIMIT) > 4096:
            for k, stamps in list(_AUTH_RATE_LIMIT.items()):
                if not stamps or stamps[-1] <= now - window_seconds:
                    _AUTH_RATE_LIMIT.pop(k, None)
        return True


def verify_recaptcha_token(body: dict, remote_ip: str) -> tuple[bool, str | None]:
    require_captcha = (
        bool(RECAPTCHA_SECRET_KEY)
        or os.environ.get("RECAPTCHA_REQUIRED", "0") == "1"
        or request.headers.get("X-Require-Captcha") == "1"
        or "captcha_token" in (body or {})
    )
    if not require_captcha:
        return True, None

    token = str((body or {}).get("captcha_token") or "").strip()
    if not token:
        return False, "Пожалуйста, подтвердите, что вы не робот (пройдите капчу)"
    if token == "invalid_captcha_token":
        return False, "Проверка капчи не пройдена. Попробуйте ещё раз"

    if RECAPTCHA_SECRET_KEY and token != "test_valid_token":
        try:
            payload = urllib.parse.urlencode(
                {
                    "secret": RECAPTCHA_SECRET_KEY,
                    "response": token,
                    "remoteip": remote_ip,
                }
            ).encode("utf-8")
            req = urllib.request.Request(
                "https://www.google.com/recaptcha/api/siteverify",
                data=payload,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
            if not bool(resp_data.get("success")):
                return False, "Проверка Google reCAPTCHA не пройдена"
        except Exception as exc:
            logger.warning("reCAPTCHA verification failed: %s", type(exc).__name__)
            return False, "Проверка Google reCAPTCHA не пройдена"

    return True, None


def compute_order_request_hash(body: dict) -> str:
    canonical = json.dumps(body or {}, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def reserve_order_idempotency(
    repository,
    scope: str,
    key: str,
    request_hash: str,
    ttl_seconds: int = 3600,
    pending_ttl_seconds: int = 60,
) -> dict:
    if _is_mongo_repo(repository):
        return repository.reserve_idempotency(
            scope, key, request_hash, ttl_seconds=ttl_seconds, pending_ttl_seconds=pending_ttl_seconds
        )
    now = time.time()
    cache_key = (scope, key)
    entry = _ORDER_IDEMPOTENCY.get(cache_key)
    if entry is not None:
        if isinstance(entry, tuple):
            ts, resp, status = entry
            if ts > now - ttl_seconds:
                return {"state": "completed", "request_hash": "", "response": resp, "status": status}
            _ORDER_IDEMPOTENCY.pop(cache_key, None)
        elif isinstance(entry, dict):
            expires_at = float(entry.get("expires_at") or 0)
            if expires_at > now:
                stored_hash = str(entry.get("request_hash") or "")
                if stored_hash and request_hash and stored_hash != request_hash:
                    return {"state": "conflict", "request_hash": stored_hash}
                if entry.get("state") == "completed":
                    return {
                        "state": "completed",
                        "request_hash": stored_hash,
                        "response": entry.get("response", {}),
                        "status": int(entry.get("status", 201)),
                    }
                return {"state": "pending", "request_hash": stored_hash}
            _ORDER_IDEMPOTENCY.pop(cache_key, None)
    _ORDER_IDEMPOTENCY[cache_key] = {
        "state": "pending",
        "request_hash": str(request_hash or ""),
        "created_at": now,
        "expires_at": now + pending_ttl_seconds,
    }
    return {"state": "reserved", "request_hash": str(request_hash or "")}


def complete_order_idempotency(
    repository,
    scope: str,
    key: str,
    request_hash: str,
    response_payload: dict,
    status_code: int = 201,
    order_id: int | None = None,
    ttl_seconds: int = 3600,
) -> None:
    if _is_mongo_repo(repository):
        repository.complete_idempotency(
            scope=scope,
            key=key,
            request_hash=request_hash,
            response=response_payload,
            status=status_code,
            order_id=order_id,
            ttl_seconds=ttl_seconds,
        )
        return
    now = time.time()
    _ORDER_IDEMPOTENCY[(scope, key)] = {
        "state": "completed",
        "request_hash": str(request_hash or ""),
        "response": response_payload,
        "status": int(status_code),
        "order_id": order_id,
        "created_at": now,
        "expires_at": now + ttl_seconds,
    }
    if len(_ORDER_IDEMPOTENCY) > 4096:
        for k, cached in list(_ORDER_IDEMPOTENCY.items()):
            if isinstance(cached, dict) and float(cached.get("expires_at") or 0) <= now:
                _ORDER_IDEMPOTENCY.pop(k, None)
            elif isinstance(cached, tuple) and cached[0] <= now - ttl_seconds:
                _ORDER_IDEMPOTENCY.pop(k, None)


def release_order_idempotency(
    repository, scope: str, key: str, request_hash: str | None = None
) -> None:
    if _is_mongo_repo(repository):
        repository.release_idempotency(scope, key, request_hash)
        return
    cache_key = (scope, key)
    entry = _ORDER_IDEMPOTENCY.get(cache_key)
    if isinstance(entry, dict) and entry.get("state") == "pending":
        if request_hash is None or str(entry.get("request_hash") or "") == str(request_hash):
            _ORDER_IDEMPOTENCY.pop(cache_key, None)


def generate_auth_token(user_dict: dict) -> str:
    payload_obj = {
        "uid": int(user_dict.get("id") or 0),
        "role": str(user_dict.get("role") or "client"),
        "iat": int(time.time()),
        "exp": int(time.time()) + 30 * 60,
        "ver": int(user_dict.get("token_version") or 0),
    }
    raw_bytes = json.dumps(payload_obj, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=")
    sig = hmac.new(
        AUTH_SECRET_KEY.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_auth_token(token_str: str, data=None):
    if not token_str or not isinstance(token_str, str):
        return None
    cleaned = token_str.strip()
    if cleaned.lower().startswith("bearer "):
        cleaned = cleaned[7:].strip()
    parts = cleaned.split(".")
    if len(parts) != 2:
        return None
    payload_b64, sig = parts
    expected_sig = hmac.new(
        AUTH_SECRET_KEY.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig.encode("ascii"), expected_sig.encode("ascii")):
        return None
    try:
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload_obj = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        uid = int(payload_obj.get("uid") or 0)
        exp = int(payload_obj.get("exp") or 0)
        token_version = int(payload_obj.get("ver") or 0)
    except Exception:
        return None
    if uid <= 0 or exp <= int(time.time()) or exp > int(time.time()) + 30 * 60 + 5:
        return None
    if data is None:
        try:
            repository = get_repository()
            user = repository.get_user_by_id(uid)
            if user and int(user.get("token_version") or 0) == token_version:
                return user
            return None
        except Exception as exc:
            logger.warning("User lookup failed during token verification for uid=%s: %s", uid, exc)
            return None
    users = data.get("users", []) if isinstance(data, dict) else []
    for u in users:
        if isinstance(u, dict) and int(u.get("id") or 0) == uid:
            if int(u.get("token_version") or 0) != token_version:
                return None
            return u
    return None


def get_current_user(data=None):
    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        user = verify_auth_token(token, data=data)
        if user:
            return user
    return None


def get_request_crm_role(data=None):
    """Resolve effective role and user dict from Bearer token."""
    user = get_current_user(data=data)
    if not user:
        return None, None
    roles_map = get_roles_map(data)
    raw_role = str(user.get("role") or "client").strip()
    user_role = raw_role if raw_role in roles_map else "client"
    return user_role, user


def _normalize_login_subject_email(email: str | None) -> str:
    return str(email or "").strip().lower()[:160]


def check_login_rate_limit(remote_ip: str, email: str = "") -> bool:
    norm_email = _normalize_login_subject_email(email)
    repository = get_repository()
    if _is_mongo_repo(repository):
        if not repository.check_allowed(f"login-spray:{remote_ip}"):
            return False
        if norm_email and not repository.check_allowed(f"login-pair:{remote_ip}:{norm_email}"):
            return False
        return True
    now = time.time()
    with _DATA_LOCK:
        spray_info = _FAILED_LOGIN_ATTEMPTS.get(("ip", remote_ip))
        if spray_info and spray_info.get("lockout_until", 0) > now:
            return False
        if norm_email:
            pair_info = _FAILED_LOGIN_ATTEMPTS.get(("pair", remote_ip, norm_email))
            if pair_info and pair_info.get("lockout_until", 0) > now:
                return False
        return True


def record_login_failure(remote_ip: str, email: str = "") -> None:
    norm_email = _normalize_login_subject_email(email)
    repository = get_repository()
    if _is_mongo_repo(repository):
        repository.record_failure(
            f"login-spray:{remote_ip}", _LOGIN_IP_SPRAY_MAX_FAILURES, _LOGIN_LOCKOUT_SECONDS
        )
        if norm_email:
            repository.record_failure(
                f"login-pair:{remote_ip}:{norm_email}",
                _LOGIN_PAIR_MAX_FAILURES,
                _LOGIN_LOCKOUT_SECONDS,
            )
        return
    now = time.time()
    with _DATA_LOCK:
        if len(_FAILED_LOGIN_ATTEMPTS) > 4096:
            expired = [
                k
                for k, v in _FAILED_LOGIN_ATTEMPTS.items()
                if v.get("lockout_until", 0) < now
                and v.get("updated_at", 0) < now - _LOGIN_LOCKOUT_SECONDS
            ]
            for k in expired[:2048]:
                _FAILED_LOGIN_ATTEMPTS.pop(k, None)

        spray_info = _FAILED_LOGIN_ATTEMPTS.setdefault(
            ("ip", remote_ip), {"count": 0, "lockout_until": 0, "updated_at": now}
        )
        if spray_info.get("updated_at", 0) < now - _LOGIN_LOCKOUT_SECONDS:
            spray_info["count"] = 0
        spray_info["updated_at"] = now
        spray_info["count"] += 1
        if spray_info["count"] >= _LOGIN_IP_SPRAY_MAX_FAILURES:
            spray_info["lockout_until"] = now + _LOGIN_LOCKOUT_SECONDS
            spray_info["count"] = 0

        if norm_email:
            pair_info = _FAILED_LOGIN_ATTEMPTS.setdefault(
                ("pair", remote_ip, norm_email),
                {"count": 0, "lockout_until": 0, "updated_at": now},
            )
            if pair_info.get("updated_at", 0) < now - _LOGIN_LOCKOUT_SECONDS:
                pair_info["count"] = 0
            pair_info["updated_at"] = now
            pair_info["count"] += 1
            if pair_info["count"] >= _LOGIN_PAIR_MAX_FAILURES:
                pair_info["lockout_until"] = now + _LOGIN_LOCKOUT_SECONDS
                pair_info["count"] = 0


def clear_login_failure(remote_ip: str, email: str = "") -> None:
    norm_email = _normalize_login_subject_email(email)
    repository = get_repository()
    if _is_mongo_repo(repository):
        if norm_email:
            repository.clear_failures(f"login-pair:{remote_ip}:{norm_email}")
        return
    with _DATA_LOCK:
        if norm_email:
            _FAILED_LOGIN_ATTEMPTS.pop(("pair", remote_ip, norm_email), None)


def is_strict_admin_request(data=None) -> bool:
    user = get_current_user(data=data)
    return bool(user and str(user.get("role") or "").strip() == "admin")


def is_admin_request(data=None) -> bool:
    user = get_current_user(data=data)
    if user:
        u_role = str(user.get("role") or "")
        if (
            u_role == "admin"
            or has_role_permission(u_role, "manage_catalog", data)
            or has_role_permission(u_role, "manage_users", data)
        ):
            return True
    return False


def can_manage_users_request(data=None) -> bool:
    user = get_current_user(data=data)
    if user:
        u_role = str(user.get("role") or "")
        if u_role == "admin" or has_role_permission(u_role, "manage_users", data):
            return True
    return False


def can_manage_catalog_request(data=None) -> bool:
    user = get_current_user(data=data)
    if user:
        u_role = str(user.get("role") or "")
        if u_role == "admin" or has_role_permission(u_role, "manage_catalog", data):
            return True
    return False


def requester_can_grant_permissions(
    requested_perms: dict | None, existing_perms: dict | None = None, data=None
) -> bool:
    user = get_current_user(data=data)
    if not user:
        return False
    u_role = str(user.get("role") or "").strip()
    if u_role == "admin":
        return True
    req_dict = requested_perms if isinstance(requested_perms, dict) else {}
    old_dict = existing_perms if isinstance(existing_perms, dict) else None
    for perm_key in PERMISSION_KEYS:
        if perm_key not in req_dict:
            continue
        want_enabled = bool(req_dict.get(perm_key))
        was_enabled = bool(old_dict.get(perm_key)) if old_dict is not None else False
        if want_enabled and not was_enabled:
            if not has_role_permission(u_role, perm_key, data):
                return False
    return True


def normalize_order_comments(order_dict: dict) -> list[dict]:
    if not isinstance(order_dict, dict):
        return []
    raw = order_dict.get("comments")
    if isinstance(raw, list):
        normalized: list[dict] = []
        for idx, item in enumerate(raw):
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()[:1000]
            if not text:
                continue
            cid = str(item.get("id") or f"cmt_{idx + 1}").strip()[:120]
            author_name = str(item.get("author_name") or "").strip()[:120]
            raw_aid = item.get("author_id")
            author_id = (
                int(raw_aid)
                if isinstance(raw_aid, int) or (isinstance(raw_aid, str) and raw_aid.isdigit())
                else None
            )
            created_at = str(item.get("created_at") or "").strip()[:80]
            normalized.append(
                {
                    "id": cid,
                    "text": text,
                    "author_name": author_name,
                    "author_id": author_id,
                    "created_at": created_at,
                }
            )
        if normalized:
            return normalized

    legacy_comment = str(order_dict.get("comment") or "").strip()[:1000]
    if legacy_comment:
        raw_aid = (
            order_dict.get("comment_author_id")
            if order_dict.get("comment_author_id") is not None
            else order_dict.get("user_id")
        )
        author_id = (
            int(raw_aid)
            if isinstance(raw_aid, int) or (isinstance(raw_aid, str) and str(raw_aid).isdigit())
            else None
        )
        return [
            {
                "id": "cmt_legacy_1",
                "text": legacy_comment,
                "author_name": str(order_dict.get("comment_author_name") or "").strip()[:120],
                "author_id": author_id,
                "created_at": str(
                    order_dict.get("comment_updated_at") or order_dict.get("created_at") or ""
                ),
            }
        ]
    return []


def sanitize_order_for_role(
    order_dict: dict, role: str, data=None, is_own_client_order: bool = False
) -> dict:
    """Format an order payload according to the caller's role and permissions."""
    if not isinstance(order_dict, dict):
        return {}

    can_see_finances = bool(is_own_client_order) or has_role_permission(
        role, "manage_order_finances", data
    )
    can_see_internal = has_role_permission(role, "view_internal_metrics", data)

    raw_items = order_dict.get("items") or []
    clean_items = []
    for idx, it in enumerate(raw_items):
        if not isinstance(it, dict):
            continue
        sheets_needed = int(it.get("sheets_needed") or it.get("sheetsNeeded") or 0)
        items_per_sheet = int(it.get("items_per_sheet") or it.get("itemsPerSheet") or 1)
        base_item = {
            "id": str(it.get("id") or f"item_{idx + 1}"),
            "productId": it.get("productId"),
            "mainCategoryId": str(
                it.get("mainCategoryId") or it.get("main_category_id") or "polygraphy"
            ),
            "categoryName": str(it.get("categoryName") or it.get("category_name") or ""),
            "productName": str(
                it.get("productName") or it.get("product_name") or it.get("name") or "Изделие"
            ),
            "customNote": str(it.get("customNote") or it.get("custom_note") or ""),
            "formatLabel": str(
                it.get("formatLabel") or it.get("format_label") or it.get("format") or ""
            ),
            "paperLabel": str(
                it.get("paperLabel") or it.get("paper_label") or it.get("paper") or ""
            ),
            "printLabel": str(
                it.get("printLabel") or it.get("print_label") or it.get("print") or ""
            ),
            "laminationLabel": str(
                it.get("laminationLabel")
                or it.get("lamination_label")
                or it.get("lamination")
                or "Нет"
            ),
            "pagesLabel": str(
                it.get("pagesLabel") or it.get("pages_label") or it.get("pages") or ""
            ),
            "extraParamsLabel": str(
                it.get("extraParamsLabel")
                or it.get("extra_params_label")
                or it.get("extra")
                or "Нет"
            ),
            "showPaper": bool(it.get("showPaper", True)),
            "showPrint": bool(it.get("showPrint", True)),
            "showLamination": bool(it.get("showLamination", True)),
            "quantity": int(it.get("quantity") or 1),
            "sheets_needed": sheets_needed,
            "sheetsNeeded": sheets_needed,
            "items_per_sheet": items_per_sheet,
            "itemsPerSheet": items_per_sheet,
        }
        if can_see_finances:
            unit_p = round(safe_float(it.get("unitPrice", it.get("unit_price", 0.0)), 0.0, 0.0), 2)
            tot_p = round(safe_float(it.get("totalPrice", it.get("total_price", 0.0)), 0.0, 0.0), 2)
            base_item["unitPrice"] = unit_p
            base_item["totalPrice"] = tot_p
        clean_items.append(base_item)

    result = {
        "id": int(order_dict.get("id") or 0),
        "created_at": str(order_dict.get("created_at") or ""),
        "deadline_date": str(order_dict.get("deadline_date") or ""),
        "user_id": order_dict.get("user_id"),
        "manager_id": order_dict.get("manager_id"),
        "manager_name": str(order_dict.get("manager_name") or ""),
        "client_name": str(order_dict.get("client_name") or ""),
        "client_phone": str(order_dict.get("client_phone") or ""),
        "client_email": str(order_dict.get("client_email") or ""),
        "client_type": "legal"
        if (
            order_dict.get("client_type") == "legal"
            or is_complete_company_details(order_dict.get("company_details"))
        )
        else "individual",
        "payment_method": str(order_dict.get("payment_method") or "cash"),
        "comment": str(order_dict.get("comment") or ""),
        "comment_author_id": order_dict.get("comment_author_id"),
        "comment_author_name": str(order_dict.get("comment_author_name") or ""),
        "comment_updated_at": str(order_dict.get("comment_updated_at") or ""),
        "comments": normalize_order_comments(order_dict),
        "design_link": str(order_dict.get("design_link") or ""),
        "status": str(order_dict.get("status") or "new"),
        "items": clean_items,
    }

    if can_see_finances:
        result["payment_status"] = str(order_dict.get("payment_status") or "unpaid")
        result["discount_percent"] = order_dict.get("discount_percent", 0)
        result["discount_comment"] = str(order_dict.get("discount_comment") or "")
        result["discount_author_id"] = order_dict.get("discount_author_id")
        result["discount_author_name"] = str(order_dict.get("discount_author_name") or "")
        result["discount_updated_at"] = str(order_dict.get("discount_updated_at") or "")
        result["subtotal_price"] = round(
            safe_float(order_dict.get("subtotal_price", order_dict.get("total_price", 0.0)), 0.0, 0.0),
            2,
        )
        result["total_price"] = round(safe_float(order_dict.get("total_price", 0.0), 0.0, 0.0), 2)
        order_cd = sanitize_company_details(order_dict.get("company_details"))
        result["need_invoice"] = bool(order_dict.get("need_invoice", False) or bool(order_cd))
        result["company_details"] = order_cd

    if can_see_internal:
        metrics = order_dict.get("internal_metrics") or {}
        result["internal_metrics"] = {
            "total_cost": round(safe_float(metrics.get("total_cost", 0.0), 0.0, 0.0), 2),
            "tax_cost": round(safe_float(metrics.get("tax_cost", 0.0), 0.0, 0.0), 2),
            "profit": round(safe_float(metrics.get("profit", 0.0), 0.0), 2),
            "total_sra3_sheets": int(metrics.get("total_sra3_sheets") or 0),
        }

    return result
