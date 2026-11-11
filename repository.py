"""Persistence adapters for the calculator application.

The Flask handlers still consume a snapshot-shaped dictionary while the Mongo
adapter stores each top-level section in its own collection. This keeps the
API migration-compatible and gives us a safe seam for incremental route
migration.
"""
from __future__ import annotations

import copy
import os
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Mapping

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

CATALOG_COLLECTIONS = (
    "settings",
    "main_categories",
    "categories",
    "material_categories",
    "items",
    "products",
)


def _clone(value: Any) -> Any:
    return copy.deepcopy(value)


class RepositoryError(RuntimeError):
    """Raised when the configured persistence backend cannot be used."""


class JsonRepository:
    """Snapshot-backed repository implementing the same domain interface as MongoRepository."""

    name = "json"

    def __init__(
        self,
        load_fn=None,
        save_fn=None,
        replace_fn=None,
    ):
        self._load_fn = load_fn
        self._save_fn = save_fn
        self._replace_fn = replace_fn

    def _resolve_callbacks(self):
        if self._load_fn is None or self._save_fn is None or self._replace_fn is None:
            import storage

            if self._load_fn is None:
                self._load_fn = storage.load_data
            if self._save_fn is None:
                self._save_fn = storage.save_data
            if self._replace_fn is None:
                self._replace_fn = storage.replace_full_data
        return self._load_fn, self._save_fn, self._replace_fn

    def _load_mutable(self) -> Dict[str, Any]:
        load_fn, _, _ = self._resolve_callbacks()
        return load_fn()

    def _save_mutable(self, data: Dict[str, Any]) -> None:
        _, save_fn, _ = self._resolve_callbacks()
        save_fn(data)

    def load_snapshot(self) -> Dict[str, Any]:
        return _clone(self._load_mutable())

    def save_catalog_snapshot(self, snapshot: Mapping[str, Any]) -> None:
        data = self._load_mutable()
        for collection in CATALOG_COLLECTIONS:
            if collection in snapshot:
                data[collection] = _clone(snapshot[collection])
        self._save_mutable(data)

    def replace_snapshot(self, snapshot: Mapping[str, Any]) -> None:
        _, _, replace_fn = self._resolve_callbacks()
        replace_fn(_clone(dict(snapshot)))

    def get_user_by_id(self, user_id: int) -> dict | None:
        uid = int(user_id)
        data = self._load_mutable()
        for user in data.get("users") or []:
            if isinstance(user, dict) and int(user.get("id") or 0) == uid:
                return _clone(user)
        return None

    def get_user_by_email(self, email: str) -> dict | None:
        normalized = str(email or "").strip().lower()
        if not normalized:
            return None
        data = self._load_mutable()
        for user in data.get("users") or []:
            if isinstance(user, dict) and str(user.get("email") or "").strip().lower() == normalized:
                return _clone(user)
        return None

    def list_users(self) -> list[dict]:
        data = self._load_mutable()
        users = [u for u in (data.get("users") or []) if isinstance(u, dict)]
        users.sort(key=lambda u: int(u.get("id") or 0))
        return [_clone(u) for u in users]

    def create_user(self, user: Mapping[str, Any]) -> dict:
        data = self._load_mutable()
        users = data.setdefault("users", [])
        document = _clone(dict(user))
        normalized_email = str(document.get("email") or "").strip().lower()
        document["email"] = normalized_email
        if any(
            isinstance(u, dict) and str(u.get("email") or "").strip().lower() == normalized_email
            for u in users
        ):
            raise RepositoryError("duplicate user email")
        next_id = max((int(u.get("id") or 0) for u in users if isinstance(u, dict)), default=0) + 1
        document["id"] = int(document.get("id") or next_id)
        users.append(document)
        self._save_mutable(data)
        return _clone(document)

    def update_user(self, user_id: int, patch: Mapping[str, Any]) -> dict | None:
        uid = int(user_id)
        data = self._load_mutable()
        users = data.get("users") or []
        target = next(
            (u for u in users if isinstance(u, dict) and int(u.get("id") or 0) == uid),
            None,
        )
        if target is None:
            return None
        update = _clone(dict(patch))
        if "email" in update:
            norm_email = str(update["email"] or "").strip().lower()
            if any(
                isinstance(u, dict)
                and int(u.get("id") or 0) != uid
                and str(u.get("email") or "").strip().lower() == norm_email
                for u in users
            ):
                raise RepositoryError("duplicate user email")
            update["email"] = norm_email
        target.update(update)
        self._save_mutable(data)
        return _clone(target)

    def delete_user(self, user_id: int) -> bool:
        uid = int(user_id)
        data = self._load_mutable()
        users = data.get("users") or []
        remaining = [
            u for u in users if not (isinstance(u, dict) and int(u.get("id") or 0) == uid)
        ]
        if len(remaining) == len(users):
            return False
        data["users"] = remaining
        self._save_mutable(data)
        return True

    def count_users_by_role(self, role: str) -> int:
        role_str = str(role)
        data = self._load_mutable()
        return sum(
            1
            for u in (data.get("users") or [])
            if isinstance(u, dict) and str(u.get("role") or "") == role_str
        )

    def reassign_users_role(self, old_role: str, new_role: str = "client") -> int:
        old_str = str(old_role)
        new_str = str(new_role)
        data = self._load_mutable()
        modified = 0
        for u in data.get("users") or []:
            if isinstance(u, dict) and str(u.get("role") or "") == old_str:
                u["role"] = new_str
                u["token_version"] = int(u.get("token_version") or 0) + 1
                modified += 1
        if modified > 0:
            self._save_mutable(data)
        return modified

    def get_order(self, order_id: int) -> dict | None:
        oid = int(order_id)
        data = self._load_mutable()
        for order in data.get("orders") or []:
            if isinstance(order, dict) and int(order.get("id") or 0) == oid:
                return _clone(order)
        return None

    def list_orders(self) -> list[dict]:
        data = self._load_mutable()
        orders = [o for o in (data.get("orders") or []) if isinstance(o, dict)]
        orders.sort(key=lambda o: str(o.get("created_at") or ""), reverse=True)
        return [_clone(o) for o in orders]

    def list_orders_for_user(
        self, user_id: int, email: str | None = None, is_email_verified: bool = False
    ) -> list[dict]:
        uid = int(user_id)
        data = self._load_mutable()
        orders = [
            o
            for o in (data.get("orders") or [])
            if isinstance(o, dict) and o.get("user_id") is not None and int(o.get("user_id")) == uid
        ]
        orders.sort(key=lambda o: str(o.get("created_at") or ""), reverse=True)
        return [_clone(o) for o in orders]

    def list_crm_orders_for_user(self, user_id: int) -> list[dict]:
        uid = int(user_id)
        data = self._load_mutable()
        orders = [
            o
            for o in (data.get("orders") or [])
            if isinstance(o, dict)
            and (
                (o.get("user_id") is not None and int(o.get("user_id") or 0) == uid)
                or int(o.get("manager_id") or 0) == uid
                or (int(o.get("manager_id") or 0) == 0 and not bool(o.get("created_by_staff")))
            )
        ]
        orders.sort(key=lambda o: str(o.get("created_at") or ""), reverse=True)
        return [_clone(o) for o in orders]

    def create_order(self, order: Mapping[str, Any]) -> dict:
        data = self._load_mutable()
        orders = data.setdefault("orders", [])
        document = _clone(dict(order))
        next_order_id = (
            max(
                (
                    int(o.get("id", 1000))
                    for o in orders
                    if isinstance(o, dict) and int(o.get("id") or 0) >= 1001
                ),
                default=1000,
            )
            + 1
        )
        document["id"] = int(document.get("id") or next_order_id)
        orders.insert(0, document)
        self._save_mutable(data)
        return _clone(document)

    def update_order(self, order_id: int, patch: Mapping[str, Any]) -> dict | None:
        oid = int(order_id)
        data = self._load_mutable()
        target = next(
            (
                o
                for o in (data.get("orders") or [])
                if isinstance(o, dict) and int(o.get("id") or 0) == oid
            ),
            None,
        )
        if target is None:
            return None
        target.update(_clone(dict(patch)))
        self._save_mutable(data)
        return _clone(target)

    def delete_order(self, order_id: int) -> bool:
        oid = int(order_id)
        data = self._load_mutable()
        orders = data.get("orders") or []
        remaining = [
            o for o in orders if not (isinstance(o, dict) and int(o.get("id") or 0) == oid)
        ]
        if len(remaining) == len(orders):
            return False
        data["orders"] = remaining
        self._save_mutable(data)
        return True

    def claim_order(
        self,
        order_id: int,
        manager_id: int,
        manager_name: str,
        event: Mapping[str, Any] | None = None,
    ) -> dict | None:
        oid = int(order_id)
        mid = int(manager_id)
        data = self._load_mutable()
        target = next(
            (
                o
                for o in (data.get("orders") or [])
                if isinstance(o, dict) and int(o.get("id") or 0) == oid
            ),
            None,
        )
        if target is None:
            return None
        existing_mgr = int(target.get("manager_id") or 0)
        if existing_mgr > 0 and existing_mgr != mid:
            return None
        target["manager_id"] = mid
        target["manager_name"] = str(manager_name or "").strip()[:120]
        if event is not None:
            events = [dict(e) for e in (target.get("events") or []) if isinstance(e, dict)]
            events.insert(0, _clone(dict(event)))
            target["events"] = events[:30]
        self._save_mutable(data)
        return _clone(target)

    def _prune_shared_carts(self, data: Dict[str, Any], now_ts: float) -> bool:
        raw_carts = data.get("shared_carts")
        if not isinstance(raw_carts, list) or not raw_carts:
            return False
        kept = []
        changed = False
        for cart in raw_carts:
            if not isinstance(cart, dict):
                changed = True
                continue
            exp_ts = cart.get("expires_at_ts")
            expired = False
            if isinstance(exp_ts, (int, float)):
                expired = float(exp_ts) <= now_ts
            else:
                exp_raw = cart.get("expires_at")
                if isinstance(exp_raw, str) and exp_raw.strip():
                    try:
                        parsed = datetime.fromisoformat(exp_raw.strip().replace("Z", "+00:00"))
                        if parsed.tzinfo is None:
                            parsed = parsed.replace(tzinfo=timezone.utc)
                        expired = parsed.timestamp() <= now_ts
                    except ValueError:
                        expired = True
            if expired:
                changed = True
            else:
                kept.append(cart)
        if changed:
            data["shared_carts"] = kept
        return changed

    def save_shared_cart(
        self,
        cart_doc: Mapping[str, Any],
        ttl_seconds: int = 7 * 24 * 3600,
        max_carts: int = 500,
    ) -> dict:
        now = datetime.now(timezone.utc)
        now_ts = now.timestamp()
        expires_at_ts = now_ts + ttl_seconds
        expires_at_iso = datetime.fromtimestamp(expires_at_ts, timezone.utc).isoformat()
        token = str(cart_doc["token"]).strip()

        document = _clone(dict(cart_doc))
        document["token"] = token
        document.setdefault("created_at", now.isoformat())
        document["expires_at"] = expires_at_iso
        document["expires_at_ts"] = expires_at_ts

        data = self._load_mutable()
        self._prune_shared_carts(data, now_ts)
        shared_carts = data.setdefault("shared_carts", [])
        shared_carts[:] = [
            c for c in shared_carts if isinstance(c, dict) and c.get("token") != token
        ]
        shared_carts.insert(0, document)
        if max_carts > 0 and len(shared_carts) > max_carts:
            del shared_carts[max_carts:]
        self._save_mutable(data)

        result = _clone(document)
        result.pop("expires_at", None)
        result.pop("expires_at_ts", None)
        return result

    def get_shared_cart(self, token: str) -> dict | None:
        clean_token = str(token or "").strip()
        if not clean_token:
            return None
        now_ts = datetime.now(timezone.utc).timestamp()
        data = self._load_mutable()
        if self._prune_shared_carts(data, now_ts):
            self._save_mutable(data)
        found = next(
            (
                c
                for c in (data.get("shared_carts") or [])
                if isinstance(c, dict) and str(c.get("token") or "") == clean_token
            ),
            None,
        )
        if found is None:
            return None
        doc = _clone(found)
        doc.pop("expires_at", None)
        doc.pop("expires_at_ts", None)
        return doc


