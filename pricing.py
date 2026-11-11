import math
from storage import safe_int, safe_float, get_default_tiers_for_cat, get_user_discount_for_product


def get_coefficient_for_category_and_qty(settings, category, quantity):
    cat_markups = settings.get("category_markups", {})
    tiers = cat_markups.get(category) or get_default_tiers_for_cat(category)
    sorted_tiers = sorted(tiers, key=lambda x: int(x.get("min_qty", 1)))
    chosen_coeff = float(sorted_tiers[0].get("coefficient", 2.0))
    for t in sorted_tiers:
        if quantity >= int(t.get("min_qty", 1)):
            chosen_coeff = float(t.get("coefficient", 2.0))
        else:
            break
    return chosen_coeff


def get_page_coefficient_for_category_and_qty(settings, category, quantity):
    cat_markups = settings.get("category_markups", {})
    tiers = cat_markups.get(category) or get_default_tiers_for_cat(category)
    sorted_tiers = sorted(tiers, key=lambda x: int(x.get("min_qty", 1)))
    first_t = sorted_tiers[0]
    chosen_coeff = float(first_t.get("page_coefficient", first_t.get("coefficient", 2.0)))
    for t in sorted_tiers:
        if quantity >= int(t.get("min_qty", 1)):
            chosen_coeff = float(t.get("page_coefficient", t.get("coefficient", 2.0)))
        else:
            break
    return chosen_coeff


def _is_truthy(val):
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val > 0
    return str(val).strip().lower() in (
        "true",
        "1",
        "yes",
        "да",
        "on",
        "perim",
        "perimeter",
        "corners",
        "corner",
        "по углам",
        "15",
        "20",
        "25",
        "30",
        "50",
    )


def resolve_wide_format_eyelets(width_mm, height_mm, raw_step, fallback_step_mm=300.0):
    step_str = str(raw_step).strip().lower() if raw_step is not None else ""
    if step_str in ("corners", "corner", "по углам", "4_corners"):
        return 4, "по углам"

    effective_step_mm = fallback_step_mm
    if step_str != "":
        parsed_cm = safe_float(step_str.replace(",", "."), 0.0)
        if parsed_cm > 0:
            effective_step_mm = max(10.0, parsed_cm * 10.0)

    perimeter_mm = 2.0 * (width_mm + height_mm)
    eyelets_per_unit = max(4, int(math.ceil(perimeter_mm / max(10.0, effective_step_mm))))
    step_cm_val = round(effective_step_mm / 10.0, 2)
    step_cm_label = (
        str(int(step_cm_val)) if step_cm_val == int(step_cm_val) else str(step_cm_val)
    )
    return eyelets_per_unit, f"шаг {step_cm_label} см"


def resolve_wide_format_paper_sqm_rate(paper):
    if not isinstance(paper, dict):
        return 0.0
    w_m = safe_float(paper.get("roll_width_m"), 0.0)
    l_m = safe_float(paper.get("roll_length_m"), 0.0)
    raw_res = (
        max(0.0001, round(w_m * l_m, 4))
        if (w_m > 0 and l_m > 0)
        else max(0.0001, safe_float(paper.get("resource", 1.0), 1.0, 0.0001))
    )
    raw_price = safe_float(paper.get("price", 0.0), 0.0, 0.0)
    explicit_rate = (
        paper.get("cost_per_sqm")
        if paper.get("cost_per_sqm") is not None
        else paper.get("price_per_m2")
    )
    if explicit_rate is not None:
        parsed_rate = safe_float(explicit_rate, -1.0)
        if parsed_rate >= 0.0 and abs(raw_price - round(parsed_rate * raw_res, 2)) <= 0.05:
            return parsed_rate
    return raw_price / raw_res


