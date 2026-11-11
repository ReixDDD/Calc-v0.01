"""Admin catalog CRUD, settings, image upload, and database export/import routes."""
from __future__ import annotations

import json
import os
import uuid
from flask import Blueprint, Response, current_app, jsonify, request
from werkzeug.utils import secure_filename

from core import (
    _EMAIL_RE,
    _MAX_IMPORT_BYTES,
    _MAX_UPLOAD_FILE_BYTES,
    _MAX_UPLOAD_FILES,
    can_manage_catalog_request,
    can_manage_users_request,
    get_current_user,
    is_admin_request,
    is_strict_admin_request,
    requester_can_grant_permissions,
    sanitize_order_for_role,
    strip_legacy_pins,
)
from storage import (
    _DATA_LOCK,
    ALLOWED_EXTENSIONS,
    INITIAL_MATERIAL_CATEGORIES,
    UPLOAD_FOLDER,
    get_default_main_cat_params,
    get_default_tiers_for_cat,
    get_public_catalog_dict,
    get_repository,
    get_roles_list,
    get_roles_map,
    has_role_permission,
    infer_material_group,
    infer_paper_color,
    infer_wide_format_roll_dimensions,
    invalidate_all_caches,
    is_supported_password_hash,
    is_valid_image_header,
    load_data,
    normalize_allowed_order_statuses,
    normalize_cost_params,
    normalize_role_permissions,
    normalize_roles_list,
    replace_full_data,
    safe_float,
    safe_int,
    sanitize_image_url,
    sanitize_user_public,
    save_data,
)

admin_catalog_bp = Blueprint("admin_catalog", __name__)


@admin_catalog_bp.route("/api/admin/upload", methods=["POST"])
def upload_product_images():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403

    files = request.files.getlist("files")
    if not files and "file" in request.files:
        files = [request.files["file"]]

    if len(files) > _MAX_UPLOAD_FILES:
        return jsonify({"error": "Слишком много файлов в одном запросе"}), 400

    uploaded_urls = []
    for f in files:
        if not f or not f.filename:
            continue
        if request.content_length and request.content_length > _MAX_UPLOAD_FILES * _MAX_UPLOAD_FILE_BYTES:
            return jsonify({"error": "Общий размер файлов слишком большой"}), 413
        filename_secure = secure_filename(f.filename)
        ext = os.path.splitext(filename_secure)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue

        header_bytes = f.stream.read(16)
        f.stream.seek(0)
        if not is_valid_image_header(header_bytes, ext):
            continue

        raw_file = f.stream.read(_MAX_UPLOAD_FILE_BYTES + 1)
        if len(raw_file) > _MAX_UPLOAD_FILE_BYTES:
            continue
        f.stream.seek(0)

        unique_name = f"prod_{uuid.uuid4().hex[:12]}{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_name)
        f.save(save_path)
        uploaded_urls.append(f"/uploads/{unique_name}")
    if not uploaded_urls:
        return jsonify({"error": "Не удалось загрузить файлы или недопустимый формат изображения"}), 400

    return jsonify({"urls": uploaded_urls}), 201


@admin_catalog_bp.route("/api/admin/data", methods=["GET"])
def get_admin_data():
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        if not is_admin_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        user = get_current_user(data=data)
        u_role = str((user or {}).get("role") or "client")
        payload = dict(data)
        if isinstance(payload.get("settings"), dict):
            payload["settings"] = strip_legacy_pins(payload["settings"])
        if can_manage_users_request(data):
            payload["users"] = [
                sanitize_user_public(u, data=data)
                for u in repository.list_users()
                if isinstance(u, dict)
            ]
        else:
            payload["users"] = []

        if u_role == "admin" or has_role_permission(u_role, "view_crm", data):
            payload["orders"] = [
                sanitize_order_for_role(o, u_role, data=data)
                for o in repository.list_orders()
                if isinstance(o, dict)
            ]
        else:
            payload["orders"] = []

        payload["catalog"] = get_public_catalog_dict(data)
        payload["security"] = {
            "auth_mode": "bearer",
            "password_kdf": "argon2id",
        }
        payload["db_info"] = {
            "data_dir": "data/",
            "db_file": "data/database.json",
            "uploads_dir": "data/uploads/",
        }
        return jsonify(payload)


@admin_catalog_bp.route("/api/admin/pin", methods=["PUT", "POST"])
def update_admin_pin():
    return (
        jsonify(
            {
                "error": "Аутентификация по PIN-кодам отключена. Используйте персональные учётные записи и пароли."
            }
        ),
        410,
    )


@admin_catalog_bp.route("/api/admin/db/export", methods=["GET"])
def export_database():
    with _DATA_LOCK:
        data = load_data()
        if not is_strict_admin_request(data):
            return (
                jsonify(
                    {
                        "error": "Экспорт полной базы данных доступен только главному администратору"
                    }
                ),
                403,
            )
        repository = get_repository()
        export_payload = dict(data)
        if isinstance(export_payload.get("settings"), dict):
            export_payload["settings"] = strip_legacy_pins(export_payload["settings"])
        export_payload["users"] = repository.list_users()
        export_payload["orders"] = repository.list_orders()
        json_bytes = json.dumps(export_payload, ensure_ascii=False, indent=2).encode("utf-8")
        return Response(
            json_bytes,
            mimetype="application/json; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="print_calculator_database.json"'
            },
        )


def _validate_imported_database(raw_json: dict) -> str | None:
    if "settings" in raw_json and not isinstance(raw_json["settings"], dict):
        return "Поле settings должно быть объектом"
    list_sections = (
        "main_categories",
        "categories",
        "material_categories",
        "items",
        "products",
        "users",
        "orders",
    )
    for section in list_sections:
        if section not in raw_json:
            continue
        items = raw_json[section]
        if not isinstance(items, list):
            return f"Поле {section} должно быть списком"
        if any(not isinstance(it, dict) for it in items):
            return f"Элементы {section} должны быть объектами"
        ids = [it.get("id") for it in items]
        if any(val is None or str(val).strip() == "" for val in ids):
            return f"В разделе {section} обнаружена запись без id"
        str_ids = [str(val) for val in ids]
        if len(str_ids) != len(set(str_ids)):
            return f"В разделе {section} обнаружены дублирующиеся id"
    if "users" in raw_json and isinstance(raw_json["users"], list):
        users_list = raw_json["users"]
        emails = []
        has_admin = False
        for u in users_list:
            if not isinstance(u, dict):
                return "Элементы users должны быть объектами"
            u_email = str(u.get("email") or "").strip().lower()
            if not u_email or not _EMAIL_RE.match(u_email):
                return "В разделе users обнаружен пользователь с некорректным email"
            emails.append(u_email)
            pw_hash = str(u.get("password_hash") or "")
            if not is_supported_password_hash(pw_hash):
                return f"У пользователя {u_email} отсутствует поддерживаемый хеш пароля"
            if str(u.get("role") or "").strip() == "admin":
                has_admin = True
        if len(emails) != len(set(emails)):
            return "В разделе users обнаружены дублирующиеся email"
        if not has_admin:
            return "Импортируемая база данных должна содержать хотя бы одного администратора (role: admin)"
    return None


