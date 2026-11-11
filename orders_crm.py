"""Client orders, shared carts, CRM order board, order claiming, and CRM notifications routes."""
from __future__ import annotations

import math
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request

from core import (
    _DATE_RE,
    _EMAIL_RE,
    _MAX_ORDER_BODY_BYTES,
    _MAX_ORDER_ITEM_FIELD_BYTES,
    _MAX_ORDER_ITEMS,
    _MAX_SHARED_CARTS,
    _SHARE_TOKEN_RE,
    ORDER_STATUS_LABELS_RU,
    VALID_ORDER_STATUSES,
    VALID_PAYMENT_METHODS,
    VALID_PAYMENT_STATUSES,
    allow_order_request,
    allow_shared_cart_get,
    complete_order_idempotency,
    compute_order_request_hash,
    get_client_ip,
    get_current_user,
    get_request_crm_role,
    normalize_order_comments,
    release_order_idempotency,
    reserve_order_idempotency,
    sanitize_order_for_role,
    sync_after_repo_write,
    valid_design_link,
)
from pricing import calculate_order_pricing
from storage import (
    _DATA_LOCK,
    SHARED_CART_TTL_SECONDS,
    can_role_set_order_status,
    get_calc_index,
    get_repository,
    get_role_order_statuses_map,
    get_roles_map,
    has_role_permission,
    is_complete_company_details,
    load_data,
    safe_float,
    safe_int,
    sanitize_company_details,
)

orders_crm_bp = Blueprint("orders_crm", __name__)

_LINE_ITEM_STRING_FIELDS = (
    "productName",
    "product_name",
    "name",
    "customNote",
    "custom_note",
    "categoryName",
    "category_name",
    "formatLabel",
    "format_label",
    "format",
    "paperLabel",
    "paper_label",
    "paper",
    "printLabel",
    "print_label",
    "print",
    "laminationLabel",
    "lamination_label",
    "lamination",
    "pagesLabel",
    "pages_label",
    "pages",
    "extraParamsLabel",
    "extra_params_label",
    "extra",
)