def calculate_order_pricing(data, calc_idx, body, is_admin=False, user=None):
    product_id = safe_int(body.get("product_id"), 0, 0, 10_000_000)
    paper_id = safe_int(body.get("paper_id"), 0, 0, 10_000_000)
    cover_paper_id = safe_int(body.get("cover_paper_id"), 0, 0, 10_000_000)
    print_sides_code = safe_int(body.get("print_sides"), 1, 1, 4)
    block_print_mode_req = str(body.get("block_print_mode") or "4+4").strip()
    cover_print_mode_req = str(body.get("cover_print_mode") or "4+0").strip()
    lamination_id = body.get("lamination_id")
    lamination_sides = safe_int(body.get("lamination_sides"), 0, 0, 2)

    quantity = safe_int(body.get("quantity"), 100, 1, 1_000_000)
    pages_count = safe_int(body.get("pages_count"), 1, 1, 10_000)

    settings = data["settings"]
    product = calc_idx["products_by_id"].get(product_id)
    if not product:
        return None, ("Продукт не найден", 400)

    category = product["category"]
    main_cat_id = calc_idx.get("subcat_parent_by_id", {}).get(category)
    if not main_cat_id:
        if category in ("polygraphy", "wide_format", "souvenirs", "stamps", "design"):
            main_cat_id = category
        else:
            main_cat_id = "polygraphy"

    mc_params = (settings.get("main_category_params") or {}).get(main_cat_id) or {}

    show_paper_select = bool(product.get("show_paper_select", True))
    show_print_sides = bool(product.get("show_print_sides", True))
    show_lamination_select = bool(product.get("show_lamination_select", True))

    include_paper_cost = bool(product.get("include_paper_cost", True))
    include_print_cost = bool(product.get("include_print_cost", True))
    include_toner_cost = bool(product.get("include_toner_cost", True))
    include_components_cost = bool(product.get("include_components_cost", True))
    include_lamination_cost = bool(product.get("include_lamination_cost", True))
    include_extra_params_cost = bool(product.get("include_extra_params_cost", True))
    include_defect_cost = bool(product.get("include_defect_cost", True))
    excluded_eq_ids = set(product.get("excluded_equipment_ids") or [])
    enabled_eq_ids = [safe_int(x, 0) for x in (product.get("enabled_equipment_ids") or []) if safe_int(x, 0) > 0]

    has_cover_block = bool(
        product.get(
            "has_cover_block",
            product.get("category") == "catalogs" or product.get("multi_page_mode") == "pages"
        )
    ) and main_cat_id == "polygraphy"
    allowed_block_print_modes = product.get("allowed_block_print_modes", "both")
    allowed_cover_print_modes = product.get("allowed_cover_print_modes", "both")

    papers_by_id = calc_idx["papers_by_id"]
    allowed_paper_ids = set(product.get("allowed_paper_ids") or [])
    allowed_cover_paper_ids = set(
        product.get("allowed_cover_paper_ids")
        if isinstance(product.get("allowed_cover_paper_ids"), list)
        else product.get("allowed_paper_ids") or []
    )
    allowed_lamination_ids = set(product.get("allowed_lamination_ids") or [])
    if show_paper_select and paper_id and allowed_paper_ids and paper_id not in allowed_paper_ids:
        return None, ("Выбранная бумага недоступна для этого продукта", 400)
    if cover_paper_id and allowed_cover_paper_ids and cover_paper_id not in allowed_cover_paper_ids:
        return None, ("Выбранная бумага обложки недоступна для этого продукта", 400)
    if lamination_id and allowed_lamination_ids and safe_int(lamination_id, 0) not in allowed_lamination_ids:
        return None, ("Выбранная ламинация недоступна для этого продукта", 400)

    paper = papers_by_id.get(paper_id)
    if not paper and show_paper_select:
        for pid in (product.get("allowed_paper_ids") or []):
            if pid in papers_by_id:
                paper = papers_by_id[pid]
                break
        if not paper:
            first_by_cat = calc_idx.get("first_paper_by_cat") or {}
            if main_cat_id == "wide_format":
                paper = first_by_cat.get("wf_banners") or calc_idx["first_paper"]
            elif main_cat_id == "souvenirs":
                paper = first_by_cat.get("souv_blanks") or calc_idx["first_paper"]
            elif main_cat_id == "stamps":
                paper = first_by_cat.get("stamps_mounts") or calc_idx["first_paper"]
            else:
                paper = first_by_cat.get("papers") or calc_idx["first_paper"]

    cover_paper = papers_by_id.get(cover_paper_id) or paper

    allow_custom_size = bool(product.get("allow_custom_size", False))
    multi_page_mode = product.get("multi_page_mode", "none")
    allowed_sides = product.get("allowed_sides", "both")
    default_mc_defect = mc_params.get("defect_percent", settings.get("defect_percent", 0.0))
    prod_defect_raw = product.get("defect_percent")
    raw_defect_pct = safe_float(
        prod_defect_raw if (prod_defect_raw is not None and float(prod_defect_raw) > 0) else default_mc_defect,
        0.0,
        0.0,
        100.0
    )
    defect_percent = raw_defect_pct if include_defect_cost else 0.0
    tax_percent = safe_float(
        mc_params.get("tax_percent", settings.get("tax_percent", 6.0)),
        6.0,
        0.0,
        100.0
    )

    sides_multiplier = 2 if print_sides_code == 2 else 1
    if allowed_sides == "single_only":
        sides_multiplier = 1
    elif allowed_sides == "duplex_only" or multi_page_mode == "pages":
        sides_multiplier = 2

    if multi_page_mode == "pages":
        sheets_per_unit = math.ceil(pages_count / 2.0)
    elif multi_page_mode == "sheets":
        sheets_per_unit = pages_count
    else:
        sheets_per_unit = 1

    total_product_sheets = quantity * sheets_per_unit

    cost_params = product.get("cost_params", []) if include_extra_params_cost else []
    selected_params = body.get("selected_params") if isinstance(body.get("selected_params"), dict) else {}
    disabled_internal_ids = set(body.get("disabled_internal_param_ids") or []) if is_admin else set()

    # Initialize common breakdown variables
    block_paper_cost = 0.0
    block_print_cost = 0.0
    cover_paper_cost = 0.0
    cover_print_cost = 0.0
    toner_total_cost = 0.0
    components_total_cost = 0.0
    paper_cost = 0.0
    wf_mat_cost_per_m2 = 0.0
    wf_total_area_m2 = 0.0
    print_cost = 0.0
    lamination_cost = 0.0
    extra_total_cost = 0.0
    params_breakdown = []
    handled_param_ids = set()

    a4_click_cost = 0.0
    a4_bw_click_cost = 0.0
    sra3_click_cost = 0.0
    sra3_sheets_needed = 0
    exact_sra3_sheets = 0.0
    block_sra3_sheets_needed = 0
    cover_sra3_sheets_needed = 0
    items_per_sheet = 1
    effective_block_print_mode = "4+4"
    effective_cover_print_mode = "4+0"

    if main_cat_id == "wide_format":
        # ---------------------------------------------------------------------
        # ШИРОКОФОРМАТНАЯ ПЕЧАТЬ (wide_format)
        # ---------------------------------------------------------------------
        max_wf_dim = 50000.0
        if allow_custom_size:
            width_mm = safe_float(body.get("width_mm", product["width_mm"]), float(product["width_mm"]), 1.0, max_wf_dim)
            height_mm = safe_float(body.get("height_mm", product["height_mm"]), float(product["height_mm"]), 1.0, max_wf_dim)
        else:
            width_mm = safe_float(product.get("width_mm", 1000.0), 1000.0, 1.0, max_wf_dim)
            height_mm = safe_float(product.get("height_mm", 1000.0), 1000.0, 1.0, max_wf_dim)

        bleed_mm = safe_float(mc_params.get("bleed_mm", 10.0), 10.0, 0.0, 1000.0)
        raw_margin_cm = selected_params.get("banner_margin_cm", body.get("banner_margin_cm"))
        banner_margin_mm = 0.0
        if raw_margin_cm is not None and str(raw_margin_cm).strip() != "":
            parsed_margin_cm = safe_float(
                str(raw_margin_cm).strip().replace(",", "."), 0.0, 0.0, 200.0
            )
            if parsed_margin_cm in (5.0, 10.0, 15.0, 20.0):
                banner_margin_mm = parsed_margin_cm * 10.0

        paper_roll_w_m = safe_float((paper or {}).get("roll_width_m"), 0.0)
        roll_width_mm = (
            safe_float(paper_roll_w_m * 1000.0, 1600.0, 100.0, 20000.0)
            if paper_roll_w_m > 0
            else safe_float(mc_params.get("roll_width_mm", 1600.0), 1600.0, 100.0, 20000.0)
        )
        roll_waste_m = safe_float(mc_params.get("roll_waste_m", 0.3), 0.3, 0.0, 100.0)
        eyelet_step_mm = safe_float(mc_params.get("eyelet_step_mm", 300.0), 300.0, 10.0, 10000.0)

        print_w_mm = width_mm + bleed_mm
        print_h_mm = height_mm + bleed_mm
        print_unit_area_m2 = (print_w_mm * print_h_mm) / 1_000_000.0
        print_area_m2 = print_unit_area_m2 * total_product_sheets

        item_w_with_bleed = width_mm + (2.0 * banner_margin_mm) + bleed_mm
        item_h_with_bleed = height_mm + (2.0 * banner_margin_mm) + bleed_mm
        material_unit_area_m2 = (item_w_with_bleed * item_h_with_bleed) / 1_000_000.0
        material_area_m2 = material_unit_area_m2 * total_product_sheets
        roll_waste_area_m2 = (roll_waste_m * (roll_width_mm / 1000.0)) if roll_waste_m > 0 else 0.0
        total_area_m2 = material_area_m2 + roll_waste_area_m2
        wf_total_area_m2 = total_area_m2

        exact_sra3_sheets = total_area_m2
        sra3_sheets_needed = max(1, int(math.ceil(total_area_m2)))
        items_per_sheet = 1

        if paper and show_paper_select and include_paper_cost:
            mat_cost_per_m2 = resolve_wide_format_paper_sqm_rate(paper)
            wf_mat_cost_per_m2 = mat_cost_per_m2
            paper_cost = total_area_m2 * mat_cost_per_m2

        wf_ink_per_m2 = 0.0
        if include_print_cost and include_toner_cost:
            for ti in calc_idx.get("wf_inks_list", []):
                if ti["id"] in excluded_eq_ids:
                    continue
                wf_ink_per_m2 += float(ti["price"]) / max(0.0001, float(ti["resource"]))

        wf_eq_per_m2 = 0.0
        eyelet_eq_unit_cost = 0.0
        for ci in calc_idx.get("wf_equipment_list", []):
            uc = float(ci["price"]) / max(0.0001, float(ci["resource"]))
            nl = (ci.get("name") or "").lower()
            ul = (ci.get("unit") or "").lower()
            if "люверс" in nl or ("шт" in ul and "м" not in ul):
                if ci["id"] not in excluded_eq_ids and eyelet_eq_unit_cost <= 0:
                    eyelet_eq_unit_cost = uc
                continue
            if include_print_cost and include_components_cost and ci["id"] not in excluded_eq_ids:
                wf_eq_per_m2 += uc

        if include_print_cost:
            toner_total_cost = print_area_m2 * sides_multiplier * wf_ink_per_m2
            components_total_cost = print_area_m2 * sides_multiplier * wf_eq_per_m2
            print_cost = toner_total_cost + components_total_cost

        if show_lamination_select and include_lamination_cost and lamination_id and lamination_sides > 0:
            lam = calc_idx["lams_by_id"].get(safe_int(lamination_id, 0))
            if lam and lam["resource"] > 0:
                lam_cost_per_m2 = float(lam["price"]) / max(0.0001, float(lam["resource"]))
                lamination_cost = print_area_m2 * lamination_sides * lam_cost_per_m2

        # Установка люверсов по периметру с шагом eyelet_step_mm
        if include_extra_params_cost:
            eyelet_param = None
            for idx, p in enumerate(cost_params):
                if not p.get("is_enabled", True):
                    continue
                pid = str(p.get("id") or f"param_{idx + 1}")
                pname_low = (p.get("name") or "").lower()
                if pid in ("eyelets", "wf_eyelets") or "люверс" in pname_low:
                    eyelet_param = (pid, p)
                    break

            eyelets_enabled = False
            param_eyelet_unit_cost = 0.0
            raw_ep_val = None
            if eyelet_param:
                ep_id, ep_obj = eyelet_param
                handled_param_ids.add(ep_id)
                raw_ep_val = selected_params.get(ep_id, body.get(ep_id, ep_obj.get("default_value")))
                if ep_obj.get("is_client_facing", False):
                    eyelets_enabled = _is_truthy(raw_ep_val) and str(raw_ep_val).lower() not in ("none", "no", "нет", "0", "false")
                else:
                    eyelets_enabled = ep_id not in disabled_internal_ids
                param_eyelet_unit_cost = float(ep_obj.get("cost") or 0.0)
            else:
                raw_ep_val = selected_params.get("eyelets", body.get("eyelets"))
                eyelets_enabled = _is_truthy(raw_ep_val)

            if eyelets_enabled and eyelet_step_mm > 0:
                raw_step_choice = selected_params.get("eyelets_step", body.get("eyelets_step"))
                if raw_step_choice is None and isinstance(raw_ep_val, str) and raw_ep_val.strip().lower() in (
                    "15",
                    "20",
                    "25",
                    "30",
                    "50",
                    "corners",
                    "по углам",
                ):
                    raw_step_choice = raw_ep_val
                eyelets_per_unit, eyelets_mode_label = resolve_wide_format_eyelets(
                    width_mm,
                    height_mm,
                    raw_step_choice,
                    fallback_step_mm=eyelet_step_mm,
                )
                total_eyelets = eyelets_per_unit * quantity
                unit_eyelet_price = eyelet_eq_unit_cost if eyelet_eq_unit_cost > 0 else (param_eyelet_unit_cost if param_eyelet_unit_cost > 0 else 2.5)
                eyelets_val = total_eyelets * unit_eyelet_price
                extra_total_cost += eyelets_val
                params_breakdown.append({
                    "id": eyelet_param[0] if eyelet_param else "eyelets",
                    "name": f"Установка люверсов ({eyelets_per_unit} шт./изд., {eyelets_mode_label})",
                    "total": round(eyelets_val, 2),
                    "is_client_facing": True
                })

    elif main_cat_id == "souvenirs":
        # ---------------------------------------------------------------------
        # СУВЕНИРЫ И ПОДАРКИ (souvenirs)
        # ---------------------------------------------------------------------
        if allow_custom_size:
            width_mm = safe_float(body.get("width_mm", product["width_mm"]), float(product["width_mm"]), 1.0, 5000.0)
            height_mm = safe_float(body.get("height_mm", product["height_mm"]), float(product["height_mm"]), 1.0, 5000.0)
        else:
            width_mm = max(1.0, float(product["width_mm"]))
            height_mm = max(1.0, float(product["height_mm"]))

        item_w_with_bleed = width_mm
        item_h_with_bleed = height_mm
        sra3_sheets_needed = quantity
        exact_sra3_sheets = float(quantity)
        items_per_sheet = 1

        if paper and show_paper_select and include_paper_cost:
            blank_unit_cost = float(paper["price"]) / max(1.0, float(paper["resource"]))
            paper_cost = blank_unit_cost * quantity

        souv_ink_unit = 0.0
        if include_print_cost and include_toner_cost:
            for ti in calc_idx.get("souv_inks_list", []):
                if ti["id"] in excluded_eq_ids:
                    continue
                souv_ink_unit += float(ti["price"]) / max(1.0, float(ti["resource"]))

        souv_eq_unit = 0.0
        if include_print_cost and include_components_cost:
            for ci in calc_idx.get("souv_equipment_list", []):
                if ci["id"] in excluded_eq_ids:
                    continue
                souv_eq_unit += float(ci["price"]) / max(1.0, float(ci["resource"]))

        if include_print_cost:
            toner_total_cost = quantity * sides_multiplier * souv_ink_unit
            components_total_cost = quantity * sides_multiplier * souv_eq_unit
            print_cost = toner_total_cost + components_total_cost

        setup_cost = safe_float(mc_params.get("setup_cost", 150.0), 150.0, 0.0, 1_000_000.0)
        packaging_cost = safe_float(mc_params.get("packaging_cost", 15.0), 15.0, 0.0, 100_000.0)
        if include_extra_params_cost:
            if packaging_cost > 0 and "mc_packaging" not in disabled_internal_ids:
                pack_val = packaging_cost * quantity
                extra_total_cost += pack_val
                params_breakdown.append({
                    "id": "mc_packaging",
                    "name": "Упаковка изделия",
                    "total": round(pack_val, 2),
                    "is_client_facing": False
                })
            if setup_cost > 0 and "mc_setup" not in disabled_internal_ids:
                extra_total_cost += setup_cost
                params_breakdown.append({
                    "id": "mc_setup",
                    "name": "Приладка оборудования на тираж",
                    "total": round(setup_cost, 2),
                    "is_client_facing": False
                })

    elif main_cat_id == "stamps":
        # ---------------------------------------------------------------------
        # ПЕЧАТИ И ШТАМПЫ (stamps)
        # ---------------------------------------------------------------------
        if allow_custom_size:
            width_mm = safe_float(body.get("width_mm", product["width_mm"]), float(product["width_mm"]), 1.0, 1000.0)
            height_mm = safe_float(body.get("height_mm", product["height_mm"]), float(product["height_mm"]), 1.0, 1000.0)
        else:
            width_mm = max(1.0, float(product["width_mm"]))
            height_mm = max(1.0, float(product["height_mm"]))

        item_w_with_bleed = width_mm
        item_h_with_bleed = height_mm
        sra3_sheets_needed = quantity
        exact_sra3_sheets = float(quantity)
        items_per_sheet = 1

        if paper and show_paper_select and include_paper_cost:
            mount_unit_cost = float(paper["price"]) / max(1.0, float(paper["resource"]))
            paper_cost = mount_unit_cost * quantity

        stamp_cons_unit = 0.0
        if include_print_cost and include_toner_cost:
            for ti in calc_idx.get("stamps_consumables_list", []):
                if ti["id"] in excluded_eq_ids:
                    continue
                stamp_cons_unit += float(ti["price"]) / max(1.0, float(ti["resource"]))

        stamp_eq_unit = 0.0
        if include_print_cost and include_components_cost:
            for ci in calc_idx.get("stamps_equipment_list", []):
                if ci["id"] in excluded_eq_ids:
                    continue
                stamp_eq_unit += float(ci["price"]) / max(1.0, float(ci["resource"]))

        if include_print_cost:
            toner_total_cost = quantity * stamp_cons_unit
            components_total_cost = quantity * stamp_eq_unit
            print_cost = toner_total_cost + components_total_cost

        # Обработка параметра срочности отдельно после остальных параметров (или отмечаем его тут)
        for idx, p in enumerate(cost_params):
            pid = str(p.get("id") or f"param_{idx + 1}")
            pname_low = (p.get("name") or "").lower()
            if pid in ("urgent", "is_urgent", "urgency") or "срочн" in pname_low:
                handled_param_ids.add(pid)

    elif main_cat_id == "design":
        # ---------------------------------------------------------------------
        # ДИЗАЙН И РЕТУШЬ (design)
        # ---------------------------------------------------------------------
        width_mm = max(1.0, float(product.get("width_mm", 210.0)))
        height_mm = max(1.0, float(product.get("height_mm", 297.0)))
        item_w_with_bleed = width_mm
        item_h_with_bleed = height_mm
        sra3_sheets_needed = quantity
        exact_sra3_sheets = float(quantity)
        items_per_sheet = 1

        hourly_rate = safe_float(mc_params.get("hourly_rate", 1200.0), 1200.0, 0.0, 1_000_000.0)
        prepress_cost = safe_float(mc_params.get("prepress_cost", 300.0), 300.0, 0.0, 1_000_000.0)
        free_revisions = safe_int(mc_params.get("free_revisions", 2), 2, 0, 100)
        extra_revision_cost = safe_float(mc_params.get("extra_revision_cost", 250.0), 250.0, 0.0, 1_000_000.0)

        default_hours = 1.0
        for idx, p in enumerate(cost_params):
            pid = str(p.get("id") or f"param_{idx + 1}")
            if pid in ("design_hours", "hours"):
                handled_param_ids.add(pid)
                try:
                    default_hours = max(0.25, float(p.get("default_value") or 1.0))
                except (ValueError, TypeError):
                    default_hours = 1.0
            elif pid in ("prepress", "include_prepress", "extra_revisions", "revisions"):
                handled_param_ids.add(pid)

        raw_hours = selected_params.get(
            "design_hours",
            selected_params.get("hours", body.get("design_hours", body.get("hours", default_hours)))
        )
        design_hours = safe_float(raw_hours, default_hours, 0.25, 1000.0)

        if include_print_cost:
            print_cost = hourly_rate * design_hours * quantity
            components_total_cost = print_cost

        if include_extra_params_cost:
            prepress_default = False
            for p in cost_params:
                if str(p.get("id")) in ("prepress", "include_prepress"):
                    prepress_default = bool(p.get("default_value", False))
                    break
            raw_prepress = selected_params.get(
                "prepress",
                selected_params.get("include_prepress", body.get("prepress", body.get("include_prepress", prepress_default)))
            )
            if _is_truthy(raw_prepress) and prepress_cost > 0:
                prep_val = prepress_cost * quantity
                extra_total_cost += prep_val
                params_breakdown.append({
                    "id": "prepress",
                    "name": "Предпечатная подготовка макета",
                    "total": round(prep_val, 2),
                    "is_client_facing": True
                })

            raw_extra_rev = selected_params.get("extra_revisions", body.get("extra_revisions"))
            if raw_extra_rev is not None:
                extra_rev_count = safe_int(raw_extra_rev, 0, 0, 1000)
            else:
                raw_total_rev = selected_params.get("revisions", body.get("revisions"))
                if raw_total_rev is not None:
                    extra_rev_count = max(0, safe_int(raw_total_rev, 0, 0, 1000) - free_revisions)
                else:
                    extra_rev_count = 0

            if extra_rev_count > 0 and extra_revision_cost > 0:
                rev_val = extra_rev_count * extra_revision_cost * quantity
                extra_total_cost += rev_val
                params_breakdown.append({
                    "id": "extra_revisions",
                    "name": f"Дополнительные правки (×{extra_rev_count})",
                    "total": round(rev_val, 2),
                    "is_client_facing": True
                })

    else:
        # ---------------------------------------------------------------------
        # ЛИСТОВАЯ ПОЛИГРАФИЯ SRA3 (polygraphy)
        # ---------------------------------------------------------------------
        usable_w = safe_float(
            mc_params.get("usable_width_mm", settings.get("usable_width_mm", 310.0)),
            310.0,
            10.0,
            5000.0
        )
        usable_h = safe_float(
            mc_params.get("usable_height_mm", settings.get("usable_height_mm", 440.0)),
            440.0,
            10.0,
            5000.0
        )
        max_sra3_len = max(usable_w, usable_h)
        min_sra3_side = min(usable_w, usable_h)

        if allow_custom_size:
            width_mm = safe_float(body.get("width_mm", product["width_mm"]), float(product["width_mm"]), 1.0, max_sra3_len)
            height_mm = safe_float(body.get("height_mm", product["height_mm"]), float(product["height_mm"]), 1.0, max_sra3_len)
            if width_mm > min_sra3_side and height_mm > min_sra3_side:
                if width_mm >= height_mm:
                    height_mm = min_sra3_side
                else:
                    width_mm = min_sra3_side
        else:
            width_mm = max(1.0, float(product["width_mm"]))
            height_mm = max(1.0, float(product["height_mm"]))

        if not include_print_cost or not show_print_sides:
            eff_toner_a4 = 0.0
            eff_comp_a4 = 0.0
            eff_toner_bw = 0.0
            eff_comp_bw = 0.0
        elif not excluded_eq_ids:
            eff_toner_a4 = calc_idx["toner_per_a4"] if include_toner_cost else 0.0
            eff_comp_a4 = calc_idx["comp_per_a4"] if include_components_cost else 0.0
            eff_toner_bw = calc_idx["toner_per_a4_bw"] if include_toner_cost else 0.0
            eff_comp_bw = calc_idx["comp_per_a4_bw"] if include_components_cost else 0.0
        else:
            eff_toner_a4 = 0.0
            eff_toner_bw = 0.0
            eff_comp_a4 = 0.0
            eff_comp_bw = 0.0
            if include_toner_cost:
                for ti in calc_idx["toners_list"]:
                    if ti["id"] in excluded_eq_ids:
                        continue
                    uc = float(ti["price"]) / max(1.0, float(ti["resource"]))
                    eff_toner_a4 += uc
                    nl = ti.get("name", "").lower()
                    if "black" in nl or "черн" in nl or "чёрн" in nl:
                        eff_toner_bw += uc
                if eff_toner_bw <= 0 and eff_toner_a4 > 0:
                    eff_toner_bw = eff_toner_a4 * 0.25
            if include_components_cost:
                for ci in calc_idx["components_list"]:
                    if ci["id"] in excluded_eq_ids:
                        continue
                    uc = float(ci["price"]) / max(1.0, float(ci["resource"]))
                    eff_comp_a4 += uc
                    if "c/m/y" not in ci.get("name", "").lower():
                        eff_comp_bw += uc

        a4_click_cost = eff_toner_a4 + eff_comp_a4
        sra3_click_cost = a4_click_cost * 2.0
        a4_bw_click_cost = eff_toner_bw + eff_comp_bw

        paper_sheet_cost = (paper["price"] / max(1.0, paper["resource"])) if (paper and show_paper_select and include_paper_cost) else 0.0
        cover_paper_sheet_cost = (cover_paper["price"] / max(1.0, cover_paper["resource"])) if (cover_paper and show_paper_select and include_paper_cost) else 0.0

        lam_sheet_cost_per_side = 0.0
        if show_lamination_select and include_lamination_cost and lamination_id and lamination_sides > 0:
            lam = calc_idx["lams_by_id"].get(safe_int(lamination_id, 0))
            if lam and lam["resource"] > 0:
                lam_cost_per_m = lam["price"] / lam["resource"]
                sheet_length_m = float(mc_params.get("sheet_length_m", settings.get("sheet_length_m", 0.5)))
                lam_sheet_cost_per_side = sheet_length_m * lam_cost_per_m

        bleed_mm = float(mc_params.get("bleed_mm", settings.get("bleed_mm", 4.0)))

        item_w_with_bleed = width_mm + bleed_mm
        item_h_with_bleed = height_mm + bleed_mm

        fit1 = int(usable_w // item_w_with_bleed) * int(usable_h // item_h_with_bleed)
        fit2 = int(usable_w // item_h_with_bleed) * int(usable_h // item_w_with_bleed)
        raw_fit = max(fit1, fit2)

        if raw_fit < 1:
            sra3_w = float(settings.get("sra3_width_mm", 320.0))
            sra3_h = float(settings.get("sra3_height_mm", 450.0))
            fit1_full = int(sra3_w // width_mm) * int(sra3_h // height_mm)
            fit2_full = int(sra3_w // height_mm) * int(sra3_h // width_mm)
            raw_fit = max(fit1_full, fit2_full)

        sra3_w = float(settings.get("sra3_width_mm", 320.0))
        sra3_h = float(settings.get("sra3_height_mm", 450.0))
        sheets_per_large_item = max(1, math.ceil((item_w_with_bleed * item_h_with_bleed) / (sra3_w * sra3_h)))

        if raw_fit >= 1:
            items_per_sheet = raw_fit
            block_sra3_sheets_needed = math.ceil(total_product_sheets / items_per_sheet)
            exact_block_sra3_sheets = total_product_sheets / float(items_per_sheet)
        else:
            items_per_sheet = 1
            block_sra3_sheets_needed = total_product_sheets * sheets_per_large_item
            exact_block_sra3_sheets = float(block_sra3_sheets_needed)

        base_a4_area_mm2 = 63000.0
        item_area_ratio_a4 = (width_mm * height_mm) / base_a4_area_mm2

        if has_cover_block:
            if allowed_block_print_modes == "4+4":
                effective_block_print_mode = "4+4"
            elif allowed_block_print_modes == "1+1":
                effective_block_print_mode = "1+1"
            elif allowed_block_print_modes == "0+0":
                effective_block_print_mode = "0+0"
            else:
                if block_print_mode_req == "0+0":
                    effective_block_print_mode = "0+0"
                elif block_print_mode_req == "1+1":
                    effective_block_print_mode = "1+1"
                else:
                    effective_block_print_mode = "4+4"

            if effective_block_print_mode == "0+0":
                block_click = 0.0
                block_toner_click = 0.0
                block_comp_click = 0.0
                block_sides_mult = 0
            elif effective_block_print_mode == "1+1":
                block_click = a4_bw_click_cost
                block_toner_click = eff_toner_bw
                block_comp_click = eff_comp_bw
                block_sides_mult = 2
            else:
                block_click = a4_click_cost
                block_toner_click = eff_toner_a4
                block_comp_click = eff_comp_a4
                block_sides_mult = 2
            block_paper_cost = exact_block_sra3_sheets * paper_sheet_cost if (show_paper_select and include_paper_cost) else 0.0
            if show_print_sides and include_print_cost and block_sides_mult > 0:
                block_print_cost = total_product_sheets * block_sides_mult * block_click * item_area_ratio_a4
                toner_total_cost += total_product_sheets * block_sides_mult * block_toner_click * item_area_ratio_a4
                components_total_cost += total_product_sheets * block_sides_mult * block_comp_click * item_area_ratio_a4

            if allowed_cover_print_modes == "4+4":
                effective_cover_print_mode = "4+4"
            elif allowed_cover_print_modes == "4+0":
                effective_cover_print_mode = "4+0"
            else:
                effective_cover_print_mode = "4+4" if cover_print_mode_req == "4+4" else "4+0"

            cover_sides_mult = 2 if effective_cover_print_mode == "4+4" else 1
            total_cover_sheets = quantity * 1
            if raw_fit >= 1:
                cover_sra3_sheets_needed = math.ceil(total_cover_sheets / items_per_sheet)
                exact_cover_sra3_sheets = total_cover_sheets / float(items_per_sheet)
            else:
                cover_sra3_sheets_needed = total_cover_sheets * sheets_per_large_item
                exact_cover_sra3_sheets = float(cover_sra3_sheets_needed)

            cover_paper_cost = exact_cover_sra3_sheets * cover_paper_sheet_cost if (show_paper_select and include_paper_cost) else 0.0
            if show_print_sides and include_print_cost:
                cover_print_cost = total_cover_sheets * cover_sides_mult * a4_click_cost * item_area_ratio_a4
                toner_total_cost += total_cover_sheets * cover_sides_mult * eff_toner_a4 * item_area_ratio_a4
                components_total_cost += total_cover_sheets * cover_sides_mult * eff_comp_a4 * item_area_ratio_a4

            paper_cost = block_paper_cost + cover_paper_cost
            print_cost = block_print_cost + cover_print_cost
            sra3_sheets_needed = block_sra3_sheets_needed + cover_sra3_sheets_needed
            exact_sra3_sheets = exact_block_sra3_sheets + exact_cover_sra3_sheets
            lamination_cost = (exact_cover_sra3_sheets * lamination_sides * lam_sheet_cost_per_side) if (show_lamination_select and include_lamination_cost) else 0.0
        else:
            sra3_sheets_needed = block_sra3_sheets_needed
            exact_sra3_sheets = exact_block_sra3_sheets
            paper_cost = exact_sra3_sheets * paper_sheet_cost if (show_paper_select and include_paper_cost) else 0.0
            if show_print_sides and include_print_cost:
                print_cost = total_product_sheets * sides_multiplier * a4_click_cost * item_area_ratio_a4
                toner_total_cost = total_product_sheets * sides_multiplier * eff_toner_a4 * item_area_ratio_a4
                components_total_cost = total_product_sheets * sides_multiplier * eff_comp_a4 * item_area_ratio_a4
            else:
                print_cost = 0.0
            lamination_cost = (exact_sra3_sheets * lamination_sides * lam_sheet_cost_per_side) if (show_lamination_select and include_lamination_cost) else 0.0

    # Generic extra cost_params loop (skips parameters already handled by section-specific logic)
    for idx, param in enumerate(cost_params):
        if not param.get("is_enabled", True):
            continue
        p_id = str(param.get("id") or f"param_{idx + 1}")
        if p_id in handled_param_ids:
            continue
        p_name = param.get("name", "Доп. параметр")
        p_mode = param.get("mode", "per_unit")
        is_client = bool(param.get("is_client_facing", False))
        unit_cost = 0.0
        display_name = p_name

        if is_client:
            input_type = param.get("input_type", "checkbox")
            raw_val = selected_params.get(p_id, param.get("default_value"))
            if input_type == "select":
                opts = param.get("options") if isinstance(param.get("options"), list) else []
                chosen_opt = next((o for o in opts if str(o.get("id")) == str(raw_val)), None)
                if not chosen_opt and opts:
                    chosen_opt = opts[0]
                if chosen_opt:
                    unit_cost = float(chosen_opt.get("cost", 0.0))
                    display_name = f"{p_name} ({chosen_opt.get('label', '')})"
            elif input_type == "number":
                try:
                    num_val = max(0.0, float(raw_val or 0))
                except (ValueError, TypeError):
                    num_val = 0.0
                unit_cost = float(param.get("cost", 0.0)) * num_val
                if num_val > 0:
                    qty_str = str(int(num_val)) if num_val.is_integer() else str(num_val)
                    display_name = f"{p_name} (×{qty_str})"
            else:
                enabled = _is_truthy(raw_val)
                if enabled:
                    unit_cost = float(param.get("cost", 0.0))
        else:
            if p_id in disabled_internal_ids:
                continue
            unit_cost = float(param.get("cost", 0.0))

        if unit_cost <= 0:
            continue
        if p_mode == "per_sheet":
            val = unit_cost * exact_sra3_sheets
        elif p_mode == "per_order":
            val = unit_cost
        else:
            val = unit_cost * quantity
        extra_total_cost += val
        params_breakdown.append({
            "id": p_id,
            "name": display_name,
            "total": round(val, 2),
            "is_client_facing": is_client
        })

    # Наценка за срочность для раздела "Печати и штампы" (stamps)
    if main_cat_id == "stamps" and include_extra_params_cost:
        urgency_pct = safe_float(mc_params.get("urgency_percent", 50.0), 50.0, 0.0, 500.0)
        is_urgent_selected = (
            _is_truthy(selected_params.get("urgent"))
            or _is_truthy(selected_params.get("is_urgent"))
            or _is_truthy(selected_params.get("urgency"))
            or _is_truthy(body.get("urgent"))
            or _is_truthy(body.get("is_urgent"))
        )
        if not is_urgent_selected:
            for idx, p in enumerate(cost_params):
                if not p.get("is_enabled", True):
                    continue
                pid = str(p.get("id") or f"param_{idx + 1}")
                pname_low = (p.get("name") or "").lower()
                if pid in ("urgent", "is_urgent", "urgency") or "срочн" in pname_low:
                    raw_u = selected_params.get(pid, p.get("default_value"))
                    if _is_truthy(raw_u):
                        is_urgent_selected = True
                        break

        if is_urgent_selected and urgency_pct > 0:
            base_for_urgency = paper_cost + print_cost + extra_total_cost
            urgency_val = base_for_urgency * (urgency_pct / 100.0)
            extra_total_cost += urgency_val
            params_breakdown.append({
                "id": "urgent",
                "name": f"Наценка за срочность (+{int(urgency_pct)}%)",
                "total": round(urgency_val, 2),
                "is_client_facing": True
            })

    if include_extra_params_cost and enabled_eq_ids:
        items_by_id = calc_idx["items_by_id"]
        item_area_m2 = (width_mm * height_mm) / 1_000_000.0
        for eq_id in enabled_eq_ids:
            eq_item = items_by_id.get(eq_id)
            if not eq_item:
                continue
            eq_res = max(1.0, float(eq_item.get("resource") or 1.0))
            eq_unit_cost = float(eq_item.get("price") or 0.0) / eq_res
            if eq_unit_cost <= 0:
                continue
            eq_unit_str = (eq_item.get("unit") or "").lower()
            if "м²" in eq_unit_str or "м2" in eq_unit_str:
                eq_val = eq_unit_cost * item_area_m2 * total_product_sheets
            elif "лист" in eq_unit_str:
                eq_val = eq_unit_cost * total_product_sheets
            else:
                eq_val = eq_unit_cost * quantity
            extra_total_cost += eq_val
            params_breakdown.append({
                "id": f"eq_{eq_id}",
                "name": eq_item.get("name", "Оборудование"),
                "total": round(eq_val, 2),
                "is_client_facing": False
            })

    subtotal_cost = print_cost + paper_cost + lamination_cost + extra_total_cost
    defect_cost = subtotal_cost * (defect_percent / 100.0)
    total_cost = subtotal_cost + defect_cost

    coefficient = get_coefficient_for_category_and_qty(settings, category, quantity)
    page_coefficient = (
        get_page_coefficient_for_category_and_qty(settings, category, quantity)
        if has_cover_block
        else coefficient
    )

    if has_cover_block:
        block_subtotal = block_paper_cost + block_print_cost
        rest_subtotal = cover_paper_cost + cover_print_cost + lamination_cost + extra_total_cost
        block_total_cost = block_subtotal * (1.0 + defect_percent / 100.0)
        rest_total_cost = rest_subtotal * (1.0 + defect_percent / 100.0)
        base_unit_price = (block_total_cost * page_coefficient + rest_total_cost * coefficient) / quantity
    else:
        base_unit_price = (total_cost / quantity) * coefficient

    raw_unit_price = base_unit_price * (1.0 + tax_percent / 100.0)
    unit_price = max(1, int(math.floor(raw_unit_price + 0.5))) if total_cost > 0 else 0
    client_price = unit_price * quantity

    original_unit_price = unit_price
    original_client_price = client_price
    user_discount_pct = get_user_discount_for_product(user, product_id, category, main_cat_id)
    if user_discount_pct > 0 and total_cost > 0:
        discounted_raw_unit = raw_unit_price * (1.0 - user_discount_pct / 100.0)
        unit_price = max(1, int(math.floor(discounted_raw_unit + 0.5)))
        client_price = unit_price * quantity

    tax_cost = client_price * (tax_percent / (100.0 + tax_percent)) if tax_percent > 0 else 0.0

    response_data = {
        "client_price": client_price,
        "unit_price": unit_price,
        "quantity": quantity,
        "discount_percent": user_discount_pct,
        "original_client_price": original_client_price,
        "original_unit_price": original_unit_price,
    }

    if is_admin:
        breakdown_data = {
            "print_cost": round(print_cost, 2),
            "toner_cost": round(toner_total_cost, 2),
            "components_cost": round(components_total_cost, 2),
            "paper_cost": round(paper_cost, 2),
            "lamination_cost": round(lamination_cost, 2),
            "extra_cost": round(extra_total_cost, 2),
            "a4_click_cost": round(a4_click_cost, 2),
            "a4_bw_click_cost": round(a4_bw_click_cost, 2),
            "sra3_click_cost": round(sra3_click_cost, 2),
            "params": params_breakdown
        }
        if main_cat_id == "wide_format":
            breakdown_data["paper_cost_per_m2"] = round(wf_mat_cost_per_m2, 2)
            breakdown_data["total_area_m2"] = round(wf_total_area_m2, 3)
        if has_cover_block:
            breakdown_data.update({
                "block_paper_cost": round(block_paper_cost, 2),
                "block_print_cost": round(block_print_cost, 2),
                "block_sheets_needed": block_sra3_sheets_needed,
                "block_print_mode": effective_block_print_mode,
                "cover_paper_cost": round(cover_paper_cost, 2),
                "cover_print_cost": round(cover_print_cost, 2),
                "cover_sheets_needed": cover_sra3_sheets_needed,
                "cover_print_mode": effective_cover_print_mode
            })
        response_data["internal"] = {
            "main_category_id": main_cat_id,
            "total_cost": round(total_cost, 2),
            "cost_per_unit": round(total_cost / quantity, 2),
            "profit": round(client_price - total_cost - tax_cost, 2),
            "coefficient": round(coefficient, 2),
            "page_coefficient": round(page_coefficient, 2),
            "defect_percent": round(defect_percent, 2),
            "defect_cost": round(defect_cost, 2),
            "tax_percent": round(tax_percent, 2),
            "tax_cost": round(tax_cost, 2),
            "sheets_needed": sra3_sheets_needed,
            "items_per_sheet": items_per_sheet,
            "size_with_bleed": f"{int(item_w_with_bleed)} × {int(item_h_with_bleed)} мм",
            "has_cover_block": has_cover_block,
            "breakdown": breakdown_data
        }

    return response_data, None

