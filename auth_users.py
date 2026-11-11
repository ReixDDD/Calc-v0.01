"""Authentication, profile management, user administration, and RBAC roles routes."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request

from core import (
    _EMAIL_RE,
    _ROLE_ID_RE,
    allow_auth_request,
    can_manage_users_request,
    check_login_rate_limit,
    clear_login_failure,
    generate_auth_token,
    get_client_ip,
    get_current_user,
    is_strict_admin_request,
    record_login_failure,
    requester_can_grant_permissions,
    sync_after_repo_write,
    verify_recaptcha_token,
)
from repository import RepositoryError
from storage import (
    _DATA_LOCK,
    COMPANY_DETAIL_KEYS,
    MAX_PASSWORD_LENGTH,
    get_repository,
    get_roles_list,
    get_roles_map,
    has_role_permission,
    hash_password,
    is_complete_company_details,
    load_data,
    normalize_allowed_order_statuses,
    normalize_role_permissions,
    normalize_roles_list,
    sanitize_company_details,
    sanitize_user_discount_fields,
    sanitize_user_public,
    save_data,
    validate_password_policy,
    verify_password,
)

auth_users_bp = Blueprint("auth_users", __name__)


def _verify_pw(stored_hash: str, password: str) -> tuple[bool, bool]:
    """Delegate through app.verify_password when present so test patches on app work."""
    app_mod = sys.modules.get("app")
    fn = getattr(app_mod, "verify_password", verify_password)
    return fn(stored_hash, password)


def _hash_pw(password: str) -> str:
    app_mod = sys.modules.get("app")
    fn = getattr(app_mod, "hash_password", hash_password)
    return fn(password)


@auth_users_bp.route("/api/auth/register", methods=["POST"])
def auth_register():
    client_ip = get_client_ip()
    if not allow_auth_request(client_ip, "register", max_requests=5, window_seconds=60):
        return (
            jsonify({"error": "Слишком много попыток регистрации. Пожалуйста, подождите минуту."}),
            429,
        )

    body = request.get_json(silent=True) or {}
    ok_captcha, captcha_err = verify_recaptcha_token(body, client_ip)
    if not ok_captcha:
        return jsonify({"error": captcha_err}), 400

    first_name = str(body.get("first_name") or "").strip()[:80]
    last_name = str(body.get("last_name") or "").strip()[:80]
    name = str(body.get("name") or "").strip()[:120]
    phone = str(body.get("phone") or "").strip()[:60]
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")

    if not email or not _EMAIL_RE.match(email):
        return jsonify({"error": "Введите корректный адрес электронной почты (Email)"}), 400
    pw_err = validate_password_policy(password)
    if pw_err:
        return jsonify({"error": pw_err}), 400

    if not first_name and not last_name and name:
        parts = name.split(None, 1)
        first_name = (parts[0] if parts else "")[:80]
        last_name = (parts[1] if len(parts) > 1 else "")[:80]
    combined_name = f"{first_name} {last_name}".strip()
    if combined_name:
        name = combined_name[:120]
    elif not name:
        name = email.split("@")[0]
        if not first_name:
            first_name = name[:80]

    with _DATA_LOCK:
        repository = get_repository()
        if repository.get_user_by_email(email):
            return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400

    pw_hash = _hash_pw(password)

    with _DATA_LOCK:
        repository = get_repository()
        if repository.get_user_by_email(email):
            return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400

        new_user = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name": name[:120],
            "phone": phone,
            "password_hash": pw_hash,
            "token_version": 0,
            "role": "client",
            "is_email_verified": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "company_details": sanitize_company_details(body.get("company_details")),
        }
        try:
            new_user = repository.create_user(new_user)
            sync_after_repo_write(repository)
        except Exception as exc:
            if isinstance(exc, RepositoryError) and "duplicate" in str(exc).lower():
                return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400
            if "duplicate" in str(exc).lower():
                return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400
            raise

        data = load_data()
        token = generate_auth_token(new_user)
        return jsonify({"token": token, "user": sanitize_user_public(new_user, data=data)}), 201


@auth_users_bp.route("/api/auth/login", methods=["POST"])
def auth_login():
    client_ip = get_client_ip()
    body = request.get_json(silent=True) or {}
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")

    rate_subject = f"{client_ip}:{email[:160]}" if email else client_ip
    if not allow_auth_request(
        client_ip, "login_ip", max_requests=60, window_seconds=60
    ) or not allow_auth_request(rate_subject, "login", max_requests=10, window_seconds=60):
        return (
            jsonify({"error": "Слишком много запросов на вход. Пожалуйста, подождите минуту."}),
            429,
        )
    if not check_login_rate_limit(client_ip, email):
        return jsonify({"error": "Превышен лимит попыток входа. Попробуйте позже."}), 403

    ok_captcha, captcha_err = verify_recaptcha_token(body, client_ip)
    if not ok_captcha:
        return jsonify({"error": captcha_err}), 400

    if not email or not password:
        return jsonify({"error": "Введите Email и пароль"}), 400

    if len(password) > MAX_PASSWORD_LENGTH:
        record_login_failure(client_ip, email)
        return jsonify({"error": "Неверный Email или пароль"}), 401

    with _DATA_LOCK:
        repository = get_repository()
        matched_user = repository.get_user_by_email(email)
        if not matched_user:
            record_login_failure(client_ip, email)
            return jsonify({"error": "Неверный Email или пароль"}), 401
        target_id = int(matched_user.get("id") or 0)
        stored_hash = str(matched_user.get("password_hash") or "")

    # Run CPU-intensive Argon2id / PBKDF2 verification outside global _DATA_LOCK
    ok_pw, needs_rehash = _verify_pw(stored_hash, password)
    if not ok_pw:
        record_login_failure(client_ip, email)
        return jsonify({"error": "Неверный Email или пароль"}), 401
    upgraded_hash = _hash_pw(password) if needs_rehash else None

    with _DATA_LOCK:
        repository = get_repository()
        current_user = repository.get_user_by_id(target_id)
        if (
            not current_user
            or str(current_user.get("email") or "").strip().lower() != email
            or str(current_user.get("password_hash") or "") != stored_hash
        ):
            record_login_failure(client_ip, email)
            return jsonify({"error": "Неверный Email или пароль"}), 401

        if upgraded_hash:
            updated = repository.update_user(target_id, {"password_hash": upgraded_hash})
            if updated:
                current_user = updated
            sync_after_repo_write(repository)

        data = load_data()
        clear_login_failure(client_ip, email)
        token = generate_auth_token(current_user)
        return jsonify({"token": token, "user": sanitize_user_public(current_user, data=data)})


@auth_users_bp.route("/api/auth/me", methods=["GET"])
def auth_me():
    with _DATA_LOCK:
        data = load_data()
        user = get_current_user(data=data)
        if not user:
            return jsonify({"error": "Не авторизован"}), 401
        return jsonify({"user": sanitize_user_public(user, data=data)})


@auth_users_bp.route("/api/auth/profile", methods=["PUT"])
def auth_update_profile():
    body = request.get_json(silent=True) or {}
    new_pw = str(body.get("password") or body.get("new_password") or "")
    if new_pw:
        pw_err = validate_password_policy(new_pw, "Новый пароль")
        if pw_err:
            return jsonify({"error": pw_err}), 400

    with _DATA_LOCK:
        repository = get_repository()
        auth_user = get_current_user()
        if not auth_user:
            return jsonify({"error": "Необходима авторизация"}), 401
        snap_user = repository.get_user_by_id(int(auth_user.get("id") or 0))
        if not snap_user:
            return jsonify({"error": "Пользователь не найден"}), 404

        target_id = int(snap_user.get("id") or 0)
        old_email = str(snap_user.get("email") or "").strip().lower()
        stored_hash = str(snap_user.get("password_hash") or "")
        initial_token_version = int(snap_user.get("token_version") or 0)

    email_changed = False
    if "email" in body:
        cand_email = str(body.get("email") or "").strip().lower()
        if not cand_email or not _EMAIL_RE.match(cand_email):
            return jsonify({"error": "Введите корректный адрес электронной почты (Email)"}), 400
        email_changed = cand_email != old_email

    # Run KDF verification and hashing outside global _DATA_LOCK
    new_pw_hash = None
    if new_pw or email_changed:
        curr_pw = str(body.get("current_password") or "")
        if not curr_pw:
            return (
                jsonify(
                    {
                        "error": "Для смены пароля или Email необходимо подтвердить текущий пароль"
                    }
                ),
                400,
            )
        ok_curr, _ = _verify_pw(stored_hash, curr_pw)
        if not ok_curr:
            return jsonify({"error": "Неверный текущий пароль"}), 400
        if new_pw:
            new_pw_hash = _hash_pw(new_pw)

    with _DATA_LOCK:
        repository = get_repository()
        target = repository.get_user_by_id(target_id)
        if not target:
            return jsonify({"error": "Пользователь не найден"}), 404
        if (
            int(target.get("token_version") or 0) != initial_token_version
            or str(target.get("password_hash") or "") != stored_hash
        ):
            return (
                jsonify(
                    {"error": "Данные профиля были изменены в другой сессии. Обновите страницу."}
                ),
                409,
            )

        patch: dict = {}
        if "email" in body:
            new_email = str(body.get("email") or "").strip().lower()
            duplicate = repository.get_user_by_email(new_email)
            if duplicate and int(duplicate.get("id") or 0) != target_id:
                return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400
            patch["email"] = new_email

        has_fl = False
        if "first_name" in body:
            patch["first_name"] = str(body.get("first_name") or "").strip()[:80]
            has_fl = True
        if "last_name" in body:
            patch["last_name"] = str(body.get("last_name") or "").strip()[:80]
            has_fl = True
        if has_fl:
            fn = patch.get("first_name", target.get("first_name") or "")
            ln = patch.get("last_name", target.get("last_name") or "")
            combined = f"{fn} {ln}".strip()
            if combined:
                patch["name"] = combined[:120]
        elif "name" in body:
            new_name = str(body.get("name") or "").strip()[:120]
            if new_name:
                patch["name"] = new_name
                parts = new_name.split(None, 1)
                patch["first_name"] = (parts[0] if parts else "")[:80]
                patch["last_name"] = (parts[1] if len(parts) > 1 else "")[:80]

        current_cd = (
            dict(target.get("company_details") or {})
            if isinstance(target.get("company_details"), dict)
            else {}
        )
        if "company_details" in body and isinstance(body.get("company_details"), dict):
            incoming_cd = body.get("company_details") or {}
            current_cd = {
                k: (
                    str(incoming_cd.get(k) or "").strip()[:300]
                    if k in incoming_cd
                    else str(current_cd.get(k) or "").strip()[:300]
                )
                for k in COMPANY_DETAIL_KEYS
            }

        if "phone" in body:
            new_phone = str(body.get("phone") or "").strip()[:60]
            patch["phone"] = new_phone
            if "company_details" not in body or "phone" not in (body.get("company_details") or {}):
                if current_cd:
                    current_cd["phone"] = new_phone
        elif current_cd.get("phone") and not target.get("phone"):
            patch["phone"] = str(current_cd.get("phone") or "").strip()[:60]

        if "company_details" in body and isinstance(body.get("company_details"), dict):
            has_any_cd = any(bool(str(current_cd.get(k) or "").strip()) for k in COMPANY_DETAIL_KEYS)
            if has_any_cd and not is_complete_company_details(current_cd):
                return (
                    jsonify(
                        {
                            "error": "Для получения статуса юридического лица необходимо заполнить все поля реквизитов компании"
                        }
                    ),
                    400,
                )

        patch["company_details"] = sanitize_company_details(current_cd)
        patch["client_type"] = (
            "legal" if is_complete_company_details(patch["company_details"]) else "individual"
        )
        if new_pw_hash:
            patch["password_hash"] = new_pw_hash
        if email_changed or bool(new_pw_hash):
            patch["token_version"] = int(target.get("token_version") or 0) + 1

        updated = repository.update_user(target_id, patch)
        sync_after_repo_write(repository)
        data = load_data()
        updated_user = updated or target
        token = generate_auth_token(updated_user)
        pub_user = sanitize_user_public(updated_user, data=data)
        return jsonify({"token": token, "user": pub_user, **pub_user})


@auth_users_bp.route("/api/admin/users", methods=["GET", "POST"])
def admin_users_collection():
    if request.method == "GET":
        with _DATA_LOCK:
            data = load_data()
            if not can_manage_users_request(data):
                return jsonify({"error": "Доступ запрещен"}), 403
            repository = get_repository()
            return jsonify([sanitize_user_public(u, data=data) for u in repository.list_users()])

    body = request.get_json(silent=True) or {}
    first_name = str(body.get("first_name") or "").strip()[:80]
    last_name = str(body.get("last_name") or "").strip()[:80]
    name = str(body.get("name") or "").strip()[:120]
    phone = str(body.get("phone") or "").strip()[:60]
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    role = str(body.get("role") or "manager").strip()

    with _DATA_LOCK:
        pre_data = load_data()
        if not can_manage_users_request(pre_data):
            return jsonify({"error": "Доступ запрещен"}), 403
        pre_roles_map = get_roles_map(pre_data)
        if role not in pre_roles_map:
            return jsonify({"error": "Недопустимая роль пользователя"}), 400
        if not is_strict_admin_request(pre_data):
            if role == "admin" or not requester_can_grant_permissions(
                pre_roles_map[role].get("permissions"), None, data=pre_data
            ):
                return (
                    jsonify(
                        {
                            "error": "Недостаточно прав для назначения роли с указанными полномочиями"
                        }
                    ),
                    403,
                )
        if not email or not _EMAIL_RE.match(email):
            return jsonify({"error": "Введите корректный адрес электронной почты (Email)"}), 400
        pw_err = validate_password_policy(password)
        if pw_err:
            return jsonify({"error": pw_err}), 400
        pre_repo = get_repository()
        if pre_repo.get_user_by_email(email):
            return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400

    if not first_name and not last_name and name:
        parts = name.split(None, 1)
        first_name = (parts[0] if parts else "")[:80]
        last_name = (parts[1] if len(parts) > 1 else "")[:80]

    combined_name = f"{first_name} {last_name}".strip()
    if combined_name:
        name = combined_name[:120]
    elif not name:
        name = email.split("@")[0]
        if not first_name:
            first_name = name[:80]

    discount_fields = sanitize_user_discount_fields(body)
    pw_hash = _hash_pw(password)

    with _DATA_LOCK:
        data = load_data()
        if not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        roles_map = get_roles_map(data)
        if role not in roles_map:
            return jsonify({"error": "Недопустимая роль пользователя"}), 400
        if not is_strict_admin_request(data):
            if role == "admin" or not requester_can_grant_permissions(
                roles_map[role].get("permissions"), None, data=data
            ):
                return (
                    jsonify(
                        {
                            "error": "Недостаточно прав для назначения роли с указанными полномочиями"
                        }
                    ),
                    403,
                )
        repository = get_repository()
        if repository.get_user_by_email(email):
            return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400
        new_user = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name": name[:120],
            "phone": phone,
            "password_hash": pw_hash,
            "token_version": 0,
            "role": role,
            "is_email_verified": bool(body.get("is_email_verified", True)),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "company_details": sanitize_company_details(body.get("company_details")),
            **discount_fields,
        }
        try:
            new_user = repository.create_user(new_user)
        except Exception as exc:
            if "duplicate" in str(exc).lower():
                return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400
            raise
        sync_after_repo_write(repository)
        return jsonify(sanitize_user_public(new_user, data=load_data())), 201


@auth_users_bp.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def admin_update_user(user_id):
    body = request.get_json(silent=True) or {}
    new_pw = str(body.get("password") or body.get("new_password") or "")
    new_pw_hash = None
    if new_pw:
        with _DATA_LOCK:
            pre_data = load_data()
            if not can_manage_users_request(pre_data):
                return jsonify({"error": "Доступ запрещен"}), 403
        pw_err = validate_password_policy(new_pw)
        if pw_err:
            return jsonify({"error": pw_err}), 400
        new_pw_hash = _hash_pw(new_pw)

    with _DATA_LOCK:
        data = load_data()
        if not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        strict_admin = is_strict_admin_request(data)
        roles_map = get_roles_map(data)
        repository = get_repository()
        target_user = repository.get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "Пользователь не найден"}), 404
        if target_user.get("role") == "admin" and not strict_admin:
            return (
                jsonify(
                    {
                        "error": "Только главный администратор может изменять учётную запись Администратора"
                    }
                ),
                403,
            )

        patch: dict = {}
        role_changed = False
        email_changed = False

        if "role" in body:
            new_role = str(body.get("role") or "").strip()
            if new_role not in roles_map:
                return jsonify({"error": "Недопустимая роль пользователя"}), 400
            if not strict_admin and (
                new_role == "admin"
                or (
                    new_role != str(target_user.get("role") or "")
                    and not requester_can_grant_permissions(
                        roles_map[new_role].get("permissions"), None, data=data
                    )
                )
            ):
                return jsonify({"error": "Недостаточно прав для назначения выбранной роли"}), 403
            if (
                target_user.get("role") == "admin"
                and new_role != "admin"
                and repository.count_users_by_role("admin") <= 1
            ):
                return (
                    jsonify({"error": "Нельзя понизить роль единственного администратора"}),
                    400,
                )
            patch["role"] = new_role
            role_changed = True

        if "email" in body:
            email = str(body.get("email") or "").strip().lower()
            if not email or not _EMAIL_RE.match(email):
                return jsonify({"error": "Введите корректный адрес электронной почты (Email)"}), 400
            duplicate = repository.get_user_by_email(email)
            if duplicate and int(duplicate.get("id") or 0) != user_id:
                return jsonify({"error": "Пользователь с таким Email уже зарегистрирован"}), 400
            email_changed = email != str(target_user.get("email") or "").strip().lower()
            patch["email"] = email

        has_fl = False
        if "first_name" in body:
            patch["first_name"] = str(body.get("first_name") or "").strip()[:80]
            has_fl = True
        if "last_name" in body:
            patch["last_name"] = str(body.get("last_name") or "").strip()[:80]
            has_fl = True

        if has_fl:
            fn = patch.get("first_name", target_user.get("first_name") or "")
            ln = patch.get("last_name", target_user.get("last_name") or "")
            combined = f"{fn} {ln}".strip()
            if combined:
                patch["name"] = combined[:120]
            elif "name" in body and str(body.get("name") or "").strip():
                patch["name"] = str(body.get("name")).strip()[:120]
        elif "name" in body and str(body.get("name") or "").strip():
            new_name = str(body.get("name")).strip()[:120]
            patch["name"] = new_name
            parts = new_name.split(None, 1)
            patch["first_name"] = (parts[0] if parts else "")[:80]
            patch["last_name"] = (parts[1] if len(parts) > 1 else "")[:80]

        if "phone" in body:
            patch["phone"] = str(body.get("phone") or "").strip()[:60]
        if "is_email_verified" in body:
            patch["is_email_verified"] = bool(body["is_email_verified"])
        if any(
            k in body
            for k in (
                "discount_percent",
                "discount_scope",
                "discount_main_categories",
                "discount_categories",
                "discount_products",
            )
        ):
            patch.update(sanitize_user_discount_fields({**target_user, **body}))
        if new_pw_hash:
            patch["password_hash"] = new_pw_hash
        if role_changed or bool(new_pw_hash) or email_changed:
            patch["token_version"] = int(target_user.get("token_version") or 0) + 1

        updated = repository.update_user(user_id, patch)
        sync_after_repo_write(repository)
        return jsonify(sanitize_user_public(updated or target_user, data=load_data()))


@auth_users_bp.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def admin_delete_user(user_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        strict_admin = is_strict_admin_request(data)
        repository = get_repository()
        target_user = repository.get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "Пользователь не найден"}), 404
        if target_user.get("role") == "admin":
            if not strict_admin:
                return (
                    jsonify(
                        {
                            "error": "Только главный администратор может удалять учётную запись Администратора"
                        }
                    ),
                    403,
                )
            if repository.count_users_by_role("admin") <= 1:
                return jsonify({"error": "Нельзя удалить единственного администратора"}), 400
        if not repository.delete_user(user_id):
            return jsonify({"error": "Пользователь не найден"}), 404
        sync_after_repo_write(repository)
        return jsonify({"status": "deleted", "id": user_id})


@auth_users_bp.route("/api/admin/roles", methods=["GET", "POST"])
def admin_roles_collection():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        roles_list = get_roles_list(data)

        if request.method == "GET":
            return jsonify(roles_list)

        body = request.get_json(silent=True) or {}
        raw_name = str(body.get("name") or "").strip()[:80]
        if not raw_name:
            return jsonify({"error": "Укажите название роли"}), 400

        existing_ids = {r["id"] for r in roles_list}
        existing_names_low = {str(r["name"]).strip().lower() for r in roles_list}
        if raw_name.lower() in existing_names_low:
            return jsonify({"error": "Роль с таким названием уже существует"}), 400

        raw_id = str(body.get("id") or "").strip().lower()
        if raw_id:
            if not _ROLE_ID_RE.match(raw_id):
                return (
                    jsonify(
                        {"error": "Код роли должен содержать от 2 до 40 символов (a-z, 0-9, _)"}
                    ),
                    400,
                )
            if raw_id in existing_ids:
                return jsonify({"error": "Роль с таким кодом уже существует"}), 400
            role_id = raw_id
        else:
            idx = len(existing_ids) + 1
            role_id = f"role_{idx}"
            while role_id in existing_ids:
                idx += 1
                role_id = f"role_{idx}"

        normalized_perms = normalize_role_permissions(body.get("permissions"), force_all_true=False)
        if not requester_can_grant_permissions(normalized_perms, None, data=data):
            return (
                jsonify(
                    {
                        "error": "Недостаточно прав: нельзя выдавать полномочия, которыми не обладает ваша роль"
                    }
                ),
                403,
            )

        new_role = {
            "id": role_id,
            "name": raw_name,
            "is_system": False,
            "permissions": normalized_perms,
            "allowed_order_statuses": normalize_allowed_order_statuses(
                body.get("allowed_order_statuses"), role_id=role_id
            ),
        }
        roles_list.append(new_role)
        settings = data.setdefault("settings", {})
        settings["roles"] = normalize_roles_list(roles_list)
        settings["role_permissions"] = {r["id"]: dict(r["permissions"]) for r in settings["roles"]}
        settings["role_order_statuses"] = {
            r["id"]: list(r["allowed_order_statuses"]) for r in settings["roles"]
        }
        save_data(data)
        created = next((r for r in settings["roles"] if r["id"] == role_id), new_role)
        return jsonify(created), 201


@auth_users_bp.route("/api/admin/roles/<string:role_id>", methods=["PUT"])
def admin_update_role(role_id):
    if role_id == "client":
        return (
            jsonify({"error": "Базовой роли Клиент нельзя выдавать служебные права доступа"}),
            400,
        )

    body = request.get_json(silent=True) or {}
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        if role_id == "admin" and not is_strict_admin_request(data):
            return (
                jsonify(
                    {"error": "Только главный администратор может изменять роль Администратора"}
                ),
                403,
            )

        roles_list = get_roles_list(data)
        target_role = next((r for r in roles_list if r["id"] == role_id), None)
        if not target_role:
            return jsonify({"error": "Роль не найдена"}), 404

        if (
            "permissions" in body
            and isinstance(body.get("permissions"), dict)
            and role_id != "admin"
        ):
            merged_candidate = dict(target_role.get("permissions") or {})
            merged_candidate.update(body["permissions"])
            normalized_candidate = normalize_role_permissions(
                merged_candidate, force_all_true=False
            )
            if not requester_can_grant_permissions(
                normalized_candidate, target_role.get("permissions"), data=data
            ):
                return (
                    jsonify(
                        {
                            "error": "Недостаточно прав: нельзя выдавать полномочия, которыми не обладает ваша роль"
                        }
                    ),
                    403,
                )

        if "name" in body:
            new_name = str(body.get("name") or "").strip()[:80]
            if new_name:
                if any(
                    r["id"] != role_id
                    and str(r.get("name") or "").strip().lower() == new_name.lower()
                    for r in roles_list
                ):
                    return jsonify({"error": "Роль с таким названием уже существует"}), 400
                target_role["name"] = new_name

        if "permissions" in body and isinstance(body.get("permissions"), dict):
            if role_id == "admin":
                target_role["permissions"] = normalize_role_permissions({}, force_all_true=True)
            else:
                merged_p = dict(target_role.get("permissions") or {})
                merged_p.update(body["permissions"])
                target_role["permissions"] = normalize_role_permissions(
                    merged_p, force_all_true=False
                )

        if "allowed_order_statuses" in body and isinstance(
            body.get("allowed_order_statuses"), list
        ):
            target_role["allowed_order_statuses"] = normalize_allowed_order_statuses(
                body["allowed_order_statuses"],
                role_id=role_id,
                force_all=(role_id == "admin"),
                force_empty=(role_id == "client"),
            )

        settings = data.setdefault("settings", {})
        settings["roles"] = normalize_roles_list(roles_list)
        settings["role_permissions"] = {r["id"]: dict(r["permissions"]) for r in settings["roles"]}
        settings["role_order_statuses"] = {
            r["id"]: list(r["allowed_order_statuses"]) for r in settings["roles"]
        }
        save_data(data)
        updated = next((r for r in settings["roles"] if r["id"] == role_id), target_role)
        return jsonify(updated)


@auth_users_bp.route("/api/admin/roles/<string:role_id>", methods=["DELETE"])
def admin_delete_role(role_id):
    if role_id in ("admin", "client"):
        return (
            jsonify(
                {"error": "Базовые системные роли Администратор и Клиент нельзя удалить"}
            ),
            400,
        )

    with _DATA_LOCK:
        data = load_data()
        if not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        roles_list = get_roles_list(data)
        target_role = next((r for r in roles_list if r["id"] == role_id), None)
        if not target_role:
            return jsonify({"error": "Роль не найдена"}), 404
        if target_role.get("is_system") and not is_strict_admin_request(data):
            return (
                jsonify(
                    {"error": "Системную роль может удалить только главный администратор"}
                ),
                403,
            )

        repository = get_repository()
        repository.reassign_users_role(role_id, "client")
        sync_after_repo_write(repository)

        data = load_data()
        roles_list = get_roles_list(data)
        remaining_roles = [r for r in roles_list if r["id"] != role_id]
        settings = data.setdefault("settings", {})
        settings["roles"] = normalize_roles_list(remaining_roles)
        settings["role_permissions"] = {r["id"]: dict(r["permissions"]) for r in settings["roles"]}
        settings["role_order_statuses"] = {
            r["id"]: list(r["allowed_order_statuses"]) for r in settings["roles"]
        }
        save_data(data)
        return jsonify({"status": "deleted", "id": role_id})


@auth_users_bp.route("/api/manager/auth", methods=["POST"])
def verify_manager_pin():
    with _DATA_LOCK:
        data = load_data()
        user = get_current_user(data=data)
        if user:
            u_role = str(user.get("role") or "client").strip()
            if (
                u_role in ("manager", "admin")
                or has_role_permission(u_role, "manage_kp", data)
                or has_role_permission(u_role, "apply_discounts", data)
                or has_role_permission(u_role, "view_crm", data)
            ):
                return jsonify({"status": "ok", "role": u_role})
        return (
            jsonify(
                {
                    "error": "Доступ запрещен. Войдите под личной учётной записью сотрудника."
                }
            ),
            403,
        )
