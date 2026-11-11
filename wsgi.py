"""Production WSGI entrypoint for Gunicorn (Linux/macOS) and Waitress (Windows/Linux).

Examples:
    # Single-worker multi-threaded Gunicorn (compatible with DATA_BACKEND=json or mongo):
    gunicorn --chdir backend --workers 1 --threads 8 --bind 0.0.0.0:5000 wsgi:application

    # Multi-worker Gunicorn (requires DATA_BACKEND=mongo):
    DATA_BACKEND=mongo gunicorn --chdir backend --workers 4 --threads 4 --bind 0.0.0.0:5000 wsgi:application

    # Cross-platform Waitress server:
    python backend/wsgi.py
"""
from __future__ import annotations

import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


def detect_configured_workers(argv: list[str] | None = None, env: dict | None = None) -> int:
    environ = env if env is not None else os.environ
    args = list(argv if argv is not None else sys.argv)

    for env_key in ("WEB_CONCURRENCY", "GUNICORN_WORKERS"):
        raw_val = str(environ.get(env_key) or "").strip()
        if raw_val.isdigit():
            return max(1, int(raw_val))

    cmd_args = str(environ.get("GUNICORN_CMD_ARGS") or "")
    combined = " ".join(args) + " " + cmd_args
    match = re.search(r"(?:--workers|-w)(?:=|\s+)(\d+)", combined)
    if match:
        return max(1, int(match.group(1)))
    return 1


def enforce_multiworker_safety(
    data_backend: str | None = None,
    argv: list[str] | None = None,
    env: dict | None = None,
) -> None:
    environ = env if env is not None else os.environ
    backend = (data_backend or environ.get("DATA_BACKEND", "json")).strip().lower()
    workers = detect_configured_workers(argv=argv, env=environ)
    if backend == "json" and workers > 1:
        raise RuntimeError(
            f"Unsafe deployment configuration: DATA_BACKEND='json' cannot run with {workers} worker processes "
            "because file locking (_DATA_LOCK) and in-memory rate limits are process-local. "
            "Either run a single multi-threaded worker (--workers 1 --threads 8) or set DATA_BACKEND='mongo'."
        )


enforce_multiworker_safety()

from app import app  # noqa: E402

application = app


if __name__ == "__main__":
    from waitress import serve

    host = os.environ.get("PRINT_CALC_BIND_HOST", "0.0.0.0").strip() or "0.0.0.0"
    port = int(os.environ.get("PORT", "5000"))
    threads = max(2, int(os.environ.get("WAITRESS_THREADS", "8")))
    serve(application, host=host, port=port, threads=threads)
