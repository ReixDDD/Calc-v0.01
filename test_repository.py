import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from repository import COLLECTIONS, JsonRepository, MongoRepository, RepositoryError, create_repository
from migrate_json_to_mongo import load_json, validate_references, validate_unique_ids


class TestJsonRepositorySelection(unittest.TestCase):
    def _make_memory_repo(self, initial: dict | None = None):
        state = {
            "settings": {"tax_percent": 6.0},
            "main_categories": [{"id": "polygraphy", "name": "Полиграфия"}],
            "categories": [{"id": "cards", "parent_id": "polygraphy", "name": "Визитки"}],
            "material_categories": [],
            "items": [],
            "products": [],
            "users": [],
            "orders": [],
            **(initial or {}),
        }

        def _load():
            return state

        def _save(new_data):
            if new_data is not state:
                state.clear()
                state.update(new_data)

        def _replace(new_data):
            if new_data is not state:
                state.clear()
                state.update(new_data)

        return JsonRepository(load_fn=_load, save_fn=_save, replace_fn=_replace), state

    def test_json_is_default_and_mongo_selection_requires_driver(self):
        repo = create_repository("json")
        self.assertEqual(repo.name, "json")
        self.assertEqual(COLLECTIONS[0], "settings")
        self.assertEqual(COLLECTIONS[-1], "orders")

    def test_unknown_backend_is_rejected(self):
        with self.assertRaises(RepositoryError):
            create_repository("unknown")

    def test_both_adapters_expose_unified_domain_methods(self):
        domain_methods = (
            "load_snapshot",
            "save_catalog_snapshot",
            "replace_snapshot",
            "get_user_by_id",
            "get_user_by_email",
            "list_users",
            "create_user",
            "update_user",
            "delete_user",
            "count_users_by_role",
            "reassign_users_role",
            "get_order",
            "list_orders",
            "list_orders_for_user",
            "list_crm_orders_for_user",
            "create_order",
            "update_order",
            "delete_order",
            "claim_order",
            "save_shared_cart",
            "get_shared_cart",
        )
        for method_name in domain_methods:
            self.assertTrue(hasattr(MongoRepository, method_name), method_name)
            self.assertTrue(hasattr(JsonRepository, method_name), method_name)

    def test_json_repository_user_lifecycle_and_role_reassignment(self):
        repo, _ = self._make_memory_repo()
        created = repo.create_user({"email": "Alice@Example.com", "role": "custom_mgr", "name": "Alice"})
        self.assertEqual(created["id"], 1)
        self.assertEqual(created["email"], "alice@example.com")

        with self.assertRaises(RepositoryError):
            repo.create_user({"email": "alice@example.com", "role": "client"})

        self.assertEqual(repo.get_user_by_email("ALICE@example.com")["id"], 1)
        self.assertEqual(repo.count_users_by_role("custom_mgr"), 1)

        updated = repo.update_user(1, {"name": "Alice Updated"})
        self.assertEqual(updated["name"], "Alice Updated")

        reassigned = repo.reassign_users_role("custom_mgr", "client")
        self.assertEqual(reassigned, 1)
        after_reassign = repo.get_user_by_id(1)
        self.assertEqual(after_reassign["role"], "client")
        self.assertEqual(after_reassign["token_version"], 1)

        self.assertTrue(repo.delete_user(1))
        self.assertFalse(repo.delete_user(1))
        self.assertEqual(repo.list_users(), [])

    def test_json_repository_order_claim_and_shared_carts(self):
        repo, _ = self._make_memory_repo()
        order = repo.create_order(
            {
                "user_id": 7,
                "created_at": "2026-05-01T10:00:00+00:00",
                "status": "new",
                "client_name": "Клиент",
            }
        )
        self.assertEqual(order["id"], 1001)
        self.assertEqual(len(repo.list_orders_for_user(7)), 1)
        self.assertEqual(len(repo.list_crm_orders_for_user(99)), 1)

        claimed = repo.claim_order(
            1001,
            manager_id=42,
            manager_name="Менеджер",
            event={"id": "evt_1", "type": "manager_assigned"},
        )
        self.assertIsNotNone(claimed)
        self.assertEqual(claimed["manager_id"], 42)
        self.assertIsNone(repo.claim_order(1001, manager_id=99, manager_name="Другой"))

        saved_cart = repo.save_shared_cart(
            {"token": "abc1234567890def", "items": [{"productName": "Визитки"}], "meta": {}},
            ttl_seconds=60,
        )
        self.assertEqual(saved_cart["token"], "abc1234567890def")
        self.assertIsNotNone(repo.get_shared_cart("abc1234567890def"))

        repo.save_shared_cart(
            {"token": "expired000000000", "items": [], "meta": {}},
            ttl_seconds=-5,
        )
        self.assertIsNone(repo.get_shared_cart("expired000000000"))

        self.assertTrue(repo.delete_order(1001))
        self.assertIsNone(repo.get_order(1001))


class TestMigrationValidation(unittest.TestCase):
    def test_current_database_has_expected_shape_and_unique_ids(self):
        data_dir = Path(os.environ.get("PRINT_CALC_DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
        snapshot = load_json(data_dir / "database.json")
        validate_unique_ids(snapshot)
        validate_references(snapshot)
        self.assertEqual(set(COLLECTIONS), set(snapshot) - {"shared_carts", "crm_notifications"})

    def test_duplicate_ids_are_rejected(self):
        snapshot = {
            "settings": {},
            "main_categories": [{"id": "same"}, {"id": "same"}],
            "categories": [],
            "material_categories": [],
            "items": [],
            "products": [],
            "users": [],
            "orders": [],
        }
        with self.assertRaisesRegex(ValueError, "duplicate ids"):
            validate_unique_ids(snapshot)

    def test_duplicate_normalized_emails_are_rejected(self):
        snapshot = {
            "settings": {},
            "main_categories": [],
            "categories": [],
            "material_categories": [],
            "items": [],
            "products": [],
            "users": [{"id": 1, "email": "A@example.com"}, {"id": 2, "email": "a@example.com"}],
            "orders": [],
        }
        with self.assertRaisesRegex(ValueError, "duplicate normalized emails"):
            validate_unique_ids(snapshot)

    def test_broken_references_are_rejected(self):
        bad_product_cat = {
            "settings": {},
            "main_categories": [{"id": "polygraphy"}],
            "categories": [{"id": "cards", "parent_id": "polygraphy"}],
            "material_categories": [],
            "items": [{"id": 21}],
            "products": [{"id": 301, "category": "missing_cat", "allowed_paper_ids": [21]}],
            "users": [],
            "orders": [],
        }
        with self.assertRaisesRegex(ValueError, "references missing category"):
            validate_references(bad_product_cat)

        bad_order_user = {
            "settings": {},
            "main_categories": [{"id": "polygraphy"}],
            "categories": [{"id": "cards", "parent_id": "polygraphy"}],
            "material_categories": [],
            "items": [{"id": 21}],
            "products": [{"id": 301, "category": "cards", "allowed_paper_ids": [21]}],
            "users": [{"id": 1, "email": "u@example.com"}],
            "orders": [{"id": 1001, "user_id": 999}],
        }
        with self.assertRaisesRegex(ValueError, "references missing user_id"):
            validate_references(bad_order_user)


if __name__ == "__main__":
    unittest.main()