class MongoRepository:
    """MongoDB snapshot adapter with collection-level storage and indexes."""

    name = "mongo"

    def __init__(self, uri: str | None = None, database: str | None = None):
        try:
            from pymongo import MongoClient
            from pymongo.errors import PyMongoError
        except ImportError as exc:  # pragma: no cover - depends on environment
            raise RepositoryError(
                "MongoDB backend requires pymongo; install backend/requirements.txt"
            ) from exc

        self._pymongo_error = PyMongoError
        self._client = MongoClient(
            uri or os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017"),
            serverSelectionTimeoutMS=int(os.environ.get("MONGODB_TIMEOUT_MS", "3000")),
            connectTimeoutMS=int(os.environ.get("MONGODB_CONNECT_TIMEOUT_MS", "3000")),
        )
        self._db = self._client[database or os.environ.get("MONGODB_DATABASE", "print_calculator")]
        self._ensure_indexes()

    def ping(self) -> None:
        self._client.admin.command("ping")

    def _ensure_indexes(self) -> None:
        self._db.users.create_index("email", unique=True, name="users_email_unique")
        self._db.orders.create_index(
            [("user_id", 1), ("created_at", -1)], name="orders_user_created"
        )
        self._db.orders.create_index(
            [("status", 1), ("created_at", -1)], name="orders_status_created"
        )
        self._db.orders.create_index(
            [("idempotency_scope", 1), ("idempotency_key", 1)],
            unique=True,
            partialFilterExpression={"idempotency_key": {"$type": "string"}},
            name="orders_idempotency_unique",
        )
        self._db.rate_limits.create_index("expires_at", expireAfterSeconds=0, name="rate_limits_ttl")
        self._db.order_idempotency.create_index(
            [("scope", 1), ("key", 1)], unique=True, name="idempotency_scope_key_unique"
        )
        self._db.order_idempotency.create_index(
            "expires_at", expireAfterSeconds=0, name="idempotency_ttl"
        )
        self._db.shared_carts.create_index(
            "token", unique=True, name="shared_carts_token_unique"
        )
        self._db.shared_carts.create_index(
            "expires_at", expireAfterSeconds=0, name="shared_carts_ttl"
        )

    @staticmethod
    def _document_id(collection: str, value: Any) -> Any:
        if collection == "settings":
            return "singleton"
        if isinstance(value, dict) and "id" in value:
            return value["id"]
        return None

    def load_snapshot(self) -> Dict[str, Any]:
        snapshot: Dict[str, Any] = {}
        settings = self._db.settings.find_one({"_id": "singleton"})
        snapshot["settings"] = _clone((settings or {}).get("value", {}))
        for collection in COLLECTIONS:
            if collection == "settings":
                continue
            docs = list(self._db[collection].find({}, {"_id": 0}))
            snapshot[collection] = _clone(docs)
        return snapshot

    def save_catalog_snapshot(self, snapshot: Mapping[str, Any]) -> None:
        """Update only catalog and configuration collections without touching users or orders."""
        topology = self._client.topology_description.topology_type_name
        transaction_capable = topology in {"ReplicaSetWithPrimary", "Sharded", "LoadBalanced"}
        if not transaction_capable:
            self._save_catalog_snapshot_in_session(snapshot, None)
            return
        with self._client.start_session() as session:
            with session.start_transaction():
                self._save_catalog_snapshot_in_session(snapshot, session)

    def _save_catalog_snapshot_in_session(self, snapshot: Mapping[str, Any], session) -> None:
        kwargs = {"session": session} if session is not None else {}
        for collection in CATALOG_COLLECTIONS:
            coll = self._db[collection]
            coll.delete_many({}, **kwargs)
            if collection == "settings":
                coll.insert_one(
                    {"_id": "singleton", "value": _clone(snapshot.get("settings", {}))},
                    **kwargs,
                )
                continue
            docs = []
            for item in snapshot.get(collection, []) or []:
                if not isinstance(item, dict):
                    continue
                doc = _clone(item)
                doc.setdefault("_id", self._document_id(collection, doc))
                docs.append(doc)
            if docs:
                coll.insert_many(docs, ordered=True, **kwargs)
        for collection in ("items", "products"):
            values = [
                int(item.get("id") or 0)
                for item in snapshot.get(collection, [])
                if isinstance(item, dict)
            ]
            if values:
                self._db.counters.update_one(
                    {"_id": collection},
                    {"$max": {"value": max(values)}},
                    upsert=True,
                    **kwargs,
                )

    def replace_snapshot(self, snapshot: Mapping[str, Any]) -> None:
        """Replace all collections transactionally where the topology supports it."""
        topology = self._client.topology_description.topology_type_name
        transaction_capable = topology in {"ReplicaSetWithPrimary", "Sharded", "LoadBalanced"}
        if not transaction_capable:
            self._replace_snapshot_in_session(snapshot, None)
            return
        with self._client.start_session() as session:
            with session.start_transaction():
                self._replace_snapshot_in_session(snapshot, session)

    def _replace_snapshot_in_session(self, snapshot: Mapping[str, Any], session) -> None:
        for collection in COLLECTIONS:
            coll = self._db[collection]
            kwargs = {"session": session} if session is not None else {}
            coll.delete_many({}, **kwargs)
            if collection == "settings":
                coll.insert_one({"_id": "singleton", "value": _clone(snapshot.get("settings", {}))}, **kwargs)
                continue
            docs = []
            for item in snapshot.get(collection, []) or []:
                if not isinstance(item, dict):
                    continue
                doc = _clone(item)
                doc.setdefault("_id", self._document_id(collection, doc))
                docs.append(doc)
            if docs:
                coll.insert_many(docs, ordered=True, **kwargs)
        # Seed atomic numeric sequences after importing an existing snapshot.
        for collection in ("users", "items", "products"):
            values = [int(item.get("id") or 0) for item in snapshot.get(collection, []) if isinstance(item, dict)]
            if values:
                self._db.counters.update_one(
                    {"_id": collection}, {"$max": {"value": max(values)}}, upsert=True, **kwargs
                )
        order_values = [int(item.get("id") or 1000) - 1000 for item in snapshot.get("orders", []) if isinstance(item, dict)]
        if order_values:
            self._db.counters.update_one(
                {"_id": "orders"}, {"$max": {"value": max(order_values)}}, upsert=True, **kwargs
            )

    def get_user_by_id(self, user_id: int) -> dict | None:
        return self._db.users.find_one({"id": int(user_id)}, {"_id": 0})

    def get_user_by_email(self, email: str) -> dict | None:
        normalized = str(email or "").strip().lower()
        return self._db.users.find_one({"email": normalized}, {"_id": 0})

    def create_user(self, user: Mapping[str, Any]) -> dict:
        from pymongo import ReturnDocument

        document = _clone(dict(user))
        document["email"] = str(document.get("email") or "").strip().lower()
        sequence = self._db.counters.find_one_and_update(
            {"_id": "users"}, {"$inc": {"value": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        document["id"] = int(document.get("id") or sequence["value"])
        document["_id"] = document["id"]
        self._db.users.insert_one(document)
        document.pop("_id", None)
        return document

    def update_user(self, user_id: int, patch: Mapping[str, Any]) -> dict | None:
        from pymongo import ReturnDocument
        update = _clone(dict(patch))
        if "email" in update:
            update["email"] = str(update["email"] or "").strip().lower()
        return self._db.users.find_one_and_update(
            {"id": int(user_id)}, {"$set": update},
            projection={"_id": 0}, return_document=ReturnDocument.AFTER,
        )

    def create_order(self, order: Mapping[str, Any]) -> dict:
        from pymongo import ReturnDocument

        document = _clone(dict(order))
        sequence = self._db.counters.find_one_and_update(
            {"_id": "orders"}, {"$inc": {"value": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        document["id"] = int(document.get("id") or max(1001, int(sequence["value"]) + 1000))
        document["_id"] = document["id"]
        self._db.orders.insert_one(document)
        document.pop("_id", None)
        return document

    def update_order(self, order_id: int, patch: Mapping[str, Any]) -> dict | None:
        from pymongo import ReturnDocument
        return self._db.orders.find_one_and_update(
            {"id": int(order_id)}, {"$set": _clone(dict(patch))},
            projection={"_id": 0}, return_document=ReturnDocument.AFTER,
        )

    def delete_order(self, order_id: int) -> bool:
        return self._db.orders.delete_one({"id": int(order_id)}).deleted_count == 1

    def list_orders(self) -> list[dict]:
        return list(self._db.orders.find({}, {"_id": 0}).sort("created_at", -1))

    def list_users(self) -> list[dict]:
        return list(self._db.users.find({}, {"_id": 0}).sort("id", 1))

    def delete_user(self, user_id: int) -> bool:
        return self._db.users.delete_one({"id": int(user_id)}).deleted_count == 1

    def count_users_by_role(self, role: str) -> int:
        return self._db.users.count_documents({"role": role})

    def reassign_users_role(self, old_role: str, new_role: str = "client") -> int:
        res = self._db.users.update_many(
            {"role": str(old_role)},
            {"$set": {"role": str(new_role)}, "$inc": {"token_version": 1}},
        )
        return int(res.modified_count)

    def get_order(self, order_id: int) -> dict | None:
        return self._db.orders.find_one({"id": int(order_id)}, {"_id": 0})

    def list_orders_for_user(
        self, user_id: int, email: str | None = None, is_email_verified: bool = False
    ) -> list[dict]:
        return list(
            self._db.orders.find({"user_id": int(user_id)}, {"_id": 0}).sort("created_at", -1)
        )

    def list_crm_orders_for_user(self, user_id: int) -> list[dict]:
        uid = int(user_id)
        return list(
            self._db.orders.find(
                {
                    "$or": [
                        {"user_id": uid},
                        {"manager_id": uid},
                        {"manager_id": {"$in": [None, 0]}, "created_by_staff": {"$ne": True}},
                    ]
                },
                {"_id": 0},
            ).sort("created_at", -1)
        )

    def claim_order(
        self,
        order_id: int,
        manager_id: int,
        manager_name: str,
        event: Mapping[str, Any] | None = None,
    ) -> dict | None:
        from pymongo import ReturnDocument

        update_op: dict[str, Any] = {
            "$set": {
                "manager_id": int(manager_id),
                "manager_name": str(manager_name or "").strip()[:120],
            }
        }
        if event is not None:
            update_op["$push"] = {
                "events": {"$each": [_clone(dict(event))], "$position": 0, "$slice": 30}
            }
        return self._db.orders.find_one_and_update(
            {
                "id": int(order_id),
                "$or": [
                    {"manager_id": {"$in": [None, 0]}},
                    {"manager_id": {"$exists": False}},
                    {"manager_id": int(manager_id)},
                ],
            },
            update_op,
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

    def save_shared_cart(
        self,
        cart_doc: Mapping[str, Any],
        ttl_seconds: int = 7 * 24 * 3600,
        max_carts: int = 500,
    ) -> dict:
        _ = max_carts
        now = datetime.now(timezone.utc)
        expires_at = datetime.fromtimestamp(now.timestamp() + ttl_seconds, timezone.utc)
        token = str(cart_doc["token"]).strip()
        document = _clone(dict(cart_doc))
        document["token"] = token
        document.setdefault("created_at", now.isoformat())
        document["expires_at"] = expires_at
        self._db.shared_carts.replace_one({"token": token}, document, upsert=True)
        result = dict(document)
        result.pop("_id", None)
        result.pop("expires_at", None)
        result.pop("expires_at_ts", None)
        return result

    def get_shared_cart(self, token: str) -> dict | None:
        clean_token = str(token or "").strip()
        if not clean_token:
            return None
        doc = self._db.shared_carts.find_one({"token": clean_token}, {"_id": 0})
        if not doc:
            return None
        now = datetime.now(timezone.utc)
        exp = doc.get("expires_at")
        is_expired = False
        if isinstance(exp, datetime):
            exp_utc = exp if exp.tzinfo is not None else exp.replace(tzinfo=timezone.utc)
            if exp_utc <= now:
                is_expired = True
        elif isinstance(exp, (int, float)):
            if float(exp) <= now.timestamp():
                is_expired = True
        elif isinstance(exp, str) and exp.strip():
            try:
                parsed_exp = datetime.fromisoformat(exp.strip().replace("Z", "+00:00"))
                if parsed_exp.tzinfo is None:
                    parsed_exp = parsed_exp.replace(tzinfo=timezone.utc)
                if parsed_exp <= now:
                    is_expired = True
            except ValueError:
                is_expired = True
        if is_expired:
            self._db.shared_carts.delete_one({"token": str(token).strip()})
            return None
        doc.pop("expires_at", None)
        doc.pop("expires_at_ts", None)
        return doc

    def record_failure(self, key: str, max_attempts: int, window_seconds: int) -> bool:
        """Atomically increment a failure counter; return whether still allowed."""
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        doc = self._db.rate_limits.find_one_and_update(
            {"_id": key, "expires_at": {"$gt": now}},
            {"$inc": {"count": 1}},
            return_document=True,
        )
        if doc is None:
            self._db.rate_limits.replace_one(
                {"_id": key},
                {"_id": key, "count": 1, "expires_at": now + timedelta(seconds=window_seconds)},
                upsert=True,
            )
            doc = self._db.rate_limits.find_one({"_id": key})
        return int((doc or {}).get("count", 0)) < max_attempts

    def clear_failures(self, key: str) -> None:
        self._db.rate_limits.delete_one({"_id": key})

    def check_allowed(self, key: str, max_attempts: int = 5) -> bool:
        now = datetime.now(timezone.utc)
        doc = self._db.rate_limits.find_one({"_id": key, "expires_at": {"$gt": now}})
        return doc is None or int(doc.get("count", 0)) < max_attempts

    def allow_order_request(
        self, key: str, max_requests: int = 10, window_seconds: int = 60
    ) -> bool:
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        doc = self._db.rate_limits.find_one_and_update(
            {"_id": key, "expires_at": {"$gt": now}},
            {"$inc": {"count": 1}},
            return_document=True,
        )
        if doc is None:
            self._db.rate_limits.replace_one(
                {"_id": key},
                {
                    "_id": key,
                    "count": 1,
                    "expires_at": now + timedelta(seconds=window_seconds),
                },
                upsert=True,
            )
            return True
        return int(doc.get("count", 0)) <= max_requests

    def reserve_idempotency(
        self,
        scope: str,
        key: str,
        request_hash: str,
        ttl_seconds: int = 3600,
        pending_ttl_seconds: int = 60,
    ) -> dict:
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        self._db.order_idempotency.delete_many(
            {"scope": scope, "key": key, "expires_at": {"$lte": now}}
        )
        try:
            self._db.order_idempotency.insert_one(
                {
                    "scope": scope,
                    "key": key,
                    "request_hash": str(request_hash or ""),
                    "state": "pending",
                    "created_at": now,
                    "expires_at": now + timedelta(seconds=pending_ttl_seconds),
                }
            )
            return {"state": "reserved", "request_hash": str(request_hash or "")}
        except self._pymongo_error as exc:
            if "duplicate" not in str(exc).lower() and getattr(exc, "code", None) != 11000:
                raise RepositoryError(f"Failed to reserve idempotency key: {exc}") from exc

        doc = self._db.order_idempotency.find_one({"scope": scope, "key": key}, {"_id": 0})
        if doc is None:
            order_doc = self._db.orders.find_one(
                {"idempotency_scope": scope, "idempotency_key": key}, {"_id": 0}
            )
            if order_doc is not None:
                stored_hash = str(order_doc.get("idempotency_request_hash") or "")
                if stored_hash and request_hash and stored_hash != request_hash:
                    return {"state": "conflict", "request_hash": stored_hash}
                return {
                    "state": "completed",
                    "request_hash": stored_hash,
                    "response": order_doc.get("idempotency_response", {}),
                    "status": int(order_doc.get("idempotency_status", 201)),
                    "order_id": order_doc.get("id"),
                }
            return {"state": "pending", "request_hash": str(request_hash or "")}

        stored_hash = str(doc.get("request_hash") or "")
        if stored_hash and request_hash and stored_hash != request_hash:
            return {"state": "conflict", "request_hash": stored_hash}
        if doc.get("state") == "completed" or "response" in doc:
            return {
                "state": "completed",
                "request_hash": stored_hash,
                "response": doc.get("response", {}),
                "status": int(doc.get("status", 201)),
                "order_id": doc.get("order_id"),
            }
        return {"state": "pending", "request_hash": stored_hash}

    def complete_idempotency(
        self,
        scope: str,
        key: str,
        request_hash: str,
        response: Mapping[str, Any],
        status: int = 201,
        order_id: int | None = None,
        ttl_seconds: int = 3600,
    ) -> None:
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        cloned_response = _clone(dict(response))
        self._db.order_idempotency.update_one(
            {"scope": scope, "key": key},
            {
                "$set": {
                    "request_hash": str(request_hash or ""),
                    "state": "completed",
                    "response": cloned_response,
                    "status": int(status),
                    "order_id": int(order_id) if order_id is not None else None,
                    "completed_at": now,
                    "expires_at": now + timedelta(seconds=ttl_seconds),
                },
                "$setOnInsert": {
                    "scope": scope,
                    "key": key,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        if order_id is not None:
            result = self._db.orders.update_one(
                {"id": int(order_id)},
                {
                    "$set": {
                        "idempotency_scope": scope,
                        "idempotency_key": key,
                        "idempotency_request_hash": str(request_hash or ""),
                        "idempotency_response": cloned_response,
                        "idempotency_status": int(status),
                    }
                },
            )
            if result.matched_count != 1:
                raise RepositoryError("Order disappeared before idempotency was recorded")

    def release_idempotency(
        self, scope: str, key: str, request_hash: str | None = None
    ) -> None:
        query: dict[str, Any] = {"scope": scope, "key": key, "state": "pending"}
        if request_hash is not None:
            query["request_hash"] = str(request_hash)
        self._db.order_idempotency.delete_one(query)

    def get_idempotency(self, scope: str, key: str) -> dict | None:
        now = datetime.now(timezone.utc)
        legacy = self._db.order_idempotency.find_one({"scope": scope, "key": key}, {"_id": 0})
        if legacy and legacy.get("expires_at") and legacy["expires_at"] > now:
            if legacy.get("state") in (None, "completed") and "response" in legacy:
                return legacy
        doc = self._db.orders.find_one(
            {"idempotency_scope": scope, "idempotency_key": key}, {"_id": 0}
        )
        if doc is not None:
            return {
                "response": doc.get("idempotency_response", {}),
                "status": doc.get("idempotency_status", 201),
                "request_hash": doc.get("idempotency_request_hash", ""),
            }
        return None

    def put_idempotency(
        self,
        scope: str,
        key: str,
        response: Mapping[str, Any],
        status: int,
        ttl_seconds: int = 3600,
        order_id: int | None = None,
        request_hash: str = "",
    ) -> None:
        self.complete_idempotency(
            scope=scope,
            key=key,
            request_hash=request_hash,
            response=response,
            status=status,
            order_id=order_id,
            ttl_seconds=ttl_seconds,
        )


def create_repository(backend: str | None = None):
    selected = (backend or os.environ.get("DATA_BACKEND", "json")).strip().lower()
    if selected == "json":
        return JsonRepository()
    if selected == "mongo":
        return MongoRepository()
    raise RepositoryError(f"Unsupported DATA_BACKEND: {selected}")
