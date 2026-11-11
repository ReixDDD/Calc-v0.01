"""Migrate the normalized JSON aggregate into MongoDB.

Usage:
  python backend/migrate_json_to_mongo.py --uri mongodb://127.0.0.1:27017 \
      --database print_calculator --data-dir ./data --dry-run

The command never runs during application startup and refuses to overwrite
non-empty collections unless --replace is supplied.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from repository import MongoRepository, RepositoryError  # noqa: E402

COLLECTIONS = (
    "settings",
    "main_categories",
    "categories",
    "material_categories",
    "items",
    "products",
    "users",
    "orders",
)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("database JSON must contain an object")
    missing = [key for key in COLLECTIONS if key not in value]
    if missing:
        raise ValueError(f"database JSON is missing keys: {', '.join(missing)}")
    for key in COLLECTIONS[1:]:
        if not isinstance(value[key], list):
            raise ValueError(f"database field {key!r} must be an array")
    if not isinstance(value["settings"], dict):
        raise ValueError("database field 'settings' must be an object")
    return value


def validate_unique_ids(snapshot: dict) -> None:
    for collection in COLLECTIONS[1:]:
        ids = [item.get("id") for item in snapshot[collection] if isinstance(item, dict)]
        if any(value is None for value in ids):
            raise ValueError(f"collection {collection!r} contains a record without id")
        if len(ids) != len(set(map(str, ids))):
            raise ValueError(f"collection {collection!r} contains duplicate ids")
    emails = [str(item.get("email", "")).strip().lower() for item in snapshot["users"]]
    emails = [email for email in emails if email]
    if len(emails) != len(set(emails)):
        raise ValueError("users contains duplicate normalized emails")


def validate_references(snapshot: dict) -> None:
    main_cat_ids = {
        str(mc.get("id"))
        for mc in snapshot.get("main_categories", [])
        if isinstance(mc, dict) and mc.get("id") is not None
    }
    cat_ids = {
        str(cat.get("id"))
        for cat in snapshot.get("categories", [])
        if isinstance(cat, dict) and cat.get("id") is not None
    }
    item_ids = {
        int(it["id"])
        for it in snapshot.get("items", [])
        if isinstance(it, dict) and it.get("id") is not None
    }
    user_ids = {
        int(u["id"])
        for u in snapshot.get("users", [])
        if isinstance(u, dict) and u.get("id") is not None
    }

    for cat in snapshot.get("categories", []):
        if not isinstance(cat, dict):
            continue
        parent_id = str(cat.get("parent_id") or "").strip()
        if parent_id and parent_id not in main_cat_ids:
            raise ValueError(
                f"category {cat.get('id')!r} references missing main_category {parent_id!r}"
            )

    item_ref_fields = (
        "allowed_paper_ids",
        "allowed_cover_paper_ids",
        "allowed_lamination_ids",
        "enabled_equipment_ids",
        "excluded_equipment_ids",
    )
    for prod in snapshot.get("products", []):
        if not isinstance(prod, dict):
            continue
        prod_id = prod.get("id")
        cat_id = str(prod.get("category") or "").strip()
        if not cat_id or cat_id not in cat_ids:
            raise ValueError(f"product {prod_id!r} references missing category {cat_id!r}")
        for ref_field in item_ref_fields:
            for ref_id in prod.get(ref_field) or []:
                if int(ref_id) not in item_ids:
                    raise ValueError(
                        f"product {prod_id!r} field {ref_field!r} references missing item {ref_id!r}"
                    )

    for order in snapshot.get("orders", []):
        if not isinstance(order, dict):
            continue
        order_uid = order.get("user_id")
        if order_uid is not None and int(order_uid) not in user_ids:
            raise ValueError(
                f"order {order.get('id')!r} references missing user_id {order_uid!r}"
            )


def main() -> int:
    from datetime import datetime, timezone

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=os.environ.get("PRINT_CALC_DATA_DIR", str(ROOT / "data")))
    parser.add_argument("--uri", default=os.environ.get("MONGODB_URI"))
    parser.add_argument("--database", default=os.environ.get("MONGODB_DATABASE", "print_calculator"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace", action="store_true", help="allow replacing existing Mongo collections")
    parser.add_argument("--backup-file", default="", help="optional path for pre-replace Mongo backup JSON")
    args = parser.parse_args()

    source = Path(args.data_dir) / "database.json"
    snapshot = load_json(source)
    validate_unique_ids(snapshot)
    validate_references(snapshot)
    counts = {key: (1 if key == "settings" else len(snapshot[key])) for key in COLLECTIONS}
    print(json.dumps({"source": str(source), "counts": counts}, ensure_ascii=False, indent=2))
    if args.dry_run:
        return 0

    if not args.uri:
        raise ValueError("--uri or MONGODB_URI is required for a live migration")
    repo = MongoRepository(uri=args.uri, database=args.database)
    repo.ping()
    existing = {key: repo._db[key].count_documents({}) for key in COLLECTIONS}
    if any(existing.values()):
        if not args.replace:
            raise ValueError(f"Mongo database is not empty: {existing}; use --replace only after backup")
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = (
            Path(args.backup_file)
            if args.backup_file
            else Path(args.data_dir) / f"mongo_backup_{args.database}_{ts}.json"
        )
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        existing_snapshot = repo.load_snapshot()
        with backup_path.open("w", encoding="utf-8") as handle:
            json.dump(existing_snapshot, handle, ensure_ascii=False, indent=2)
    repo.replace_snapshot(snapshot)
    print(json.dumps({"migrated": counts, "database": args.database}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RepositoryError, ValueError, OSError) as exc:
        print(f"migration failed: {exc}", file=sys.stderr)
        raise SystemExit(2)
