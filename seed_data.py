"""Static catalog, material, pricing tier, and product seed definitions."""
from __future__ import annotations

DEFAULT_CLIENT_NAMES = {
    "NOW!PRINT - Gloss 115 гр.": "Мелованная глянцевая 115 г/м²",
    "NOW!PRINT - Eco Gloss/Matt - 128 гр.": "Мелованная бумага 128 г/м²",
    "NOW!PRINT - Eco Gloss - 150 гр.": "Мелованная глянцевая 150 г/м²",
    "NOW!PRINT - Eco Matt - 115 гр.": "Мелованная матовая 115 г/м²",
    "NOW!PRINT - Eco Matt - 300 гр.": "Плотная матовая бумага 300 г/м²",
    "NOW!PRINT - Plus - 90 гр.": "Тонкая бумага 90 г/м²",
    "NOW!PRINT - Plus - 170 гр.": "Плотная бумага 170 г/м²",
    "MASTERTAC Самоклейка - Kraft-Brown - 175 гр.": "Самоклеящаяся бумага Крафт 175 г/м²",
    "MASTERTAC Самоклейка - Tamperproof - 230 гр.": "Самоклеящаяся пломбировочная 230 г/м²",
    "MASTERTAC Самоклейка - Petlazer Matt - 197 гр.": "Самоклеящаяся матовая пленка 197 г/м²",
    "Soft-Touch - 28мкр.": "Матовая бархатная (Soft-Touch 28 мкр)",
    "Soft-Touch - 34мкр.": "Матовая бархатная (Soft-Touch 34 мкр)",
}

DEFAULT_TIERS_STANDARD = [
    {"min_qty": 1, "coefficient": 9.0},
    {"min_qty": 25, "coefficient": 7.0},
    {"min_qty": 100, "coefficient": 6.0},
    {"min_qty": 250, "coefficient": 5.5},
    {"min_qty": 500, "coefficient": 5.0},
    {"min_qty": 1000, "coefficient": 4.5},
    {"min_qty": 2500, "coefficient": 4.0},
]

DEFAULT_TIERS_BOOKLETS = [
    {"min_qty": 1, "coefficient": 12.0},
    {"min_qty": 25, "coefficient": 8.0},
    {"min_qty": 100, "coefficient": 7.0},
    {"min_qty": 250, "coefficient": 6.5},
    {"min_qty": 500, "coefficient": 6.0},
    {"min_qty": 1000, "coefficient": 5.0},
    {"min_qty": 2500, "coefficient": 4.5},
]

DEFAULT_TIERS_CALENDARS = [
    {"min_qty": 1, "coefficient": 12.0},
    {"min_qty": 5, "coefficient": 8.0},
    {"min_qty": 10, "coefficient": 6.0},
    {"min_qty": 25, "coefficient": 4.5},
    {"min_qty": 50, "coefficient": 3.5},
    {"min_qty": 100, "coefficient": 3.0},
    {"min_qty": 250, "coefficient": 2.2},
    {"min_qty": 500, "coefficient": 2.1},
    {"min_qty": 1000, "coefficient": 2.0},
    {"min_qty": 2500, "coefficient": 1.9},
]

DEFAULT_TIERS_CATALOGS = [
    {"min_qty": 1, "coefficient": 12.0, "page_coefficient": 9.0},
    {"min_qty": 5, "coefficient": 8.0, "page_coefficient": 8.0},
    {"min_qty": 10, "coefficient": 6.0, "page_coefficient": 7.5},
    {"min_qty": 25, "coefficient": 4.2, "page_coefficient": 7.0},
    {"min_qty": 50, "coefficient": 3.2, "page_coefficient": 6.5},
    {"min_qty": 100, "coefficient": 2.8, "page_coefficient": 6.0},
    {"min_qty": 250, "coefficient": 2.5, "page_coefficient": 5.5},
    {"min_qty": 500, "coefficient": 2.0, "page_coefficient": 5.0},
    {"min_qty": 1000, "coefficient": 1.9, "page_coefficient": 4.5},
    {"min_qty": 2500, "coefficient": 1.8, "page_coefficient": 4.0},
]

DEFAULT_TIERS_WIDE_FORMAT = [
    {"min_qty": 1, "coefficient": 2.8},
    {"min_qty": 5, "coefficient": 2.4},
    {"min_qty": 10, "coefficient": 2.1},
    {"min_qty": 25, "coefficient": 1.9},
    {"min_qty": 50, "coefficient": 1.75},
    {"min_qty": 100, "coefficient": 1.6},
]

DEFAULT_TIERS_SOUVENIRS = [
    {"min_qty": 1, "coefficient": 2.5},
    {"min_qty": 10, "coefficient": 2.1},
    {"min_qty": 25, "coefficient": 1.85},
    {"min_qty": 50, "coefficient": 1.7},
    {"min_qty": 100, "coefficient": 1.55},
    {"min_qty": 250, "coefficient": 1.45},
]

DEFAULT_TIERS_STAMPS = [
    {"min_qty": 1, "coefficient": 2.4},
    {"min_qty": 3, "coefficient": 2.1},
    {"min_qty": 5, "coefficient": 1.9},
    {"min_qty": 10, "coefficient": 1.75},
    {"min_qty": 25, "coefficient": 1.6},
]

DEFAULT_TIERS_DESIGN = [
    {"min_qty": 1, "coefficient": 1.2},
    {"min_qty": 5, "coefficient": 1.1},
    {"min_qty": 10, "coefficient": 1.05},
]

BASE_MATERIAL_CATEGORIES = {"papers", "wf_banners", "souv_blanks", "stamps_mounts"}

INITIAL_MAIN_CATEGORIES = [
    {"id": "polygraphy", "name": "Полиграфическая продукция", "is_hidden": False, "is_accent": False},
    {"id": "wide_format", "name": "Широкоформатная печать", "is_hidden": False, "is_accent": False},
    {"id": "souvenirs", "name": "Сувениры и подарки", "is_hidden": False, "is_accent": False},
    {"id": "stamps", "name": "Печати и штампы", "is_hidden": False, "is_accent": False},
    {"id": "design", "name": "Дизайн и ретушь", "is_hidden": False, "is_accent": False},
]

NON_POLYGRAPHY_SEED_CATEGORIES = [
    {"id": "wf_banners_cat", "parent_id": "wide_format", "name": "Баннеры и растяжки", "icon": "🏳️", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "hit"},
    {"id": "wf_films_cat", "parent_id": "wide_format", "name": "Самоклеящаяся плёнка", "icon": "🎞️", "is_hidden": False, "is_featured": True, "image_url": "", "badge": ""},
    {"id": "wf_posters_cat", "parent_id": "wide_format", "name": "Широкоформатные плакаты и холсты", "icon": "🖼️", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "new"},
    {"id": "souv_mugs_cat", "parent_id": "souvenirs", "name": "Кружки с печатью", "icon": "☕", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "hit"},
    {"id": "souv_textile_cat", "parent_id": "souvenirs", "name": "Футболки и текстиль", "icon": "👕", "is_hidden": False, "is_featured": True, "image_url": "", "badge": ""},
    {"id": "stamps_orgs_cat", "parent_id": "stamps", "name": "Печати и штампы", "icon": "🔏", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "hit"},
    {"id": "design_makets_cat", "parent_id": "design", "name": "Разработка макетов и ретушь", "icon": "🎨", "is_hidden": False, "is_featured": True, "image_url": "", "badge": ""},
]