@admin_catalog_bp.route("/api/admin/db/import", methods=["POST"])
def import_database():
    with _DATA_LOCK:
        current_data = load_data()
        if not is_strict_admin_request(current_data):
            return (
                jsonify(
                    {
                        "error": "Импорт базы данных доступен только главному администратору"
                    }
                ),
                403,
            )

        raw_json = None
        if "file" in request.files and request.files["file"]:
            try:
                raw_bytes = request.files["file"].read(_MAX_IMPORT_BYTES + 1)
                if len(raw_bytes) > _MAX_IMPORT_BYTES:
                    return jsonify({"error": "Файл базы данных слишком большой"}), 413
                raw_json = json.loads(raw_bytes.decode("utf-8"))
            except (UnicodeDecodeError, ValueError, OSError) as exc:
                current_app.logger.warning("Failed to parse imported database file: %s", exc)
                return jsonify({"error": "Некорректный JSON-файл базы данных"}), 400
        else:
            if request.content_length and request.content_length > _MAX_IMPORT_BYTES:
                return jsonify({"error": "Файл базы данных слишком большой"}), 413
            raw_json = request.get_json(silent=True)

        if not isinstance(raw_json, dict) or not any(
            k in raw_json for k in ("settings", "items", "products", "categories", "main_categories")
        ):
            return jsonify({"error": "Файл не содержит структуру базы данных калькулятора"}), 400

        validation_err = _validate_imported_database(raw_json)
        if validation_err:
            return jsonify({"error": validation_err}), 400

        repository = get_repository()
        raw_json.pop("catalog", None)
        raw_json.pop("db_info", None)
        raw_json.pop("security", None)
        if isinstance(raw_json.get("settings"), dict):
            raw_json["settings"] = strip_legacy_pins(raw_json["settings"])
        if "users" not in raw_json:
            raw_json["users"] = repository.list_users()
        if "orders" not in raw_json:
            raw_json["orders"] = repository.list_orders()

        replace_full_data(raw_json)
        invalidate_all_caches()
        migrated = load_data()
        payload = dict(migrated)
        if isinstance(payload.get("settings"), dict):
            payload["settings"] = strip_legacy_pins(payload["settings"])
        payload["users"] = [
            sanitize_user_public(u, data=migrated)
            for u in repository.list_users()
            if isinstance(u, dict)
        ]
        payload["orders"] = [
            sanitize_order_for_role(o, "admin", data=migrated)
            for o in repository.list_orders()
            if isinstance(o, dict)
        ]
        payload["catalog"] = get_public_catalog_dict(migrated)
        payload["security"] = {
            "auth_mode": "bearer",
            "password_kdf": "argon2id",
        }
        payload["db_info"] = {
            "data_dir": "data/",
            "db_file": "data/database.json",
            "uploads_dir": "data/uploads/",
        }
        return jsonify(payload)