def _estimate_sra3_from_format_and_qty(
    format_label: str, pages_label: str, quantity: int, settings: dict
):
    usable_w = float(settings.get("usable_width_mm", 310.0))
    usable_h = float(settings.get("usable_height_mm", 440.0))
    bleed = float(settings.get("bleed_mm", 4.0))
    nums = re.findall(r"(\d+(?:[.,]\d+)?)", str(format_label or ""))
    if len(nums) >= 2:
        w = max(1.0, float(nums[0].replace(",", ".")))
        h = max(1.0, float(nums[1].replace(",", ".")))
    else:
        w, h = 90.0, 50.0

    iw = w + bleed
    ih = h + bleed
    fit1 = max(0, int(usable_w // iw)) * max(0, int(usable_h // ih))
    fit2 = max(0, int(usable_w // ih)) * max(0, int(usable_h // iw))
    items_per_sheet = max(1, fit1, fit2)

    sheets_per_unit = 1
    if pages_label:
        p_nums = re.findall(r"(\d+)", str(pages_label))
        if p_nums:
            p_val = max(1, int(p_nums[0]))
            if "стр" in str(pages_label).lower() or "полос" in str(pages_label).lower():
                sheets_per_unit = max(1, math.ceil(p_val / 2.0))
            else:
                sheets_per_unit = p_val

    total_unit_sheets = max(1, int(quantity)) * sheets_per_unit
    sheets_needed = max(1, int(math.ceil(total_unit_sheets / float(items_per_sheet))))
    return sheets_needed, items_per_sheet


def _recalculate_order_totals_and_metrics(order_dict: dict, data: dict):
    items = order_dict.get("items") or []
    subtotal = sum(
        float(it.get("totalPrice") or it.get("total_price") or 0.0)
        for it in items
        if isinstance(it, dict)
    )
    disc_pct = max(
        0.0, min(100.0, safe_float(order_dict.get("discount_percent", 0.0), 0.0, 0.0, 100.0))
    )
    disc_amount = round((subtotal * disc_pct) / 100.0)
    final_total = max(0.0, round(subtotal - disc_amount))
    order_dict["discount_percent"] = round(disc_pct, 2) if disc_pct % 1 else int(disc_pct)
    order_dict["subtotal_price"] = round(subtotal, 2)
    order_dict["total_price"] = round(final_total, 2)

    settings = data.get("settings") or {}
    tax_percent = safe_float(settings.get("tax_percent", 6.0), 6.0, 0.0, 100.0)

    total_cost = 0.0
    total_sra3 = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        it_cost = safe_float(it.get("_internal_cost", 0.0), 0.0, 0.0)
        if it_cost <= 0:
            it_price = float(it.get("totalPrice") or it.get("total_price") or 0.0)
            it_cost = round(it_price * 0.45, 2)
            it["_internal_cost"] = it_cost
        total_cost += it_cost
        total_sra3 += max(0, int(it.get("sheets_needed") or it.get("sheetsNeeded") or 0))

    tax_cost = (
        round(final_total * (tax_percent / (100.0 + tax_percent)), 2) if tax_percent > 0 else 0.0
    )
    profit = round(final_total - total_cost - tax_cost, 2)

    order_dict["internal_metrics"] = {
        "total_cost": round(total_cost, 2),
        "tax_cost": round(tax_cost, 2),
        "profit": round(profit, 2),
        "total_sra3_sheets": int(total_sra3),
    }


def _is_own_crm_order(order_dict: dict, user: dict | None) -> bool:
    if not isinstance(order_dict, dict) or not isinstance(user, dict):
        return False
    uid = int(user.get("id") or 0)
    if uid <= 0:
        return False
    order_uid = int(order_dict.get("user_id") or 0)
    order_mgr_id = int(order_dict.get("manager_id") or 0)
    return order_uid == uid or order_mgr_id == uid


def _is_unassigned_client_order(order_dict: dict, data=None) -> bool:
    if not isinstance(order_dict, dict):
        return False
    order_mgr_id = int(order_dict.get("manager_id") or 0)
    if order_mgr_id > 0:
        return False
    if bool(order_dict.get("created_by_staff")):
        return False
    order_uid = int(order_dict.get("user_id") or 0)
    if order_uid > 0 and isinstance(data, dict):
        creator = next(
            (
                u
                for u in (data.get("users") or [])
                if isinstance(u, dict) and int(u.get("id") or 0) == order_uid
            ),
            None,
        )
        if creator:
            c_role = str(creator.get("role") or "client")
            if c_role != "client" or has_role_permission(c_role, "view_crm", data):
                return False
    return True


def _can_crm_user_see_order(
    order_dict: dict, user: dict | None, can_view_all: bool, data=None
) -> bool:
    if can_view_all:
        return True
    if _is_own_crm_order(order_dict, user):
        return True
    if _is_unassigned_client_order(order_dict, data=data):
        return True
    return False


def _collect_crm_notifications_for_user(
    orders, role: str, user: dict | None, data: dict
) -> list[dict]:
    uid = int(user.get("id") or 0) if isinstance(user, dict) else 0
    can_view_all = (role == "admin") or has_role_permission(role, "view_all_orders", data)
    allowed_statuses = (
        set(ORDER_STATUS_LABELS_RU.keys())
        if role == "admin"
        else set(get_role_order_statuses_map(data).get(role, []))
    )
    notifications: list[dict] = []
    for order in orders or []:
        if not isinstance(order, dict):
            continue
        if not _can_crm_user_see_order(order, user, can_view_all, data=data):
            continue
        is_own = _is_own_crm_order(order, user)
        for evt in order.get("events") or []:
            if not isinstance(evt, dict):
                continue
            evt_status = str(evt.get("status") or order.get("status") or "new")
            evt_type = str(evt.get("type") or "status_changed")
            in_scope = (
                (
                    evt_type == "manager_assigned"
                    and (int(evt.get("target_manager_id") or 0) == uid or role == "admin")
                )
                or (evt_type in ("order_created", "status_changed") and evt_status in allowed_statuses)
                or (is_own and evt_status in allowed_statuses)
            )
            if not in_scope:
                continue
            read_by_ids = [
                int(x)
                for x in (evt.get("read_by") or [])
                if str(x).isdigit() or isinstance(x, int)
            ]
            notifications.append(
                {
                    "id": str(evt.get("id") or ""),
                    "order_id": int(order.get("id") or 0),
                    "type": evt_type,
                    "status": evt_status,
                    "client_name": str(order.get("client_name") or ""),
                    "message": str(evt.get("message") or f"Заказ №{order.get('id')}"),
                    "created_at": str(evt.get("created_at") or order.get("created_at") or ""),
                    "is_read": bool(uid > 0 and uid in read_by_ids),
                }
            )
    notifications.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return notifications[:50]


def _build_priced_line_items(
    raw_items: list,
    data: dict,
    calc_idx: dict,
    *,
    include_internal: bool,
    include_calc_inputs: bool,
    pricing_user: dict | None = None,
    entity_genitive: str = "заказа",
) -> tuple[list[dict] | None, str | None]:
    """Normalize and server-price line items for orders and shared carts."""
    settings = data.get("settings") or {}
    products_list = data.get("products") or []
    result_items: list[dict] = []

    for idx, raw_it in enumerate(raw_items):
        if not isinstance(raw_it, dict):
            continue
        if any(
            len(str(raw_it.get(key) or "")) > _MAX_ORDER_ITEM_FIELD_BYTES
            for key in _LINE_ITEM_STRING_FIELDS
        ):
            return None, f"Слишком длинное поле позиции {entity_genitive}"

        qty = max(1, safe_int(raw_it.get("quantity", 1), 1, 1, 1_000_000))
        prod_id = safe_int(raw_it.get("productId") or raw_it.get("product_id"), 0)
        prod_name = str(
            raw_it.get("productName")
            or raw_it.get("product_name")
            or raw_it.get("name")
            or "Изделие"
        ).strip()

        if prod_id <= 0 and prod_name:
            matched_prod = next(
                (
                    p
                    for p in products_list
                    if str(p.get("name") or "").strip().lower() == prod_name.lower()
                ),
                None,
            )
            if matched_prod:
                prod_id = int(matched_prod["id"])

        paper_id = safe_int(raw_it.get("paperId") or raw_it.get("paper_id"), 0)
        cover_paper_id = safe_int(raw_it.get("coverPaperId") or raw_it.get("cover_paper_id"), 0)
        print_sides = safe_int(raw_it.get("printSides") or raw_it.get("print_sides"), 1)
        block_print_mode = str(
            raw_it.get("blockPrintMode") or raw_it.get("block_print_mode") or "4+4"
        )
        cover_print_mode = str(
            raw_it.get("coverPrintMode") or raw_it.get("cover_print_mode") or "4+0"
        )
        lamination_id = (
            raw_it.get("laminationId") if "laminationId" in raw_it else raw_it.get("lamination_id")
        )
        lamination_sides = safe_int(
            raw_it.get("laminationSides") or raw_it.get("lamination_sides"), 0
        )
        width_mm = raw_it.get("widthMm") if "widthMm" in raw_it else raw_it.get("width_mm")
        height_mm = raw_it.get("heightMm") if "heightMm" in raw_it else raw_it.get("height_mm")
        pages_count = safe_int(raw_it.get("pagesCount") or raw_it.get("pages_count"), 1)
        raw_sel_params = raw_it.get("selectedParams") or raw_it.get("selected_params") or {}
        selected_params: dict[str, str | int | float | bool] = {}
        if isinstance(raw_sel_params, dict):
            for pk, pv in raw_sel_params.items():
                if isinstance(pv, (str, int, float, bool)):
                    selected_params[str(pk)[:80]] = pv

        calc_res = None
        if prod_id > 0:
            calc_payload = {
                "product_id": prod_id,
                "paper_id": paper_id,
                "cover_paper_id": cover_paper_id,
                "print_sides": print_sides,
                "block_print_mode": block_print_mode,
                "cover_print_mode": cover_print_mode,
                "lamination_id": lamination_id,
                "lamination_sides": lamination_sides,
                "width_mm": width_mm,
                "height_mm": height_mm,
                "quantity": qty,
                "pages_count": pages_count,
                "selected_params": selected_params,
            }
            res_obj, err = calculate_order_pricing(
                data,
                calc_idx,
                calc_payload,
                is_admin=include_internal,
                user=pricing_user,
            )
            if not err and res_obj:
                calc_res = res_obj

        if not calc_res:
            return None, f"Не удалось выполнить серверный расчёт позиции {entity_genitive}"

        fmt_label = str(
            raw_it.get("formatLabel") or raw_it.get("format_label") or raw_it.get("format") or ""
        ).strip()
        pages_label = str(
            raw_it.get("pagesLabel") or raw_it.get("pages_label") or raw_it.get("pages") or ""
        ).strip()

        if include_internal and calc_res.get("internal"):
            sheets_needed = int(calc_res["internal"].get("sheets_needed") or 1)
            items_per_sheet = int(calc_res["internal"].get("items_per_sheet") or 1)
        else:
            sheets_needed, items_per_sheet = _estimate_sra3_from_format_and_qty(
                fmt_label, pages_label, qty, settings
            )

        total_p = round(float(calc_res.get("client_price") or 0.0), 2)
        unit_p = round(float(calc_res.get("unit_price") or 0.0), 2)

        item_dict: dict = {}
        if not include_calc_inputs:
            item_dict["id"] = str(raw_it.get("id") or f"item_{idx + 1}")
        item_dict["productId"] = prod_id if prod_id > 0 else None
        if include_calc_inputs:
            item_dict.update(
                {
                    "paperId": paper_id,
                    "coverPaperId": cover_paper_id,
                    "printSides": print_sides,
                    "blockPrintMode": block_print_mode,
                    "coverPrintMode": cover_print_mode,
                    "laminationId": safe_int(lamination_id, 0) if lamination_id is not None else None,
                    "laminationSides": lamination_sides,
                    "widthMm": safe_float(width_mm, 0.0) if width_mm is not None else None,
                    "heightMm": safe_float(height_mm, 0.0) if height_mm is not None else None,
                    "pagesCount": pages_count,
                    "selectedParams": selected_params,
                }
            )
        item_dict.update(
            {
                "mainCategoryId": str(
                    raw_it.get("mainCategoryId") or raw_it.get("main_category_id") or "polygraphy"
                ),
                "categoryName": str(
                    raw_it.get("categoryName") or raw_it.get("category_name") or ""
                ),
                "productName": prod_name,
                "customNote": str(raw_it.get("customNote") or raw_it.get("custom_note") or ""),
                "formatLabel": fmt_label or "По спецификации",
                "paperLabel": str(
                    raw_it.get("paperLabel")
                    or raw_it.get("paper_label")
                    or raw_it.get("paper")
                    or ""
                ),
                "printLabel": str(
                    raw_it.get("printLabel")
                    or raw_it.get("print_label")
                    or raw_it.get("print")
                    or ""
                ),
                "laminationLabel": str(
                    raw_it.get("laminationLabel")
                    or raw_it.get("lamination_label")
                    or raw_it.get("lamination")
                    or "Нет"
                ),
                "pagesLabel": pages_label,
                "extraParamsLabel": str(
                    raw_it.get("extraParamsLabel")
                    or raw_it.get("extra_params_label")
                    or raw_it.get("extra")
                    or "Нет"
                ),
                "showPaper": bool(raw_it.get("showPaper", True)),
                "showPrint": bool(raw_it.get("showPrint", True)),
                "showLamination": bool(raw_it.get("showLamination", True)),
                "quantity": qty,
                "unitPrice": unit_p,
                "totalPrice": total_p,
                "sheets_needed": sheets_needed,
                "sheetsNeeded": sheets_needed,
                "items_per_sheet": items_per_sheet,
                "itemsPerSheet": items_per_sheet,
            }
        )
        if include_internal:
            internal_cost = (
                round(float(calc_res["internal"].get("total_cost") or 0.0), 2)
                if calc_res.get("internal")
                else 0.0
            )
            item_dict["_internal_cost"] = internal_cost

        result_items.append(item_dict)

    if not result_items:
        return None, f"Некорректный список позиций {entity_genitive}"
    return result_items, None


@orders_crm_bp.route("/api/orders", methods=["POST"])
def create_order():
    remote_ip = get_client_ip()
    if not allow_order_request(remote_ip):
        return jsonify({"error": "Слишком много заказов. Повторите попытку позже."}), 429
    if request.content_length and request.content_length > _MAX_ORDER_BODY_BYTES:
        return jsonify({"error": "Заказ слишком большой"}), 413

    body = request.get_json(silent=True) or {}
    idempotency_key = (request.headers.get("Idempotency-Key") or "").strip()
    if len(idempotency_key) > 128:
        return jsonify({"error": "Некорректный Idempotency-Key"}), 400

    with _DATA_LOCK:
        data = load_data()
        calc_idx = get_calc_index(data)
        current_user = get_current_user(data=data)
        if not current_user or int(current_user.get("id") or 0) <= 0:
            return (
                jsonify(
                    {
                        "error": "Для оформления заказа необходимо войти в аккаунт или зарегистрироваться"
                    }
                ),
                401,
            )
        role = str(current_user.get("role") or "client")
        repository = get_repository()

        idempotency_scope = f"user:{int(current_user['id'])}"
        request_hash = compute_order_request_hash(body) if idempotency_key else ""
        idempotency_reserved = False
        idempotency_completed = False

        if idempotency_key:
            reservation = reserve_order_idempotency(
                repository, idempotency_scope, idempotency_key, request_hash
            )
            r_state = reservation.get("state")
            if r_state == "conflict":
                return (
                    jsonify(
                        {
                            "error": "Ключ идемпотентности уже использован с другими параметрами заказа"
                        }
                    ),
                    409,
                )
            if r_state == "pending":
                return (
                    jsonify({"error": "Заказ с этим ключом идемпотентности уже обрабатывается"}),
                    409,
                )
            if r_state == "completed":
                return jsonify(reservation.get("response", {})), int(
                    reservation.get("status", 201)
                )
            idempotency_reserved = True

        try:
            raw_items = body.get("items")
            if not isinstance(raw_items, list) or len(raw_items) == 0:
                return jsonify({"error": "Корзина пуста — добавьте хотя бы одну позицию"}), 400
            if len(raw_items) > _MAX_ORDER_ITEMS:
                return jsonify({"error": "В заказе слишком много позиций"}), 400

            client_name = (
                str(body.get("client_name") or "").strip()[:160]
                or str(current_user.get("name") or "").strip()[:160]
            )
            client_phone = (
                str(body.get("client_phone") or "").strip()[:60]
                or str(current_user.get("phone") or "").strip()[:60]
            )
            client_email = (
                str(body.get("client_email") or "").strip().lower()[:120]
                or str(current_user.get("email") or "").strip().lower()[:120]
            )
            comment = str(body.get("comment") or "").strip()[:1000]
            design_link = str(body.get("design_link") or "").strip()[:500]
            deadline_date = str(body.get("deadline_date") or "").strip()

            if client_email and not _EMAIL_RE.match(client_email):
                return jsonify({"error": "Введите корректный адрес электронной почты (Email)"}), 400
            if deadline_date and not _DATE_RE.match(deadline_date):
                return jsonify({"error": "Некорректная дата сдачи"}), 400
            if not valid_design_link(design_link):
                return jsonify({"error": "Ссылка на макет должна начинаться с https://"}), 400

            if not client_name:
                return jsonify({"error": "Укажите ваше имя или название компании"}), 400

            can_apply_discount = has_role_permission(role, "apply_discounts", data)
            discount_percent = (
                max(0.0, min(100.0, safe_float(body.get("discount_percent", 0.0), 0.0, 0.0, 100.0)))
                if can_apply_discount
                else 0.0
            )
            discount_comment = str(body.get("discount_comment") or "").strip()[:500]
            if can_apply_discount and discount_percent > 0 and not discount_comment:
                return (
                    jsonify(
                        {
                            "error": "Для установки скидки необходимо указать комментарий (причину скидки)"
                        }
                    ),
                    400,
                )

            stored_items, items_err = _build_priced_line_items(
                raw_items,
                data,
                calc_idx,
                include_internal=True,
                include_calc_inputs=False,
                pricing_user=current_user,
                entity_genitive="заказа",
            )
            if items_err or not stored_items:
                return jsonify({"error": items_err or "Некорректный список позиций заказа"}), 400

            raw_pm = str(body.get("payment_method") or "cash").strip()
            if raw_pm not in VALID_PAYMENT_METHODS:
                return jsonify({"error": "Недопустимый способ оплаты"}), 400

            is_staff_creator = (
                (role != "client")
                or has_role_permission(role, "view_crm", data)
                or has_role_permission(role, "manage_kp", data)
            )
            user_is_legal = is_complete_company_details(current_user.get("company_details"))

            if raw_pm == "bank_transfer" and not (user_is_legal or is_staff_creator):
                return (
                    jsonify({"error": "Безналичный расчёт доступен только юридическим лицам"}),
                    400,
                )

            if raw_pm == "bank_transfer":
                incoming_cd = sanitize_company_details(body.get("company_details"))
                profile_cd = (
                    sanitize_company_details(current_user.get("company_details"))
                    if (user_is_legal and not is_staff_creator)
                    else {}
                )
                merged_cd = dict(profile_cd)
                for k, v in incoming_cd.items():
                    if str(v or "").strip():
                        merged_cd[k] = str(v).strip()
                if not str(merged_cd.get("company_name") or "").strip() and client_name:
                    merged_cd["company_name"] = client_name[:300]
                order_company_details = sanitize_company_details(merged_cd)
                if not client_phone and order_company_details.get("phone"):
                    client_phone = order_company_details["phone"]
                need_invoice = True
                order_client_type = "legal"
            elif is_staff_creator and (
                str(body.get("client_type") or "").strip() == "legal"
                or (
                    bool(body.get("need_invoice", False))
                    and isinstance(body.get("company_details"), dict)
                    and sanitize_company_details(body.get("company_details"))
                )
            ):
                order_company_details = sanitize_company_details(body.get("company_details"))
                if not order_company_details.get("company_name") and client_name:
                    order_company_details = sanitize_company_details(
                        {**order_company_details, "company_name": client_name}
                    )
                if not client_phone and order_company_details.get("phone"):
                    client_phone = order_company_details["phone"]
                need_invoice = True
                order_client_type = "legal"
            else:
                need_invoice = bool(body.get("need_invoice", False)) if user_is_legal else False
                order_client_type = "legal" if (user_is_legal and need_invoice) else "individual"
                if order_client_type == "legal":
                    order_company_details = sanitize_company_details(
                        current_user.get("company_details")
                    )
                    if not client_phone and order_company_details.get("phone"):
                        client_phone = order_company_details["phone"]
                else:
                    need_invoice = False
                    order_company_details = {}

            now_iso = datetime.now(timezone.utc).isoformat()
            manager_id = int(current_user["id"]) if is_staff_creator else None
            manager_name = (
                str(current_user.get("name") or current_user.get("email") or "").strip()[:120]
                if is_staff_creator
                else ""
            )
            discount_author_name = (
                str(current_user.get("name") or current_user.get("email") or "").strip()[:120]
                if (can_apply_discount and discount_percent > 0)
                else ""
            )
            comment_author_name = (
                str(current_user.get("name") or current_user.get("email") or "").strip()[:120]
                if comment
                else ""
            )
            new_order = {
                "created_at": now_iso,
                "deadline_date": deadline_date,
                "user_id": int(current_user["id"]),
                "manager_id": manager_id,
                "manager_name": manager_name,
                "created_by_staff": bool(is_staff_creator),
                "client_name": client_name[:160],
                "client_phone": client_phone[:60],
                "client_email": client_email[:120],
                "client_type": order_client_type,
                "payment_method": raw_pm,
                "comment": comment[:1000],
                "comment_author_id": int(current_user["id"]) if comment else None,
                "comment_author_name": comment_author_name,
                "comment_updated_at": now_iso if comment else "",
                "comments": [
                    {
                        "id": f"cmt_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
                        "text": comment[:1000],
                        "author_name": (comment_author_name or client_name)[:120],
                        "author_id": int(current_user["id"]),
                        "created_at": now_iso,
                    }
                ]
                if comment
                else [],
                "design_link": design_link[:500],
                "need_invoice": need_invoice,
                "company_details": order_company_details,
                "status": "new",
                "payment_status": "unpaid",
                "discount_percent": discount_percent,
                "discount_comment": (
                    discount_comment if (can_apply_discount and discount_percent > 0) else ""
                ),
                "discount_author_id": (
                    int(current_user["id"])
                    if (can_apply_discount and discount_percent > 0)
                    else None
                ),
                "discount_author_name": discount_author_name,
                "discount_updated_at": (
                    now_iso if (can_apply_discount and discount_percent > 0) else ""
                ),
                "items": stored_items,
                "total_price": 0.0,
                "internal_metrics": {},
            }
            new_order["events"] = [
                {
                    "id": f"evt_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
                    "type": "order_created",
                    "status": "new",
                    "message": f"Новый заказ — статус «{ORDER_STATUS_LABELS_RU['new']}»",
                    "created_at": now_iso,
                    "actor_user_id": int(current_user["id"]),
                    "target_manager_id": new_order.get("manager_id"),
                    "read_by": [int(current_user["id"])],
                }
            ]
            _recalculate_order_totals_and_metrics(new_order, data)
            new_order = repository.create_order(new_order)
            sync_after_repo_write(repository)

            view_role = role if (role and role in get_roles_map(data)) else "client"
            response_payload = sanitize_order_for_role(
                new_order, view_role, data=data, is_own_client_order=True
            )
            if idempotency_key:
                complete_order_idempotency(
                    repository,
                    idempotency_scope,
                    idempotency_key,
                    request_hash,
                    response_payload,
                    201,
                    order_id=int(new_order["id"]),
                )
                idempotency_completed = True
            return jsonify(response_payload), 201
        finally:
            if idempotency_key and idempotency_reserved and not idempotency_completed:
                release_order_idempotency(
                    repository, idempotency_scope, idempotency_key, request_hash
                )


@orders_crm_bp.route("/api/orders/my", methods=["GET"])
def list_my_orders():
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        user = get_current_user(data=data)
        if not user:
            return jsonify({"error": "Необходима авторизация для просмотра ваших заказов"}), 401

        uid = int(user.get("id") or 0)
        orders = repository.list_orders_for_user(uid)
        my_orders = [
            sanitize_order_for_role(o, "client", data=data, is_own_client_order=True)
            for o in orders
            if isinstance(o, dict)
        ]
        return jsonify(my_orders)


@orders_crm_bp.route("/api/shared-carts", methods=["POST"])
def create_shared_cart():
    remote_ip = get_client_ip()
    if not allow_order_request(remote_ip):
        return jsonify({"error": "Слишком много запросов. Повторите попытку позже."}), 429
    if request.content_length and request.content_length > _MAX_ORDER_BODY_BYTES:
        return jsonify({"error": "Слишком большой объём данных корзины"}), 413

    body = request.get_json(silent=True) or {}
    raw_items = body.get("items")
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return jsonify({"error": "Корзина пуста — добавьте хотя бы одну позицию"}), 400
    if len(raw_items) > _MAX_ORDER_ITEMS:
        return jsonify({"error": "В корзине слишком много позиций"}), 400

    with _DATA_LOCK:
        data = load_data()
        calc_idx = get_calc_index(data)
        role, _ = get_request_crm_role(data=data)
        repository = get_repository()
        normalized_items, items_err = _build_priced_line_items(
            raw_items,
            data,
            calc_idx,
            include_internal=False,
            include_calc_inputs=True,
            pricing_user=None,
            entity_genitive="корзины",
        )
        if items_err or not normalized_items:
            return jsonify({"error": items_err or "Некорректный список позиций корзины"}), 400

        raw_meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
        can_apply_discount = bool(role and has_role_permission(role, "apply_discounts", data))
        discount_pct = (
            max(0.0, min(100.0, safe_float(raw_meta.get("discountPercent", 0.0), 0.0, 0.0, 100.0)))
            if can_apply_discount
            else 0.0
        )
        clean_meta = {
            "customerName": str(raw_meta.get("customerName") or "").strip()[:160],
            "comment": str(raw_meta.get("comment") or "").strip()[:500],
            "discountPercent": discount_pct,
        }

        token = secrets.token_hex(16)
        now_ts = time.time()
        expires_at_ts = now_ts + SHARED_CART_TTL_SECONDS
        now_iso = datetime.fromtimestamp(now_ts, timezone.utc).isoformat()
        expires_at_iso = datetime.fromtimestamp(expires_at_ts, timezone.utc).isoformat()
        cart_record = {
            "token": token,
            "created_at": now_iso,
            "expires_at": expires_at_iso,
            "expires_at_ts": expires_at_ts,
            "items": normalized_items,
            "meta": clean_meta,
        }

        repository.save_shared_cart(
            cart_record, ttl_seconds=SHARED_CART_TTL_SECONDS, max_carts=_MAX_SHARED_CARTS
        )
        sync_after_repo_write(repository)

        return (
            jsonify(
                {
                    "token": token,
                    "path": f"/cart?share={token}",
                    "items": normalized_items,
                    "meta": clean_meta,
                }
            ),
            201,
        )


@orders_crm_bp.route("/api/shared-carts/<string:token>", methods=["GET"])
def get_shared_cart(token: str):
    if not allow_shared_cart_get(get_client_ip()):
        return (
            jsonify({"error": "Слишком много запросов к общим корзинам. Повторите попытку позже."}),
            429,
        )
    clean_token = str(token or "").strip().lower()
    if not _SHARE_TOKEN_RE.match(clean_token):
        return (
            jsonify(
                {"error": "Ссылка на корзину не найдена или срок её действия (7 дней) истёк"}
            ),
            404,
        )

    with _DATA_LOCK:
        repository = get_repository()
        found = repository.get_shared_cart(clean_token)
        if not found:
            return (
                jsonify(
                    {"error": "Ссылка на корзину не найдена или срок её действия (7 дней) истёк"}
                ),
                404,
            )

        return (
            jsonify(
                {
                    "token": found["token"],
                    "created_at": found.get("created_at", ""),
                    "items": found.get("items", []),
                    "meta": found.get("meta", {}),
                }
            ),
            200,
        )


def _list_visible_crm_orders(repository, data: dict, role: str, user: dict | None) -> list[dict]:
    can_view_all = (role == "admin") or has_role_permission(role, "view_all_orders", data)
    if can_view_all:
        return repository.list_orders()
    if user and int(user.get("id") or 0) > 0:
        uid = int(user["id"])
        candidates = repository.list_crm_orders_for_user(uid)
        return [o for o in candidates if _can_crm_user_see_order(o, user, False, data=data)]
    return []


@orders_crm_bp.route("/api/crm/orders", methods=["GET"])
def crm_list_orders():
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        role, user = get_request_crm_role(data=data)
        if not role or role == "client" or not has_role_permission(role, "view_crm", data):
            return jsonify({"error": "Доступ к CRM запрещён для вашей роли"}), 403

        orders = _list_visible_crm_orders(repository, data, role, user)
        result = [sanitize_order_for_role(o, role, data=data) for o in orders if isinstance(o, dict)]
        return jsonify(result)


@orders_crm_bp.route("/api/crm/orders/<int:order_id>", methods=["PUT"])
def crm_update_order(order_id):
    body = request.get_json(silent=True) or {}
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        role, user = get_request_crm_role(data=data)
        if not role or role == "client" or not has_role_permission(role, "view_crm", data):
            return jsonify({"error": "Доступ запрещен"}), 403

        can_view_all = (role == "admin") or has_role_permission(role, "view_all_orders", data)
        can_update_status = has_role_permission(role, "update_order_status", data)
        can_manage_finances = has_role_permission(role, "manage_order_finances", data)
        can_apply_discount = (
            has_role_permission(role, "apply_discounts", data) or can_manage_finances
        )

        has_status_fields = any(
            k in body for k in ("status", "comment", "add_comment", "delete_comment_id")
        )
        finance_keys = (
            "payment_status",
            "deadline_date",
            "client_name",
            "client_phone",
            "client_email",
            "design_link",
            "need_invoice",
            "company_details",
            "manager_id",
        )
        has_finance_fields = any(k in body for k in finance_keys)
        has_discount_field = "discount_percent" in body or "discount_comment" in body

        has_allowed_status_change = has_status_fields and can_update_status
        has_allowed_finance_change = has_finance_fields and can_manage_finances
        has_allowed_discount_change = has_discount_field and can_apply_discount

        if (
            has_status_fields
            and not can_update_status
            and not (has_allowed_finance_change or has_allowed_discount_change)
        ):
            return (
                jsonify({"error": "Недостаточно прав для изменения статуса или комментария заказа"}),
                403,
            )
        if (has_finance_fields or has_discount_field) and not (
            has_allowed_status_change or has_allowed_finance_change or has_allowed_discount_change
        ):
            return jsonify({"error": "Недостаточно прав для изменения параметров заказа"}), 403

        if can_manage_finances:
            if "client_email" in body:
                cand_email = str(body.get("client_email") or "").strip().lower()[:120]
                if cand_email and not _EMAIL_RE.match(cand_email):
                    return (
                        jsonify({"error": "Введите корректный адрес электронной почты (Email)"}),
                        400,
                    )
            if "deadline_date" in body:
                cand_deadline = str(body.get("deadline_date") or "").strip()
                if cand_deadline and not _DATE_RE.match(cand_deadline):
                    return jsonify({"error": "Некорректная дата сдачи"}), 400
            if "design_link" in body:
                cand_link = str(body.get("design_link") or "").strip()[:500]
                if not valid_design_link(cand_link):
                    return jsonify({"error": "Ссылка на макет должна начинаться с https://"}), 400

        actor_uid = int(user["id"]) if user and int(user.get("id") or 0) > 0 else None
        actor_name = str(
            (user.get("name") or user.get("email")) if user else "Сотрудник"
        ).strip()[:120]
        now_iso = datetime.now(timezone.utc).isoformat()

        def _apply_comment_changes(order_obj: dict) -> dict:
            comments_list = normalize_order_comments(order_obj)
            if "add_comment" in body:
                new_text = str(body.get("add_comment") or "").strip()[:1000]
                if new_text and len(comments_list) < 50:
                    comments_list.append(
                        {
                            "id": f"cmt_{order_id}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
                            "text": new_text,
                            "author_name": actor_name,
                            "author_id": actor_uid,
                            "created_at": now_iso,
                        }
                    )
            if "delete_comment_id" in body:
                del_id = str(body.get("delete_comment_id") or "").strip()
                comments_list = [c for c in comments_list if str(c.get("id") or "") != del_id]
            if (
                "comment" in body
                and "add_comment" not in body
                and "delete_comment_id" not in body
            ):
                raw_c = str(body.get("comment") or "").strip()[:1000]
                if not raw_c:
                    comments_list = []
                else:
                    comments_list.append(
                        {
                            "id": f"cmt_{order_id}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
                            "text": raw_c,
                            "author_name": actor_name,
                            "author_id": actor_uid,
                            "created_at": now_iso,
                        }
                    )
            last_cmt = comments_list[-1] if comments_list else None
            return {
                "comments": comments_list,
                "comment": str(last_cmt.get("text") or "") if last_cmt else "",
                "comment_author_id": last_cmt.get("author_id") if last_cmt else None,
                "comment_author_name": str(last_cmt.get("author_name") or "") if last_cmt else "",
                "comment_updated_at": str(last_cmt.get("created_at") or now_iso) if last_cmt else "",
            }

        target = repository.get_order(order_id)
        if not target:
            return jsonify({"error": "Заказ не найден"}), 404
        if not _can_crm_user_see_order(target, user, can_view_all, data=data):
            return (
                jsonify({"error": "Доступ запрещён: вы можете редактировать только свои заказы"}),
                403,
            )

        old_status = str(target.get("status") or "new").strip()
        old_mgr_id = int(target.get("manager_id") or 0) if target.get("manager_id") else None
        patch: dict = {}

        if can_update_status:
            if "status" in body:
                new_status = str(body.get("status") or "").strip()
                if new_status not in VALID_ORDER_STATUSES:
                    return jsonify({"error": "Недопустимый статус заказа"}), 400
                current_status = str(target.get("status") or "").strip()
                if new_status != current_status and not can_role_set_order_status(
                    role, new_status, data
                ):
                    return (
                        jsonify(
                            {
                                "error": "У вашей роли нет прав для перевода заказа в выбранный статус"
                            }
                        ),
                        403,
                    )
                patch["status"] = new_status
            if any(k in body for k in ("comment", "add_comment", "delete_comment_id")):
                patch.update(_apply_comment_changes(target))

        if can_manage_finances:
            if "payment_status" in body:
                new_pay = str(body.get("payment_status") or "").strip()
                if new_pay not in VALID_PAYMENT_STATUSES:
                    return jsonify({"error": "Недопустимый статус оплаты"}), 400
                patch["payment_status"] = new_pay
            for key, limit in (
                ("deadline_date", 60),
                ("client_name", 160),
                ("client_phone", 60),
                ("client_email", 120),
                ("design_link", 500),
            ):
                if key in body:
                    val = str(body.get(key) or "").strip()[:limit]
                    if key == "client_name" and not val:
                        continue
                    patch[key] = val.lower() if key == "client_email" else val
            if "need_invoice" in body:
                patch["need_invoice"] = bool(body["need_invoice"])
            if "company_details" in body and isinstance(body["company_details"], dict):
                patch["company_details"] = sanitize_company_details(body["company_details"])
                if patch["company_details"]:
                    patch["need_invoice"] = True
            if can_view_all and "manager_id" in body:
                raw_mgr_id = body.get("manager_id")
                mgr_uid = safe_int(raw_mgr_id, 0) if raw_mgr_id is not None else 0
                if mgr_uid <= 0:
                    patch["manager_id"] = None
                    patch["manager_name"] = ""
                else:
                    mgr_user = repository.get_user_by_id(mgr_uid)
                    patch["manager_id"] = mgr_uid
                    patch["manager_name"] = str(
                        (
                            mgr_user.get("name") or mgr_user.get("email")
                            if mgr_user
                            else body.get("manager_name")
                        )
                        or ""
                    ).strip()[:120]

        if can_apply_discount and has_discount_field:
            next_disc = max(
                0.0,
                min(
                    100.0,
                    safe_float(
                        body.get("discount_percent", target.get("discount_percent", 0.0)),
                        0.0,
                        0.0,
                        100.0,
                    ),
                ),
            )
            if "discount_comment" in body:
                next_comment = str(body.get("discount_comment") or "").strip()[:500]
            else:
                next_comment = str(target.get("discount_comment") or "").strip()[:500]
            if next_disc > 0 and not next_comment:
                return (
                    jsonify(
                        {
                            "error": "Для установки скидки необходимо указать комментарий (причину скидки)"
                        }
                    ),
                    400,
                )
            patch["discount_percent"] = next_disc
            patch["discount_comment"] = next_comment if next_disc > 0 else ""
            patch["discount_author_id"] = actor_uid if next_disc > 0 else None
            patch["discount_author_name"] = actor_name if next_disc > 0 else ""
            patch["discount_updated_at"] = now_iso if next_disc > 0 else ""
            merged = dict(target)
            merged.update(patch)
            _recalculate_order_totals_and_metrics(merged, data)
            patch["subtotal_price"] = merged.get("subtotal_price", target.get("subtotal_price", 0.0))
            patch["total_price"] = merged.get("total_price", target.get("total_price", 0.0))
            patch["internal_metrics"] = merged.get(
                "internal_metrics", target.get("internal_metrics", {})
            )

        eff_status = str(patch.get("status") or target.get("status") or "new").strip()
        eff_mgr_raw = patch.get("manager_id") if "manager_id" in patch else target.get("manager_id")
        new_mgr_id = int(eff_mgr_raw or 0) if eff_mgr_raw else None
        events = [dict(e) for e in (target.get("events") or []) if isinstance(e, dict)]
        events_changed = False
        if eff_status != old_status:
            events.insert(
                0,
                {
                    "id": f"evt_{order_id}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
                    "type": "status_changed",
                    "old_status": old_status,
                    "status": eff_status,
                    "message": f"Заказ №{order_id} переведён в статус «{ORDER_STATUS_LABELS_RU.get(eff_status, eff_status)}»",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "actor_user_id": actor_uid,
                    "target_manager_id": new_mgr_id,
                    "read_by": [actor_uid] if actor_uid else [],
                },
            )
            events_changed = True
        if new_mgr_id != old_mgr_id and new_mgr_id:
            eff_client_name = patch.get("client_name") or target.get("client_name") or "Клиент"
            events.insert(
                0,
                {
                    "id": f"evt_{order_id}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
                    "type": "manager_assigned",
                    "status": eff_status,
                    "message": f"Вам назначен заказ №{order_id} ({eff_client_name})",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "actor_user_id": actor_uid,
                    "target_manager_id": int(new_mgr_id),
                    "read_by": [actor_uid] if actor_uid else [],
                },
            )
            events_changed = True
        if events_changed:
            patch["events"] = events[:30]

        updated = repository.update_order(order_id, patch) if patch else target
        sync_after_repo_write(repository)
        return jsonify(sanitize_order_for_role(updated or target, role, data=data))


@orders_crm_bp.route("/api/crm/orders/<int:order_id>/claim", methods=["POST"])
def crm_claim_order(order_id):
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        role, user = get_request_crm_role(data=data)
        if not role or role == "client" or not has_role_permission(role, "view_crm", data):
            return jsonify({"error": "Доступ к CRM запрещён для вашей роли"}), 403
        if not user or int(user.get("id") or 0) <= 0:
            return (
                jsonify(
                    {"error": "Для взятия заказа в работу войдите под личным аккаунтом менеджера"}
                ),
                403,
            )

        uid = int(user["id"])
        mgr_name = str(user.get("name") or user.get("email") or "").strip()[:120]
        now_iso = datetime.now(timezone.utc).isoformat()

        target = repository.get_order(order_id)
        if not target:
            return jsonify({"error": "Заказ не найден"}), 404
        existing_mgr = int(target.get("manager_id") or 0)
        if existing_mgr > 0 and existing_mgr != uid:
            return jsonify({"error": "Заказ уже взят в работу другим менеджером"}), 409
        if existing_mgr == 0 and not _is_unassigned_client_order(target, data=data):
            return jsonify({"error": "Заказ уже закреплён за другим сотрудником"}), 409

        evt = {
            "id": f"evt_{order_id}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
            "type": "manager_assigned",
            "status": str(target.get("status") or "new"),
            "message": f"Менеджер {mgr_name or f'#{uid}'} взял в работу заказ №{order_id}",
            "created_at": now_iso,
            "actor_user_id": uid,
            "target_manager_id": uid,
            "read_by": [uid],
        }
        claimed = repository.claim_order(
            order_id, uid, mgr_name, event=evt if existing_mgr != uid else None
        )
        if not claimed:
            return jsonify({"error": "Заказ уже взят в работу другим менеджером"}), 409
        sync_after_repo_write(repository)
        return jsonify(sanitize_order_for_role(claimed, role, data=data))


@orders_crm_bp.route("/api/crm/notifications", methods=["GET"])
def crm_list_notifications():
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        role, user = get_request_crm_role(data=data)
        if not role or role == "client" or not has_role_permission(role, "view_crm", data):
            return jsonify({"error": "Доступ к CRM запрещён для вашей роли"}), 403

        orders = _list_visible_crm_orders(repository, data, role, user)
        notifications = _collect_crm_notifications_for_user(orders, role, user, data)
        unread_count = sum(1 for n in notifications if not n["is_read"])
        return jsonify({"unread_count": unread_count, "notifications": notifications})


@orders_crm_bp.route("/api/crm/notifications/read", methods=["POST"])
def crm_mark_notifications_read():
    body = request.get_json(silent=True) or {}
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        role, user = get_request_crm_role(data=data)
        if (
            not role
            or role == "client"
            or not has_role_permission(role, "view_crm", data)
            or not user
            or int(user.get("id") or 0) <= 0
        ):
            return jsonify({"error": "Доступ к CRM запрещён для вашей роли"}), 403

        uid = int(user["id"])
        mark_all = bool(body.get("mark_all", False))
        notification_ids = {str(x) for x in (body.get("notification_ids") or []) if str(x)}

        orders = _list_visible_crm_orders(repository, data, role, user)
        any_modified = False
        for order in orders:
            if not isinstance(order, dict):
                continue
            evts = order.get("events")
            if not isinstance(evts, list) or not evts:
                continue
            order_modified = False
            for evt in evts:
                if not isinstance(evt, dict):
                    continue
                if mark_all or str(evt.get("id") or "") in notification_ids:
                    read_by = [
                        int(x)
                        for x in (evt.get("read_by") or [])
                        if str(x).isdigit() or isinstance(x, int)
                    ]
                    if uid not in read_by:
                        read_by.append(uid)
                        evt["read_by"] = read_by
                        order_modified = True
            if order_modified:
                any_modified = True
                repository.update_order(int(order["id"]), {"events": evts})

        if any_modified:
            sync_after_repo_write(repository)

        notifications = _collect_crm_notifications_for_user(orders, role, user, data)
        unread_count = sum(1 for n in notifications if not n["is_read"])
        return jsonify({"status": "ok", "unread_count": unread_count})


@orders_crm_bp.route("/api/crm/orders/<int:order_id>", methods=["DELETE"])
def crm_delete_order(order_id):
    with _DATA_LOCK:
        repository = get_repository()
        data = load_data()
        role, user = get_request_crm_role(data=data)
        if (
            not role
            or role == "client"
            or not has_role_permission(role, "view_crm", data)
            or not has_role_permission(role, "delete_orders", data)
        ):
            return jsonify({"error": "Недостаточно прав для удаления заказов"}), 403

        can_view_all = (role == "admin") or has_role_permission(role, "view_all_orders", data)
        target = repository.get_order(order_id)
        if not target:
            return jsonify({"error": "Заказ не найден"}), 404
        if not can_view_all and not _is_own_crm_order(target, user):
            return (
                jsonify({"error": "Доступ запрещён: вы можете удалять только свои заказы"}),
                403,
            )
        if not repository.delete_order(order_id):
            return jsonify({"error": "Заказ не найден"}), 404
        sync_after_repo_write(repository)
        return jsonify({"status": "deleted", "id": order_id})