INITIAL_CATEGORIES = [
    {"id": "business_cards", "parent_id": "polygraphy", "name": "Визитки", "icon": "💳", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "Хит продаж"},
    {"id": "flyers", "parent_id": "polygraphy", "name": "Листовки и флаеры", "icon": "📄", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "Популярное"},
    {"id": "booklets", "parent_id": "polygraphy", "name": "Буклеты и лифлеты", "icon": "📖", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "С биговкой"},
    {"id": "catalogs", "parent_id": "polygraphy", "name": "Каталоги, брошюры и журналы", "icon": "📚", "is_hidden": False, "is_featured": True, "image_url": "", "badge": "Многостраничные"},
    {"id": "stickers", "parent_id": "polygraphy", "name": "Наклейки и стикеры", "icon": "🏷️", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "С контурной резкой"},
    {"id": "stickers_3d", "parent_id": "polygraphy", "name": "3D Стикеры (объемные)", "icon": "💧", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Со смолой"},
    {"id": "notepads", "parent_id": "polygraphy", "name": "Блокноты", "icon": "📓", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "На пружине / КБС"},
    {"id": "planners", "parent_id": "polygraphy", "name": "Планеры и ежедневники", "icon": "🗓️", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Организация"},
    {"id": "menus", "parent_id": "polygraphy", "name": "Меню для ресторанов", "icon": "🍽️", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "HoReCa"},
    {"id": "table_tents", "parent_id": "polygraphy", "name": "Тейбл-тенты", "icon": "⛺", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Настольные"},
    {"id": "postcards", "parent_id": "polygraphy", "name": "Открытки и пригласительные", "icon": "💌", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Дизайнерские"},
    {"id": "certificates", "parent_id": "polygraphy", "name": "Сертификаты и дипломы", "icon": "📜", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Подарочные"},
    {"id": "blanks", "parent_id": "polygraphy", "name": "Фирменные бланки", "icon": "📝", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Для офиса"},
    {"id": "folders", "parent_id": "polygraphy", "name": "Папки вырубные и адресные", "icon": "📁", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "С карманом"},
    {"id": "packaging_boxes", "parent_id": "polygraphy", "name": "Коробки упаковочные", "icon": "📦", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Самосборные"},
    {"id": "card_decks", "parent_id": "polygraphy", "name": "Колоды карт (игральные, МАК, Таро)", "icon": "🃏", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "В коробочке"},
    {"id": "posters", "parent_id": "polygraphy", "name": "Плакаты и афиши", "icon": "🖼️", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Форматы А3–SRA3"},
    {"id": "calendars", "parent_id": "polygraphy", "name": "Календари", "icon": "📅", "is_hidden": False, "is_featured": False, "image_url": "", "badge": "Сезонное"},
    *[dict(c) for c in NON_POLYGRAPHY_SEED_CATEGORIES],
]

ALL_PAPER_IDS = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
ALL_LAM_IDS = [27, 28]

INITIAL_MATERIAL_CATEGORIES = [
    {"id": "papers", "main_category_id": "polygraphy", "title": "Бумага и самоклейка", "kind": "material", "resource_label": "Листов в пачке (шт.)", "unit_label": "₽ / лист SRA3", "default_unit": "шт.", "has_client_name": True, "is_system": True},
    {"id": "laminations", "main_category_id": "polygraphy", "title": "Ламинация", "kind": "material", "resource_label": "Длина рулона (м.)", "unit_label": "₽ / п.м.", "default_unit": "м.", "has_client_name": True, "is_system": True},
    {"id": "toners", "main_category_id": "polygraphy", "title": "Тонеры (ресурс А4)", "kind": "equipment", "resource_label": "Ресурс страниц А4", "unit_label": "₽ / стр. А4", "default_unit": "стр. А4", "has_client_name": False, "is_system": True},
    {"id": "components", "main_category_id": "polygraphy", "title": "Комплектующие и машина (ресурс А4)", "kind": "equipment", "resource_label": "Ресурс страниц А4", "unit_label": "₽ / стр. А4", "default_unit": "стр. А4", "has_client_name": False, "is_system": True},
    {"id": "extras", "main_category_id": "polygraphy", "title": "Доп. оборудование и расходники", "kind": "equipment", "resource_label": "Ресурс / кол-во", "unit_label": "₽ / ед.", "default_unit": "лист.", "has_client_name": False, "is_system": True},
    {"id": "wf_banners", "main_category_id": "wide_format", "title": "Баннеры, плёнка и холсты", "kind": "material", "resource_label": "Ширина и длина рулона (м)", "unit_label": "₽ / м²", "default_unit": "м²", "has_client_name": True, "is_system": False},
    {"id": "wf_inks", "main_category_id": "wide_format", "title": "Краска / чернила", "kind": "equipment", "resource_label": "Ресурс (м²)", "unit_label": "₽ / м²", "default_unit": "м²", "has_client_name": False, "is_system": False},
    {"id": "wf_equipment", "main_category_id": "wide_format", "title": "Оборудование и фурнитура (плоттер, люверсы)", "kind": "equipment", "resource_label": "Ресурс / кол-во", "unit_label": "₽ / ед.", "default_unit": "ед.", "has_client_name": False, "is_system": False},
    {"id": "souv_blanks", "main_category_id": "souvenirs", "title": "Заготовки (кружки, текстиль, ручки)", "kind": "material", "resource_label": "Кол-во в упаковке (шт.)", "unit_label": "₽ / шт.", "default_unit": "шт.", "has_client_name": True, "is_system": False},
    {"id": "souv_inks", "main_category_id": "souvenirs", "title": "Краска и расходники (сублимация, ДТФ, УФ)", "kind": "equipment", "resource_label": "Ресурс (шт. / отпечатков)", "unit_label": "₽ / шт.", "default_unit": "шт.", "has_client_name": False, "is_system": False},
    {"id": "souv_equipment", "main_category_id": "souvenirs", "title": "Оборудование (термопресс, УФ, лазер)", "kind": "equipment", "resource_label": "Ресурс (циклов / шт.)", "unit_label": "₽ / ед.", "default_unit": "ед.", "has_client_name": False, "is_system": False},
    {"id": "stamps_mounts", "main_category_id": "stamps", "title": "Оснастки для печатей и штампов", "kind": "material", "resource_label": "Кол-во в упаковке (шт.)", "unit_label": "₽ / шт.", "default_unit": "шт.", "has_client_name": True, "is_system": False},
    {"id": "stamps_consumables", "main_category_id": "stamps", "title": "Резина, полимер и краска", "kind": "equipment", "resource_label": "Ресурс (клише / шт.)", "unit_label": "₽ / шт.", "default_unit": "шт.", "has_client_name": False, "is_system": False},
    {"id": "stamps_equipment", "main_category_id": "stamps", "title": "Оборудование (лазерный гравер, экспокамера)", "kind": "equipment", "resource_label": "Ресурс (клише / циклов)", "unit_label": "₽ / ед.", "default_unit": "ед.", "has_client_name": False, "is_system": False},
]

INITIAL_NON_POLYGRAPHY_ITEMS = [
    {"category": "wf_banners", "name": "Баннер литой Frontlit 440 г/м² (рулон 3.2×50м)", "client_name": "Баннерная ткань литая 440 г/м²", "group": "Баннерная ткань", "in_stock": True, "price": 15200, "roll_width_m": 3.2, "roll_length_m": 50.0, "resource": 160, "unit": "м²"},
    {"category": "wf_banners", "name": "Баннер ламинированный 340 г/м² (рулон 1.6×50м)", "client_name": "Баннер ламинированный 340 г/м²", "group": "Баннерная ткань", "in_stock": True, "price": 5600, "roll_width_m": 1.6, "roll_length_m": 50.0, "resource": 80, "unit": "м²"},
    {"category": "wf_banners", "name": "Плёнка самоклеящаяся Orajet 3640 (рулон 1.26×50м)", "client_name": "Самоклеящаяся виниловая плёнка", "group": "Плёнка ПВХ", "in_stock": True, "price": 11970, "roll_width_m": 1.26, "roll_length_m": 50.0, "resource": 63, "unit": "м²"},
    {"category": "wf_banners", "name": "Постерная бумага CityLight 150 г/м² (рулон 1.27×50м)", "client_name": "Постерная бумага Ситилайт 150 г/м²", "group": "Постеры и холст", "in_stock": True, "price": 4445, "roll_width_m": 1.27, "roll_length_m": 50.0, "resource": 63.5, "unit": "м²"},
    {"category": "wf_banners", "name": "Холст натуральный художественный 340 г/м² (рулон 1.27×18м)", "client_name": "Холст натуральный художественный 340 г/м²", "group": "Постеры и холст", "in_stock": True, "price": 9144, "roll_width_m": 1.27, "roll_length_m": 18.0, "resource": 22.86, "unit": "м²"},
    {"category": "wf_inks", "name": "Экосольвентные чернила CMYK (комплект 4×1 л)", "client_name": "Экосольвентные чернила", "group": "Чернила", "in_stock": True, "price": 9600, "resource": 320, "unit": "м²"},
    {"category": "wf_equipment", "name": "Широкоформатный плоттер Mimaki JV150 (амортизация и ТО)", "client_name": "Плоттерная печать", "group": "Оборудование", "in_stock": True, "price": 1200000, "resource": 60000, "unit": "м²"},
    {"category": "wf_equipment", "name": "Люверсы оцинкованные Ø10 мм (упаковка 1000 шт.)", "client_name": "Установка люверсов", "group": "Фурнитура", "in_stock": True, "price": 2500, "resource": 1000, "unit": "шт."},
    {"category": "souv_blanks", "name": "Кружка белая керамическая Премиум 330 мл (коробка 36 шт.)", "client_name": "Кружка белая керамическая 330 мл", "group": "Кружки", "in_stock": True, "price": 3960, "resource": 36, "unit": "шт."},
    {"category": "souv_blanks", "name": "Футболка белая двухслойная для сублимации (упаковка 10 шт.)", "client_name": "Футболка белая Премиум", "group": "Текстиль", "in_stock": True, "price": 4500, "resource": 10, "unit": "шт."},
    {"category": "souv_inks", "name": "Комплект сублимационных чернил + бумага А4", "client_name": "Сублимационный перенос", "group": "Сублимация", "in_stock": True, "price": 3500, "resource": 500, "unit": "шт."},
    {"category": "souv_equipment", "name": "Кружечный и плоский термопресс (ресурс нагревательного элемента)", "client_name": "Термопресс", "group": "Оборудование", "in_stock": True, "price": 45000, "resource": 15000, "unit": "ед."},
    {"category": "stamps_mounts", "name": "Автоматическая оснастка Colop Printer R40 Ø40 мм (10 шт.)", "client_name": "Автоматическая оснастка Colop R40", "group": "Оснастки круглые", "in_stock": True, "price": 3800, "resource": 10, "unit": "шт."},
    {"category": "stamps_mounts", "name": "Карманная оснастка Colop Mouse R40 Ø40 мм (10 шт.)", "client_name": "Карманная оснастка Colop Mouse R40", "group": "Оснастки круглые", "in_stock": True, "price": 4200, "resource": 10, "unit": "шт."},
    {"category": "stamps_mounts", "name": "Автоматическая оснастка для штампа Colop Printer 30 (47×18 мм, 10 шт.)", "client_name": "Автоматическая оснастка Colop Printer 30 (47×18 мм)", "group": "Оснастки прямоугольные", "in_stock": True, "price": 3500, "resource": 10, "unit": "шт."},
    {"category": "stamps_consumables", "name": "Резина для лазерной гравировки А4 (на 35 клише)", "client_name": "Клише из лазерной резины", "group": "Резина", "in_stock": True, "price": 1050, "resource": 35, "unit": "шт."},
    {"category": "stamps_equipment", "name": "Лазерный гравер CO2 (ресурс лазерной трубки)", "client_name": "Лазерная гравировка клише", "group": "Оборудование", "in_stock": True, "price": 35000, "resource": 10000, "unit": "ед."},
]


def build_non_polygraphy_seed_products(items_list, valid_lam_ids=None):
    lam_ids = sorted(valid_lam_ids) if valid_lam_ids else list(ALL_LAM_IDS)
    wf_banner_ids = [
        i["id"] for i in items_list
        if i.get("category") == "wf_banners" and ("баннер" in i.get("name", "").lower() or "frontlit" in i.get("name", "").lower())
    ]
    wf_film_ids = [
        i["id"] for i in items_list
        if i.get("category") == "wf_banners" and ("плёнк" in i.get("name", "").lower() or "пленк" in i.get("name", "").lower() or "orajet" in i.get("name", "").lower())
    ]
    wf_poster_ids = [
        i["id"] for i in items_list
        if i.get("category") == "wf_banners" and ("постер" in i.get("name", "").lower() or "холст" in i.get("name", "").lower() or "citylight" in i.get("name", "").lower())
    ]
    all_wf_ids = [i["id"] for i in items_list if i.get("category") == "wf_banners"]
    wf_banner_ids = wf_banner_ids or all_wf_ids
    wf_film_ids = wf_film_ids or all_wf_ids
    wf_poster_ids = wf_poster_ids or all_wf_ids

    souv_mug_ids = [
        i["id"] for i in items_list
        if i.get("category") == "souv_blanks" and "кружк" in i.get("name", "").lower()
    ]
    souv_tshirt_ids = [
        i["id"] for i in items_list
        if i.get("category") == "souv_blanks" and "футболк" in i.get("name", "").lower()
    ]
    all_souv_ids = [i["id"] for i in items_list if i.get("category") == "souv_blanks"]
    souv_mug_ids = souv_mug_ids or all_souv_ids
    souv_tshirt_ids = souv_tshirt_ids or all_souv_ids

    stamp_round_ids = [
        i["id"] for i in items_list
        if i.get("category") == "stamps_mounts" and ("r40" in i.get("name", "").lower() or "кругл" in i.get("group", "").lower())
    ]
    stamp_rect_ids = [
        i["id"] for i in items_list
        if i.get("category") == "stamps_mounts" and ("printer 30" in i.get("name", "").lower() or "прямоугол" in i.get("group", "").lower() or "47" in i.get("name", ""))
    ]
    all_stamp_ids = [i["id"] for i in items_list if i.get("category") == "stamps_mounts"]
    stamp_round_ids = stamp_round_ids or all_stamp_ids
    stamp_rect_ids = stamp_rect_ids or all_stamp_ids

    return [
        {
            "id": 2001,
            "category": "wf_banners_cat",
            "product_kind": "Баннеры с люверсами",
            "name": "Баннер с люверсами (2000 × 1000 мм)",
            "width_mm": 2000.0,
            "height_mm": 1000.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": True,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(wf_banner_ids),
            "defect_percent": 3.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "eyelets",
                    "name": "Установка люверсов",
                    "cost": 2.5,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": True,
                    "options": [],
                },
                {
                    "id": "edge_gluing",
                    "name": "Проклейка (усиление) края баннера",
                    "cost": 45.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": True,
                    "options": [],
                },
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(wf_banner_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2002,
            "category": "wf_banners_cat",
            "product_kind": "Баннеры с люверсами",
            "name": "Баннер широкоформатный (3000 × 2000 мм)",
            "width_mm": 3000.0,
            "height_mm": 2000.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": True,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(wf_banner_ids),
            "defect_percent": 3.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "eyelets",
                    "name": "Установка люверсов",
                    "cost": 2.5,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": True,
                    "options": [],
                },
                {
                    "id": "edge_gluing",
                    "name": "Проклейка (усиление) края баннера",
                    "cost": 65.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": True,
                    "options": [],
                },
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(wf_banner_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2003,
            "category": "wf_films_cat",
            "product_kind": "Виниловая плёнка с печатью",
            "name": "Самоклеящаяся плёнка с печатью (1000 × 1000 мм)",
            "width_mm": 1000.0,
            "height_mm": 1000.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": True,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(wf_film_ids),
            "defect_percent": 3.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "plotter_cut",
                    "name": "Контурная плоттерная резка по меткам",
                    "cost": 120.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": False,
                    "options": [],
                }
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": True,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": True,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(wf_film_ids),
            "allowed_lamination_ids": list(lam_ids),
        },
        {
            "id": 2004,
            "category": "wf_posters_cat",
            "product_kind": "Плакаты и холсты",
            "name": "Широкоформатный плакат / Холст А1 (594 × 841 мм)",
            "width_mm": 594.0,
            "height_mm": 841.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": True,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(wf_poster_ids),
            "defect_percent": 3.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "stretcher_frame",
                    "name": "Натяжка холста на деревянный подрамник",
                    "cost": 450.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": False,
                    "options": [],
                }
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(wf_poster_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2101,
            "category": "souv_mugs_cat",
            "product_kind": "Кружки керамические",
            "name": "Кружка с печатью 330 мл (белая керамика)",
            "width_mm": 200.0,
            "height_mm": 95.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(souv_mug_ids),
            "defect_percent": 2.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "gift_box",
                    "name": "Подарочная коробочка с окном",
                    "cost": 35.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": False,
                    "options": [],
                }
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(souv_mug_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2102,
            "category": "souv_textile_cat",
            "product_kind": "Футболки с печатью",
            "name": "Футболка с полноцветным принтом А4 (210 × 297 мм)",
            "width_mm": 210.0,
            "height_mm": 297.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "both",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(souv_tshirt_ids),
            "defect_percent": 2.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(souv_tshirt_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2103,
            "category": "souv_textile_cat",
            "product_kind": "Футболки с печатью",
            "name": "Футболка с полноцветным принтом А3 (297 × 420 мм)",
            "width_mm": 297.0,
            "height_mm": 420.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "both",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(souv_tshirt_ids),
            "defect_percent": 2.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(souv_tshirt_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2201,
            "category": "stamps_orgs_cat",
            "product_kind": "Круглые печати",
            "name": "Печать организации автоматическая Ø40 мм",
            "width_mm": 40.0,
            "height_mm": 40.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(stamp_round_ids),
            "defect_percent": 2.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "urgent",
                    "name": "Срочное изготовление (за 1 час)",
                    "cost": 0.0,
                    "mode": "per_order",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": False,
                    "options": [],
                }
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(stamp_round_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2202,
            "category": "stamps_orgs_cat",
            "product_kind": "Прямоугольные штампы",
            "name": "Штамп прямоугольный автоматический (47 × 18 мм)",
            "width_mm": 47.0,
            "height_mm": 18.0,
            "schematic_type": "flat",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(stamp_rect_ids),
            "defect_percent": 2.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "urgent",
                    "name": "Срочное изготовление (за 1 час)",
                    "cost": 0.0,
                    "mode": "per_order",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": False,
                    "options": [],
                }
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": True,
            "show_lamination_select": False,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(stamp_rect_ids),
            "allowed_lamination_ids": [],
        },
        {
            "id": 2301,
            "category": "design_makets_cat",
            "product_kind": "Разработка макета",
            "name": "Разработка дизайн-макета с нуля",
            "width_mm": 210.0,
            "height_mm": 297.0,
            "schematic_type": "certificate",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": [],
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "design_hours",
                    "name": "Часы работы дизайнера",
                    "cost": 0.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "number",
                    "default_value": 1,
                    "options": [],
                },
                {
                    "id": "prepress",
                    "name": "Предпечатная подготовка макета",
                    "cost": 0.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": True,
                    "options": [],
                },
                {
                    "id": "extra_revisions",
                    "name": "Дополнительные правки (сверх бесплатных)",
                    "cost": 0.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "number",
                    "default_value": 0,
                    "options": [],
                },
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": False,
            "show_lamination_select": False,
            "include_paper_cost": False,
            "include_print_cost": True,
            "include_toner_cost": False,
            "include_components_cost": False,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": False,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": [],
            "allowed_lamination_ids": [],
        },
        {
            "id": 2302,
            "category": "design_makets_cat",
            "product_kind": "Разработка макета",
            "name": "Проверка, ретушь и доработка макета к печати",
            "width_mm": 210.0,
            "height_mm": 297.0,
            "schematic_type": "certificate",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": [],
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {
                    "id": "design_hours",
                    "name": "Часы работы дизайнера",
                    "cost": 0.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "number",
                    "default_value": 1,
                    "options": [],
                },
                {
                    "id": "prepress",
                    "name": "Предпечатная подготовка макета",
                    "cost": 0.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "checkbox",
                    "default_value": True,
                    "options": [],
                },
                {
                    "id": "extra_revisions",
                    "name": "Дополнительные правки (сверх бесплатных)",
                    "cost": 0.0,
                    "mode": "per_unit",
                    "is_enabled": True,
                    "is_client_facing": True,
                    "input_type": "number",
                    "default_value": 0,
                    "options": [],
                },
            ],
            "show_format_select": True,
            "show_print_sides": False,
            "show_paper_select": False,
            "show_lamination_select": False,
            "include_paper_cost": False,
            "include_print_cost": True,
            "include_toner_cost": False,
            "include_components_cost": False,
            "include_lamination_cost": False,
            "include_extra_params_cost": True,
            "include_defect_cost": False,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": [],
            "allowed_lamination_ids": [],
        },
    ]


def build_extra_calendar_seeds(valid_paper_ids, valid_lam_ids):
    sorted_papers = sorted(valid_paper_ids)
    sorted_lams = sorted(valid_lam_ids)
    dense_papers = [p_id for p_id in (21, 23) if p_id in valid_paper_ids] or sorted_papers
    block_papers = [p_id for p_id in (17, 18, 19, 20, 21, 23) if p_id in valid_paper_ids] or sorted_papers
    return [
        {
            "id": 407,
            "category": "calendars",
            "product_kind": "Календарь «Домик»",
            "name": "Настольный «Домик» А5 с перекидным блоком (210 × 148 мм)",
            "width_mm": 210.0,
            "height_mm": 366.0,
            "schematic_type": "calendar_house",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "sheets",
            "default_pages": 7,
            "allowed_sides": "both",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(dense_papers),
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {"id": "house_spring", "name": "Пружина Wire-O + сборка домика", "cost": 22.0, "mode": "per_unit", "is_enabled": True, "is_client_facing": False, "input_type": "checkbox", "default_value": True, "options": []}
            ],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": True,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": True,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(block_papers),
            "allowed_lamination_ids": list(sorted_lams),
        },
        {
            "id": 408,
            "category": "calendars",
            "product_kind": "Календарь «Домик»",
            "name": "Настольный «Домик» Компакт (150 × 100 мм, развёртка 150 × 270 мм)",
            "width_mm": 150.0,
            "height_mm": 270.0,
            "schematic_type": "calendar_house",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "none",
            "default_pages": 1,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(dense_papers),
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {"id": "house_crease", "name": "3 биговки + замок", "cost": 6.0, "mode": "per_unit", "is_enabled": True, "is_client_facing": False, "input_type": "checkbox", "default_value": True, "options": []}
            ],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": True,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": True,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(dense_papers),
            "allowed_lamination_ids": list(sorted_lams),
        },
        {
            "id": 409,
            "category": "calendars",
            "product_kind": "Календарь «Трио»",
            "name": "Квартальный «Трио Стандарт» (297 × 690 мм, 1 рекламное поле)",
            "width_mm": 297.0,
            "height_mm": 420.0,
            "schematic_type": "calendar_wall",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "sheets",
            "default_pages": 4,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(dense_papers),
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {"id": "trio_blocks", "name": "Комплект 3 квартальных блоков + 3 пружины + люверс + курсор", "cost": 135.0, "mode": "per_unit", "is_enabled": True, "is_client_facing": False, "input_type": "checkbox", "default_value": True, "options": []}
            ],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": True,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": True,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(dense_papers),
            "allowed_lamination_ids": list(sorted_lams),
        },
        {
            "id": 410,
            "category": "calendars",
            "product_kind": "Календарь «Трио»",
            "name": "Квартальный «Трио Бизнес» (297 × 790 мм, 3 рекламных поля)",
            "width_mm": 297.0,
            "height_mm": 420.0,
            "schematic_type": "calendar_wall",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "sheets",
            "default_pages": 4,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(dense_papers),
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {"id": "trio_blocks_biz", "name": "Комплект 3 численника + 3 пружины + люверс + курсор", "cost": 145.0, "mode": "per_unit", "is_enabled": True, "is_client_facing": False, "input_type": "checkbox", "default_value": True, "options": []}
            ],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": True,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": True,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(dense_papers),
            "allowed_lamination_ids": list(sorted_lams),
        },
        {
            "id": 411,
            "category": "calendars",
            "product_kind": "Календарь «Трио»",
            "name": "Квартальный «Трио Макси» (335 × 840 мм, широкие поля)",
            "width_mm": 310.0,
            "height_mm": 440.0,
            "schematic_type": "calendar_wall",
            "base_mm": 35.0,
            "allow_custom_size": False,
            "multi_page_mode": "sheets",
            "default_pages": 4,
            "allowed_sides": "single_only",
            "has_cover_block": False,
            "allowed_block_print_modes": "both",
            "allowed_cover_print_modes": "both",
            "allowed_cover_paper_ids": list(dense_papers),
            "defect_percent": 0.0,
            "is_hidden": False,
            "images": [],
            "cost_params": [
                {"id": "trio_blocks_maxi", "name": "Широкие численники 335 мм + 3 пружины + люверс + курсор", "cost": 165.0, "mode": "per_unit", "is_enabled": True, "is_client_facing": False, "input_type": "checkbox", "default_value": True, "options": []}
            ],
            "show_format_select": True,
            "show_print_sides": True,
            "show_paper_select": True,
            "show_lamination_select": True,
            "include_paper_cost": True,
            "include_print_cost": True,
            "include_toner_cost": True,
            "include_components_cost": True,
            "include_lamination_cost": True,
            "include_extra_params_cost": True,
            "include_defect_cost": True,
            "excluded_equipment_ids": [],
            "enabled_equipment_ids": [],
            "allowed_paper_ids": list(dense_papers),
            "allowed_lamination_ids": list(sorted_lams),
        },
    ]


INITIAL_PRODUCTS = [
    {"id": 101, "category": "flyers", "name": "A6 (105 × 148 мм)", "width_mm": 105, "height_mm": 148, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 102, "category": "flyers", "name": "Еврофлаер (99 × 210 мм)", "width_mm": 99, "height_mm": 210, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 103, "category": "flyers", "name": "A5 (148 × 210 мм)", "width_mm": 148, "height_mm": 210, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 104, "category": "flyers", "name": "A4 (210 × 297 мм)", "width_mm": 210, "height_mm": 297, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 105, "category": "flyers", "name": "A3 (297 × 420 мм)", "width_mm": 297, "height_mm": 420, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 106, "category": "flyers", "name": "Произвольный размер", "width_mm": 100, "height_mm": 150, "allow_custom_size": True, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 3.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 201, "category": "booklets", "name": "Евробуклет, 2 сгиба (в развороте А4 — 297 × 210 мм)", "width_mm": 297, "height_mm": 210, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [{"id": "fold_1", "name": "Фальцовка (SuperFax PF-370)", "cost": 0.15, "mode": "per_unit"}], "allowed_paper_ids": [17, 18, 19, 20, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 202, "category": "booklets", "name": "Буклет А5, 1 сгиб (в развороте А4 — 297 × 210 мм)", "width_mm": 297, "height_mm": 210, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [{"id": "fold_1", "name": "Фальцовка (SuperFax PF-370)", "cost": 0.15, "mode": "per_unit"}], "allowed_paper_ids": [17, 18, 19, 20, 21, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 203, "category": "booklets", "name": "Буклет А4, 1 сгиб (в развороте А3 — 420 × 297 мм)", "width_mm": 420, "height_mm": 297, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [{"id": "fold_1", "name": "Фальцовка (SuperFax PF-370)", "cost": 0.15, "mode": "per_unit"}], "allowed_paper_ids": [17, 18, 19, 20, 21, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 204, "category": "booklets", "name": "Мини-буклет А6, 1 сгиб (в развороте А5 — 210 × 148 мм)", "width_mm": 210, "height_mm": 148, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [{"id": "fold_1", "name": "Фальцовка (SuperFax PF-370)", "cost": 0.15, "mode": "per_unit"}], "allowed_paper_ids": [17, 18, 19, 20, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 205, "category": "booklets", "name": "Произвольный размер (в развороте)", "width_mm": 297, "height_mm": 210, "allow_custom_size": True, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 3.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 301, "category": "business_cards", "name": "Стандартная (90 × 50 мм)", "width_mm": 90, "height_mm": 50, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [21, 23, 24, 26], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 302, "category": "business_cards", "name": "Евровизитка (85 × 55 мм)", "width_mm": 85, "height_mm": 55, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [21, 23, 24, 26], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 303, "category": "business_cards", "name": "Квадратная (65 × 65 мм)", "width_mm": 65, "height_mm": 65, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [21, 23, 24, 26], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 304, "category": "business_cards", "name": "Двойная со сгибом (180 × 50 мм)", "width_mm": 180, "height_mm": 50, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [21, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 305, "category": "business_cards", "name": "Произвольный размер", "width_mm": 90, "height_mm": 50, "allow_custom_size": True, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 401, "category": "calendars", "name": "Карманный календарь (70 × 100 мм)", "width_mm": 70, "height_mm": 100, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [21, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 402, "category": "calendars", "name": "Настольный «Домик» (210 × 300 мм)", "width_mm": 210, "height_mm": 300, "schematic_type": "calendar_house", "base_mm": 35, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "single_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [21, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 403, "category": "calendars", "name": "Настенный постер А3 (297 × 420 мм)", "width_mm": 297, "height_mm": 420, "allow_custom_size": False, "multi_page_mode": "none", "default_pages": 1, "allowed_sides": "single_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [17, 18, 19, 20, 21, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 404, "category": "calendars", "name": "Перекидной настенный А4 (210 × 297 мм)", "width_mm": 210, "height_mm": 297, "allow_custom_size": False, "multi_page_mode": "sheets", "default_pages": 13, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [17, 18, 19, 20, 21, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 405, "category": "calendars", "name": "Перекидной настенный А3 (297 × 420 мм)", "width_mm": 297, "height_mm": 420, "allow_custom_size": False, "multi_page_mode": "sheets", "default_pages": 13, "allowed_sides": "both", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [17, 18, 19, 20, 21, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 406, "category": "calendars", "name": "Произвольный размер", "width_mm": 210, "height_mm": 297, "allow_custom_size": True, "multi_page_mode": "sheets", "default_pages": 1, "allowed_sides": "both", "defect_percent": 3.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 501, "category": "catalogs", "name": "Каталог А5 (148 × 210 мм)", "width_mm": 148, "height_mm": 210, "allow_custom_size": False, "multi_page_mode": "pages", "default_pages": 16, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [17, 18, 19, 20, 21, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 502, "category": "catalogs", "name": "Каталог А4 (210 × 297 мм)", "width_mm": 210, "height_mm": 297, "allow_custom_size": False, "multi_page_mode": "pages", "default_pages": 16, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [17, 18, 19, 20, 21, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 503, "category": "catalogs", "name": "Каталог квадратный (210 × 210 мм)", "width_mm": 210, "height_mm": 210, "allow_custom_size": False, "multi_page_mode": "pages", "default_pages": 16, "allowed_sides": "duplex_only", "defect_percent": 0.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": [17, 18, 19, 20, 21, 22, 23], "allowed_lamination_ids": list(ALL_LAM_IDS)},
    {"id": 504, "category": "catalogs", "name": "Произвольный размер страницы", "width_mm": 210, "height_mm": 297, "allow_custom_size": True, "multi_page_mode": "pages", "default_pages": 16, "allowed_sides": "duplex_only", "defect_percent": 3.0, "is_hidden": False, "images": [], "cost_params": [], "allowed_paper_ids": list(ALL_PAPER_IDS), "allowed_lamination_ids": list(ALL_LAM_IDS)},
    *build_non_polygraphy_seed_products(
        [{"id": 30 + idx, **it} for idx, it in enumerate(INITIAL_NON_POLYGRAPHY_ITEMS)],
        ALL_LAM_IDS,
    ),
]

DEFAULT_MAIN_CATEGORY_PARAMS = {
    "polygraphy": {
        "bleed_mm": 4.0,
        "sheet_length_m": 0.5,
        "usable_height_mm": 440.0,
        "usable_width_mm": 310.0,
        "defect_percent": 3.0,
        "tax_percent": 6.0,
    },
    "wide_format": {
        "bleed_mm": 10.0,
        "roll_waste_m": 0.3,
        "defect_percent": 3.0,
        "tax_percent": 6.0,
    },
    "souvenirs": {
        "setup_cost": 300.0,
        "print_area_mm": 200.0,
        "packaging_cost": 15.0,
        "defect_percent": 2.0,
        "tax_percent": 6.0,
    },
    "stamps": {
        "min_line_mm": 0.15,
        "engraving_depth_mm": 1.2,
        "urgency_percent": 50.0,
        "defect_percent": 2.0,
        "tax_percent": 6.0,
    },
    "design": {
        "hourly_rate": 1500.0,
        "free_revisions": 2.0,
        "extra_revision_cost": 350.0,
        "prepress_cost": 250.0,
        "defect_percent": 0.0,
        "tax_percent": 6.0,
    },
}


def get_default_main_cat_params(mc_id, settings=None):
    base = DEFAULT_MAIN_CATEGORY_PARAMS.get(mc_id)
    if base:
        res = dict(base)
        if mc_id == "polygraphy" and isinstance(settings, dict):
            res["bleed_mm"] = float(settings.get("bleed_mm", res["bleed_mm"]))
            res["sheet_length_m"] = float(settings.get("sheet_length_m", res["sheet_length_m"]))
            res["usable_height_mm"] = float(settings.get("usable_height_mm", res["usable_height_mm"]))
            res["usable_width_mm"] = float(settings.get("usable_width_mm", res["usable_width_mm"]))
            res["defect_percent"] = float(settings.get("defect_percent", res["defect_percent"]))
            res["tax_percent"] = float(settings.get("tax_percent", res["tax_percent"]))
        return res
    return {
        "setup_cost": 200.0,
        "extra_waste_percent": 2.0,
        "defect_percent": 3.0,
        "tax_percent": float(settings.get("tax_percent", 6.0)) if isinstance(settings, dict) else 6.0,
    }


INITIAL_DATA = {
    "settings": {
        "sheet_length_m": 0.5,
        "sra3_width_mm": 320.0,
        "sra3_height_mm": 450.0,
        "usable_width_mm": 310.0,
        "usable_height_mm": 440.0,
        "bleed_mm": 4.0,
        "defect_percent": 3.0,
        "tax_percent": 6.0,
        "main_category_params": {k: dict(v) for k, v in DEFAULT_MAIN_CATEGORY_PARAMS.items()},
        "category_markups": {
            "flyers": [dict(t) for t in DEFAULT_TIERS_STANDARD],
            "booklets": [dict(t) for t in DEFAULT_TIERS_BOOKLETS],
            "business_cards": [dict(t) for t in DEFAULT_TIERS_STANDARD],
            "calendars": [dict(t) for t in DEFAULT_TIERS_CALENDARS],
            "catalogs": [dict(t) for t in DEFAULT_TIERS_CATALOGS],
        },
        "role_permissions": {
            "client": {
                "manage_kp": False,
                "apply_discounts": False,
                "view_crm": False,
                "view_all_orders": False,
                "update_order_status": False,
                "manage_order_finances": False,
                "view_internal_metrics": False,
                "delete_orders": False,
                "manage_catalog": False,
                "manage_users": False,
            },
            "production": {
                "manage_kp": False,
                "apply_discounts": False,
                "view_crm": True,
                "view_all_orders": True,
                "update_order_status": True,
                "manage_order_finances": False,
                "view_internal_metrics": False,
                "delete_orders": False,
                "manage_catalog": False,
                "manage_users": False,
            },
            "manager": {
                "manage_kp": True,
                "apply_discounts": True,
                "view_crm": True,
                "view_all_orders": False,
                "update_order_status": True,
                "manage_order_finances": True,
                "view_internal_metrics": False,
                "delete_orders": False,
                "manage_catalog": False,
                "manage_users": False,
            },
            "admin": {
                "manage_kp": True,
                "apply_discounts": True,
                "view_crm": True,
                "view_all_orders": True,
                "update_order_status": True,
                "manage_order_finances": True,
                "view_internal_metrics": True,
                "delete_orders": True,
                "manage_catalog": True,
                "manage_users": True,
            },
        },
    },
    "main_categories": [dict(mc) for mc in INITIAL_MAIN_CATEGORIES],
    "categories": [dict(c) for c in INITIAL_CATEGORIES],
    "material_categories": [dict(mc) for mc in INITIAL_MATERIAL_CATEGORIES],
    "items": [
        {"id": 1, "category": "toners", "name": "Black", "client_name": "Black", "price": 10042, "resource": 14000, "unit": "стр. А4"},
        {"id": 2, "category": "toners", "name": "Cyan", "client_name": "Cyan", "price": 8909, "resource": 14000, "unit": "стр. А4"},
        {"id": 3, "category": "toners", "name": "Majenta", "client_name": "Majenta", "price": 10969, "resource": 14000, "unit": "стр. А4"},
        {"id": 4, "category": "toners", "name": "Yellow", "client_name": "Yellow", "price": 11484, "resource": 14000, "unit": "стр. А4"},
        {"id": 5, "category": "components", "name": "DRAM-Картридж Black 1шт. (ACE60Y2)", "client_name": "", "price": 55000, "resource": 460000, "unit": "стр. А4"},
        {"id": 6, "category": "components", "name": "DRAM-Картридж C/M/Y 3 шт. (ACE60Y1)", "client_name": "", "price": 165000, "resource": 340000, "unit": "стр. А4"},
        {"id": 7, "category": "components", "name": "Девелопер Black 1шт. (A3VX600)", "client_name": "", "price": 30000, "resource": 900000, "unit": "стр. А4"},
        {"id": 8, "category": "components", "name": "Девелопер C/M/Y 3шт. (A3VX900/A3VX800/A3VX700)", "client_name": "", "price": 87000, "resource": 800000, "unit": "стр. А4"},
        {"id": 9, "category": "components", "name": "Коротроны заряда 4шт. (AC57R70111)", "client_name": "", "price": 26000, "resource": 250000, "unit": "стр. А4"},
        {"id": 10, "category": "components", "name": "Лента переноса 1шт. (A9VE500200)", "client_name": "", "price": 35000, "resource": 280000, "unit": "стр. А4"},
        {"id": 11, "category": "components", "name": "Ракель ленты переноса 1 шт. (CET281014)", "client_name": "", "price": 5000, "resource": 200000, "unit": "стр. А4"},
        {"id": 12, "category": "components", "name": "Ролик 2-го переноса 1шт. (A50U520001)", "client_name": "", "price": 24000, "resource": 250000, "unit": "стр. А4"},
        {"id": 13, "category": "components", "name": "Ремень фиксации 1шт. (A50U765000)", "client_name": "", "price": 22000, "resource": 200000, "unit": "стр. А4"},
        {"id": 14, "category": "components", "name": "Прижимной вал печки 1шт. (A50U765500)", "client_name": "", "price": 10000, "resource": 240000, "unit": "стр. А4"},
        {"id": 15, "category": "components", "name": "Бункер отработки 1шт. (A50UR70115)", "client_name": "", "price": 10000, "resource": 300000, "unit": "стр. А4"},
        {"id": 16, "category": "components", "name": "Konica Minolta C4080", "client_name": "", "price": 2000000, "resource": 4000000, "unit": "стр. А4"},
        {"id": 17, "category": "papers", "name": "NOW!PRINT - Gloss 115 гр.", "client_name": "Мелованная глянцевая 115 г/м²", "price": 1150, "resource": 250, "unit": "шт."},
        {"id": 18, "category": "papers", "name": "NOW!PRINT - Eco Gloss/Matt - 128 гр.", "client_name": "Мелованная бумага 128 г/м²", "price": 1025, "resource": 250, "unit": "шт."},
        {"id": 19, "category": "papers", "name": "NOW!PRINT - Eco Gloss - 150 гр.", "client_name": "Мелованная глянцевая 150 г/м²", "price": 1225, "resource": 250, "unit": "шт."},
        {"id": 20, "category": "papers", "name": "NOW!PRINT - Eco Matt - 115 гр.", "client_name": "Мелованная матовая 115 г/м²", "price": 750, "resource": 250, "unit": "шт."},
        {"id": 21, "category": "papers", "name": "NOW!PRINT - Eco Matt - 300 гр.", "client_name": "Плотная матовая бумага 300 г/м²", "price": 1213, "resource": 125, "unit": "шт."},
        {"id": 22, "category": "papers", "name": "NOW!PRINT - Plus - 90 гр.", "client_name": "Тонкая бумага 90 г/м²", "price": 1750, "resource": 500, "unit": "шт."},
        {"id": 23, "category": "papers", "name": "NOW!PRINT - Plus - 170 гр.", "client_name": "Плотная бумага 170 г/м²", "price": 2275, "resource": 250, "unit": "шт."},
        {"id": 24, "category": "papers", "name": "MASTERTAC Самоклейка - Kraft-Brown - 175 гр.", "client_name": "Самоклеящаяся бумага Крафт 175 г/м²", "price": 9075, "resource": 250, "unit": "шт."},
        {"id": 25, "category": "papers", "name": "MASTERTAC Самоклейка - Tamperproof - 230 гр.", "client_name": "Самоклеящаяся пломбировочная 230 г/м²", "price": 4400, "resource": 100, "unit": "шт."},
        {"id": 26, "category": "papers", "name": "MASTERTAC Самоклейка - Petlazer Matt - 197 гр.", "client_name": "Самоклеящаяся матовая пленка 197 г/м²", "price": 24550, "resource": 250, "unit": "шт."},
        {"id": 27, "category": "laminations", "name": "Soft-Touch - 34мкр.", "client_name": "Матовая бархатная (Soft-Touch 34 мкр)", "price": 1618, "resource": 100, "unit": "м."},
        {"id": 28, "category": "laminations", "name": "Soft-Touch - 28мкр.", "client_name": "Матовая бархатная (Soft-Touch 28 мкр)", "price": 1409, "resource": 100, "unit": "м."},
        {"id": 29, "category": "extras", "name": "Фальцовщик SuperFax PF-370", "client_name": "Фальцовка", "price": 150000, "resource": 1000000, "unit": "лист."},
    ],
    "products": INITIAL_PRODUCTS,
}


def infer_material_group(name, client_name, category):
    combined = f"{name} {client_name}".lower()
    if category == "papers":
        if "самоклей" in combined or "mastertac" in combined or "пленк" in combined:
            return "Самоклейка и пленка"
        if "дизайн" in combined or "крафт" in combined or "kraft" in combined:
            return "Дизайнерская / Крафт"
        if "глян" in combined or "gloss" in combined:
            return "Мелованная глянцевая"
        if "мат" in combined or "matt" in combined:
            return "Мелованная матовая"
        return "Базовая бумага"
    if category == "laminations":
        if "soft" in combined or "софт" in combined or "бархат" in combined:
            return "Soft-Touch"
        if "глян" in combined or "gloss" in combined:
            return "Глянцевая"
        if "мат" in combined or "matt" in combined:
            return "Матовая"
        return "Ламинация"
    return ""


def infer_paper_color(name, client_name):
    combined = f"{name} {client_name}".lower()
    if "крафт" in combined or "kraft" in combined:
        return ("Крафт", "#b58860")
    if "черн" in combined or "чёрн" in combined or "black" in combined:
        return ("Чёрный", "#1f2937")
    if "слонов" in combined or "ivory" in combined or "айвори" in combined:
        return ("Слоновая кость", "#f5f0e1")
    if "крем" in combined or "cream" in combined:
        return ("Кремовый", "#fffdd0")
    if "золот" in combined or "gold" in combined:
        return ("Золотой", "#d4af37")
    if "серебр" in combined or "silver" in combined:
        return ("Серебряный", "#cbd5e1")
    return ("Белый", "#ffffff")


def get_default_tiers_for_cat(cat_id):
    if cat_id in ("booklets", "table_tents", "packaging_boxes", "folders"):
        return [dict(t) for t in DEFAULT_TIERS_BOOKLETS]
    if cat_id in ("calendars", "card_decks", "stickers_3d"):
        return [dict(t) for t in DEFAULT_TIERS_CALENDARS]
    if cat_id in ("catalogs", "notepads", "planners", "menus"):
        return [dict(t) for t in DEFAULT_TIERS_CATALOGS]
    if cat_id in ("wide_format", "wf_banners_cat", "wf_films_cat", "wf_posters_cat"):
        return [dict(t) for t in DEFAULT_TIERS_WIDE_FORMAT]
    if cat_id in ("souvenirs", "souv_mugs_cat", "souv_textile_cat"):
        return [dict(t) for t in DEFAULT_TIERS_SOUVENIRS]
    if cat_id in ("stamps", "stamps_orgs_cat"):
        return [dict(t) for t in DEFAULT_TIERS_STAMPS]
    if cat_id in ("design", "design_makets_cat"):
        return [dict(t) for t in DEFAULT_TIERS_DESIGN]
    return [dict(t) for t in DEFAULT_TIERS_STANDARD]


def infer_default_product_kind(p):
    cat = (p.get("category") or "").strip().lower()
    name = (p.get("name") or "").strip().lower()
    pid = int(p.get("id") or 0)

    if cat == "calendars":
        if "домик" in name or pid in (402, 407, 408):
            return "Календарь «Домик»"
        if "трио" in name or "квартал" in name or pid in (409, 410, 411):
            return "Календарь «Трио»"
        if "перекид" in name or pid in (404, 405, 406):
            return "Перекидной настенный"
        return "Карманный и постер"

    if cat == "catalogs":
        if "журнал" in name or pid in (505, 506):
            return "Журналы"
        return "Каталоги и брошюры"

    if cat == "stickers":
        if "стикерпак" in name or "набор" in name or pid in (604, 605, 606):
            return "Стикерпаки (на листах)"
        return "Поштучные наклейки и стикеры"

    if cat == "menus":
        if p.get("multi_page_mode") == "pages" or "многостранич" in name or "карта" in name or pid in (1003, 1004):
            return "Многостраничное меню"
        return "Листовое и со сгибом"

    if cat == "table_tents":
        if "вкладыш" in name or pid in (1104, 1105):
            return "Сменные вкладыши"
        return "Самосборные тейбл-тенты"

    if cat == "postcards":
        if "двойн" in name or "сгиб" in name or pid in (1203, 1204):
            return "Двойные со сгибом"
        return "Одинарные открытки"

    if cat == "booklets":
        if "2 сгиб" in name or "евро" in name or pid == 201:
            return "Евробуклеты (2 сгиба)"
        return "Буклеты-книжки (1 сгиб)"

    return ""
