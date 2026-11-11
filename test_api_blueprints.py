"""Contract tests for modular Flask Blueprints, security headers, RBAC, and error handling."""
from __future__ import annotations

import copy
import os
import sys
import unittest
from unittest.mock import patch

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-with-at-least-32-characters-long")

from app import app, generate_auth_token, load_data  # noqa: E402
from storage import RepositoryError, _DATA_LOCK  # noqa: E402


class TestApiBlueprints(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def _get_admin_user(self) -> dict:
        with _DATA_LOCK:
            data = load_data()
            users = data.get("users") or []
            admin_user = next(
                (u for u in users if isinstance(u, dict) and u.get("role") == "admin"),
                None,
            )
            if admin_user:
                return dict(admin_user)
        return {
            "id": 1,
            "email": "admin@print-calc.local",
            "name": "Администратор",
            "role": "admin",
        }

    def test_public_catalog_contract_and_security_headers(self):
        res = self.client.get("/api/catalog")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-Frame-Options"), "SAMEORIGIN")
        self.assertEqual(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")

        payload = res.get_json()
        self.assertIsInstance(payload, dict)
        for expected_key in (
            "main_categories",
            "categories",
            "products",
            "papers",
            "laminations",
            "limits",
        ):
            self.assertIn(expected_key, payload)
        self.assertGreater(len(payload["products"]), 0)

    def test_public_vs_admin_calculate_visibility(self):
        cat_res = self.client.get("/api/catalog")
        products = cat_res.get_json()["products"]
        sample_prod = products[0]
        paper_id = (sample_prod.get("allowed_paper_ids") or [1])[0]
        calc_payload = {
            "product_id": sample_prod["id"],
            "paper_id": paper_id,
            "quantity": 100,
            "print_sides": 1,
            "lamination_sides": 0,
        }

        anon_res = self.client.post("/api/calculate", json=calc_payload)
        self.assertEqual(anon_res.status_code, 200)
        anon_json = anon_res.get_json()
        self.assertIn("client_price", anon_json)
        self.assertIn("unit_price", anon_json)
        self.assertNotIn("internal", anon_json)

        admin_user = self._get_admin_user()
        token = generate_auth_token(admin_user)
        with patch("routes.catalog.get_current_user", return_value=admin_user), patch(
            "routes.catalog.get_request_crm_role", return_value=("admin", admin_user)
        ):
            admin_res = self.client.post(
                "/api/calculate",
                json=calc_payload,
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(admin_res.status_code, 200)
        admin_json = admin_res.get_json()
        self.assertIn("client_price", admin_json)
        self.assertIn("internal", admin_json)
        self.assertIn("total_cost", admin_json["internal"])
        self.assertIn("profit", admin_json["internal"])

    def test_protected_routes_reject_invalid_bearer_with_401_and_no_store(self):
        for endpoint in ("/api/admin/data", "/api/crm/orders", "/api/crm/notifications"):
            res = self.client.get(
                endpoint,
                headers={"Authorization": "Bearer invalid.tampered.token"},
            )
            self.assertEqual(res.status_code, 401, f"Expected 401 for {endpoint}")
            self.assertIn("no-store", res.headers.get("Cache-Control", ""))
            body = res.get_json()
            self.assertIsInstance(body, dict)
            self.assertIn("error", body)

    def test_admin_data_rbac_and_secret_sanitization(self):
        unauth_res = self.client.get("/api/admin/data")
        self.assertEqual(unauth_res.status_code, 403)

        admin_user = self._get_admin_user()
        token = generate_auth_token(admin_user)
        with patch("app.get_current_user", return_value=admin_user), patch(
            "routes.admin_catalog.is_admin_request", return_value=True
        ), patch("routes.admin_catalog.can_manage_users_request", return_value=True), patch(
            "routes.admin_catalog.get_current_user", return_value=admin_user
        ):
            ok_res = self.client.get(
                "/api/admin/data",
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(ok_res.status_code, 200)
        payload = ok_res.get_json()
        self.assertEqual(payload.get("security", {}).get("password_kdf"), "argon2id")
        for user_item in payload.get("users", []):
            self.assertNotIn("password_hash", user_item)
        settings = payload.get("settings", {})
        self.assertNotIn("admin_pin", settings)
        self.assertNotIn("manager_pin", settings)

    def test_repository_error_returns_503_json(self):
        with patch(
            "routes.catalog.load_data",
            side_effect=RepositoryError("Simulated storage outage"),
        ):
            res = self.client.get("/api/catalog")
        self.assertEqual(res.status_code, 503)
        payload = res.get_json()
        self.assertEqual(
            payload,
            {"error": "Хранилище данных временно недоступно"},
        )

    def test_wide_format_roll_cost_per_sqm_sets_roll_price_only_for_wf_materials(self):
        import copy

        with _DATA_LOCK:
            fake_db = copy.deepcopy(load_data())

        admin_user = self._get_admin_user()
        token = generate_auth_token(admin_user)

        with patch("routes.admin_catalog.load_data", side_effect=lambda: fake_db), patch(
            "routes.admin_catalog.save_data", side_effect=lambda d: None
        ), patch("routes.admin_catalog.can_manage_catalog_request", return_value=True):
            # 1. Creating a wide-format roll material with cost_per_sqm calculates roll price
            add_wf_res = self.client.post(
                "/api/admin/items",
                json={
                    "category": "wf_banners",
                    "name": "Тестовый баннер 510г",
                    "roll_width_m": 1.27,
                    "roll_length_m": 50,
                    "cost_per_sqm": 120,
                    "price": 0,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(add_wf_res.status_code, 201)
            wf_item = add_wf_res.get_json()
            self.assertEqual(wf_item["roll_width_m"], 1.27)
            self.assertEqual(wf_item["roll_length_m"], 50.0)
            self.assertEqual(wf_item["resource"], 63.5)
            self.assertEqual(wf_item["cost_per_sqm"], 120.0)
            self.assertEqual(wf_item["price"], 7620.0)

            # 2. Bulk update of roll_width_m, roll_length_m, and cost_per_sqm recalculates area & roll price
            bulk_res = self.client.put(
                "/api/admin/items/bulk",
                json={
                    "items": [
                        {
                            "id": wf_item["id"],
                            "name": wf_item["name"],
                            "roll_width_m": 3.2,
                            "roll_length_m": 50,
                            "cost_per_sqm": 100,
                            "price": 7620.0,
                        }
                    ]
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(bulk_res.status_code, 200)
            saved_wf = next(i for i in fake_db["items"] if i["id"] == wf_item["id"])
            self.assertEqual(saved_wf["roll_width_m"], 3.2)
            self.assertEqual(saved_wf["roll_length_m"], 50.0)
            self.assertEqual(saved_wf["resource"], 160.0)
            self.assertEqual(saved_wf["cost_per_sqm"], 100.0)
            self.assertEqual(saved_wf["price"], 16000.0)

            # 3. Non-wide-format categories (papers, wf_inks) ignore roll_width_m, roll_length_m, cost_per_sqm
            add_paper_res = self.client.post(
                "/api/admin/items",
                json={
                    "category": "papers",
                    "name": "Тестовая бумага",
                    "price": 2000,
                    "resource": 250,
                    "roll_width_m": 1.6,
                    "roll_length_m": 50,
                    "cost_per_sqm": 999,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(add_paper_res.status_code, 201)
            paper_item = add_paper_res.get_json()
            self.assertEqual(paper_item["price"], 2000.0)
            self.assertEqual(paper_item["resource"], 250.0)
            self.assertNotIn("cost_per_sqm", paper_item)
            self.assertNotIn("roll_width_m", paper_item)
            self.assertNotIn("roll_length_m", paper_item)

    def test_wide_format_pricing_uses_roll_width_m_from_material(self):
        from pricing import calculate_order_pricing
        from storage import _build_public_catalog_payload, get_calc_index

        fake_db = copy.deepcopy(load_data())
        # Ensure global roll_width_mm and eyelet_step_mm are absent from wide_format params
        wf_params = fake_db["settings"]["main_category_params"]["wide_format"]
        self.assertNotIn("roll_width_mm", wf_params)
        self.assertNotIn("eyelet_step_mm", wf_params)

        pub_catalog = _build_public_catalog_payload(fake_db)
        wf_pub_papers = [p for p in pub_catalog["papers"] if p["category"] == "wf_banners"]
        self.assertGreaterEqual(len(wf_pub_papers), 2)
        self.assertEqual(wf_pub_papers[0]["roll_width_m"], 3.2)
        self.assertEqual(wf_pub_papers[0]["roll_length_m"], 50.0)
        self.assertEqual(wf_pub_papers[1]["roll_width_m"], 1.6)
        self.assertEqual(wf_pub_papers[1]["roll_length_m"], 50.0)

        calc_idx = get_calc_index(fake_db)
        roll_32 = next(i for i in fake_db["items"] if i.get("roll_width_m") == 3.2)
        roll_16 = next(i for i in fake_db["items"] if i.get("roll_width_m") == 1.6)
        wf_prod = next(
            p for p in fake_db["products"] if p["id"] == 2001
        )
        wf_prod["allowed_paper_ids"] = [roll_32["id"], roll_16["id"]]

        res_32, err_32 = calculate_order_pricing(
            fake_db,
            calc_idx,
            {
                "product_id": wf_prod["id"],
                "paper_id": roll_32["id"],
                "width_mm": 1000,
                "height_mm": 1000,
                "quantity": 1,
                "selected_params": {"eyelets": False, "edge_gluing": False},
            },
            is_admin=True,
        )
        self.assertIsNone(err_32)
        # print_area = 1.01 * 1.01 = 1.0201 m2; waste for 3.2m roll = 0.3 * 3.2 = 0.96 m2 => total 1.9801 m2
        self.assertAlmostEqual(
            res_32["internal"]["breakdown"]["total_area_m2"],
            round(1.0201 + 0.3 * 3.2, 3),
            places=3,
        )

        res_16, err_16 = calculate_order_pricing(
            fake_db,
            calc_idx,
            {
                "product_id": wf_prod["id"],
                "paper_id": roll_16["id"],
                "width_mm": 1000,
                "height_mm": 1000,
                "quantity": 1,
                "selected_params": {"eyelets": False, "edge_gluing": False},
            },
            is_admin=True,
        )
        self.assertIsNone(err_16)
        # print_area = 1.01 * 1.01 = 1.0201 m2; waste for 1.6m roll = 0.3 * 1.6 = 0.48 m2 => total 1.5001 m2
        self.assertAlmostEqual(
            res_16["internal"]["breakdown"]["total_area_m2"],
            round(1.0201 + 0.3 * 1.6, 3),
            places=3,
        )

    def test_wide_format_eyelet_spacing_options_and_corners(self):
        from pricing import calculate_order_pricing
        from storage import get_calc_index

        fake_db = copy.deepcopy(load_data())
        calc_idx = get_calc_index(fake_db)
        wf_prod = next(p for p in fake_db["products"] if p["id"] == 2001)
        roll_id = wf_prod["allowed_paper_ids"][0]

        def calc_with_step(eyelets_on, step=None):
            sp = {"eyelets": eyelets_on, "edge_gluing": False}
            if step is not None:
                sp["eyelets_step"] = step
            res, err = calculate_order_pricing(
                fake_db,
                calc_idx,
                {
                    "product_id": wf_prod["id"],
                    "paper_id": roll_id,
                    "width_mm": 2000,
                    "height_mm": 1000,
                    "quantity": 10,
                    "selected_params": sp,
                },
                is_admin=True,
            )
            self.assertIsNone(err)
            return res

        res_off = calc_with_step(False, "15")
        res_corners = calc_with_step(True, "corners")
        res_50 = calc_with_step(True, "50")
        res_30 = calc_with_step(True, "30")
        res_25 = calc_with_step(True, "25")
        res_20 = calc_with_step(True, "20")
        res_15 = calc_with_step(True, "15")

        self.assertEqual(res_off["internal"]["breakdown"]["extra_cost"], 0.0)
        # 2000 x 1000 mm => perimeter = 6000 mm; unit eyelet cost = 2.5 rub, qty = 10
        # corners: 4 * 10 * 2.5 = 100.0
        self.assertEqual(res_corners["internal"]["breakdown"]["extra_cost"], 100.0)
        self.assertIn("по углам", res_corners["internal"]["breakdown"]["params"][0]["name"])
        # 50 cm (500 mm): 12 * 10 * 2.5 = 300.0
        self.assertEqual(res_50["internal"]["breakdown"]["extra_cost"], 300.0)
        # 30 cm (300 mm): 20 * 10 * 2.5 = 500.0
        self.assertEqual(res_30["internal"]["breakdown"]["extra_cost"], 500.0)
        # 25 cm (250 mm): 24 * 10 * 2.5 = 600.0
        self.assertEqual(res_25["internal"]["breakdown"]["extra_cost"], 600.0)
        # 20 cm (200 mm): 30 * 10 * 2.5 = 750.0
        self.assertEqual(res_20["internal"]["breakdown"]["extra_cost"], 750.0)
        # 15 cm (150 mm): 40 * 10 * 2.5 = 1000.0
        self.assertEqual(res_15["internal"]["breakdown"]["extra_cost"], 1000.0)
        self.assertIn("шаг 15 см", res_15["internal"]["breakdown"]["params"][0]["name"])

        self.assertGreater(res_15["client_price"], res_20["client_price"])
        self.assertGreater(res_20["client_price"], res_25["client_price"])
        self.assertGreater(res_25["client_price"], res_30["client_price"])
        self.assertGreater(res_30["client_price"], res_50["client_price"])
        self.assertGreater(res_50["client_price"], res_corners["client_price"])
        self.assertGreater(res_corners["client_price"], res_off["client_price"])

    def test_wide_format_banner_margins_pricing(self):
        from pricing import calculate_order_pricing
        from storage import get_calc_index

        fake_db = copy.deepcopy(load_data())
        calc_idx = get_calc_index(fake_db)
        wf_prod = next(p for p in fake_db["products"] if p["id"] == 2001)
        roll_id = wf_prod["allowed_paper_ids"][0]
        wf_params = fake_db["settings"]["main_category_params"]["wide_format"]
        bleed = float(wf_params.get("bleed_mm", 10.0))

        def calc_margin(margin_cm):
            res, err = calculate_order_pricing(
                fake_db,
                calc_idx,
                {
                    "product_id": wf_prod["id"],
                    "paper_id": roll_id,
                    "width_mm": 2000,
                    "height_mm": 1000,
                    "quantity": 5,
                    "selected_params": {
                        "eyelets": False,
                        "edge_gluing": False,
                        "banner_margin_cm": str(margin_cm),
                    },
                },
                is_admin=True,
            )
            self.assertIsNone(err)
            return res

        r5 = calc_margin(5)
        r10 = calc_margin(10)
        r15 = calc_margin(15)
        r20 = calc_margin(20)

        self.assertEqual(
            r5["internal"]["size_with_bleed"],
            f"{int(2000 + 100 + bleed)} × {int(1000 + 100 + bleed)} мм",
        )
        self.assertEqual(
            r10["internal"]["size_with_bleed"],
            f"{int(2000 + 200 + bleed)} × {int(1000 + 200 + bleed)} мм",
        )
        self.assertEqual(
            r15["internal"]["size_with_bleed"],
            f"{int(2000 + 300 + bleed)} × {int(1000 + 300 + bleed)} мм",
        )
        self.assertEqual(
            r20["internal"]["size_with_bleed"],
            f"{int(2000 + 400 + bleed)} × {int(1000 + 400 + bleed)} мм",
        )

        self.assertGreater(r20["client_price"], r15["client_price"])
        self.assertGreater(r15["client_price"], r10["client_price"])
        self.assertGreater(r10["client_price"], r5["client_price"])


if __name__ == "__main__":
    unittest.main()