@admin_catalog_bp.route("/api/admin/settings", methods=["PUT"])
def update_settings():
    with _DATA_LOCK:
        data = load_data()
        if not is_admin_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        catalog_keys = (
            "sheet_length_m",
            "bleed_mm",
            "defect_percent",
            "tax_percent",
            "usable_width_mm",
            "usable_height_mm",
            "main_category_params",
            "category_markups",
        )
        has_catalog_changes = any(k in body for k in catalog_keys)
        has_role_changes = (
            "roles" in body or "role_permissions" in body or "role_order_statuses" in body
        )
        if has_catalog_changes and not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        if has_role_changes and not can_manage_users_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403

        if has_role_changes and not is_strict_admin_request(data):
            existing_roles_map = get_roles_map(data)
            if "roles" in body and isinstance(body["roles"], list):
                candidate_roles = normalize_roles_list(
                    body["roles"],
                    legacy_role_perms=body.get("role_permissions"),
                    legacy_role_statuses=body.get("role_order_statuses"),
                )
                candidate_ids = {r["id"] for r in candidate_roles}
                for existing_id, existing_role in existing_roles_map.items():
                    if existing_role.get("is_system") and existing_id not in candidate_ids:
                        return (
                            jsonify(
                                {
                                    "error": "Системную роль может удалить только главный администратор"
                                }
                            ),
                            403,
                        )
                for r in candidate_roles:
                    r_id = r["id"]
                    if r_id in ("admin", "client"):
                        continue
                    old_perms = (
                        existing_roles_map[r_id].get("permissions")
                        if r_id in existing_roles_map
                        else None
                    )
                    if not requester_can_grant_permissions(
                        r.get("permissions"), old_perms, data=data
                    ):
                        return (
                            jsonify(
                                {
                                    "error": "Недостаточно прав: нельзя выдавать полномочия, которыми не обладает ваша роль"
                                }
                            ),
                            403,
                        )
            elif "role_permissions" in body and isinstance(body["role_permissions"], dict):
                for r_id, raw_p in body["role_permissions"].items():
                    if r_id in ("admin", "client") or not isinstance(raw_p, dict):
                        continue
                    old_perms = (
                        existing_roles_map[r_id].get("permissions")
                        if r_id in existing_roles_map
                        else None
                    )
                    merged_candidate = dict(old_perms or {})
                    merged_candidate.update(raw_p)
                    norm_cand = normalize_role_permissions(merged_candidate, force_all_true=False)
                    if not requester_can_grant_permissions(norm_cand, old_perms, data=data):
                        return (
                            jsonify(
                                {
                                    "error": "Недостаточно прав: нельзя выдавать полномочия, которыми не обладает ваша роль"
                                }
                            ),
                            403,
                        )

        data["settings"] = strip_legacy_pins(data.get("settings") or {})
        if "sheet_length_m" in body:
            data["settings"]["sheet_length_m"] = safe_float(
                body["sheet_length_m"], 0.5, 0.01, 100.0
            )
        if "bleed_mm" in body:
            data["settings"]["bleed_mm"] = safe_float(body["bleed_mm"], 4.0, 0.0, 100.0)
        if "defect_percent" in body:
            data["settings"]["defect_percent"] = round(
                safe_float(body["defect_percent"], 0.0, 0.0, 100.0), 2
            )
        if "tax_percent" in body:
            data["settings"]["tax_percent"] = round(
                safe_float(body["tax_percent"], 6.0, 0.0, 100.0), 2
            )
        if "usable_width_mm" in body:
            data["settings"]["usable_width_mm"] = safe_float(
                body["usable_width_mm"], 310.0, 50.0, 5000.0
            )
        if "usable_height_mm" in body:
            data["settings"]["usable_height_mm"] = safe_float(
                body["usable_height_mm"], 440.0, 50.0, 5000.0
            )
        if "main_category_params" in body and isinstance(body["main_category_params"], dict):
            mc_params_store = data["settings"].setdefault("main_category_params", {})
            for mc_id, raw_p in body["main_category_params"].items():
                if not isinstance(raw_p, dict):
                    continue
                cleaned_p = dict(
                    mc_params_store.get(mc_id)
                    or get_default_main_cat_params(mc_id, data["settings"])
                )
                for k, v in raw_p.items():
                    cleaned_p[str(k)] = round(safe_float(v, 0.0, 0.0, 1_000_000.0), 3)
                if mc_id == "wide_format":
                    cleaned_p.pop("roll_width_mm", None)
                    cleaned_p.pop("eyelet_step_mm", None)
                mc_params_store[mc_id] = cleaned_p

        poly_p = (
            data["settings"]
            .setdefault("main_category_params", {})
            .setdefault("polygraphy", get_default_main_cat_params("polygraphy", data["settings"]))
        )
        if "main_category_params" in body and isinstance(
            body.get("main_category_params", {}).get("polygraphy"), dict
        ):
            in_poly = body["main_category_params"]["polygraphy"]
            if "sheet_length_m" in in_poly and "sheet_length_m" not in body:
                data["settings"]["sheet_length_m"] = safe_float(
                    in_poly["sheet_length_m"], 0.5, 0.01, 100.0
                )
            if "bleed_mm" in in_poly and "bleed_mm" not in body:
                data["settings"]["bleed_mm"] = safe_float(in_poly["bleed_mm"], 4.0, 0.0, 100.0)
            if "defect_percent" in in_poly and "defect_percent" not in body:
                data["settings"]["defect_percent"] = round(
                    safe_float(in_poly["defect_percent"], 0.0, 0.0, 100.0), 2
                )
            if "tax_percent" in in_poly and "tax_percent" not in body:
                data["settings"]["tax_percent"] = round(
                    safe_float(in_poly["tax_percent"], 6.0, 0.0, 100.0), 2
                )
            if "usable_width_mm" in in_poly and "usable_width_mm" not in body:
                data["settings"]["usable_width_mm"] = safe_float(
                    in_poly["usable_width_mm"], 310.0, 50.0, 5000.0
                )
            if "usable_height_mm" in in_poly and "usable_height_mm" not in body:
                data["settings"]["usable_height_mm"] = safe_float(
                    in_poly["usable_height_mm"], 440.0, 50.0, 5000.0
                )

        poly_p["sheet_length_m"] = float(data["settings"].get("sheet_length_m", 0.5))
        poly_p["bleed_mm"] = float(data["settings"].get("bleed_mm", 4.0))
        poly_p["defect_percent"] = float(data["settings"].get("defect_percent", 3.0))
        poly_p["tax_percent"] = float(data["settings"].get("tax_percent", 6.0))
        poly_p["usable_width_mm"] = float(data["settings"].get("usable_width_mm", 310.0))
        poly_p["usable_height_mm"] = float(data["settings"].get("usable_height_mm", 440.0))

        if "category_markups" in body and isinstance(body["category_markups"], dict):
            cleaned_cat_markups = {}
            for cat, tiers in body["category_markups"].items():
                if isinstance(tiers, list):
                    cleaned_tiers = []
                    for t in tiers:
                        if not isinstance(t, dict):
                            continue
                        coeff = round(safe_float(t.get("coefficient", 1.0), 1.0, 0.1, 1000.0), 2)
                        tier_item = {
                            "min_qty": safe_int(t.get("min_qty", 1), 1, 1, 10_000_000),
                            "coefficient": coeff,
                        }
                        if cat in ("catalogs", "notepads", "planners", "menus"):
                            tier_item["page_coefficient"] = round(
                                safe_float(t.get("page_coefficient", coeff), coeff, 0.1, 1000.0), 2
                            )
                        cleaned_tiers.append(tier_item)
                    cleaned_tiers.sort(key=lambda x: x["min_qty"])
                    cleaned_cat_markups[cat] = cleaned_tiers
            data["settings"]["category_markups"] = cleaned_cat_markups
        if "roles" in body and isinstance(body["roles"], list):
            data["settings"]["roles"] = normalize_roles_list(
                body["roles"],
                legacy_role_perms=body.get("role_permissions"),
                legacy_role_statuses=body.get("role_order_statuses"),
            )
            if isinstance(body.get("role_order_statuses"), dict):
                incoming_status_map = body["role_order_statuses"]
                for r in data["settings"]["roles"]:
                    r_id = r["id"]
                    if r_id in incoming_status_map and isinstance(
                        incoming_status_map[r_id], list
                    ):
                        r["allowed_order_statuses"] = normalize_allowed_order_statuses(
                            incoming_status_map[r_id],
                            role_id=r_id,
                            force_all=(r_id == "admin"),
                            force_empty=(r_id == "client"),
                        )
            data["settings"]["role_permissions"] = {
                r["id"]: dict(r["permissions"]) for r in data["settings"]["roles"]
            }
            data["settings"]["role_order_statuses"] = {
                r["id"]: list(r["allowed_order_statuses"]) for r in data["settings"]["roles"]
            }
        elif (
            ("role_permissions" in body and isinstance(body["role_permissions"], dict))
            or ("role_order_statuses" in body and isinstance(body["role_order_statuses"], dict))
        ):
            roles_list = get_roles_list(data)
            incoming_map = (
                body.get("role_permissions")
                if isinstance(body.get("role_permissions"), dict)
                else {}
            )
            incoming_status_map = (
                body.get("role_order_statuses")
                if isinstance(body.get("role_order_statuses"), dict)
                else {}
            )
            for r in roles_list:
                r_id = r["id"]
                if r_id in incoming_map and isinstance(incoming_map[r_id], dict):
                    if r_id == "admin":
                        r["permissions"] = normalize_role_permissions({}, force_all_true=True)
                    elif r_id == "client":
                        r["permissions"] = normalize_role_permissions({}, force_all_false=True)
                    else:
                        merged_p = dict(r.get("permissions") or {})
                        merged_p.update(incoming_map[r_id])
                        r["permissions"] = normalize_role_permissions(
                            merged_p, force_all_true=False
                        )
                if r_id in incoming_status_map and isinstance(incoming_status_map[r_id], list):
                    r["allowed_order_statuses"] = normalize_allowed_order_statuses(
                        incoming_status_map[r_id],
                        role_id=r_id,
                        force_all=(r_id == "admin"),
                        force_empty=(r_id == "client"),
                    )
            data["settings"]["roles"] = normalize_roles_list(roles_list)
            data["settings"]["role_permissions"] = {
                r["id"]: dict(r["permissions"]) for r in data["settings"]["roles"]
            }
            data["settings"]["role_order_statuses"] = {
                r["id"]: list(r["allowed_order_statuses"]) for r in data["settings"]["roles"]
            }
        save_data(data)
        return jsonify(strip_legacy_pins(data["settings"]))


@admin_catalog_bp.route("/api/admin/main-categories", methods=["POST"])
def add_main_category():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "Новый раздел").strip()

        existing_ids = {mc["id"] for mc in data.get("main_categories", [])}
        idx = len(existing_ids) + 1
        mc_id = f"main_{idx}"
        while mc_id in existing_ids:
            idx += 1
            mc_id = f"main_{idx}"

        new_mc = {
            "id": mc_id,
            "name": name,
            "is_hidden": bool(body.get("is_hidden", False)),
            "is_accent": bool(body.get("is_accent", False)),
            "image_url": sanitize_image_url(body.get("image_url") or ""),
        }
        data.setdefault("main_categories", []).append(new_mc)
        data.setdefault("settings", {}).setdefault("category_markups", {})[
            mc_id
        ] = get_default_tiers_for_cat(mc_id)
        data.setdefault("settings", {}).setdefault("main_category_params", {})[
            mc_id
        ] = get_default_main_cat_params(mc_id, data.get("settings"))
        save_data(data)
        return jsonify(new_mc), 201


