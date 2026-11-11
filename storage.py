import threading
import json
import logging
import os
import shutil
import math
import copy
import re
import time
from datetime import datetime, timezone
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from werkzeug.security import check_password_hash

from repository import JsonRepository, MongoRepository, RepositoryError
from seed_data import (
    ALL_LAM_IDS,
    ALL_PAPER_IDS,
    BASE_MATERIAL_CATEGORIES,
    DEFAULT_CLIENT_NAMES,
    DEFAULT_MAIN_CATEGORY_PARAMS,
    DEFAULT_TIERS_BOOKLETS,
    DEFAULT_TIERS_CALENDARS,
    DEFAULT_TIERS_CATALOGS,
    DEFAULT_TIERS_DESIGN,
    DEFAULT_TIERS_SOUVENIRS,
    DEFAULT_TIERS_STAMPS,
    DEFAULT_TIERS_STANDARD,
    DEFAULT_TIERS_WIDE_FORMAT,
    INITIAL_CATEGORIES,
    INITIAL_DATA,
    INITIAL_MAIN_CATEGORIES,
    INITIAL_MATERIAL_CATEGORIES,
    INITIAL_NON_POLYGRAPHY_ITEMS,
    INITIAL_PRODUCTS,
    NON_POLYGRAPHY_SEED_CATEGORIES,
    build_extra_calendar_seeds,
    build_non_polygraphy_seed_products,
    get_default_main_cat_params,
    get_default_tiers_for_cat,
    infer_default_product_kind,
    infer_material_group,
    infer_paper_color,
)

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))


