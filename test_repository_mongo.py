import os
import uuid
import unittest
from pathlib import Path

sys_path = str(Path(__file__).resolve().parent)
import sys
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

from repository import MongoRepository


@unittest.skipUnless(os.environ.get("MONGODB_TEST_URI"), "MONGODB_TEST_URI is not configured")
class TestMongoRepositorySmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database = f"print_calculator_test_{uuid.uuid4().hex}"
        cls.repository = MongoRepository(
            uri=os.environ["MONGODB_TEST_URI"], database=cls.database
        )
        cls.repository.ping()

    @classmethod
    def tearDownClass(cls):
        cls.repository._client.drop_database(cls.database)
        cls.repository._client.close()

    def test_user_order_idempotency_and_rate_limit_operations(self):
        user = self.repository.create_user({
            "email": f"{uuid.uuid4().hex}@example.test",
            "role": "client",
            "token_version": 0,
        })
        self.assertEqual(self.repository.get_user_by_id(user["id"])["email"], user["email"])

        order = self.repository.create_order({
            "user_id": user["id"],
            "client_email": user["email"],
            "created_at": "2026-11-03T00:00:00+00:00",
            "status": "new",
            "items": [],
        })
        self.assertEqual(self.repository.get_order(order["id"])["id"], order["id"])
        idem_key = uuid.uuid4().hex
        res1 = self.repository.reserve_idempotency("test-scope", idem_key, "hash-1")
        self.assertEqual(res1["state"], "reserved")
        res_pending = self.repository.reserve_idempotency("test-scope", idem_key, "hash-1")
        self.assertEqual(res_pending["state"], "pending")
        res_conflict = self.repository.reserve_idempotency("test-scope", idem_key, "hash-2")
        self.assertEqual(res_conflict["state"], "conflict")
        self.repository.complete_idempotency("test-scope", idem_key, "hash-1", {"ok": True}, 201, order_id=order["id"])
        res_done = self.repository.reserve_idempotency("test-scope", idem_key, "hash-1")
        self.assertEqual(res_done["state"], "completed")
        self.assertEqual(res_done["response"], {"ok": True})

        rel_key = uuid.uuid4().hex
        self.assertEqual(self.repository.reserve_idempotency("test-scope", rel_key, "hash-r")["state"], "reserved")
        self.repository.release_idempotency("test-scope", rel_key, "hash-r")
        self.assertEqual(self.repository.reserve_idempotency("test-scope", rel_key, "hash-r")["state"], "reserved")

        self.assertTrue(self.repository.record_failure("test-rate", 2, 60))
        self.assertFalse(self.repository.record_failure("test-rate", 2, 60))
        self.assertFalse(self.repository.check_allowed("test-rate", max_attempts=2))

        cart_token = uuid.uuid4().hex[:16]
        self.repository.save_shared_cart(
            {
                "token": cart_token,
                "items": [{"productId": 301, "quantity": 100}],
                "meta": {"customerName": "Mongo Cart", "comment": "", "discountPercent": 0},
            }
        )
        loaded_cart = self.repository.get_shared_cart(cart_token)
        self.assertIsNotNone(loaded_cart)
        self.assertEqual(loaded_cart["token"], cart_token)

        expired_token = uuid.uuid4().hex[:16]
        self.repository.save_shared_cart(
            {
                "token": expired_token,
                "items": [{"productId": 301, "quantity": 50}],
                "meta": {"customerName": "Expired Cart", "comment": "", "discountPercent": 0},
            },
            ttl_seconds=-10,
        )
        self.assertIsNone(self.repository.get_shared_cart(expired_token))
        self.assertIsNone(
            self.repository._db.shared_carts.find_one({"token": expired_token})
        )


if __name__ == "__main__":
    unittest.main()