@admin_catalog_bp.route("/api/admin/main-categories/<string:mc_id>", methods=["PUT"])
def update_main_category(mc_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        for mc in data.get("main_categories", []):
            if mc["id"] == mc_id:
                if "name" in body:
                    mc["name"] = str(body["name"]).strip()
                if "is_hidden" in body:
                    mc["is_hidden"] = bool(body["is_hidden"])
                if "is_accent" in body:
                    mc["is_accent"] = bool(body["is_accent"])
                if "image_url" in body:
                    mc["image_url"] = sanitize_image_url(body["image_url"] or "")
                save_data(data)
                return jsonify(mc)
        return jsonify({"error": "Раздел не найден"}), 404


@admin_catalog_bp.route("/api/admin/main-categories/<string:mc_id>", methods=["DELETE"])
def delete_main_category(mc_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        main_cats = data.get("main_categories", [])
        if len(main_cats) <= 1:
            return jsonify({"error": "Нельзя удалить последний главный раздел"}), 400
        data["main_categories"] = [mc for mc in main_cats if mc["id"] != mc_id]
        fallback_id = data["main_categories"][0]["id"]
        for c in data.get("categories", []):
            if c.get("parent_id") == mc_id:
                c["parent_id"] = fallback_id
        for mc in data.get("material_categories", []):
            if mc.get("main_category_id") == mc_id:
                mc["main_category_id"] = fallback_id
        data.get("settings", {}).get("category_markups", {}).pop(mc_id, None)
        save_data(data)
        return jsonify({"status": "deleted"})


@admin_catalog_bp.route("/api/admin/categories", methods=["POST"])
def add_category():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "Новая подкатегория").strip()
        icon = (body.get("icon") or "📦").strip()
        default_parent = data.get("main_categories", [{}])[0].get("id", "polygraphy")
        parent_id = (body.get("parent_id") or default_parent).strip()

        existing_ids = {c["id"] for c in data.get("categories", [])}
        idx = len(existing_ids) + 1
        cat_id = f"cat_{idx}"
        while cat_id in existing_ids:
            idx += 1
            cat_id = f"cat_{idx}"

        new_cat = {
            "id": cat_id,
            "parent_id": parent_id,
            "name": name,
            "icon": icon,
            "is_hidden": bool(body.get("is_hidden", False)),
            "is_featured": bool(body.get("is_featured", False)),
            "image_url": sanitize_image_url(body.get("image_url") or ""),
            "badge": (body.get("badge") or "").strip(),
        }
        data.setdefault("categories", []).append(new_cat)
        parent_tiers = data.get("settings", {}).get("category_markups", {}).get(parent_id)
        data.setdefault("settings", {}).setdefault("category_markups", {})[cat_id] = (
            [dict(t) for t in parent_tiers]
            if isinstance(parent_tiers, list) and len(parent_tiers) > 0
            else get_default_tiers_for_cat(cat_id)
        )
        save_data(data)
        return jsonify(new_cat), 201


@admin_catalog_bp.route("/api/admin/categories/<string:cat_id>", methods=["PUT"])
def update_category(cat_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        for c in data.get("categories", []):
            if c["id"] == cat_id:
                if "name" in body:
                    c["name"] = str(body["name"]).strip()
                if "icon" in body:
                    c["icon"] = str(body["icon"]).strip()
                if "parent_id" in body:
                    c["parent_id"] = str(body["parent_id"]).strip()
                if "is_hidden" in body:
                    c["is_hidden"] = bool(body["is_hidden"])
                if "is_featured" in body:
                    c["is_featured"] = bool(body["is_featured"])
                if "image_url" in body:
                    c["image_url"] = sanitize_image_url(body["image_url"] or "")
                if "badge" in body:
                    c["badge"] = str(body["badge"]).strip()
                save_data(data)
                return jsonify(c)
        return jsonify({"error": "Подкатегория не найдена"}), 404


@admin_catalog_bp.route("/api/admin/categories/<string:cat_id>", methods=["DELETE"])
def delete_category(cat_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        data["categories"] = [c for c in data.get("categories", []) if c["id"] != cat_id]
        data["products"] = [p for p in data.get("products", []) if p["category"] != cat_id]
        data.get("settings", {}).get("category_markups", {}).pop(cat_id, None)
        save_data(data)
        return jsonify({"status": "deleted"})


@admin_catalog_bp.route("/api/admin/reorder", methods=["PUT", "POST"])
def reorder_entities():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}

        if isinstance(body.get("main_category_ids"), list):
            ordered_ids = [str(x).strip() for x in body["main_category_ids"] if str(x).strip()]
            mc_by_id = {mc["id"]: mc for mc in data.get("main_categories", [])}
            reordered = [mc_by_id[mid] for mid in ordered_ids if mid in mc_by_id]
            seen = set(ordered_ids)
            for mc in data.get("main_categories", []):
                if mc["id"] not in seen:
                    reordered.append(mc)
            data["main_categories"] = reordered

        if isinstance(body.get("category_ids"), list):
            ordered_ids = [str(x).strip() for x in body["category_ids"] if str(x).strip()]
            cat_by_id = {c["id"]: c for c in data.get("categories", [])}
            subset_set = {cid for cid in ordered_ids if cid in cat_by_id}
            if len(subset_set) == len(cat_by_id):
                data["categories"] = [cat_by_id[cid] for cid in ordered_ids if cid in cat_by_id]
            else:
                ordered_objs = [cat_by_id[cid] for cid in ordered_ids if cid in cat_by_id]
                it = iter(ordered_objs)
                new_cats = []
                for c in data.get("categories", []):
                    if c["id"] in subset_set:
                        new_cats.append(next(it))
                    else:
                        new_cats.append(c)
                data["categories"] = new_cats

        if isinstance(body.get("product_ids"), list):
            ordered_ids = [safe_int(x, 0) for x in body["product_ids"] if safe_int(x, 0) > 0]
            prod_by_id = {p["id"]: p for p in data.get("products", [])}
            subset_set = {pid for pid in ordered_ids if pid in prod_by_id}
            if len(subset_set) == len(prod_by_id):
                data["products"] = [prod_by_id[pid] for pid in ordered_ids if pid in prod_by_id]
            else:
                ordered_objs = [prod_by_id[pid] for pid in ordered_ids if pid in prod_by_id]
                it = iter(ordered_objs)
                new_prods = []
                for p in data.get("products", []):
                    if p["id"] in subset_set:
                        new_prods.append(next(it))
                    else:
                        new_prods.append(p)
                data["products"] = new_prods

        save_data(data)
        return jsonify(
            {
                "status": "ok",
                "main_categories": data.get("main_categories", []),
                "categories": data.get("categories", []),
                "products": data.get("products", []),
                "catalog": get_public_catalog_dict(data),
            }
        )


@admin_catalog_bp.route("/api/admin/material-categories", methods=["POST"])
def add_material_category():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        title = (body.get("title") or "Новая категория").strip()
        default_main_id = data.get("main_categories", [{}])[0].get("id", "polygraphy")
        main_category_id = (body.get("main_category_id") or default_main_id).strip()
        kind = body.get("kind") if body.get("kind") in ("material", "equipment") else "material"
        default_unit = (body.get("default_unit") or ("шт." if kind == "material" else "ед.")).strip()
        resource_label = (
            body.get("resource_label")
            or (
                f"Кол-во в пачке / упаковке ({default_unit})"
                if kind == "material"
                else f"Ресурс ({default_unit})"
            )
        ).strip()
        unit_label = (body.get("unit_label") or f"₽ / {default_unit}").strip()
        has_client_name = bool(body.get("has_client_name", kind == "material"))

        mat_cats = data.setdefault(
            "material_categories", [dict(mc) for mc in INITIAL_MATERIAL_CATEGORIES]
        )
        existing_ids = {mc["id"] for mc in mat_cats}
        idx = len(existing_ids) + 1
        mc_id = f"mat_cat_{idx}"
        while mc_id in existing_ids:
            idx += 1
            mc_id = f"mat_cat_{idx}"

        new_mc = {
            "id": mc_id,
            "main_category_id": main_category_id,
            "title": title,
            "kind": kind,
            "resource_label": resource_label,
            "unit_label": unit_label,
            "default_unit": default_unit,
            "has_client_name": has_client_name,
            "is_system": False,
        }
        mat_cats.append(new_mc)
        save_data(data)
        return jsonify(new_mc), 201


@admin_catalog_bp.route("/api/admin/material-categories/<string:mc_id>", methods=["PUT"])
def update_material_category(mc_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        for mc in data.get("material_categories", []):
            if mc["id"] == mc_id:
                if "title" in body and str(body["title"]).strip():
                    mc["title"] = str(body["title"]).strip()
                if "main_category_id" in body and str(body["main_category_id"]).strip():
                    mc["main_category_id"] = str(body["main_category_id"]).strip()
                if "kind" in body and body["kind"] in ("material", "equipment"):
                    mc["kind"] = body["kind"]
                if "default_unit" in body and str(body["default_unit"]).strip():
                    mc["default_unit"] = str(body["default_unit"]).strip()
                if "resource_label" in body and str(body["resource_label"]).strip():
                    mc["resource_label"] = str(body["resource_label"]).strip()
                if "unit_label" in body and str(body["unit_label"]).strip():
                    mc["unit_label"] = str(body["unit_label"]).strip()
                if "has_client_name" in body:
                    mc["has_client_name"] = bool(body["has_client_name"])
                save_data(data)
                return jsonify(mc)
        return jsonify({"error": "Категория материалов не найдена"}), 404


@admin_catalog_bp.route("/api/admin/material-categories/<string:mc_id>", methods=["DELETE"])
def delete_material_category(mc_id):
    system_ids = {"papers", "laminations", "toners", "components", "extras"}
    if mc_id in system_ids:
        return (
            jsonify(
                {"error": "Базовую системную категорию нельзя удалить (её можно переименовать)"}
            ),
            400,
        )
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        removed_item_ids = {i["id"] for i in data.get("items", []) if i.get("category") == mc_id}
        data["material_categories"] = [
            mc for mc in data.get("material_categories", []) if mc["id"] != mc_id
        ]
        data["items"] = [i for i in data.get("items", []) if i.get("category") != mc_id]
        if removed_item_ids:
            for p in data.get("products", []):
                for key in (
                    "allowed_paper_ids",
                    "allowed_cover_paper_ids",
                    "allowed_lamination_ids",
                    "excluded_equipment_ids",
                    "enabled_equipment_ids",
                ):
                    if isinstance(p.get(key), list):
                        p[key] = [x for x in p[key] if x not in removed_item_ids]
        save_data(data)
        return jsonify({"status": "deleted"})


def _is_wide_format_roll_material(category_id: str, data: dict) -> bool:
    if category_id == "wf_banners":
        return True
    mat_cat = next(
        (mc for mc in data.get("material_categories", []) if mc.get("id") == category_id),
        None,
    )
    if not mat_cat:
        return False
    return (
        mat_cat.get("main_category_id") == "wide_format"
        and (mat_cat.get("kind") or "material") == "material"
    )


def _apply_item_pricing_fields(item: dict, payload: dict, is_wf_roll: bool) -> None:
    if not is_wf_roll:
        default_resource = safe_float(item.get("resource", 1.0), 1.0, 1.0)
        item["resource"] = safe_float(
            payload.get("resource", default_resource), default_resource, 1.0
        )
        default_price = safe_float(item.get("price", 0.0), 0.0, 0.0)
        item["price"] = round(safe_float(payload.get("price", default_price), default_price, 0.0), 2)
        item.pop("cost_per_sqm", None)
        item.pop("roll_width_m", None)
        item.pop("roll_length_m", None)
        return

    cur_w = safe_float(item.get("roll_width_m"), 0.0)
    cur_l = safe_float(item.get("roll_length_m"), 0.0)
    if cur_w <= 0 or cur_l <= 0:
        cur_w, cur_l = infer_wide_format_roll_dimensions(
            item.get("name", ""),
            safe_float(payload.get("resource", item.get("resource", 0.0)), 0.0),
        )

    has_dim_payload = (
        ("roll_width_m" in payload and payload.get("roll_width_m") not in (None, ""))
        or ("roll_length_m" in payload and payload.get("roll_length_m") not in (None, ""))
    )
    if has_dim_payload:
        w_m = round(safe_float(payload.get("roll_width_m", cur_w), cur_w, 0.01), 4)
        l_m = round(safe_float(payload.get("roll_length_m", cur_l), cur_l, 0.01), 4)
        item["roll_width_m"] = w_m
        item["roll_length_m"] = l_m
        item["resource"] = max(0.01, round(w_m * l_m, 4))
    else:
        default_resource = safe_float(item.get("resource", 1.0), 1.0, 0.01)
        item["resource"] = safe_float(
            payload.get("resource", default_resource), default_resource, 0.01
        )
        if "resource" in payload:
            inferred_w, inferred_l = infer_wide_format_roll_dimensions(
                item.get("name", ""), item["resource"]
            )
            item["roll_width_m"] = inferred_w
            item["roll_length_m"] = inferred_l
        else:
            item["roll_width_m"] = round(cur_w, 4)
            item["roll_length_m"] = round(cur_l, 4)

    raw_cost_per_sqm = payload.get("cost_per_sqm")
    if "cost_per_sqm" in payload and raw_cost_per_sqm is not None and raw_cost_per_sqm != "":
        sqm_cost = round(safe_float(raw_cost_per_sqm, 0.0, 0.0), 2)
        item["cost_per_sqm"] = sqm_cost
        item["price"] = round(sqm_cost * item["resource"], 2)
    elif "price" in payload:
        default_price = safe_float(item.get("price", 0.0), 0.0, 0.0)
        item["price"] = round(safe_float(payload.get("price", default_price), default_price, 0.0), 2)
        item.pop("cost_per_sqm", None)
    elif (has_dim_payload or "resource" in payload) and "cost_per_sqm" in item:
        sqm_cost = round(safe_float(item.get("cost_per_sqm"), 0.0, 0.0), 2)
        item["price"] = round(sqm_cost * item["resource"], 2)
    else:
        default_price = safe_float(item.get("price", 0.0), 0.0, 0.0)
        item["price"] = round(default_price, 2)


@admin_catalog_bp.route(
    "/api/admin/material-categories/<string:mc_id>/apply-sqm-price", methods=["POST"]
)
def apply_material_category_sqm_price(mc_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        price_per_m2 = round(safe_float(body.get("price_per_m2"), -1.0), 2)
        if price_per_m2 < 0:
            return jsonify({"error": "Некорректная цена за м²"}), 400
        target_group = str(body.get("group") or "ALL").strip()

        mat_cat = next(
            (mc for mc in data.get("material_categories", []) if mc.get("id") == mc_id),
            None,
        )
        if not mat_cat:
            return jsonify({"error": "Категория материалов не найдена"}), 404

        grp_prices = mat_cat.setdefault("group_prices_per_m2", {})
        if not isinstance(grp_prices, dict):
            grp_prices = {}
            mat_cat["group_prices_per_m2"] = grp_prices

        if target_group and target_group != "ALL":
            grp_prices[target_group] = price_per_m2
        else:
            mat_cat["default_price_per_m2"] = price_per_m2

        updated_count = 0
        for item in data.get("items", []):
            if item.get("category") != mc_id:
                continue
            item_grp = str(item.get("group") or "").strip()
            if target_group and target_group != "ALL" and item_grp != target_group:
                continue
            res_m2 = safe_float(item.get("resource", 1.0), 1.0, 0.01)
            item["cost_per_sqm"] = price_per_m2
            item["price_per_m2"] = price_per_m2
            item["price"] = round(price_per_m2 * res_m2, 2)
            if item_grp:
                grp_prices[item_grp] = price_per_m2
            updated_count += 1

        save_data(data)
        return jsonify(
            {
                "status": "ok",
                "updated_count": updated_count,
                "material_category": mat_cat,
                "items": data.get("items", []),
            }
        )


@admin_catalog_bp.route("/api/admin/items", methods=["POST"])
def add_item():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        new_id = max((i["id"] for i in data["items"]), default=0) + 1
        category = body.get("category", "papers")
        name = str(body.get("name", "Новая позиция")).strip()
        client_name = str(body.get("client_name") or name).strip()

        mat_cat_obj = next(
            (mc for mc in data.get("material_categories", []) if mc.get("id") == category), None
        )
        default_unit = mat_cat_obj.get("default_unit", "шт.") if mat_cat_obj else "шт."
        if not mat_cat_obj:
            if category == "laminations":
                default_unit = "м."
            elif category in ("toners", "components"):
                default_unit = "стр. А4"

        group = str(body.get("group") or infer_material_group(name, client_name, category)).strip()
        def_c_name, def_c_hex = (
            infer_paper_color(name, client_name) if category == "papers" else ("", "")
        )
        color_name = str(body.get("color_name") or def_c_name).strip()
        color_hex = str(body.get("color_hex") or def_c_hex).strip()
        new_item = {
            "id": new_id,
            "category": category,
            "name": name,
            "client_name": client_name,
            "group": group,
            "in_stock": bool(body.get("in_stock", True)),
            "color_name": color_name,
            "color_hex": color_hex,
            "price": 0.0,
            "resource": 1.0,
            "unit": str(body.get("unit") or default_unit).strip(),
        }
        is_wf_roll = _is_wide_format_roll_material(category, data)
        effective_body = dict(body)
        if (
            is_wf_roll
            and "cost_per_sqm" not in effective_body
            and "price" not in effective_body
            and mat_cat_obj
        ):
            grp_prices = mat_cat_obj.get("group_prices_per_m2") or {}
            inherited_sqm = grp_prices.get(group, mat_cat_obj.get("default_price_per_m2"))
            if inherited_sqm is not None:
                effective_body["cost_per_sqm"] = inherited_sqm
        _apply_item_pricing_fields(new_item, effective_body, is_wf_roll)
        if "cost_per_sqm" in new_item:
            new_item["price_per_m2"] = new_item["cost_per_sqm"]
        data["items"].append(new_item)

        enable_for_categories = body.get("enable_for_categories")
        if category == "papers":
            for p in data.get("products", []):
                if enable_for_categories is None or p["category"] in enable_for_categories:
                    if new_id not in p.get("allowed_paper_ids", []):
                        p.setdefault("allowed_paper_ids", []).append(new_id)
                    if new_id not in p.get("allowed_cover_paper_ids", []):
                        p.setdefault("allowed_cover_paper_ids", []).append(new_id)
        elif category == "laminations":
            for p in data.get("products", []):
                if enable_for_categories is None or p["category"] in enable_for_categories:
                    if new_id not in p.get("allowed_lamination_ids", []):
                        p.setdefault("allowed_lamination_ids", []).append(new_id)

        save_data(data)
        return jsonify(new_item), 201


@admin_catalog_bp.route("/api/admin/items/bulk", methods=["PUT"])
def bulk_update_items():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        updates = body.get("items")
        if not isinstance(updates, list):
            return jsonify({"error": "Ожидается список items"}), 400

        updates_by_id = {
            safe_int(u.get("id"), 0): u
            for u in updates
            if isinstance(u, dict) and safe_int(u.get("id"), 0) > 0
        }
        updated_count = 0
        for item in data["items"]:
            u = updates_by_id.get(item["id"])
            if not u:
                continue
            item["name"] = str(u.get("name", item["name"])).strip()
            item["client_name"] = str(
                u.get("client_name", item.get("client_name", item["name"]))
            ).strip()
            if "group" in u:
                item["group"] = str(u["group"]).strip()
            if "in_stock" in u:
                item["in_stock"] = bool(u["in_stock"])
            if "color_name" in u:
                item["color_name"] = str(u["color_name"]).strip()
            if "color_hex" in u:
                item["color_hex"] = str(u["color_hex"]).strip()
            _apply_item_pricing_fields(
                item, u, _is_wide_format_roll_material(item.get("category", ""), data)
            )
            if "unit" in u:
                item["unit"] = str(u["unit"]).strip()
            updated_count += 1

        if updated_count > 0:
            save_data(data)
        return jsonify({"status": "ok", "updated": updated_count})


@admin_catalog_bp.route("/api/admin/items/<int:item_id>", methods=["PUT"])
def update_item(item_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        for item in data["items"]:
            if item["id"] == item_id:
                old_res = safe_float(item.get("resource", 1.0), 1.0, 0.01)
                old_price = safe_float(item.get("price", 0.0), 0.0, 0.0)
                item["name"] = str(body.get("name", item["name"])).strip()
                item["client_name"] = str(
                    body.get("client_name", item.get("client_name", item["name"]))
                ).strip()
                if "group" in body:
                    item["group"] = str(body["group"]).strip()
                if "in_stock" in body:
                    item["in_stock"] = bool(body["in_stock"])
                if "color_name" in body:
                    item["color_name"] = str(body["color_name"]).strip()
                if "color_hex" in body:
                    item["color_hex"] = str(body["color_hex"]).strip()
                effective_body = dict(body)
                if (
                    "resource" in effective_body
                    and "cost_per_sqm" not in effective_body
                    and "cost_per_sqm" in item
                    and safe_float(effective_body.get("resource"), old_res) != old_res
                    and safe_float(effective_body.get("price"), old_price) == old_price
                ):
                    effective_body.pop("price", None)
                _apply_item_pricing_fields(
                    item, effective_body, _is_wide_format_roll_material(item.get("category", ""), data)
                )
                if "cost_per_sqm" in item:
                    item["price_per_m2"] = item["cost_per_sqm"]
                if "unit" in body:
                    item["unit"] = str(body["unit"]).strip()
                save_data(data)
                return jsonify(item)
        return jsonify({"error": "Не найдено"}), 404


@admin_catalog_bp.route("/api/admin/items/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        data["items"] = [i for i in data["items"] if i["id"] != item_id]
        for p in data.get("products", []):
            for key in (
                "allowed_paper_ids",
                "allowed_cover_paper_ids",
                "allowed_lamination_ids",
                "excluded_equipment_ids",
                "enabled_equipment_ids",
            ):
                if key in p and isinstance(p[key], list):
                    p[key] = [x for x in p[key] if x != item_id]
        save_data(data)
        return jsonify({"status": "deleted"})


@admin_catalog_bp.route("/api/admin/products", methods=["POST"])
def add_product():
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        products = data.setdefault("products", [])
        new_id = max((p["id"] for p in products), default=600) + 1

        all_papers = [i["id"] for i in data["items"] if i["category"] == "papers"]
        all_lams = [i["id"] for i in data["items"] if i["category"] == "laminations"]

        cleaned_params = normalize_cost_params(body.get("cost_params", []))

        raw_images = body.get("images", [])
        cleaned_images = (
            [u for u in (sanitize_image_url(img) for img in raw_images) if u]
            if isinstance(raw_images, list)
            else []
        )

        cat = body.get("category", "flyers")
        mp_mode = body.get("multi_page_mode", "none")
        allowed_papers = (
            body.get("allowed_paper_ids")
            if isinstance(body.get("allowed_paper_ids"), list)
            else all_papers
        )
        allowed_cover_papers = (
            body.get("allowed_cover_paper_ids")
            if isinstance(body.get("allowed_cover_paper_ids"), list)
            else list(allowed_papers)
        )

        new_product = {
            "id": new_id,
            "category": cat,
            "name": str(body.get("name", "Новый продукт")).strip(),
            "product_kind": str(body.get("product_kind") or "").strip(),
            "width_mm": safe_float(body.get("width_mm", 210), 210.0, 1.0, 50_000.0),
            "height_mm": safe_float(body.get("height_mm", 297), 297.0, 1.0, 50_000.0),
            "allow_custom_size": bool(body.get("allow_custom_size", False)),
            "multi_page_mode": mp_mode,
            "default_pages": safe_int(body.get("default_pages", 1), 1, 1, 10_000),
            "allowed_sides": body.get("allowed_sides", "both"),
            "has_cover_block": bool(
                body.get("has_cover_block", cat == "catalogs" or mp_mode == "pages")
            ),
            "allowed_block_print_modes": body.get("allowed_block_print_modes", "both"),
            "allowed_cover_print_modes": body.get("allowed_cover_print_modes", "both"),
            "allowed_cover_paper_ids": allowed_cover_papers,
            "defect_percent": safe_float(body.get("defect_percent", 0.0), 0.0, 0.0, 100.0),
            "is_hidden": bool(body.get("is_hidden", False)),
            "schematic_type": body.get("schematic_type", "auto"),
            "base_mm": safe_float(body.get("base_mm", 35.0), 35.0, 5.0, 5000.0),
            "images": cleaned_images,
            "cost_params": cleaned_params,
            "show_format_select": bool(body.get("show_format_select", True)),
            "show_print_sides": bool(body.get("show_print_sides", True)),
            "show_paper_select": bool(body.get("show_paper_select", True)),
            "show_lamination_select": bool(body.get("show_lamination_select", True)),
            "include_paper_cost": bool(body.get("include_paper_cost", True)),
            "include_print_cost": bool(body.get("include_print_cost", True)),
            "include_toner_cost": bool(body.get("include_toner_cost", True)),
            "include_components_cost": bool(body.get("include_components_cost", True)),
            "include_lamination_cost": bool(body.get("include_lamination_cost", True)),
            "include_extra_params_cost": bool(body.get("include_extra_params_cost", True)),
            "include_defect_cost": bool(body.get("include_defect_cost", True)),
            "excluded_equipment_ids": [
                safe_int(x, 0)
                for x in (body.get("excluded_equipment_ids") or [])
                if safe_int(x, 0) > 0
            ]
            if isinstance(body.get("excluded_equipment_ids"), list)
            else [],
            "enabled_equipment_ids": [
                safe_int(x, 0)
                for x in (body.get("enabled_equipment_ids") or [])
                if safe_int(x, 0) > 0
            ]
            if isinstance(body.get("enabled_equipment_ids"), list)
            else [],
            "allowed_paper_ids": allowed_papers,
            "allowed_lamination_ids": (
                body.get("allowed_lamination_ids")
                if isinstance(body.get("allowed_lamination_ids"), list)
                else all_lams
            ),
        }
        products.append(new_product)
        save_data(data)
        return jsonify(new_product), 201


@admin_catalog_bp.route("/api/admin/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        for p in data.get("products", []):
            if p["id"] == product_id:
                if "name" in body:
                    p["name"] = str(body["name"]).strip()
                if "product_kind" in body:
                    p["product_kind"] = str(body["product_kind"] or "").strip()
                if "category" in body:
                    p["category"] = body["category"]
                if "width_mm" in body:
                    p["width_mm"] = safe_float(body["width_mm"], p["width_mm"], 1.0, 50_000.0)
                if "height_mm" in body:
                    p["height_mm"] = safe_float(body["height_mm"], p["height_mm"], 1.0, 50_000.0)
                if "allow_custom_size" in body:
                    p["allow_custom_size"] = bool(body["allow_custom_size"])
                if "multi_page_mode" in body:
                    p["multi_page_mode"] = body["multi_page_mode"]
                if "default_pages" in body:
                    p["default_pages"] = safe_int(
                        body["default_pages"], p.get("default_pages", 1), 1, 10_000
                    )
                if "allowed_sides" in body:
                    p["allowed_sides"] = body["allowed_sides"]
                if "has_cover_block" in body:
                    p["has_cover_block"] = bool(body["has_cover_block"])
                if "allowed_block_print_modes" in body and body["allowed_block_print_modes"] in (
                    "both",
                    "4+4",
                    "1+1",
                    "0+0",
                ):
                    p["allowed_block_print_modes"] = body["allowed_block_print_modes"]
                if "allowed_cover_print_modes" in body and body["allowed_cover_print_modes"] in (
                    "both",
                    "4+4",
                    "4+0",
                ):
                    p["allowed_cover_print_modes"] = body["allowed_cover_print_modes"]
                if "allowed_cover_paper_ids" in body and isinstance(
                    body["allowed_cover_paper_ids"], list
                ):
                    p["allowed_cover_paper_ids"] = [
                        safe_int(x, 0)
                        for x in body["allowed_cover_paper_ids"]
                        if safe_int(x, 0) > 0
                    ]
                if "defect_percent" in body:
                    p["defect_percent"] = safe_float(body["defect_percent"], 0.0, 0.0, 100.0)
                if "is_hidden" in body:
                    p["is_hidden"] = bool(body["is_hidden"])
                if "schematic_type" in body:
                    p["schematic_type"] = body["schematic_type"]
                if "base_mm" in body:
                    p["base_mm"] = safe_float(body["base_mm"], 35.0, 5.0, 5000.0)
                for flag_key in (
                    "show_format_select",
                    "show_print_sides",
                    "show_paper_select",
                    "show_lamination_select",
                    "include_paper_cost",
                    "include_print_cost",
                    "include_toner_cost",
                    "include_components_cost",
                    "include_lamination_cost",
                    "include_extra_params_cost",
                    "include_defect_cost",
                ):
                    if flag_key in body:
                        p[flag_key] = bool(body[flag_key])
                if "excluded_equipment_ids" in body and isinstance(
                    body["excluded_equipment_ids"], list
                ):
                    p["excluded_equipment_ids"] = [
                        safe_int(x, 0)
                        for x in body["excluded_equipment_ids"]
                        if safe_int(x, 0) > 0
                    ]
                if "enabled_equipment_ids" in body and isinstance(
                    body["enabled_equipment_ids"], list
                ):
                    p["enabled_equipment_ids"] = [
                        safe_int(x, 0)
                        for x in body["enabled_equipment_ids"]
                        if safe_int(x, 0) > 0
                    ]
                if "images" in body and isinstance(body["images"], list):
                    p["images"] = [
                        u for u in (sanitize_image_url(img) for img in body["images"]) if u
                    ]
                if "cost_params" in body and isinstance(body["cost_params"], list):
                    p["cost_params"] = normalize_cost_params(body["cost_params"])
                if "allowed_paper_ids" in body and isinstance(body["allowed_paper_ids"], list):
                    p["allowed_paper_ids"] = [
                        safe_int(x, 0) for x in body["allowed_paper_ids"] if safe_int(x, 0) > 0
                    ]
                if "allowed_lamination_ids" in body and isinstance(
                    body["allowed_lamination_ids"], list
                ):
                    p["allowed_lamination_ids"] = [
                        safe_int(x, 0)
                        for x in body["allowed_lamination_ids"]
                        if safe_int(x, 0) > 0
                    ]
                save_data(data)
                return jsonify(p)
        return jsonify({"error": "Продукт не найден"}), 404


@admin_catalog_bp.route("/api/admin/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        data["products"] = [p for p in data.get("products", []) if p["id"] != product_id]
        save_data(data)
        return jsonify({"status": "deleted"})


@admin_catalog_bp.route("/api/admin/categories/<string:cat_id>/apply-materials", methods=["POST"])
def apply_materials_to_category(cat_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        paper_ids = body.get("allowed_paper_ids")
        cover_paper_ids = body.get("allowed_cover_paper_ids")
        lam_ids = body.get("allowed_lamination_ids")
        for p in data.get("products", []):
            if p["category"] == cat_id:
                if isinstance(paper_ids, list):
                    p["allowed_paper_ids"] = [
                        safe_int(x, 0) for x in paper_ids if safe_int(x, 0) > 0
                    ]
                if isinstance(cover_paper_ids, list):
                    p["allowed_cover_paper_ids"] = [
                        safe_int(x, 0) for x in cover_paper_ids if safe_int(x, 0) > 0
                    ]
                if isinstance(lam_ids, list):
                    p["allowed_lamination_ids"] = [
                        safe_int(x, 0) for x in lam_ids if safe_int(x, 0) > 0
                    ]
        save_data(data)
        return jsonify({"status": "ok"})


@admin_catalog_bp.route("/api/admin/categories/<string:cat_id>/apply-params", methods=["POST"])
def apply_params_to_category(cat_id):
    with _DATA_LOCK:
        data = load_data()
        if not can_manage_catalog_request(data):
            return jsonify({"error": "Доступ запрещен"}), 403
        body = request.get_json(silent=True) or {}
        cleaned_params = normalize_cost_params(body.get("cost_params", []))
        for p in data.get("products", []):
            if p["category"] == cat_id:
                p["cost_params"] = [dict(cp) for cp in cleaned_params]
                for flag_key in (
                    "show_format_select",
                    "show_print_sides",
                    "show_paper_select",
                    "show_lamination_select",
                    "include_paper_cost",
                    "include_print_cost",
                    "include_toner_cost",
                    "include_components_cost",
                    "include_lamination_cost",
                    "include_extra_params_cost",
                    "include_defect_cost",
                ):
                    if flag_key in body:
                        p[flag_key] = bool(body[flag_key])
                if "excluded_equipment_ids" in body and isinstance(
                    body["excluded_equipment_ids"], list
                ):
                    p["excluded_equipment_ids"] = [
                        safe_int(x, 0)
                        for x in body["excluded_equipment_ids"]
                        if safe_int(x, 0) > 0
                    ]
                if "enabled_equipment_ids" in body and isinstance(
                    body["enabled_equipment_ids"], list
                ):
                    p["enabled_equipment_ids"] = [
                        safe_int(x, 0)
                        for x in body["enabled_equipment_ids"]
                        if safe_int(x, 0) > 0
                    ]
                if "allow_custom_size" in body:
                    p["allow_custom_size"] = bool(body["allow_custom_size"])
                if "has_cover_block" in body:
                    p["has_cover_block"] = bool(body["has_cover_block"])
                if "allowed_block_print_modes" in body and body["allowed_block_print_modes"] in (
                    "both",
                    "4+4",
                    "1+1",
                ):
                    p["allowed_block_print_modes"] = body["allowed_block_print_modes"]
                if "allowed_cover_print_modes" in body and body["allowed_cover_print_modes"] in (
                    "both",
                    "4+4",
                    "4+0",
                ):
                    p["allowed_cover_print_modes"] = body["allowed_cover_print_modes"]
                if "allowed_cover_paper_ids" in body and isinstance(
                    body["allowed_cover_paper_ids"], list
                ):
                    p["allowed_cover_paper_ids"] = [
                        safe_int(x, 0)
                        for x in body["allowed_cover_paper_ids"]
                        if safe_int(x, 0) > 0
                    ]
        save_data(data)
        return jsonify({"status": "ok"})
