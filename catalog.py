"""Public catalog, dynamic SEO page metadata, pricing calculation, and uploaded image serving."""
from __future__ import annotations

import os
from flask import Blueprint, Response, jsonify, request, send_from_directory

from core import get_current_user, get_request_crm_role
from pricing import calculate_order_pricing
from storage import (
    _DATA_LOCK,
    LEGACY_UPLOAD_FOLDER,
    UPLOAD_FOLDER,
    get_calc_index,
    get_public_catalog_bytes,
    has_role_permission,
    load_data,
)

catalog_bp = Blueprint("catalog", __name__)


@catalog_bp.route("/uploads/<path:filename>", methods=["GET"])
def serve_uploaded_file(filename):
    primary_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.isfile(primary_path):
        return send_from_directory(UPLOAD_FOLDER, filename)
    if os.path.isdir(LEGACY_UPLOAD_FOLDER):
        return send_from_directory(LEGACY_UPLOAD_FOLDER, filename)
    return send_from_directory(UPLOAD_FOLDER, filename)


@catalog_bp.route("/api/catalog", methods=["GET"])
def get_public_catalog():
    with _DATA_LOCK:
        data = load_data()
        json_bytes = get_public_catalog_bytes(data)
        return Response(json_bytes, mimetype="application/json; charset=utf-8")


@catalog_bp.route("/api/page-info", methods=["GET"])
def get_dynamic_page_info():
    with _DATA_LOCK:
        data = load_data()
        main_cat_id = (request.args.get("main_category_id") or "").strip()
        sub_cat_id = (request.args.get("subcategory_id") or "").strip()
        prod_id_raw = request.args.get("product_id")
        prod_id = int(prod_id_raw) if prod_id_raw and str(prod_id_raw).isdigit() else None

        main_categories = [
            mc for mc in data.get("main_categories", []) if not mc.get("is_hidden", False)
        ]
        categories = [c for c in data.get("categories", []) if not c.get("is_hidden", False)]
        products = [p for p in data.get("products", []) if not p.get("is_hidden", False)]

        resolved_product = (
            next((p for p in products if p["id"] == prod_id), None) if prod_id else None
        )
        if resolved_product and not sub_cat_id:
            sub_cat_id = resolved_product["category"]

        resolved_subcategory = (
            next((c for c in categories if c["id"] == sub_cat_id), None) if sub_cat_id else None
        )
        if resolved_subcategory and not main_cat_id:
            main_cat_id = resolved_subcategory.get("parent_id", "")

        resolved_main_category = (
            next((mc for mc in main_categories if mc["id"] == main_cat_id), None)
            if main_cat_id
            else None
        )

        return jsonify(
            {
                "main_category": resolved_main_category,
                "subcategory": resolved_subcategory,
                "product": resolved_product,
                "url_paths": {
                    "main_category": (
                        f"/category/{resolved_main_category['id']}"
                        if resolved_main_category
                        else None
                    ),
                    "subcategory": (
                        f"/category/{resolved_main_category['id'] if resolved_main_category else 'polygraphy'}/{resolved_subcategory['id']}"
                        if resolved_subcategory
                        else None
                    ),
                    "product": (
                        f"/category/{resolved_main_category['id'] if resolved_main_category else 'polygraphy'}/{resolved_subcategory['id'] if resolved_subcategory else resolved_product['category']}/{resolved_product['id']}"
                        if resolved_product
                        else None
                    ),
                },
            }
        )


@catalog_bp.route("/api/calculate", methods=["POST"])
def calculate_order():
    with _DATA_LOCK:
        data = load_data()
        calc_idx = get_calc_index(data)
        body = request.get_json(silent=True) or {}
        current_user = get_current_user(data=data)
        role, _ = get_request_crm_role(data=data)
        can_view_internal = (role == "admin") or has_role_permission(
            role, "view_internal_metrics", data
        )
        response_data, err = calculate_order_pricing(
            data, calc_idx, body, is_admin=can_view_internal, user=current_user
        )
        if err:
            return jsonify({"error": err[0]}), err[1]
        return jsonify(response_data)