def _load_dotenv_file(dotenv_path: str) -> None:
    if not os.path.isfile(dotenv_path):
        return
    try:
        with open(dotenv_path, "r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                    val = val[1:-1]
                if key and val != "" and key not in os.environ:
                    os.environ[key] = val
    except OSError:
        pass


_load_dotenv_file(os.path.join(PROJECT_ROOT, ".env"))

DATA_DIR = os.path.abspath(os.environ.get("PRINT_CALC_DATA_DIR") or os.path.join(PROJECT_ROOT, "data"))
os.makedirs(DATA_DIR, exist_ok=True)

DATA_FILE = os.path.join(DATA_DIR, "database.json")
DATA_BACKEND = os.environ.get("DATA_BACKEND", "json").strip().lower()
_JSON_REPOSITORY = None
_MONGO_REPOSITORY = None
_MONGO_BOOTSTRAPPED = False
UPLOAD_FOLDER = os.path.join(DATA_DIR, "uploads")
LEGACY_UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

_DATA_LOCK = threading.RLock()
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
SHARED_CART_TTL_SECONDS = 7 * 24 * 3600  # 604800 секунд (7 дней)

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
_ARGON2_SEMAPHORE = threading.BoundedSemaphore(4)
_PASSWORD_HASHER = PasswordHasher(
    time_cost=2,
    memory_cost=19456,
    parallelism=1,
)


def validate_password_policy(password: str, field_label: str = "Пароль") -> str | None:
    if not isinstance(password, str) or len(password) < MIN_PASSWORD_LENGTH:
        return f"{field_label} должен содержать минимум {MIN_PASSWORD_LENGTH} символов"
    if len(password) > MAX_PASSWORD_LENGTH:
        return f"{field_label} не должен превышать {MAX_PASSWORD_LENGTH} символов"
    return None


def hash_password(password: str) -> str:
    if not isinstance(password, str) or not password or len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError("Password length is outside allowed bounds")
    with _ARGON2_SEMAPHORE:
        return _PASSWORD_HASHER.hash(password)


def verify_password(stored_hash: str, password: str) -> tuple[bool, bool]:
    """Verify password against Argon2id or legacy Werkzeug hash.

    Returns ``(is_valid, needs_rehash)``. Passwords exceeding MAX_PASSWORD_LENGTH
    are rejected immediately before entering any KDF to prevent CPU/RAM DoS.
    """
    if (
        not isinstance(stored_hash, str)
        or not stored_hash
        or not isinstance(password, str)
        or not password
        or len(password) > MAX_PASSWORD_LENGTH
    ):
        return False, False

    if stored_hash.startswith("$argon2"):
        try:
            with _ARGON2_SEMAPHORE:
                _PASSWORD_HASHER.verify(stored_hash, password)
            return True, bool(_PASSWORD_HASHER.check_needs_rehash(stored_hash))
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False, False

    if stored_hash.startswith(("pbkdf2:", "scrypt:")):
        try:
            if check_password_hash(stored_hash, password):
                return True, True
        except ValueError:
            return False, False

    return False, False


def is_supported_password_hash(value: str) -> bool:
    return isinstance(value, str) and value.startswith(
        ("$argon2id$", "$argon2i$", "$argon2d$", "pbkdf2:", "scrypt:")
    )



def prune_expired_shared_carts(data: dict, now_ts: float | None = None) -> bool:
    if not isinstance(data, dict):
        return False
    shared_carts = data.get("shared_carts")
    if not isinstance(shared_carts, list) or len(shared_carts) == 0:
        return False

    current_ts = float(now_ts) if now_ts is not None else time.time()
    kept = []
    removed = False

    for item in shared_carts:
        if not isinstance(item, dict):
            removed = True
            continue

        expired = False
        raw_exp_ts = item.get("expires_at_ts")
        if raw_exp_ts is not None:
            try:
                if float(raw_exp_ts) <= current_ts:
                    expired = True
            except (ValueError, TypeError):
                expired = True

        if not expired:
            raw_exp_iso = item.get("expires_at")
            if isinstance(raw_exp_iso, str) and raw_exp_iso.strip():
                try:
                    exp_dt = datetime.fromisoformat(raw_exp_iso.strip().replace("Z", "+00:00"))
                    if exp_dt.tzinfo is None:
                        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                    if exp_dt.timestamp() <= current_ts:
                        expired = True
                except ValueError:
                    expired = True

        if not expired:
            raw_created = item.get("created_at")
            if isinstance(raw_created, str) and raw_created.strip():
                try:
                    created_dt = datetime.fromisoformat(raw_created.strip().replace("Z", "+00:00"))
                    if created_dt.tzinfo is None:
                        created_dt = created_dt.replace(tzinfo=timezone.utc)
                    if created_dt.timestamp() + SHARED_CART_TTL_SECONDS <= current_ts:
                        expired = True
                except ValueError:
                    pass

        if expired:
            removed = True
        else:
            kept.append(item)

    if removed:
        shared_carts[:] = kept
    return removed


def safe_int(val, default=0, min_val=None, max_val=None):
    try:
        res = int(float(val))
    except (ValueError, TypeError, OverflowError):
        res = default
    if min_val is not None and res < min_val:
        res = min_val
    if max_val is not None and res > max_val:
        res = max_val
    return res


def safe_float(val, default=0.0, min_val=None, max_val=None):
    try:
        res = float(val)
        if not math.isfinite(res):
            res = default
    except (ValueError, TypeError, OverflowError):
        res = default
    if min_val is not None and res < min_val:
        res = min_val
    if max_val is not None and res > max_val:
        res = max_val
    return res


def sanitize_image_url(url):
    if not isinstance(url, str):
        return ""
    cleaned = url.strip()
    if not cleaned or any(ch in cleaned for ch in ("\r", "\n", "\x00")):
        return ""
    lower = cleaned.lower()
    if lower.startswith(("javascript:", "vbscript:", "data:text/html", "data:application/")):
        return ""
    if cleaned.startswith(("/uploads/", "/assets/")) and not cleaned.startswith("//"):
        return cleaned[:1024]
    if lower.startswith("https://"):
        return cleaned[:1024]
    return ""


def is_valid_image_header(header_bytes, ext):
    if not header_bytes or len(header_bytes) < 6:
        return False
    if ext == ".png":
        return header_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in (".jpg", ".jpeg"):
        return header_bytes.startswith(b"\xff\xd8\xff")
    if ext == ".gif":
        return header_bytes.startswith((b"GIF87a", b"GIF89a"))
    if ext == ".webp":
        return len(header_bytes) >= 12 and header_bytes[:4] == b"RIFF" and header_bytes[8:12] == b"WEBP"
    return False


def _migrate_legacy_storage():
    """Автоматически переносит старые загрузки backend/uploads в вынесенную папку /data."""
    try:
        if os.path.isdir(LEGACY_UPLOAD_FOLDER):
            for fname in os.listdir(LEGACY_UPLOAD_FOLDER):
                src_p = os.path.join(LEGACY_UPLOAD_FOLDER, fname)
                dst_p = os.path.join(UPLOAD_FOLDER, fname)
                if os.path.isfile(src_p) and not os.path.exists(dst_p):
                    shutil.copy2(src_p, dst_p)
    except OSError as exc:
        logger.warning("Failed to migrate legacy uploads folder: %s", exc)


_migrate_legacy_storage()


def get_base_material_cat_ids(data=None):
    cats = set(BASE_MATERIAL_CATEGORIES)
    if isinstance(data, dict):
        for mc in data.get("material_categories", []):
            if isinstance(mc, dict) and mc.get("kind") == "material" and mc.get("id") and mc.get("id") != "laminations":
                cats.add(mc["id"])
    return cats


_ROLL_DIM_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*[×xх*]\s*(\d+(?:[.,]\d+)?)\s*м", re.IGNORECASE)


def infer_wide_format_roll_dimensions(name, resource_m2):
    safe_area = safe_float(resource_m2, 0.0, 0.0)
    match = _ROLL_DIM_RE.search(str(name or ""))
    if match:
        try:
            w = float(match.group(1).replace(",", "."))
            l = float(match.group(2).replace(",", "."))
            if w > 0 and l > 0 and (safe_area <= 0 or abs(w * l - safe_area) <= 0.25):
                return round(w, 4), round(l, 4)
        except ValueError:
            pass
    if safe_area > 0:
        default_w = 1.6 if safe_area >= 1.6 else 1.0
        return default_w, round(safe_area / default_w, 4)
    return 1.6, 50.0


def normalize_cost_params(raw_params):
    cleaned_params = []
    if isinstance(raw_params, list):
        for idx, cp in enumerate(raw_params):
            if not isinstance(cp, dict):
                continue
            raw_opts = cp.get("options") if isinstance(cp.get("options"), list) else []
            cleaned_opts = [
                {
                    "id": str(opt.get("id") or f"opt_{oidx + 1}"),
                    "label": (opt.get("label") or f"Вариант {oidx + 1}").strip(),
                    "cost": round(safe_float(opt.get("cost", 0.0), 0.0, 0.0), 2)
                }
                for oidx, opt in enumerate(raw_opts)
                if isinstance(opt, dict)
            ]
            cleaned_params.append({
                "id": str(cp.get("id") or f"param_{idx + 1}"),
                "name": (cp.get("name") or "Параметр").strip(),
                "cost": round(safe_float(cp.get("cost", 0.0), 0.0, 0.0), 2),
                "mode": cp.get("mode", "per_unit"),
                "is_enabled": bool(cp.get("is_enabled", True)),
                "is_client_facing": bool(cp.get("is_client_facing", False)),
                "input_type": cp.get("input_type", "checkbox"),
                "default_value": cp.get("default_value", False),
                "options": cleaned_opts
            })
    return cleaned_params


def _dedupe_int_ids(raw_list, valid_ids_set):
    if not isinstance(raw_list, list):
        return []
    result = []
    seen = set()
    for val in raw_list:
        iv = safe_int(val, 0)
        if iv > 0 and iv in valid_ids_set and iv not in seen:
            seen.add(iv)
            result.append(iv)
    return result


_DATA_CACHE = None
_PUBLIC_CATALOG_CACHE = None
_PUBLIC_CATALOG_JSON_BYTES = None
_CALC_INDEX_CACHE = None


def invalidate_derived_caches():
    global _PUBLIC_CATALOG_CACHE, _PUBLIC_CATALOG_JSON_BYTES, _CALC_INDEX_CACHE
    _PUBLIC_CATALOG_CACHE = None
    _PUBLIC_CATALOG_JSON_BYTES = None
    _CALC_INDEX_CACHE = None


def invalidate_all_caches():
    global _DATA_CACHE
    _DATA_CACHE = None
    invalidate_derived_caches()


def _get_mongo_repository():
    global _MONGO_REPOSITORY
    if _MONGO_REPOSITORY is None:
        _MONGO_REPOSITORY = MongoRepository()
    return _MONGO_REPOSITORY


def _bootstrap_empty_mongo(repository):
    """Import the local snapshot into a newly created, empty Mongo database."""
    global _MONGO_BOOTSTRAPPED
    if _MONGO_BOOTSTRAPPED:
        return
    snapshot = repository.load_snapshot()
    mongo_is_empty = not snapshot.get("settings") and not any(
        snapshot.get(k) for k in ("products", "categories", "items", "users")
    )
    if not mongo_is_empty:
        _MONGO_BOOTSTRAPPED = True
        return

    local_snapshot = None
    for candidate in (DATA_FILE, DATA_FILE + ".bak"):
        try:
            if os.path.exists(candidate):
                with open(candidate, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict) and any(
                    loaded.get(k) for k in ("products", "categories", "items", "users")
                ):
                    local_snapshot = loaded
                    break
        except (OSError, ValueError, TypeError):
            continue

    repository.replace_snapshot(local_snapshot if local_snapshot is not None else copy.deepcopy(INITIAL_DATA))
    _MONGO_BOOTSTRAPPED = True


def get_repository():
    """Return the configured persistence adapter (`JsonRepository` or `MongoRepository`)."""
    global _JSON_REPOSITORY
    if DATA_BACKEND == "mongo":
        return _get_mongo_repository()
    if _JSON_REPOSITORY is None:
        _JSON_REPOSITORY = JsonRepository(
            load_fn=load_data,
            save_fn=save_data,
            replace_fn=replace_full_data,
        )
    return _JSON_REPOSITORY


def load_data():
    global _DATA_CACHE
    with _DATA_LOCK:
        if _DATA_CACHE is not None:
            return _DATA_CACHE
        if DATA_BACKEND == "mongo":
            try:
                repository = _get_mongo_repository()
                data = repository.load_snapshot()
            except RepositoryError:
                raise
            except Exception as exc:
                raise RepositoryError(f"MongoDB load failed: {exc}") from exc
        else:
            if not os.path.exists(DATA_FILE):
                save_data(INITIAL_DATA)
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (OSError, ValueError, TypeError) as exc:
                logger.warning("Primary database file %s unreadable (%s); falling back to backup", DATA_FILE, exc)
                backup_file = DATA_FILE + ".bak"
                if os.path.exists(backup_file):
                    with open(backup_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                else:
                    data = copy.deepcopy(INITIAL_DATA)

        changed = False
        for transient_key in ("catalog", "db_info"):
            if transient_key in data:
                data.pop(transient_key, None)
                changed = True

        settings = data.setdefault("settings", {})
        for legacy_pin_key in ("admin_pin", "manager_pin", "admin_pin_hash", "manager_pin_hash"):
            if legacy_pin_key in settings:
                settings.pop(legacy_pin_key, None)
                changed = True

        if "bleed_mm" not in settings:
            settings["bleed_mm"] = 4.0
            changed = True
        if "defect_percent" not in settings:
            settings["defect_percent"] = 3.0
            changed = True
        if "tax_percent" not in settings:
            settings["tax_percent"] = 6.0
            changed = True
        if "usable_width_mm" not in settings:
            settings["usable_width_mm"] = 310.0
            changed = True
        if "usable_height_mm" not in settings:
            settings["usable_height_mm"] = 440.0
            changed = True
        if settings.get("sheet_length_m") == 0.45:
            settings["sheet_length_m"] = 0.5
            changed = True
        norm_roles = normalize_roles_list(
            settings.get("roles"),
            legacy_role_perms=settings.get("role_permissions"),
            legacy_role_statuses=settings.get("role_order_statuses"),
        )
        if settings.get("roles") != norm_roles:
            settings["roles"] = norm_roles
            changed = True
        norm_role_perms = {r["id"]: dict(r["permissions"]) for r in norm_roles}
        if settings.get("role_permissions") != norm_role_perms:
            settings["role_permissions"] = norm_role_perms
            changed = True
        norm_role_statuses = {r["id"]: list(r["allowed_order_statuses"]) for r in norm_roles}
        if settings.get("role_order_statuses") != norm_role_statuses:
            settings["role_order_statuses"] = norm_role_statuses
            changed = True

        # 1. Главные категории шапки и Подкатегории продуктов
        if "main_categories" not in data or not isinstance(data["main_categories"], list) or len(data["main_categories"]) == 0:
            data["main_categories"] = [dict(mc) for mc in INITIAL_MAIN_CATEGORIES]
            changed = True
        else:
            for mc in data["main_categories"]:
                if "is_hidden" not in mc:
                    mc["is_hidden"] = False
                    changed = True
                if "is_accent" not in mc:
                    mc["is_accent"] = False
                    changed = True
                if "image_url" not in mc:
                    mc["image_url"] = ""
                    changed = True

        main_cat_ids_set = {mc["id"] for mc in data["main_categories"]}
        default_parent_id = data["main_categories"][0]["id"]

        if "main_category_params" not in settings or not isinstance(settings.get("main_category_params"), dict):
            settings["main_category_params"] = {}
            changed = True
        for mc in data["main_categories"]:
            mc_id = mc["id"]
            def_params = get_default_main_cat_params(mc_id, settings)
            cur_params = settings["main_category_params"].get(mc_id)
            if not isinstance(cur_params, dict):
                settings["main_category_params"][mc_id] = dict(def_params)
                changed = True
            else:
                for pk, pv in def_params.items():
                    if pk not in cur_params:
                        cur_params[pk] = pv
                        changed = True
                if mc_id == "polygraphy":
                    for sync_k in ("bleed_mm", "sheet_length_m", "usable_height_mm", "usable_width_mm", "defect_percent", "tax_percent"):
                        if sync_k in settings and cur_params.get(sync_k) != float(settings[sync_k]):
                            cur_params[sync_k] = float(settings[sync_k])
                            changed = True
                elif mc_id == "wide_format":
                    for legacy_wf_key in ("roll_width_mm", "eyelet_step_mm"):
                        if legacy_wf_key in cur_params:
                            cur_params.pop(legacy_wf_key, None)
                            changed = True

        if "categories" not in data or not isinstance(data["categories"], list) or len(data["categories"]) == 0:
            data["categories"] = [dict(c) for c in INITIAL_CATEGORIES]
            changed = True
        else:
            default_featured_ids = {"flyers", "booklets", "business_cards", "catalogs"}
            existing_subcat_ids = set()
            for c in data["categories"]:
                existing_subcat_ids.add(c.get("id"))
                if "is_hidden" not in c:
                    c["is_hidden"] = False
                    changed = True
                if "parent_id" not in c or c.get("parent_id") not in main_cat_ids_set:
                    c["parent_id"] = default_parent_id
                    changed = True
                if "is_featured" not in c:
                    c["is_featured"] = c.get("id") in default_featured_ids
                    changed = True
                if "image_url" not in c:
                    c["image_url"] = ""
                    changed = True
                if "badge" not in c:
                    c["badge"] = "hit" if c.get("id") == "calendars" else ""
                    changed = True
            for seed_c in NON_POLYGRAPHY_SEED_CATEGORIES:
                if seed_c["id"] not in existing_subcat_ids and seed_c["parent_id"] in main_cat_ids_set:
                    data["categories"].append(dict(seed_c))
                    existing_subcat_ids.add(seed_c["id"])
                    changed = True

        cat_ids = [c["id"] for c in data["categories"]] + [
            mc["id"] for mc in data.get("main_categories", []) if mc["id"] not in {c["id"] for c in data["categories"]}
        ]
        valid_cat_ids_set = set(cat_ids)

        # 2. Шкала наценки и очистка устаревших ключей
        if "category_markups" not in settings or not isinstance(settings["category_markups"], dict):
            settings["category_markups"] = {cid: get_default_tiers_for_cat(cid) for cid in cat_ids}
            changed = True
        else:
            orphan_markup_keys = [k for k in settings["category_markups"] if k not in valid_cat_ids_set]
            for ok in orphan_markup_keys:
                settings["category_markups"].pop(ok, None)
                changed = True
            for cid in cat_ids:
                tiers = settings["category_markups"].get(cid)
                def_tiers_map = {int(dt["min_qty"]): float(dt.get("page_coefficient", dt["coefficient"])) for dt in get_default_tiers_for_cat(cid)}
                if not tiers or not isinstance(tiers, list):
                    settings["category_markups"][cid] = get_default_tiers_for_cat(cid)
                    changed = True
                else:
                    is_old_default_pct = (
                        len(tiers) == 6
                        and all("markup_percent" in t and "coefficient" not in t for t in tiers)
                        and [int(t.get("min_qty", 0)) for t in tiers] == [1, 50, 100, 300, 500, 1000]
                    )
                    if is_old_default_pct:
                        settings["category_markups"][cid] = get_default_tiers_for_cat(cid)
                        changed = True
                    else:
                        for t in tiers:
                            if "coefficient" not in t:
                                pct = float(t.get("markup_percent", 100.0))
                                t["coefficient"] = round(1.0 + pct / 100.0, 2)
                                changed = True
                            if "markup_percent" in t:
                                t.pop("markup_percent", None)
                                changed = True
                            if cid in ("catalogs", "notepads", "planners", "menus"):
                                if "page_coefficient" not in t:
                                    mq = int(t.get("min_qty", 1))
                                    t["page_coefficient"] = def_tiers_map.get(mq, float(t["coefficient"]))
                                    changed = True
                            elif "page_coefficient" in t:
                                t.pop("page_coefficient", None)
                                changed = True

        # 2b. Категории материалов и оборудования
        init_mc_map = {mc["id"]: mc for mc in INITIAL_MATERIAL_CATEGORIES}
        if "material_categories" not in data or not isinstance(data["material_categories"], list) or len(data["material_categories"]) == 0:
            data["material_categories"] = [dict(mc) for mc in INITIAL_MATERIAL_CATEGORIES]
            changed = True
        else:
            existing_mat_ids = set()
            for mc in data["material_categories"]:
                if isinstance(mc, dict):
                    existing_mat_ids.add(mc.get("id"))
                    if not mc.get("main_category_id") or mc.get("main_category_id") not in main_cat_ids_set:
                        mc["main_category_id"] = init_mc_map.get(mc.get("id"), {}).get("main_category_id", default_parent_id)
                        changed = True
                    if mc.get("id") == "wf_banners" and mc.get("resource_label") == "Площадь рулона (м²)":
                        mc["resource_label"] = "Ширина и длина рулона (м)"
                        changed = True
            for init_mc in INITIAL_MATERIAL_CATEGORIES:
                if init_mc["id"] not in existing_mat_ids:
                    data["material_categories"].append(dict(init_mc))
                    changed = True

        # 3. Позиции базы материалов и оборудования
        items = data.setdefault("items", [])
        has_lam_28 = any("28" in i.get("name", "") and i.get("category") == "laminations" for i in items)
        if not has_lam_28:
            new_lam_id = max((i["id"] for i in items), default=27) + 1
            items.append({
                "id": new_lam_id,
                "category": "laminations",
                "name": "Soft-Touch - 28мкр.",
                "client_name": "Матовая бархатная (Soft-Touch 28 мкр)",
                "price": 1409,
                "resource": 100,
                "unit": "м."
            })
            for p in data.get("products", []):
                if new_lam_id not in p.get("allowed_lamination_ids", []):
                    p.setdefault("allowed_lamination_ids", []).append(new_lam_id)
            changed = True

        has_folder = any("PF-370" in i.get("name", "") for i in items)
        if not has_folder:
            new_ext_id = max((i["id"] for i in items), default=28) + 1
            items.append({
                "id": new_ext_id,
                "category": "extras",
                "name": "Фальцовщик SuperFax PF-370",
                "client_name": "Фальцовка",
                "price": 150000,
                "resource": 1000000,
                "unit": "лист."
            })
            changed = True

        existing_item_names = {i.get("name") for i in items}
        for seed_item in INITIAL_NON_POLYGRAPHY_ITEMS:
            if seed_item["name"] not in existing_item_names:
                next_seed_id = max((i["id"] for i in items), default=29) + 1
                new_entry = dict(seed_item)
                new_entry["id"] = next_seed_id
                items.append(new_entry)
                existing_item_names.add(seed_item["name"])
                changed = True

        wf_roll_cat_ids = {"wf_banners"} | {
            mc.get("id")
            for mc in data.get("material_categories", [])
            if isinstance(mc, dict)
            and mc.get("main_category_id") == "wide_format"
            and (mc.get("kind") or "material") == "material"
            and mc.get("id")
        }
        for item in items:
            if "client_name" not in item or not item["client_name"]:
                if item["category"] in ("papers", "laminations", "extras"):
                    item["client_name"] = DEFAULT_CLIENT_NAMES.get(item["name"], item["name"])
                    changed = True
                else:
                    item["client_name"] = item["name"]
                    changed = True
            if "group" not in item or not item.get("group"):
                inferred = infer_material_group(item.get("name", ""), item.get("client_name", ""), item.get("category", ""))
                if inferred:
                    item["group"] = inferred
                    changed = True
            if "in_stock" not in item:
                item["in_stock"] = True
                changed = True
            if item.get("category") == "papers":
                if "color_name" not in item or not item.get("color_name") or "color_hex" not in item or not item.get("color_hex"):
                    c_name, c_hex = infer_paper_color(item.get("name", ""), item.get("client_name", ""))
                    item["color_name"] = item.get("color_name") or c_name
                    item["color_hex"] = item.get("color_hex") or c_hex
                    changed = True
            if item.get("category") in wf_roll_cat_ids:
                raw_w = safe_float(item.get("roll_width_m"), 0.0)
                raw_l = safe_float(item.get("roll_length_m"), 0.0)
                if raw_w <= 0 or raw_l <= 0:
                    w_m, l_m = infer_wide_format_roll_dimensions(item.get("name", ""), safe_float(item.get("resource"), 0.0))
                    item["roll_width_m"] = w_m
                    item["roll_length_m"] = l_m
                    item["resource"] = max(0.01, round(w_m * l_m, 4))
                    changed = True

        base_mat_cats = get_base_material_cat_ids(data)
        valid_all_item_ids = {i["id"] for i in items}
        valid_paper_ids = {i["id"] for i in items if i.get("category") in base_mat_cats}
        valid_poly_paper_ids = {i["id"] for i in items if i.get("category") == "papers"}
        valid_lam_ids = {i["id"] for i in items if i.get("category") == "laminations"}
        subcat_ids_set = {c["id"] for c in data["categories"]}
        fallback_subcat_id = data["categories"][0]["id"] if data["categories"] else "flyers"

        # 4. Продукты и проверка ссылочной целостности
        if "products" not in data or not isinstance(data["products"], list) or len(data["products"]) == 0:
            migrated_products = []
            for p in INITIAL_PRODUCTS:
                p_copy = dict(p)
                p_copy["allowed_paper_ids"] = [pid for pid in p["allowed_paper_ids"] if pid in valid_paper_ids] or sorted(valid_paper_ids)
                p_copy["allowed_lamination_ids"] = [lid for lid in p["allowed_lamination_ids"] if lid in valid_lam_ids]
                migrated_products.append(p_copy)
            data["products"] = migrated_products
            changed = True
        else:
            for p in data["products"]:
                if p.get("category") not in subcat_ids_set:
                    p["category"] = fallback_subcat_id
                    changed = True
                if "is_hidden" not in p:
                    p["is_hidden"] = False
                    changed = True
                if "defect_percent" not in p:
                    p["defect_percent"] = 3.0 if p.get("allow_custom_size") else 0.0
                    changed = True
                if "images" not in p or not isinstance(p["images"], list):
                    p["images"] = []
                    changed = True
                valid_schematics = {
                    "auto", "none", "flat", "booklet_1fold", "booklet_2fold",
                    "calendar_house", "calendar_wall", "pocket_calendar", "catalog",
                    "notepad_spiral", "folder", "box", "card_deck", "sticker_pack", "certificate"
                }
                raw_st = p.get("schematic_type")
                if raw_st == "booklet_1_fold":
                    p["schematic_type"] = "booklet_1fold"
                    changed = True
                elif raw_st == "booklet_2_folds":
                    p["schematic_type"] = "booklet_2fold"
                    changed = True
                elif raw_st == "single_sheet":
                    cat_s = p.get("category", "")
                    if cat_s in ("stickers", "stickers_3d"):
                        p["schematic_type"] = "sticker_pack"
                    elif cat_s in ("blanks", "certificates"):
                        p["schematic_type"] = "certificate"
                    else:
                        p["schematic_type"] = "flat"
                    changed = True
                elif not raw_st or raw_st not in valid_schematics:
                    p["schematic_type"] = "auto"
                    changed = True
                if "base_mm" not in p:
                    p["base_mm"] = 35.0
                    changed = True
                if "product_kind" not in p or (
                    not str(p.get("product_kind") or "").strip()
                    and p.get("category") in ("calendars", "catalogs", "stickers", "menus", "table_tents", "postcards", "booklets")
                ):
                    inferred_kind = infer_default_product_kind(p)
                    if p.get("product_kind") != inferred_kind:
                        p["product_kind"] = inferred_kind
                        changed = True
                if "cost_params" not in p or not isinstance(p["cost_params"], list):
                    p["cost_params"] = []
                    changed = True
                else:
                    for cp in p["cost_params"]:
                        if isinstance(cp, dict):
                            if "is_enabled" not in cp:
                                cp["is_enabled"] = True
                                changed = True
                            if (
                                cp.get("id") in ("eyelets", "wf_eyelets")
                                and cp.get("name") == "Установка люверсов по периметру"
                            ):
                                cp["name"] = "Установка люверсов"
                                changed = True
                if p.get("id") in (501, 502, 503, 504) and len(p.get("cost_params", [])) == 0:
                    p["cost_params"] = [
                        {
                            "id": "mag_binding",
                            "name": "Тип скрепления",
                            "cost": 0,
                            "mode": "per_unit",
                            "is_enabled": True,
                            "is_client_facing": True,
                            "input_type": "select",
                            "default_value": "staple",
                            "options": [
                                {"id": "staple", "label": "На 2 металлические скрепки (скоба)", "cost": 6},
                                {"id": "spiral", "label": "На металлическую пружину (+18 ₽)", "cost": 18},
                                {"id": "pur", "label": "Клеевое бесшовное скрепление КБС (+28 ₽)", "cost": 28}
                            ]
                        }
                    ]
                    changed = True
                if "has_cover_block" not in p:
                    p["has_cover_block"] = bool(p.get("category") == "catalogs" or p.get("multi_page_mode") == "pages")
                    changed = True
                if "allowed_block_print_modes" not in p or p.get("allowed_block_print_modes") not in ("both", "4+4", "1+1", "0+0"):
                    p["allowed_block_print_modes"] = "both"
                    changed = True
                if "allowed_cover_print_modes" not in p or p.get("allowed_cover_print_modes") not in ("both", "4+4", "4+0"):
                    p["allowed_cover_print_modes"] = "both"
                    changed = True
                if "allowed_cover_paper_ids" not in p or not isinstance(p.get("allowed_cover_paper_ids"), list):
                    p["allowed_cover_paper_ids"] = list(p.get("allowed_paper_ids", []))
                    changed = True

                # Очистка битых (несуществующих) ID бумаг, ламинации и оборудования
                clean_papers = _dedupe_int_ids(p.get("allowed_paper_ids", []), valid_paper_ids)
                if clean_papers != p.get("allowed_paper_ids"):
                    p["allowed_paper_ids"] = clean_papers
                    changed = True

                clean_cover_papers = _dedupe_int_ids(p.get("allowed_cover_paper_ids", []), valid_paper_ids)
                if clean_cover_papers != p.get("allowed_cover_paper_ids"):
                    p["allowed_cover_paper_ids"] = clean_cover_papers
                    changed = True

                clean_lams = _dedupe_int_ids(p.get("allowed_lamination_ids", []), valid_lam_ids)
                if clean_lams != p.get("allowed_lamination_ids"):
                    p["allowed_lamination_ids"] = clean_lams
                    changed = True

                clean_excl_eq = _dedupe_int_ids(p.get("excluded_equipment_ids", []), valid_all_item_ids)
                if clean_excl_eq != p.get("excluded_equipment_ids"):
                    p["excluded_equipment_ids"] = clean_excl_eq
                    changed = True

                clean_enab_eq = _dedupe_int_ids(p.get("enabled_equipment_ids", []), valid_all_item_ids)
                if clean_enab_eq != p.get("enabled_equipment_ids"):
                    p["enabled_equipment_ids"] = clean_enab_eq
                    changed = True

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
                    if flag_key not in p:
                        p[flag_key] = True
                        changed = True

            # Авто-добавление размеров для Календаря «Домик» и Календаря «Трио» (если еще нет в БД)
            existing_prod_ids = {int(p.get("id") or 0) for p in data["products"]}
            for seed_p in build_extra_calendar_seeds(valid_paper_ids, valid_lam_ids):
                if seed_p["id"] not in existing_prod_ids and "calendars" in subcat_ids_set:
                    data["products"].append(seed_p)
                    existing_prod_ids.add(seed_p["id"])
                    changed = True

            for seed_np in build_non_polygraphy_seed_products(items, valid_lam_ids):
                if seed_np["id"] not in existing_prod_ids and seed_np["category"] in subcat_ids_set:
                    data["products"].append(seed_np)
                    existing_prod_ids.add(seed_np["id"])
                    changed = True

        # 5. Пользователи (авторизация по Email + паролю и роли client | production | manager | admin)
        if "users" not in data or not isinstance(data.get("users"), list):
            data["users"] = []
            changed = True

        users = data["users"]
        valid_roles = set(get_roles_map(data).keys())
        for u in users:
            if not isinstance(u, dict):
                continue
            if "role" not in u or str(u.get("role") or "") not in valid_roles:
                u["role"] = "client"
                changed = True
            if "is_email_verified" not in u:
                u["is_email_verified"] = False
                changed = True
            if "created_at" not in u or not u.get("created_at"):
                u["created_at"] = datetime.now(timezone.utc).isoformat()
                changed = True
            if "company_details" not in u or not isinstance(u.get("company_details"), dict):
                u["company_details"] = {}
                changed = True
            else:
                norm_cd = sanitize_company_details(u.get("company_details"))
                if u["company_details"] != norm_cd:
                    u["company_details"] = norm_cd
                    changed = True
            if "email" in u and isinstance(u["email"], str):
                norm_email = u["email"].strip().lower()
                if u["email"] != norm_email:
                    u["email"] = norm_email
                    changed = True

            u_email = str(u.get("email") or "").strip().lower()
            raw_fn = str(u.get("first_name") or "").strip()
            raw_ln = str(u.get("last_name") or "").strip()
            raw_phone = str(u.get("phone") or "").strip()
            raw_name = str(u.get("name") or "").strip()

            # Миграция дефолтных стартовых аккаунтов сотрудников
            if u_email == "manager@print.local" and not raw_fn and raw_name in ("", "Менеджер"):
                raw_fn = "Алексей"
                raw_ln = "Смирнов"
                raw_name = "Алексей Смирнов"
                if not raw_phone:
                    raw_phone = "+7 (900) 000-00-01"
                changed = True
            elif u_email == "production@print.local" and not raw_fn and raw_name in ("", "Цех / Производство"):
                raw_fn = "Сергей"
                raw_ln = "Иванов"
                raw_name = "Сергей Иванов"
                if not raw_phone:
                    raw_phone = "+7 (900) 000-00-02"
                changed = True
            elif u_email == "admin@print.local" and not raw_fn:
                raw_fn = "Администратор"
                if not raw_phone:
                    raw_phone = "+7 (900) 000-00-00"
                changed = True

            if not raw_fn and not raw_ln and raw_name:
                parts = raw_name.split(None, 1)
                raw_fn = parts[0] if parts else ""
                raw_ln = parts[1] if len(parts) > 1 else ""
                changed = True

            combined_name = f"{raw_fn} {raw_ln}".strip()
            final_name = combined_name or raw_name or (u_email.split("@")[0] if u_email else "")

            if u.get("first_name") != raw_fn:
                u["first_name"] = raw_fn
                changed = True
            if u.get("last_name") != raw_ln:
                u["last_name"] = raw_ln
                changed = True
            if u.get("phone") != raw_phone:
                u["phone"] = raw_phone
                changed = True
            if u.get("name") != final_name:
                u["name"] = final_name
                changed = True

        existing_emails = {str(u.get("email") or "").strip().lower() for u in users if isinstance(u, dict)}
        next_uid = max((int(u.get("id", 0)) for u in users if isinstance(u, dict)), default=0) + 1
        now_iso = datetime.now(timezone.utc).isoformat()

        # Never create privileged accounts with predictable passwords in production.
        # Enable this only for local development/bootstrap and rotate credentials immediately.
        seed_default_users = os.environ.get("PRINT_CALC_SEED_DEFAULT_USERS", "0") == "1"
        seed_admin_email = (os.environ.get("PRINT_CALC_SEED_ADMIN_EMAIL") or "admin@print.local").strip().lower()
        seed_admin_password = os.environ.get("PRINT_CALC_SEED_ADMIN_PASSWORD") or "admin1234"
        seed_manager_email = (os.environ.get("PRINT_CALC_SEED_MANAGER_EMAIL") or "manager@print.local").strip().lower()
        seed_manager_password = os.environ.get("PRINT_CALC_SEED_MANAGER_PASSWORD") or "manager1234"
        seed_prod_email = (os.environ.get("PRINT_CALC_SEED_PRODUCTION_EMAIL") or "production@print.local").strip().lower()
        seed_prod_password = os.environ.get("PRINT_CALC_SEED_PRODUCTION_PASSWORD") or "prod1234"

        has_admin_user = any(isinstance(u, dict) and u.get("role") == "admin" for u in users)
        if seed_default_users and not has_admin_user:
            if seed_admin_email and seed_admin_email not in existing_emails and seed_admin_password:
                users.append({
                    "id": next_uid,
                    "email": seed_admin_email,
                    "first_name": "Администратор",
                    "last_name": "",
                    "name": "Администратор",
                    "phone": "+7 (900) 000-00-00",
                    "password_hash": hash_password(seed_admin_password),
                    "role": "admin",
                    "is_email_verified": True,
                    "created_at": now_iso,
                    "company_details": {},
                })
                existing_emails.add(seed_admin_email)
                next_uid += 1
                changed = True
            if seed_manager_email and seed_manager_email not in existing_emails and seed_manager_password:
                users.append({
                    "id": next_uid,
                    "email": seed_manager_email,
                    "first_name": "Алексей",
                    "last_name": "Смирнов",
                    "name": "Алексей Смирнов",
                    "phone": "+7 (900) 000-00-01",
                    "password_hash": hash_password(seed_manager_password),
                    "role": "manager",
                    "is_email_verified": True,
                    "created_at": now_iso,
                    "company_details": {},
                })
                existing_emails.add(seed_manager_email)
                next_uid += 1
                changed = True

        if seed_default_users and seed_prod_email and seed_prod_email not in existing_emails and seed_prod_password:
            users.append({
                "id": next_uid,
                "email": seed_prod_email,
                "first_name": "Сергей",
                "last_name": "Иванов",
                "name": "Сергей Иванов",
                "phone": "+7 (900) 000-00-02",
                "password_hash": hash_password(seed_prod_password),
                "role": "production",
                "is_email_verified": True,
                "created_at": now_iso,
                "company_details": {},
            })
            existing_emails.add(seed_prod_email)
            next_uid += 1
            changed = True

        # 6. Заказы CRM (orders)
        if "orders" not in data or not isinstance(data.get("orders"), list):
            data["orders"] = []
            changed = True

        if prune_expired_shared_carts(data):
            changed = True

        if changed and DATA_BACKEND != "mongo":
            save_data(data)

        _DATA_CACHE = data
        return data


COMPANY_DETAIL_KEYS = (
    "company_name",
    "inn",
    "kpp",
    "legal_address",
    "bank_name",
    "bik",
    "checking_account",
    "correspondent_account",
    "phone",
)

PERMISSION_KEYS = (
    "manage_kp",
    "apply_discounts",
    "view_crm",
    "view_all_orders",
    "update_order_status",
    "manage_order_finances",
    "view_internal_metrics",
    "delete_orders",
    "manage_catalog",
    "manage_users",
)

ORDER_STATUS_KEYS = (
    "new",
    "awaiting_payment",
    "prepress",
    "in_progress",
    "ready",
    "completed",
    "cancelled",
)

DEFAULT_ROLE_ORDER_STATUSES = {
    "client": [],
    "production": ["prepress", "in_progress", "ready", "completed"],
    "manager": list(ORDER_STATUS_KEYS),
    "admin": list(ORDER_STATUS_KEYS),
}

DEFAULT_ROLES = [
    {
        "id": "client",
        "name": "Клиент",
        "is_system": True,
        "permissions": {k: False for k in PERMISSION_KEYS},
        "allowed_order_statuses": list(DEFAULT_ROLE_ORDER_STATUSES["client"]),
    },
    {
        "id": "production",
        "name": "Производство",
        "is_system": True,
        "permissions": {
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
        "allowed_order_statuses": list(DEFAULT_ROLE_ORDER_STATUSES["production"]),
    },
    {
        "id": "manager",
        "name": "Менеджер",
        "is_system": True,
        "permissions": {
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
        "allowed_order_statuses": list(DEFAULT_ROLE_ORDER_STATUSES["manager"]),
    },
    {
        "id": "admin",
        "name": "Администратор",
        "is_system": True,
        "permissions": {k: True for k in PERMISSION_KEYS},
        "allowed_order_statuses": list(DEFAULT_ROLE_ORDER_STATUSES["admin"]),
    },
]

DEFAULT_ROLE_PERMISSIONS = {r["id"]: dict(r["permissions"]) for r in DEFAULT_ROLES}


def normalize_role_permissions(
    raw_perms,
    force_all_true: bool = False,
    force_all_false: bool = False,
    role_id: str = "",
) -> dict:
    if force_all_true:
        return {k: True for k in PERMISSION_KEYS}
    if force_all_false:
        return {k: False for k in PERMISSION_KEYS}
    raw_dict = raw_perms if isinstance(raw_perms, dict) else {}
    default_perms = DEFAULT_ROLE_PERMISSIONS.get(role_id, {})
    return {
        k: bool(raw_dict[k]) if k in raw_dict else bool(default_perms.get(k, False))
        for k in PERMISSION_KEYS
    }


def normalize_allowed_order_statuses(
    raw_statuses, role_id: str = "", force_all: bool = False, force_empty: bool = False
) -> list[str]:
    if force_all or role_id == "admin":
        return list(ORDER_STATUS_KEYS)
    if force_empty or role_id == "client":
        return []
    if raw_statuses is None:
        default_list = DEFAULT_ROLE_ORDER_STATUSES.get(role_id, list(ORDER_STATUS_KEYS))
        return list(default_list)
    if isinstance(raw_statuses, list):
        raw_set = {str(s or "").strip() for s in raw_statuses}
        return [st for st in ORDER_STATUS_KEYS if st in raw_set]
    default_list = DEFAULT_ROLE_ORDER_STATUSES.get(role_id, list(ORDER_STATUS_KEYS))
    return list(default_list)


def normalize_roles_list(
    raw_roles, legacy_role_perms=None, legacy_role_statuses=None
) -> list[dict]:
    default_by_id = {r["id"]: copy.deepcopy(r) for r in DEFAULT_ROLES}
    legacy_map = legacy_role_perms if isinstance(legacy_role_perms, dict) else {}
    legacy_status_map = legacy_role_statuses if isinstance(legacy_role_statuses, dict) else {}

    if not isinstance(raw_roles, list) or len(raw_roles) == 0:
        roles_source = [copy.deepcopy(r) for r in DEFAULT_ROLES]
        for r in roles_source:
            r_id = r["id"]
            if r_id not in ("admin", "client") and isinstance(legacy_map.get(r_id), dict):
                merged = dict(r["permissions"])
                for k, v in legacy_map[r_id].items():
                    if k in PERMISSION_KEYS:
                        merged[k] = bool(v)
                r["permissions"] = normalize_role_permissions(
                    merged, force_all_true=False, role_id=r_id
                )
            if r_id not in ("admin", "client") and isinstance(legacy_status_map.get(r_id), list):
                r["allowed_order_statuses"] = normalize_allowed_order_statuses(
                    legacy_status_map[r_id], role_id=r_id
                )
    else:
        roles_source = raw_roles

    result = []
    seen_ids = set()
    for item in roles_source:
        if not isinstance(item, dict):
            continue
        r_id = str(item.get("id") or "").strip()
        if not r_id or r_id in seen_ids:
            continue
        seen_ids.add(r_id)
        def_role = default_by_id.get(r_id)
        raw_name = str(item.get("name") or (def_role["name"] if def_role else r_id)).strip()[:80]
        if not raw_name:
            raw_name = def_role["name"] if def_role else r_id
        is_admin = r_id == "admin"
        is_client = r_id == "client"
        raw_p = item.get("permissions")
        if not isinstance(raw_p, dict) and def_role:
            raw_p = def_role["permissions"]
        if is_client:
            perms = {k: False for k in PERMISSION_KEYS}
        else:
            perms = normalize_role_permissions(raw_p, force_all_true=is_admin, role_id=r_id)
        raw_s = item.get("allowed_order_statuses")
        if raw_s is None and r_id in legacy_status_map:
            raw_s = legacy_status_map.get(r_id)
        allowed_statuses = normalize_allowed_order_statuses(
            raw_s,
            role_id=r_id,
            force_all=is_admin,
            force_empty=is_client,
        )
        is_sys = (
            True
            if (is_admin or is_client)
            else bool(item.get("is_system", def_role["is_system"] if def_role else False))
        )
        result.append({
            "id": r_id,
            "name": raw_name,
            "is_system": is_sys,
            "permissions": perms,
            "allowed_order_statuses": allowed_statuses,
        })

    for req_id in ("client", "admin"):
        if req_id not in seen_ids:
            req_role = copy.deepcopy(default_by_id[req_id])
            if req_id == "client":
                req_role["is_system"] = True
                req_role["permissions"] = {k: False for k in PERMISSION_KEYS}
                req_role["allowed_order_statuses"] = []
                result.insert(0, req_role)
            else:
                req_role["is_system"] = True
                req_role["permissions"] = {k: True for k in PERMISSION_KEYS}
                req_role["allowed_order_statuses"] = list(ORDER_STATUS_KEYS)
                result.append(req_role)
            seen_ids.add(req_id)

    return result


def get_roles_list(data=None) -> list[dict]:
    if data is None:
        if _DATA_CACHE is not None:
            data = _DATA_CACHE
        else:
            try:
                data = load_data()
            except Exception as exc:
                logger.warning("Falling back to default roles because load_data failed: %s", exc)
                data = {}
    settings = data.get("settings") if isinstance(data, dict) else None
    raw_roles = settings.get("roles") if isinstance(settings, dict) else None
    legacy_perms = settings.get("role_permissions") if isinstance(settings, dict) else None
    legacy_statuses = settings.get("role_order_statuses") if isinstance(settings, dict) else None
    return normalize_roles_list(
        raw_roles,
        legacy_role_perms=legacy_perms,
        legacy_role_statuses=legacy_statuses,
    )


def get_roles_map(data=None) -> dict[str, dict]:
    return {r["id"]: r for r in get_roles_list(data)}


def get_role_permissions_map(data=None) -> dict:
    return {r["id"]: dict(r["permissions"]) for r in get_roles_list(data)}


def get_role_order_statuses_map(data=None) -> dict[str, list[str]]:
    return {r["id"]: list(r.get("allowed_order_statuses") or []) for r in get_roles_list(data)}


def has_role_permission(role_id: str | None, perm_key: str, data=None) -> bool:
    if not role_id or str(role_id).strip() == "client":
        return False
    if role_id == "admin":
        return True
    role_obj = get_roles_map(data).get(str(role_id))
    if not isinstance(role_obj, dict):
        return False
    perms = role_obj.get("permissions")
    if not isinstance(perms, dict):
        return False
    return bool(perms.get(perm_key, False))


def can_role_set_order_status(role_id: str | None, target_status: str, data=None) -> bool:
    if not has_role_permission(role_id, "update_order_status", data):
        return False
    if role_id == "admin":
        return target_status in ORDER_STATUS_KEYS
    statuses_map = get_role_order_statuses_map(data)
    allowed = statuses_map.get(str(role_id), [])
    return target_status in allowed


def sanitize_company_details(raw_details):
    if not isinstance(raw_details, dict) or not raw_details:
        return {}
    cleaned = {}
    has_any = False
    for k in COMPANY_DETAIL_KEYS:
        val = str(raw_details.get(k) or "").strip()[:300]
        cleaned[k] = val
        if val:
            has_any = True
    return cleaned if has_any else {}


def is_complete_company_details(raw_details) -> bool:
    """Проверяет, что заполнены абсолютно все поля COMPANY_DETAIL_KEYS."""
    if not isinstance(raw_details, dict) or not raw_details:
        return False
    return all(bool(str(raw_details.get(k) or "").strip()) for k in COMPANY_DETAIL_KEYS)



def sanitize_user_discount_fields(raw_dict: dict | None) -> dict:
    if not isinstance(raw_dict, dict):
        raw_dict = {}
    discount_percent = round(safe_float(raw_dict.get("discount_percent", 0.0), 0.0, 0.0, 100.0), 2)
    discount_scope = (
        "selected" if str(raw_dict.get("discount_scope") or "").strip() == "selected" else "all"
    )

    main_cats: list[str] = []
    seen_main: set[str] = set()
    raw_main = raw_dict.get("discount_main_categories")
    if isinstance(raw_main, list):
        for x in raw_main:
            s = str(x or "").strip()[:80]
            if s and s not in seen_main:
                seen_main.add(s)
                main_cats.append(s)

    cats: list[str] = []
    seen_cats: set[str] = set()
    raw_cats = raw_dict.get("discount_categories")
    if isinstance(raw_cats, list):
        for x in raw_cats:
            s = str(x or "").strip()[:80]
            if s and s not in seen_cats:
                seen_cats.add(s)
                cats.append(s)

    prods: list[int] = []
    seen_prods: set[int] = set()
    raw_prods = raw_dict.get("discount_products")
    if isinstance(raw_prods, list):
        for x in raw_prods:
            pid = safe_int(x, 0)
            if pid > 0 and pid not in seen_prods:
                seen_prods.add(pid)
                prods.append(pid)

    return {
        "discount_percent": discount_percent,
        "discount_scope": discount_scope,
        "discount_main_categories": main_cats,
        "discount_categories": cats,
        "discount_products": prods,
    }


def get_user_discount_for_product(
    user_dict: dict | None,
    product_id: int,
    category_id: str,
    main_category_id: str,
) -> float:
    if not isinstance(user_dict, dict):
        return 0.0
    pct = round(safe_float(user_dict.get("discount_percent", 0.0), 0.0, 0.0, 100.0), 2)
    if pct <= 0:
        return 0.0
    scope = str(user_dict.get("discount_scope") or "all").strip()
    if scope != "selected":
        return pct
    allowed_prods = {
        safe_int(x, 0) for x in (user_dict.get("discount_products") or []) if safe_int(x, 0) > 0
    }
    allowed_cats = {
        str(x).strip() for x in (user_dict.get("discount_categories") or []) if str(x).strip()
    }
    allowed_main = {
        str(x).strip()
        for x in (user_dict.get("discount_main_categories") or [])
        if str(x).strip()
    }
    if (
        int(product_id) in allowed_prods
        or str(category_id) in allowed_cats
        or str(main_category_id) in allowed_main
    ):
        return pct
    return 0.0


def sanitize_user_public(user_dict, data=None):
    if not isinstance(user_dict, dict):
        return {}
    cd = sanitize_company_details(user_dict.get("company_details"))
    client_type = "legal" if is_complete_company_details(cd) else "individual"
    phone_val = str(user_dict.get("phone") or cd.get("phone") or "").strip()[:60]
    first_name = str(user_dict.get("first_name") or "").strip()[:80]
    last_name = str(user_dict.get("last_name") or "").strip()[:80]
    raw_name = str(user_dict.get("name") or "").strip()[:120]
    if not first_name and not last_name and raw_name:
        parts = raw_name.split(None, 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""
    combined_name = f"{first_name} {last_name}".strip()
    display_name = combined_name or raw_name
    roles_map = get_roles_map(data)
    raw_role = str(user_dict.get("role") or "client").strip()
    role = raw_role if raw_role in roles_map else "client"
    role_obj = roles_map.get(role) or roles_map.get("client") or DEFAULT_ROLES[0]
    role_name = str(role_obj.get("name") or role)
    role_perms = dict(role_obj.get("permissions") or DEFAULT_ROLE_PERMISSIONS["client"])
    allowed_order_statuses = (
        list(role_obj.get("allowed_order_statuses") or [])
        if role_perms.get("update_order_status")
        else []
    )
    discount_fields = sanitize_user_discount_fields(user_dict)
    return {
        "id": int(user_dict.get("id") or 0),
        "email": str(user_dict.get("email") or "").strip().lower(),
        "first_name": first_name,
        "last_name": last_name,
        "name": display_name,
        "phone": phone_val,
        "role": role,
        "role_name": role_name,
        "permissions": role_perms,
        "allowed_order_statuses": allowed_order_statuses,
        "is_email_verified": bool(user_dict.get("is_email_verified", False)),
        "created_at": str(user_dict.get("created_at") or ""),
        "client_type": client_type,
        "company_details": cd,
        **discount_fields,
    }


def _write_json_data_file(data: dict) -> None:
    tmp_file = DATA_FILE + ".tmp"
    backup_file = DATA_FILE + ".bak"
    try:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if os.name != "nt":
            try:
                os.chmod(tmp_file, 0o600)
            except OSError:
                pass
        if os.path.exists(DATA_FILE):
            if os.path.exists(backup_file):
                os.remove(backup_file)
            os.replace(DATA_FILE, backup_file)
            if os.name != "nt":
                try:
                    os.chmod(backup_file, 0o600)
                except OSError:
                    pass
        os.replace(tmp_file, DATA_FILE)
    except Exception:
        if os.path.exists(tmp_file):
            os.remove(tmp_file)
        raise


def save_data(data):
    global _DATA_CACHE
    with _DATA_LOCK:
        if DATA_BACKEND == "mongo":
            try:
                _get_mongo_repository().save_catalog_snapshot(data)
            except Exception as exc:
                raise RepositoryError(f"MongoDB catalog save failed: {exc}") from exc
            _DATA_CACHE = None
            invalidate_derived_caches()
            return
        _DATA_CACHE = data
        invalidate_derived_caches()
        _write_json_data_file(data)


def replace_full_data(data):
    """Replace the entire database snapshot (used exclusively for full DB import)."""
    global _DATA_CACHE
    with _DATA_LOCK:
        if DATA_BACKEND == "mongo":
            try:
                _get_mongo_repository().replace_snapshot(data)
            except Exception as exc:
                raise RepositoryError(f"MongoDB snapshot import failed: {exc}") from exc
            _DATA_CACHE = None
            invalidate_derived_caches()
            return
        _DATA_CACHE = data
        invalidate_derived_caches()
        _write_json_data_file(data)


def get_calc_index(data):
    global _CALC_INDEX_CACHE
    with _DATA_LOCK:
        if _CALC_INDEX_CACHE is not None:
            return _CALC_INDEX_CACHE

        base_mat_cats = get_base_material_cat_ids(data)
        items = data.get("items", [])
        products = data.get("products", [])
        products_by_id = {p["id"]: p for p in products}
        items_by_id = {i["id"]: i for i in items}
        papers_by_id = {}
        first_paper_by_cat = {}
        lams_by_id = {}
        toners_list = []
        components_list = []
        wf_inks_list = []
        wf_equipment_list = []
        souv_inks_list = []
        souv_equipment_list = []
        stamps_consumables_list = []
        stamps_equipment_list = []
        first_paper = None
        toner_per_a4 = 0.0
        comp_per_a4 = 0.0
        toner_per_a4_bw = 0.0
        comp_per_a4_bw = 0.0

        for i in items:
            cat = i.get("category")
            res = float(i.get("resource") or 0.0)
            price = float(i.get("price") or 0.0)
            if cat in base_mat_cats:
                papers_by_id[i["id"]] = i
                if cat not in first_paper_by_cat:
                    first_paper_by_cat[cat] = i
                if cat == "papers" and first_paper is None:
                    first_paper = i
            elif cat == "laminations":
                lams_by_id[i["id"]] = i
            elif cat == "toners" and res > 0:
                toners_list.append(i)
                unit_c = price / res
                toner_per_a4 += unit_c
                name_low = i.get("name", "").lower()
                if "black" in name_low or "черн" in name_low or "чёрн" in name_low:
                    toner_per_a4_bw += unit_c
            elif cat == "components" and res > 0:
                components_list.append(i)
                unit_c = price / res
                comp_per_a4 += unit_c
                if "c/m/y" not in i.get("name", "").lower():
                    comp_per_a4_bw += unit_c
            elif cat == "wf_inks" and res > 0:
                wf_inks_list.append(i)
            elif cat == "wf_equipment" and res > 0:
                wf_equipment_list.append(i)
            elif cat == "souv_inks" and res > 0:
                souv_inks_list.append(i)
            elif cat == "souv_equipment" and res > 0:
                souv_equipment_list.append(i)
            elif cat == "stamps_consumables" and res > 0:
                stamps_consumables_list.append(i)
            elif cat == "stamps_equipment" and res > 0:
                stamps_equipment_list.append(i)

        if toner_per_a4_bw <= 0:
            toner_per_a4_bw = toner_per_a4 * 0.25

        a4_click_cost = toner_per_a4 + comp_per_a4
        sra3_click_cost = a4_click_cost * 2.0
        a4_bw_click_cost = toner_per_a4_bw + comp_per_a4_bw

        categories = data.get("categories", [])
        subcat_parent_by_id = {c["id"]: c.get("parent_id", "polygraphy") for c in categories}

        _CALC_INDEX_CACHE = {
            "products_by_id": products_by_id,
            "items_by_id": items_by_id,
            "papers_by_id": papers_by_id,
            "first_paper_by_cat": first_paper_by_cat,
            "lams_by_id": lams_by_id,
            "toners_list": toners_list,
            "components_list": components_list,
            "wf_inks_list": wf_inks_list,
            "wf_equipment_list": wf_equipment_list,
            "souv_inks_list": souv_inks_list,
            "souv_equipment_list": souv_equipment_list,
            "stamps_consumables_list": stamps_consumables_list,
            "stamps_equipment_list": stamps_equipment_list,
            "first_paper": first_paper,
            "toner_per_a4": toner_per_a4,
            "comp_per_a4": comp_per_a4,
            "toner_per_a4_bw": toner_per_a4_bw,
            "comp_per_a4_bw": comp_per_a4_bw,
            "a4_click_cost": a4_click_cost,
            "sra3_click_cost": sra3_click_cost,
            "a4_bw_click_cost": a4_bw_click_cost,
            "subcat_parent_by_id": subcat_parent_by_id,
        }
        return _CALC_INDEX_CACHE


def _build_public_catalog_payload(data):
    visible_main_categories = [
        {
            "id": mc["id"],
            "name": mc["name"],
            "is_accent": bool(mc.get("is_accent", False)),
            "image_url": sanitize_image_url(mc.get("image_url", ""))
        }
        for mc in data.get("main_categories", [])
        if not mc.get("is_hidden", False)
    ]
    visible_main_ids = {mc["id"] for mc in visible_main_categories}
    fallback_main_id = visible_main_categories[0]["id"] if visible_main_categories else "polygraphy"

    visible_categories = [
        {
            "id": c["id"],
            "parent_id": c.get("parent_id") if c.get("parent_id") in visible_main_ids else fallback_main_id,
            "name": c["name"],
            "icon": c.get("icon", "📦"),
            "is_featured": bool(c.get("is_featured", False)),
            "image_url": sanitize_image_url(c.get("image_url", "")),
            "badge": c.get("badge", "")
        }
        for c in data.get("categories", [])
        if not c.get("is_hidden", False) and (c.get("parent_id", fallback_main_id) in visible_main_ids)
    ]
    visible_cat_ids = {c["id"] for c in visible_categories}

    base_mat_cats = get_base_material_cat_ids(data)
    papers = []
    for i in data["items"]:
        if i["category"] not in base_mat_cats:
            continue
        pub_paper = {
            "id": i["id"],
            "category": i["category"],
            "name": (i.get("client_name") or i["name"]).strip(),
            "group": (i.get("group") or infer_material_group(i.get("name", ""), i.get("client_name", ""), i["category"])).strip(),
            "in_stock": bool(i.get("in_stock", True)),
            "color_name": (i.get("color_name") or infer_paper_color(i.get("name", ""), i.get("client_name", ""))[0]).strip(),
            "color_hex": (i.get("color_hex") or infer_paper_color(i.get("name", ""), i.get("client_name", ""))[1]).strip(),
        }
        rw_m = safe_float(i.get("roll_width_m"), 0.0)
        rl_m = safe_float(i.get("roll_length_m"), 0.0)
        if rw_m > 0:
            pub_paper["roll_width_m"] = round(rw_m, 4)
        if rl_m > 0:
            pub_paper["roll_length_m"] = round(rl_m, 4)
        papers.append(pub_paper)
    laminations = [
        {
            "id": i["id"],
            "name": (i.get("client_name") or i["name"]).strip(),
            "group": (i.get("group") or infer_material_group(i.get("name", ""), i.get("client_name", ""), "laminations")).strip(),
            "in_stock": bool(i.get("in_stock", True))
        }
        for i in data["items"]
        if i["category"] == "laminations"
    ]

    def clean_public_cost_params(raw_params):
        if not isinstance(raw_params, list):
            return []
        result = []
        for idx, cp in enumerate(raw_params):
            if not isinstance(cp, dict) or not cp.get("is_client_facing", False) or not cp.get("is_enabled", True):
                continue
            raw_opts = cp.get("options") if isinstance(cp.get("options"), list) else []
            cleaned_opts = [
                {
                    "id": str(opt.get("id") or f"opt_{oidx + 1}"),
                    "label": (opt.get("label") or f"Вариант {oidx + 1}").strip(),
                    "cost": round(safe_float(opt.get("cost", 0.0), 0.0, 0.0), 2)
                }
                for oidx, opt in enumerate(raw_opts)
                if isinstance(opt, dict)
            ]
            result.append({
                "id": str(cp.get("id") or f"param_{idx + 1}"),
                "name": (cp.get("name") or "Параметр").strip(),
                "cost": round(safe_float(cp.get("cost", 0.0), 0.0, 0.0), 2),
                "mode": cp.get("mode", "per_unit"),
                "is_enabled": True,
                "is_client_facing": True,
                "input_type": cp.get("input_type", "checkbox"),
                "default_value": cp.get("default_value", False),
                "options": cleaned_opts
            })
        return result

    public_products = [
        {
            "id": p["id"],
            "category": p["category"],
            "name": p["name"],
            "product_kind": str(p.get("product_kind") or "").strip(),
            "width_mm": p["width_mm"],
            "height_mm": p["height_mm"],
            "allow_custom_size": bool(p.get("allow_custom_size", False)),
            "multi_page_mode": p.get("multi_page_mode", "none"),
            "default_pages": int(p.get("default_pages", 1)),
            "allowed_sides": p.get("allowed_sides", "both"),
            "has_cover_block": bool(p.get("has_cover_block", p.get("category") == "catalogs" or p.get("multi_page_mode") == "pages")),
            "allowed_block_print_modes": p.get("allowed_block_print_modes", "both"),
            "allowed_cover_print_modes": p.get("allowed_cover_print_modes", "both"),
            "allowed_cover_paper_ids": p.get("allowed_cover_paper_ids") if isinstance(p.get("allowed_cover_paper_ids"), list) else p.get("allowed_paper_ids", []),
            "schematic_type": p.get("schematic_type", "auto"),
            "base_mm": float(p.get("base_mm", 35.0)),
            "images": [u for u in (sanitize_image_url(img) for img in p.get("images", [])) if u],
            "cost_params": clean_public_cost_params(p.get("cost_params", [])),
            "show_format_select": bool(p.get("show_format_select", True)),
            "show_print_sides": bool(p.get("show_print_sides", True)),
            "show_paper_select": bool(p.get("show_paper_select", True)),
            "show_lamination_select": bool(p.get("show_lamination_select", True)),
            "allowed_paper_ids": p.get("allowed_paper_ids", []),
            "allowed_lamination_ids": p.get("allowed_lamination_ids", [])
        }
        for p in data.get("products", [])
        if p["category"] in visible_cat_ids and not p.get("is_hidden", False)
    ]
    settings = data.get("settings", {})
    usable_w = float(settings.get("usable_width_mm", 310.0))
    usable_h = float(settings.get("usable_height_mm", 440.0))
    sra3_w = float(settings.get("sra3_width_mm", 320.0))
    sra3_h = float(settings.get("sra3_height_mm", 450.0))
    bleed_mm = float(settings.get("bleed_mm", 4.0))
    mc_params_all = settings.get("main_category_params") or {}
    wf_params = mc_params_all.get("wide_format") or {}
    souv_params = mc_params_all.get("souvenirs") or {}

    category_qty_tiers = {}
    raw_markups = settings.get("category_markups") or {}
    if isinstance(raw_markups, dict):
        for cat_id, tiers in raw_markups.items():
            if not isinstance(tiers, list):
                continue
            qtys = sorted({
                int(round(float(t.get("min_qty", 1))))
                for t in tiers
                if isinstance(t, dict) and float(t.get("min_qty", 0)) >= 1
            })
            if qtys:
                category_qty_tiers[str(cat_id)] = qtys

    return {
        "main_categories": visible_main_categories,
        "categories": visible_categories,
        "papers": papers,
        "laminations": laminations,
        "products": public_products,
        "category_qty_tiers": category_qty_tiers,
        "limits": {
            "usable_width_mm": usable_w,
            "usable_height_mm": usable_h,
            "sra3_width_mm": sra3_w,
            "sra3_height_mm": sra3_h,
            "bleed_mm": bleed_mm,
            "by_main_category": {
                "polygraphy": {
                    "usable_width_mm": usable_w,
                    "usable_height_mm": usable_h,
                    "max_width_mm": max(usable_w, usable_h),
                    "max_height_mm": max(usable_w, usable_h),
                    "bleed_mm": bleed_mm,
                },
                "wide_format": {
                    "usable_width_mm": 50000.0,
                    "usable_height_mm": 50000.0,
                    "max_width_mm": 50000.0,
                    "max_height_mm": 50000.0,
                    "roll_width_mm": float(wf_params.get("roll_width_mm", 1600.0)),
                    "bleed_mm": float(wf_params.get("bleed_mm", 10.0)),
                },
                "souvenirs": {
                    "usable_width_mm": float(souv_params.get("print_area_mm", 200.0)),
                    "usable_height_mm": float(souv_params.get("print_area_mm", 200.0)),
                    "max_width_mm": 2000.0,
                    "max_height_mm": 2000.0,
                },
                "stamps": {
                    "usable_width_mm": 200.0,
                    "usable_height_mm": 200.0,
                    "max_width_mm": 200.0,
                    "max_height_mm": 200.0,
                },
                "design": {
                    "usable_width_mm": 50000.0,
                    "usable_height_mm": 50000.0,
                    "max_width_mm": 50000.0,
                    "max_height_mm": 50000.0,
                },
            }
        }
    }


def get_public_catalog_dict(data):
    global _PUBLIC_CATALOG_CACHE, _PUBLIC_CATALOG_JSON_BYTES
    with _DATA_LOCK:
        if _PUBLIC_CATALOG_CACHE is None:
            _PUBLIC_CATALOG_CACHE = _build_public_catalog_payload(data)
            _PUBLIC_CATALOG_JSON_BYTES = json.dumps(_PUBLIC_CATALOG_CACHE, ensure_ascii=False).encode("utf-8")
        return _PUBLIC_CATALOG_CACHE


def get_public_catalog_bytes(data):
    global _PUBLIC_CATALOG_JSON_BYTES
    with _DATA_LOCK:
        if _PUBLIC_CATALOG_JSON_BYTES is None:
            get_public_catalog_dict(data)
        return _PUBLIC_CATALOG_JSON_BYTES
