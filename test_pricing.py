import atexit
import copy
import math
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

# Isolate tests from real data/database.json before importing storage/app.
_TEST_TEMP_DIR = tempfile.TemporaryDirectory(prefix="print_calc_test_")
atexit.register(_TEST_TEMP_DIR.cleanup)
_REAL_DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "database.json"
if _REAL_DATA_FILE.is_file():
    shutil.copy2(_REAL_DATA_FILE, Path(_TEST_TEMP_DIR.name) / "database.json")
os.environ["PRINT_CALC_DATA_DIR"] = _TEST_TEMP_DIR.name

# Keep production strict while making the test module runnable in isolation.
os.environ.setdefault('AUTH_SECRET_KEY', 'test-secret-key-with-at-least-32-characters-long')
os.environ.setdefault('PRINT_CALC_SEED_DEFAULT_USERS', '1')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from storage import (
    get_calc_index,
    _build_public_catalog_payload,
    load_data,
)
from pricing import calculate_order_pricing


def make_test_data():
    return copy.deepcopy(load_data())


class TestMultiCategoryPricing(unittest.TestCase):
    def setUp(self):
        self.data = make_test_data()
        self.calc_idx = get_calc_index(self.data)

    def test_catalog_limits_and_starter_products(self):
        catalog = _build_public_catalog_payload(self.data)
        limits = catalog["limits"]
        self.assertIn("by_main_category", limits)
        self.assertIn("bleed_mm", limits)
        self.assertIn("sra3_width_mm", limits)
        self.assertIn("sra3_height_mm", limits)
        self.assertEqual(limits["by_main_category"]["wide_format"]["max_width_mm"], 50000.0)
        self.assertEqual(limits["by_main_category"]["wide_format"]["max_height_mm"], 50000.0)
        self.assertIn("roll_width_mm", limits["by_main_category"]["wide_format"])
        self.assertIn("bleed_mm", limits["by_main_category"]["wide_format"])

        self.assertIn("category_qty_tiers", catalog)
        qty_tiers = catalog["category_qty_tiers"]
        self.assertIn("flyers", qty_tiers)
        self.assertTrue(all(isinstance(x, int) for x in qty_tiers["flyers"]))
        self.assertIn("wf_banners_cat", qty_tiers)
        self.assertEqual(qty_tiers["wf_banners_cat"], sorted(qty_tiers["wf_banners_cat"]))

        cat_by_id = {c["id"]: c for c in catalog["categories"]}
        for expected_subcat, expected_parent in [
            ("wf_banners_cat", "wide_format"),
            ("wf_films_cat", "wide_format"),
            ("wf_posters_cat", "wide_format"),
            ("souv_mugs_cat", "souvenirs"),
            ("souv_textile_cat", "souvenirs"),
            ("stamps_orgs_cat", "stamps"),
            ("design_makets_cat", "design"),
        ]:
            self.assertIn(expected_subcat, cat_by_id)
            self.assertEqual(cat_by_id[expected_subcat]["parent_id"], expected_parent)

        prods_by_main = {mc["id"]: [] for mc in catalog["main_categories"]}
        for p in catalog["products"]:
            parent_id = cat_by_id.get(p["category"], {}).get("parent_id")
            if parent_id in prods_by_main:
                prods_by_main[parent_id].append(p)

        self.assertGreaterEqual(len(prods_by_main["wide_format"]), 3)
        self.assertGreaterEqual(len(prods_by_main["souvenirs"]), 2)
        self.assertGreaterEqual(len(prods_by_main["stamps"]), 2)
        self.assertGreaterEqual(len(prods_by_main["design"]), 2)

    def test_polygraphy_sra3_pricing(self):
        poly_prod = next(
            p for p in self.data["products"]
            if self.calc_idx["subcat_parent_by_id"].get(p["category"]) == "polygraphy"
        )
        res, err = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": poly_prod["id"],
                "paper_id": poly_prod["allowed_paper_ids"][0] if poly_prod.get("allowed_paper_ids") else 0,
                "print_sides": 2,
                "quantity": 100,
            },
            is_admin=True,
        )
        self.assertIsNone(err)
        self.assertIsNotNone(res)
        self.assertGreater(res["client_price"], 0)
        internal = res["internal"]
        self.assertEqual(internal["main_category_id"], "polygraphy")
        self.assertGreaterEqual(internal["items_per_sheet"], 1)
        self.assertGreaterEqual(internal["sheets_needed"], 1)
        self.assertGreater(internal["breakdown"]["print_cost"], 0)
        self.assertGreater(internal["breakdown"]["paper_cost"], 0)

    def test_wide_format_large_dimensions_and_eyelets(self):
        # Product 2001: Баннер с люверсами (3000 x 2000 мм), custom size 4000 x 2000 мм
        banner_item = next(i for i in self.data["items"] if i["category"] == "wf_banners")
        wf_params = self.data["settings"]["main_category_params"]["wide_format"]
        bleed = float(wf_params.get("bleed_mm", 10.0))
        roll_w = (
            float(banner_item["roll_width_m"]) * 1000.0
            if float(banner_item.get("roll_width_m") or 0) > 0
            else float(wf_params.get("roll_width_mm", 1600.0))
        )
        roll_waste = float(wf_params.get("roll_waste_m", 0.3))
        eyelet_step = float(wf_params.get("eyelet_step_mm", 300.0))

        res_no_eyelets, err = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": 2001,
                "paper_id": banner_item["id"],
                "width_mm": 4000,
                "height_mm": 2000,
                "quantity": 2,
                "selected_params": {"eyelets": False, "edge_gluing": False},
            },
            is_admin=True,
        )
        self.assertIsNone(err)
        internal_no = res_no_eyelets["internal"]
        self.assertEqual(internal_no["main_category_id"], "wide_format")
        self.assertEqual(internal_no["size_with_bleed"], f"{int(4000 + bleed)} × {int(2000 + bleed)} мм")

        unit_area = ((4000.0 + bleed) * (2000.0 + bleed)) / 1_000_000.0
        print_area = unit_area * 2
        roll_waste_area = roll_waste * (roll_w / 1000.0)
        total_area = print_area + roll_waste_area
        expected_mat_cost = round(total_area * (banner_item["price"] / banner_item["resource"]), 2)
        self.assertAlmostEqual(internal_no["breakdown"]["paper_cost"], expected_mat_cost, places=1)
        self.assertGreater(internal_no["breakdown"]["print_cost"], 0)

        # Now enable eyelets
        res_with_eyelets, err2 = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": 2001,
                "paper_id": banner_item["id"],
                "width_mm": 4000,
                "height_mm": 2000,
                "quantity": 2,
                "selected_params": {"eyelets": True, "edge_gluing": False},
            },
            is_admin=True,
        )
        self.assertIsNone(err2)
        internal_with = res_with_eyelets["internal"]
        eyelets_per_unit = max(4, int(math.ceil((2.0 * (4000.0 + 2000.0)) / eyelet_step)))
        self.assertGreater(internal_with["breakdown"]["extra_cost"], 0)
        self.assertEqual(internal_with["breakdown"]["extra_cost"] % eyelets_per_unit, 0.0)
        self.assertGreater(res_with_eyelets["client_price"], res_no_eyelets["client_price"])

    def test_souvenirs_pricing(self):
        # Product 2101: Кружка с печатью 330 мл
        mug_item = next(i for i in self.data["items"] if i["category"] == "souv_blanks")
        souv_params = self.data["settings"]["main_category_params"]["souvenirs"]
        setup_cost = float(souv_params.get("setup_cost", 150.0))
        packaging_cost = float(souv_params.get("packaging_cost", 15.0))

        res, err = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": 2101,
                "paper_id": mug_item["id"],
                "quantity": 10,
                "selected_params": {"gift_box": False},
            },
            is_admin=True,
        )
        self.assertIsNone(err)
        internal = res["internal"]
        self.assertEqual(internal["main_category_id"], "souvenirs")
        expected_blank_cost = round(10 * (mug_item["price"] / mug_item["resource"]), 2)
        self.assertAlmostEqual(internal["breakdown"]["paper_cost"], expected_blank_cost, places=2)
        self.assertGreater(internal["breakdown"]["print_cost"], 0)
        expected_extra = packaging_cost * 10 + setup_cost
        self.assertAlmostEqual(internal["breakdown"]["extra_cost"], expected_extra, places=2)

    def test_stamps_pricing_and_urgency(self):
        # Product 2201: Печать организации автоматическая Ø40 мм
        mount_item = next(i for i in self.data["items"] if i["category"] == "stamps_mounts")
        stamps_params = self.data["settings"]["main_category_params"]["stamps"]
        urgency_pct = float(stamps_params.get("urgency_percent", 50.0))

        res_normal, err = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": 2201,
                "paper_id": mount_item["id"],
                "quantity": 1,
                "selected_params": {"urgent": False},
            },
            is_admin=True,
        )
        self.assertIsNone(err)
        int_norm = res_normal["internal"]
        self.assertEqual(int_norm["main_category_id"], "stamps")
        self.assertGreater(int_norm["breakdown"]["paper_cost"], 0)
        self.assertGreater(int_norm["breakdown"]["print_cost"], 0)
        self.assertEqual(int_norm["breakdown"]["extra_cost"], 0.0)

        res_urgent, err2 = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": 2201,
                "paper_id": mount_item["id"],
                "quantity": 1,
                "selected_params": {"urgent": True},
            },
            is_admin=True,
        )
        self.assertIsNone(err2)
        int_urg = res_urgent["internal"]
        expected_urgency = round(
            (int_norm["breakdown"]["paper_cost"] + int_norm["breakdown"]["print_cost"]) * (urgency_pct / 100.0),
            2,
        )
        self.assertAlmostEqual(int_urg["breakdown"]["extra_cost"], expected_urgency, places=1)
        self.assertGreater(res_urgent["client_price"], res_normal["client_price"])

    def test_design_pricing(self):
        # Product 2301: Разработка дизайн-макета с нуля
        design_params = self.data["settings"]["main_category_params"]["design"]
        hourly_rate = float(design_params.get("hourly_rate", 1200.0))
        prepress_cost = float(design_params.get("prepress_cost", 300.0))
        extra_revision_cost = float(design_params.get("extra_revision_cost", 250.0))

        res, err = calculate_order_pricing(
            self.data,
            self.calc_idx,
            {
                "product_id": 2301,
                "quantity": 1,
                "selected_params": {
                    "design_hours": 2,
                    "prepress": True,
                    "extra_revisions": 3,
                },
            },
            is_admin=True,
        )
        self.assertIsNone(err)
        internal = res["internal"]
        self.assertEqual(internal["main_category_id"], "design")
        self.assertAlmostEqual(internal["breakdown"]["print_cost"], 2.0 * hourly_rate, places=2)
        self.assertAlmostEqual(
            internal["breakdown"]["extra_cost"],
            prepress_cost + 3.0 * extra_revision_cost,
            places=2,
        )
        self.assertGreater(res["client_price"], 2.0 * hourly_rate + prepress_cost)


class TestAdminSecurityAndProductDuplication(unittest.TestCase):
    def setUp(self):
        import app as flask_app_module
        self.app_mod = flask_app_module
        self.client = flask_app_module.app.test_client()
        with flask_app_module._DATA_LOCK:
            flask_app_module._FAILED_LOGIN_ATTEMPTS.clear()
            flask_app_module._AUTH_RATE_LIMIT.clear()
            flask_app_module._ORDER_RATE_LIMIT.clear()
            flask_app_module._SHARED_CART_GET_RATE_LIMIT.clear()

    def tearDown(self):
        with self.app_mod._DATA_LOCK:
            self.app_mod._FAILED_LOGIN_ATTEMPTS.clear()
            self.app_mod._AUTH_RATE_LIMIT.clear()
            self.app_mod._ORDER_RATE_LIMIT.clear()
            self.app_mod._SHARED_CART_GET_RATE_LIMIT.clear()

    def _login_admin_headers(self, ip: str = "10.99.0.250") -> dict[str, str]:
        resp = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": ip},
        )
        self.assertEqual(resp.status_code, 200)
        return {"Authorization": f"Bearer {resp.get_json()['token']}"}

    def test_rate_limit_ignores_x_forwarded_for_spoofing_and_scopes_by_email(self):
        # Legacy X-Admin-Pin header is completely rejected (3.1)
        pin_resp = self.client.get(
            "/api/admin/data",
            headers={"X-Admin-Pin": "1234"},
            environ_base={"REMOTE_ADDR": "10.99.0.1"},
        )
        self.assertEqual(pin_resp.status_code, 403)
        self.assertEqual(self.client.post("/api/admin/pin", json={"new_pin": "9999"}).status_code, 410)

        # 5 wrong login attempts for victim@example.com from 10.99.0.1 with spoofed X-Forwarded-For
        for i in range(5):
            resp = self.client.post(
                "/api/auth/login",
                json={"email": "victim@example.com", "password": "wrongpassword123"},
                headers={"X-Forwarded-For": f"203.0.113.{i + 1}"},
                environ_base={"REMOTE_ADDR": "10.99.0.1"},
            )
            self.assertEqual(resp.status_code, 401)

        # 6th attempt for same (IP, email) must be locked out (403) even with new spoofed X-Forwarded-For
        locked_resp = self.client.post(
            "/api/auth/login",
            json={"email": "victim@example.com", "password": "wrongpassword123"},
            headers={"X-Forwarded-For": "198.51.100.250"},
            environ_base={"REMOTE_ADDR": "10.99.0.1"},
        )
        self.assertEqual(locked_resp.status_code, 403)

        # Another account (admin@print.local) behind the SAME NAT IP (10.99.0.1) is NOT locked out (4.1)
        admin_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.0.1"},
        )
        self.assertEqual(admin_login.status_code, 200)
        admin_token = admin_login.get_json()["token"]

        ok_resp = self.client.get(
            "/api/admin/data",
            headers={"Authorization": f"Bearer {admin_token}"},
            environ_base={"REMOTE_ADDR": "10.99.0.2"},
        )
        self.assertEqual(ok_resp.status_code, 200)
        payload = ok_resp.get_json()
        self.assertNotIn("admin_pin", payload.get("settings", {}))
        self.assertNotIn("manager_pin", payload.get("settings", {}))
        self.assertNotIn("admin_pin_hash", payload.get("settings", {}))
        self.assertNotIn("manager_pin_hash", payload.get("settings", {}))

    def test_manager_auth_endpoint_requires_bearer_token_and_rejects_pins(self):
        # Legacy X-Manager-Pin -> 403
        bad_resp = self.client.post(
            "/api/manager/auth",
            headers={"X-Manager-Pin": "0000"},
            environ_base={"REMOTE_ADDR": "10.99.0.10"},
        )
        self.assertEqual(bad_resp.status_code, 403)

        # Valid manager Bearer token -> 200
        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
            environ_base={"REMOTE_ADDR": "10.99.0.11"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_token = mgr_login.get_json()["token"]

        ok_mgr = self.client.post(
            "/api/manager/auth",
            headers={"Authorization": f"Bearer {mgr_token}"},
            environ_base={"REMOTE_ADDR": "10.99.0.11"},
        )
        self.assertEqual(ok_mgr.status_code, 200)
        self.assertEqual(ok_mgr.get_json().get("role"), "manager")

    def test_duplicate_product_preserves_papers_laminations_and_cost_params(self):
        adm_headers = self._login_admin_headers("10.99.0.15")
        data = load_data()
        source_prod = data["products"][0]
        dup_payload = {
            "category": source_prod["category"],
            "name": f"{source_prod['name']} (копия)",
            "product_kind": source_prod.get("product_kind", ""),
            "width_mm": source_prod["width_mm"],
            "height_mm": source_prod["height_mm"],
            "allow_custom_size": source_prod.get("allow_custom_size", False),
            "multi_page_mode": source_prod.get("multi_page_mode", "none"),
            "default_pages": source_prod.get("default_pages", 1),
            "allowed_sides": source_prod.get("allowed_sides", "both"),
            "allowed_paper_ids": [1, 2],
            "allowed_lamination_ids": [10],
            "cost_params": [
                {
                    "id": "creasing",
                    "title": "Биговка",
                    "input_type": "quantity",
                    "price_per_unit": 2.5,
                    "setup_cost": 50.0,
                    "is_client_visible": True,
                }
            ],
        }
        create_resp = self.client.post(
            "/api/admin/products",
            json=dup_payload,
            headers=adm_headers,
        )
        self.assertEqual(create_resp.status_code, 201)
        created = create_resp.get_json()
        try:
            self.assertTrue(created["name"].endswith("(копия)"))
            self.assertEqual(created["allowed_paper_ids"], [1, 2])
            self.assertEqual(created["allowed_lamination_ids"], [10])
            self.assertEqual(len(created["cost_params"]), 1)
            self.assertEqual(created["cost_params"][0]["id"], "creasing")
        finally:
            del_resp = self.client.delete(
                f"/api/admin/products/{created['id']}",
                headers=adm_headers,
            )
            self.assertEqual(del_resp.status_code, 200)

    def test_user_registration_login_me_and_role_update(self):
        import time
        test_email = f"client_{int(time.time() * 1000)}@example.com"

        # 1. Register a new client user
        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "name": "Тестовый Клиент",
                "email": test_email,
                "password": "secretpassword123",
            },
            environ_base={"REMOTE_ADDR": "10.99.1.1"},
        )
        self.assertIn(reg_resp.status_code, (200, 201))
        reg_data = reg_resp.get_json()
        self.assertIn("token", reg_data)
        self.assertIn("user", reg_data)
        user_obj = reg_data["user"]
        self.assertEqual(user_obj["email"], test_email)
        self.assertEqual(user_obj["role"], "client")
        self.assertEqual(user_obj["is_email_verified"], False)
        self.assertNotIn("password_hash", user_obj)
        client_token = reg_data["token"]
        created_user_id = user_obj["id"]

        try:
            # 2. Verify /api/auth/me with client token
            me_resp = self.client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(me_resp.status_code, 200)
            self.assertEqual(me_resp.get_json()["user"]["email"], test_email)

            # 3. Client token must NOT have access to /api/admin/users
            forbidden_resp = self.client.get(
                "/api/admin/users",
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(forbidden_resp.status_code, 403)

            # 4. Login with wrong password fails, login with right password succeeds
            bad_login = self.client.post(
                "/api/auth/login",
                json={"email": test_email, "password": "wrongpassword"},
                environ_base={"REMOTE_ADDR": "10.99.1.2"},
            )
            self.assertIn(bad_login.status_code, (401, 403))

            ok_login = self.client.post(
                "/api/auth/login",
                json={"email": test_email, "password": "secretpassword123"},
                environ_base={"REMOTE_ADDR": "10.99.1.2"},
            )
            self.assertEqual(ok_login.status_code, 200)
            self.assertEqual(ok_login.get_json()["user"]["id"], created_user_id)

            # 5. Login as default admin via email/password and promote client to manager
            admin_login = self.client.post(
                "/api/auth/login",
                json={"email": "admin@print.local", "password": "admin1234"},
                environ_base={"REMOTE_ADDR": "10.99.1.3"},
            )
            self.assertEqual(admin_login.status_code, 200)
            admin_token = admin_login.get_json()["token"]
            self.assertEqual(admin_login.get_json()["user"]["role"], "admin")

            promote_resp = self.client.put(
                f"/api/admin/users/{created_user_id}",
                json={"role": "manager", "is_email_verified": True},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            self.assertEqual(promote_resp.status_code, 200)
            promoted_user = promote_resp.get_json()
            self.assertEqual(promoted_user["role"], "manager")
            self.assertEqual(promoted_user["is_email_verified"], True)
            self.assertNotIn("password_hash", promoted_user)
        finally:
            cleanup_headers = self._login_admin_headers("10.99.1.4")
            del_user_resp = self.client.delete(
                f"/api/admin/users/{created_user_id}",
                headers=cleanup_headers,
            )
            self.assertEqual(del_user_resp.status_code, 200)

    def test_crm_orders_and_role_permissions(self):
        import time
        test_email = f"crm_client_{int(time.time() * 1000)}@example.com"

        # 1. Default production user should be seeded and able to log in
        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
            environ_base={"REMOTE_ADDR": "10.99.2.1"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_data = prod_login.get_json()
        self.assertEqual(prod_data["user"]["role"], "production")
        prod_token = prod_data["token"]

        # 2. Default manager user login
        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
            environ_base={"REMOTE_ADDR": "10.99.2.2"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_data = mgr_login.get_json()
        self.assertEqual(mgr_data["user"]["role"], "manager")
        mgr_token = mgr_data["token"]

        # 3. Default admin user login
        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.2.3"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        # 4. Register a client user
        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "name": "ООО Ромашка",
                "email": test_email,
                "password": "clientpassword123",
            },
            environ_base={"REMOTE_ADDR": "10.99.2.4"},
        )
        self.assertIn(reg_resp.status_code, (200, 201))
        client_token = reg_resp.get_json()["token"]
        client_user_id = reg_resp.get_json()["user"]["id"]

        created_order_id = None
        try:
            # 5. Client creates an order via POST /api/orders
            order_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "ООО Ромашка",
                    "client_phone": "+7 (999) 123-45-67",
                    "client_email": test_email,
                    "comment": "Упаковать по 100 шт.",
                    "design_link": "https://disk.yandex.ru/d/test-maket",
                    "items": [
                        {
                            "id": "item-1",
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "formatLabel": "90 × 50 мм",
                            "paperId": 21,
                            "paperName": "Плотная матовая бумага 300 г/м²",
                            "printSides": 2,
                            "sidesLabel": "4+4 (двусторонняя)",
                            "laminationName": "Без ламинации",
                            "extraSummary": "Скругление углов",
                            "unitPrice": 6.5,
                            "totalPrice": 1300.0,
                        }
                    ],
                },
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(order_resp.status_code, 201)
            created_order = order_resp.get_json()
            created_order_id = created_order["id"]
            self.assertGreaterEqual(created_order_id, 1001)
            self.assertEqual(created_order["status"], "new")
            self.assertEqual(created_order["user_id"], client_user_id)
            self.assertNotIn("internal_metrics", created_order)
            self.assertGreaterEqual(created_order["items"][0]["sheets_needed"], 1)
            self.assertGreaterEqual(created_order["items"][0]["items_per_sheet"], 1)

            # 6. Client can see own orders in GET /api/orders/my, but gets 403 on GET /api/crm/orders
            my_resp = self.client.get(
                "/api/orders/my",
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(my_resp.status_code, 200)
            my_orders = my_resp.get_json()
            self.assertTrue(any(o["id"] == created_order_id for o in my_orders))

            client_crm_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(client_crm_resp.status_code, 403)

            # 7. Production role gets tech-card WITHOUT prices or internal_metrics
            prod_crm_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(prod_crm_resp.status_code, 200)
            prod_orders = prod_crm_resp.get_json()
            prod_order = next(o for o in prod_orders if o["id"] == created_order_id)
            self.assertNotIn("total_price", prod_order)
            self.assertNotIn("discount_percent", prod_order)
            self.assertNotIn("payment_status", prod_order)
            self.assertNotIn("internal_metrics", prod_order)
            self.assertNotIn("totalPrice", prod_order["items"][0])
            self.assertNotIn("unitPrice", prod_order["items"][0])
            self.assertGreaterEqual(prod_order["items"][0]["sheets_needed"], 1)

            # 8. Unassigned client order is visible to all managers; once admin assigns manager_id, manager sees client prices & payment_status, but NOT internal_metrics
            mgr_unassigned_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_unassigned_resp.status_code, 200)
            self.assertTrue(
                any(o["id"] == created_order_id for o in mgr_unassigned_resp.get_json())
            )

            assign_mgr_resp = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"manager_id": mgr_data["user"]["id"]},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(assign_mgr_resp.status_code, 200)

            mgr_crm_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_crm_resp.status_code, 200)
            mgr_order = next(o for o in mgr_crm_resp.get_json() if o["id"] == created_order_id)
            self.assertIn("total_price", mgr_order)
            self.assertIn("payment_status", mgr_order)
            self.assertNotIn("internal_metrics", mgr_order)

            # 9. Admin role sees everything including internal_metrics
            adm_crm_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(adm_crm_resp.status_code, 200)
            adm_order = next(o for o in adm_crm_resp.get_json() if o["id"] == created_order_id)
            self.assertIn("internal_metrics", adm_order)
            self.assertIn("profit", adm_order["internal_metrics"])
            self.assertGreaterEqual(adm_order["internal_metrics"]["total_sra3_sheets"], 1)

            # 10. Production updates status & comment; attempts to change discount_percent are ignored
            prod_put = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={
                    "status": "in_progress",
                    "comment": "Печатаем на Konica",
                    "discount_percent": 50,
                    "payment_status": "paid",
                },
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(prod_put.status_code, 200)
            prod_updated = prod_put.get_json()
            self.assertEqual(prod_updated["status"], "in_progress")
            self.assertEqual(prod_updated["comment"], "Печатаем на Konica")
            self.assertNotIn("total_price", prod_updated)

            # Verify discount_percent was NOT changed by production
            mgr_check = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            mgr_order_after = next(o for o in mgr_check.get_json() if o["id"] == created_order_id)
            self.assertEqual(mgr_order_after["discount_percent"], 0.0)
            self.assertEqual(mgr_order_after["payment_status"], "unpaid")

            # 11. Manager updates payment_status, deadline_date, and discount_percent
            # Attempt without discount_comment must return 400
            mgr_put_no_comment = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={
                    "discount_percent": 10,
                },
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_put_no_comment.status_code, 400)

            mgr_put = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={
                    "payment_status": "paid",
                    "discount_percent": 10,
                    "discount_comment": "Скидка постоянному клиенту",
                    "deadline_date": "2026-12-31",
                },
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_put.status_code, 200)
            mgr_updated = mgr_put.get_json()
            self.assertEqual(mgr_updated["payment_status"], "paid")
            self.assertEqual(mgr_updated["discount_percent"], 10.0)
            self.assertEqual(mgr_updated["discount_comment"], "Скидка постоянному клиенту")
            self.assertTrue(bool(mgr_updated.get("discount_author_name")))
            self.assertEqual(mgr_updated["deadline_date"], "2026-12-31")

            # 12. Neither production nor manager can DELETE order; only admin can
            prod_del = self.client.delete(
                f"/api/crm/orders/{created_order_id}",
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(prod_del.status_code, 403)

            mgr_del = self.client.delete(
                f"/api/crm/orders/{created_order_id}",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_del.status_code, 403)

            adm_del = self.client.delete(
                f"/api/crm/orders/{created_order_id}",
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(adm_del.status_code, 200)
            created_order_id = None
        finally:
            if created_order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{created_order_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )
            self.client.delete(
                f"/api/admin/users/{client_user_id}",
                headers={"Authorization": f"Bearer {adm_token}"},
            )

    def test_profile_company_details_and_order_invoice(self):
        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_token = mgr_login.get_json()["token"]

        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_token = prod_login.get_json()["token"]

        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "name": "ООО Полиграф Тест",
                "email": "invoice_client@print.local",
                "password": "client1234",
            },
        )
        self.assertEqual(reg_resp.status_code, 201)
        reg_json = reg_resp.get_json()
        client_token = reg_json["token"]
        client_user_id = reg_json["user"]["id"]
        self.assertEqual(reg_json["user"]["client_type"], "individual")

        created_order_id = None
        try:
            # 0. Incomplete company_details must return 400, and non-legal client cannot use bank_transfer
            incomplete_put = self.client.put(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {client_token}"},
                json={"company_details": {"company_name": "ООО Тест"}},
            )
            self.assertEqual(incomplete_put.status_code, 400)

            rejected_bt = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {client_token}"},
                json={
                    "client_name": "Иван Частник",
                    "payment_method": "bank_transfer",
                    "items": [
                        {
                            "productId": 103,
                            "productName": "A5 (148 × 210 мм)",
                            "quantity": 100,
                        }
                    ],
                },
            )
            self.assertEqual(rejected_bt.status_code, 400)

            # 1. Update company_details via PUT /api/auth/profile with all 9 fields
            prof_put = self.client.put(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {client_token}"},
                json={
                    "company_details": {
                        "company_name": "ООО «Полиграф Плюс»",
                        "inn": "7701234567",
                        "kpp": "770101001",
                        "legal_address": "г. Москва, ул. Печатников, д. 5",
                        "bank_name": "ПАО Сбербанк",
                        "bik": "044525225",
                        "checking_account": "40702810938000012345",
                        "correspondent_account": "30101810400000000225",
                        "phone": "+7 (495) 777-88-99",
                    }
                },
            )
            self.assertEqual(prof_put.status_code, 200)
            prof_data = prof_put.get_json()
            self.assertEqual(prof_data["user"]["client_type"], "legal")
            self.assertEqual(prof_data["user"]["company_details"]["inn"], "7701234567")
            self.assertEqual(prof_data["user"]["company_details"]["company_name"], "ООО «Полиграф Плюс»")

            # 2. Verify GET /api/auth/me returns company_details and client_type='legal'
            me_resp = self.client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(me_resp.status_code, 200)
            me_user = me_resp.get_json()["user"]
            self.assertEqual(me_user["client_type"], "legal")
            me_cd = me_user["company_details"]
            self.assertEqual(me_cd["inn"], "7701234567")
            self.assertEqual(me_cd["kpp"], "770101001")
            self.assertEqual(me_cd["bank_name"], "ПАО Сбербанк")

            # 3. Create order with need_invoice=True and payment_method='card_on_delivery'
            order_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {client_token}"},
                json={
                    "client_name": "ООО «Полиграф Плюс»",
                    "client_phone": "+7 (495) 777-88-99",
                    "need_invoice": True,
                    "payment_method": "card_on_delivery",
                    "items": [
                        {
                            "productId": 103,
                            "productName": "A5 (148 × 210 мм)",
                            "categoryName": "Листовки и флаеры",
                            "formatLabel": "148 × 210 мм",
                            "paperLabel": "Мелованная 130 г/м²",
                            "printLabel": "Двусторонняя (4+4)",
                            "quantity": 500,
                            "unitPrice": 5.0,
                            "totalPrice": 2500.0,
                        }
                    ],
                },
            )
            self.assertEqual(order_resp.status_code, 201)
            created_order = order_resp.get_json()
            created_order_id = created_order["id"]
            self.assertEqual(created_order["client_type"], "legal")
            self.assertEqual(created_order["payment_method"], "card_on_delivery")
            self.assertTrue(created_order["need_invoice"])
            self.assertEqual(created_order["company_details"]["inn"], "7701234567")
            self.assertEqual(created_order["company_details"]["company_name"], "ООО «Полиграф Плюс»")

            # 4. Assign order to manager so manager sees company_details in CRM
            mgr_id = mgr_login.get_json()["user"]["id"]
            self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"manager_id": mgr_id},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            mgr_orders = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            ).get_json()
            mgr_order = next(o for o in mgr_orders if o["id"] == created_order_id)
            self.assertTrue(mgr_order.get("need_invoice"))
            self.assertEqual(mgr_order["company_details"]["inn"], "7701234567")

            # 5. Production does NOT see company_details or need_invoice
            prod_orders = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {prod_token}"},
            ).get_json()
            prod_order = next(o for o in prod_orders if o["id"] == created_order_id)
            self.assertNotIn("company_details", prod_order)
            self.assertNotIn("need_invoice", prod_order)

            # 6. Manager can create an order with payment_method="bank_transfer" and company_details via POST /api/orders
            mgr_order_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
                json={
                    "client_name": "ООО Альфа",
                    "client_phone": "+7 (495) 111-22-33",
                    "payment_method": "bank_transfer",
                    "company_details": {
                        "company_name": "ООО Альфа",
                        "inn": "7701234567",
                    },
                    "items": [
                        {
                            "productId": 103,
                            "productName": "A5 (148 × 210 мм)",
                            "categoryName": "Листовки и флаеры",
                            "formatLabel": "148 × 210 мм",
                            "paperLabel": "Мелованная 130 г/м²",
                            "printLabel": "Двусторонняя (4+4)",
                            "quantity": 500,
                            "unitPrice": 5.0,
                            "totalPrice": 2500.0,
                        }
                    ],
                },
            )
            self.assertEqual(mgr_order_resp.status_code, 201)
            mgr_created_order = mgr_order_resp.get_json()
            mgr_created_order_id = mgr_created_order["id"]
            try:
                self.assertEqual(mgr_created_order["payment_method"], "bank_transfer")
                self.assertEqual(mgr_created_order["client_type"], "legal")
                self.assertTrue(mgr_created_order["need_invoice"])
                self.assertEqual(
                    mgr_created_order["company_details"]["company_name"],
                    "ООО Альфа",
                )
                self.assertEqual(mgr_created_order["company_details"]["inn"], "7701234567")
            finally:
                self.client.delete(
                    f"/api/crm/orders/{mgr_created_order_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )
        finally:
            if created_order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{created_order_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )
            self.client.delete(
                f"/api/admin/users/{client_user_id}",
                headers={"Authorization": f"Bearer {adm_token}"},
            )

    def test_staff_first_last_name_phone_email_and_admin_create(self):
        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        # 1. Verify seed accounts have first_name, last_name, phone, email
        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_user = mgr_login.get_json()["user"]
        self.assertEqual(mgr_user["first_name"], "Алексей")
        self.assertEqual(mgr_user["last_name"], "Смирнов")
        self.assertEqual(mgr_user["phone"], "+7 (900) 000-00-01")
        self.assertEqual(mgr_user["email"], "manager@print.local")
        self.assertEqual(mgr_user["name"], "Алексей Смирнов")

        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_user = prod_login.get_json()["user"]
        self.assertEqual(prod_user["first_name"], "Сергей")
        self.assertEqual(prod_user["last_name"], "Иванов")
        self.assertEqual(prod_user["phone"], "+7 (900) 000-00-02")
        self.assertEqual(prod_user["email"], "production@print.local")
        self.assertEqual(prod_user["name"], "Сергей Иванов")

        # 2. Create a new staff user via POST /api/admin/users
        create_resp = self.client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {adm_token}"},
            json={
                "first_name": "Дмитрий",
                "last_name": "Орлов",
                "phone": "+7 (900) 555-44-33",
                "email": "d.orlov@print.local",
                "password": "staffpassword123",
                "role": "manager",
            },
        )
        self.assertEqual(create_resp.status_code, 201)
        created_staff = create_resp.get_json()
        staff_id = created_staff["id"]

        try:
            self.assertEqual(created_staff["first_name"], "Дмитрий")
            self.assertEqual(created_staff["last_name"], "Орлов")
            self.assertEqual(created_staff["name"], "Дмитрий Орлов")
            self.assertEqual(created_staff["phone"], "+7 (900) 555-44-33")
            self.assertEqual(created_staff["email"], "d.orlov@print.local")
            self.assertEqual(created_staff["role"], "manager")

            # 3. Edit employee via PUT /api/admin/users/<id>
            upd_resp = self.client.put(
                f"/api/admin/users/{staff_id}",
                headers={"Authorization": f"Bearer {adm_token}"},
                json={
                    "first_name": "Дмитрий",
                    "last_name": "Соколов",
                    "phone": "+7 (900) 555-44-99",
                    "email": "d.sokolov@print.local",
                    "role": "production",
                },
            )
            self.assertEqual(upd_resp.status_code, 200)
            upd_staff = upd_resp.get_json()
            self.assertEqual(upd_staff["last_name"], "Соколов")
            self.assertEqual(upd_staff["name"], "Дмитрий Соколов")
            self.assertEqual(upd_staff["phone"], "+7 (900) 555-44-99")
            self.assertEqual(upd_staff["email"], "d.sokolov@print.local")
            self.assertEqual(upd_staff["role"], "production")

            # 4. Staff logs in with new email and updates own profile via PUT /api/auth/profile
            staff_login = self.client.post(
                "/api/auth/login",
                json={"email": "d.sokolov@print.local", "password": "staffpassword123"},
            )
            self.assertEqual(staff_login.status_code, 200)
            staff_token = staff_login.get_json()["token"]

            # Changing email without current_password returns 400 (3.4)
            no_pw_upd = self.client.put(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {staff_token}"},
                json={
                    "first_name": "Денис",
                    "last_name": "Соколов",
                    "phone": "+7 (999) 111-22-33",
                    "email": "denis.sokolov@print.local",
                },
            )
            self.assertEqual(no_pw_upd.status_code, 400)

            self_upd = self.client.put(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {staff_token}"},
                json={
                    "first_name": "Денис",
                    "last_name": "Соколов",
                    "phone": "+7 (999) 111-22-33",
                    "email": "denis.sokolov@print.local",
                    "current_password": "staffpassword123",
                },
            )
            self.assertEqual(self_upd.status_code, 200)
            self_upd_json = self_upd.get_json()
            self_user = self_upd_json["user"]
            fresh_token = self_upd_json["token"]
            self.assertTrue(fresh_token)
            self.assertEqual(self_user["first_name"], "Денис")
            self.assertEqual(self_user["last_name"], "Соколов")
            self.assertEqual(self_user["name"], "Денис Соколов")
            self.assertEqual(self_user["phone"], "+7 (999) 111-22-33")
            self.assertEqual(self_user["email"], "denis.sokolov@print.local")

            # 5. Changing password with wrong current_password returns 400
            bad_pw_resp = self.client.put(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {fresh_token}"},
                json={
                    "current_password": "wrong-old-password",
                    "new_password": "newstaffpassword999",
                },
            )
            self.assertEqual(bad_pw_resp.status_code, 400)

            # 6. Changing password with valid current_password returns 200 and new token
            good_pw_resp = self.client.put(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {fresh_token}"},
                json={
                    "current_password": "staffpassword123",
                    "new_password": "newstaffpassword999",
                },
            )
            self.assertEqual(good_pw_resp.status_code, 200)
            good_pw_json = good_pw_resp.get_json()
            self.assertTrue(good_pw_json.get("token"))

            # 7. Login with old password returns 401, with new password returns 200
            old_login = self.client.post(
                "/api/auth/login",
                json={"email": "denis.sokolov@print.local", "password": "staffpassword123"},
            )
            self.assertEqual(old_login.status_code, 401)

            new_login = self.client.post(
                "/api/auth/login",
                json={"email": "denis.sokolov@print.local", "password": "newstaffpassword999"},
            )
            self.assertEqual(new_login.status_code, 200)
        finally:
            self.client.delete(
                f"/api/admin/users/{staff_id}",
                headers={"Authorization": f"Bearer {adm_token}"},
            )

    def test_order_idempotency_replay_conflict_and_release_on_error(self):
        import uuid

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        idem_key = f"idem-{uuid.uuid4().hex}"
        payload = {
            "client_name": "ООО Идемпотентность",
            "client_phone": "+7 (999) 000-11-22",
            "client_email": "idem@example.com",
            "items": [
                {
                    "productId": 301,
                    "productName": "Стандартная (90 × 50 мм)",
                    "quantity": 200,
                    "paperId": 21,
                    "printSides": 2,
                }
            ],
        }
        created_order_id = None
        second_order_id = None
        try:
            # 1. First request with Idempotency-Key creates order
            r1 = self.client.post(
                "/api/orders",
                json=payload,
                headers={"Authorization": f"Bearer {adm_token}", "Idempotency-Key": idem_key},
                environ_base={"REMOTE_ADDR": "10.88.1.1"},
            )
            self.assertEqual(r1.status_code, 201)
            order1 = r1.get_json()
            created_order_id = order1["id"]

            # 2. Second request with same Idempotency-Key and same body returns same order
            r2 = self.client.post(
                "/api/orders",
                json=payload,
                headers={"Authorization": f"Bearer {adm_token}", "Idempotency-Key": idem_key},
                environ_base={"REMOTE_ADDR": "10.88.1.1"},
            )
            self.assertEqual(r2.status_code, 201)
            order2 = r2.get_json()
            self.assertEqual(order2["id"], created_order_id)

            # 3. Third request with same Idempotency-Key and different body returns 409 Conflict
            modified_payload = dict(payload, client_name="Другой клиент")
            r3 = self.client.post(
                "/api/orders",
                json=modified_payload,
                headers={"Authorization": f"Bearer {adm_token}", "Idempotency-Key": idem_key},
                environ_base={"REMOTE_ADDR": "10.88.1.1"},
            )
            self.assertEqual(r3.status_code, 409)

            # 4. Invalid request (400) releases pending Idempotency-Key so retry with valid body succeeds
            retry_key = f"idem-retry-{uuid.uuid4().hex}"
            bad_resp = self.client.post(
                "/api/orders",
                json=dict(payload, items=[]),
                headers={"Authorization": f"Bearer {adm_token}", "Idempotency-Key": retry_key},
                environ_base={"REMOTE_ADDR": "10.88.1.1"},
            )
            self.assertEqual(bad_resp.status_code, 400)

            good_resp = self.client.post(
                "/api/orders",
                json=payload,
                headers={"Authorization": f"Bearer {adm_token}", "Idempotency-Key": retry_key},
                environ_base={"REMOTE_ADDR": "10.88.1.1"},
            )
            self.assertEqual(good_resp.status_code, 201)
            second_order_id = good_resp.get_json()["id"]
            self.assertNotEqual(second_order_id, created_order_id)
        finally:
            for oid in (created_order_id, second_order_id):
                if oid is not None:
                    self.client.delete(
                        f"/api/crm/orders/{oid}",
                        headers={"Authorization": f"Bearer {adm_token}"},
                    )

    def test_my_orders_does_not_leak_unverified_or_other_user_email_orders(self):
        import uuid
        from backend.storage import load_data, save_data

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        target_email = f"client_{uuid.uuid4().hex[:8]}@example.com"
        legacy_guest_order_id = 999901
        other_user_order_id = None
        own_order_id = None
        user_id = None
        try:
            # 1. Guest attempt to POST /api/orders without Authorization header must fail with 401
            orders_before = len(
                self.client.get(
                    "/api/crm/orders",
                    headers={"Authorization": f"Bearer {adm_token}"},
                ).get_json()
            )
            guest_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "Гость",
                    "client_email": target_email,
                    "items": [
                        {
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                environ_base={"REMOTE_ADDR": "10.77.1.1"},
            )
            self.assertEqual(guest_resp.status_code, 401)
            orders_after = len(
                self.client.get(
                    "/api/crm/orders",
                    headers={"Authorization": f"Bearer {adm_token}"},
                ).get_json()
            )
            self.assertEqual(orders_after, orders_before)

            # 2. User registers with target_email
            reg_resp = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Клиент Строгий ID",
                    "email": target_email,
                    "password": "password123",
                },
                environ_base={"REMOTE_ADDR": "10.77.1.2"},
            )
            self.assertEqual(reg_resp.status_code, 201)
            user_token = reg_resp.get_json()["token"]
            user_id = reg_resp.get_json()["user"]["id"]

            # 3. Admin verifies user's email
            verify_resp = self.client.put(
                f"/api/admin/users/{user_id}",
                json={"is_email_verified": True},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(verify_resp.status_code, 200)

            # 4. Seed a legacy order with user_id=None and same client_email,
            #    plus an order created by admin (different user_id) with the same client_email
            data = load_data()
            data.setdefault("orders", []).insert(
                0,
                {
                    "id": legacy_guest_order_id,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "user_id": None,
                    "client_name": "Старый гость",
                    "client_email": target_email,
                    "status": "new",
                    "payment_status": "unpaid",
                    "items": [],
                    "total_price": 500.0,
                },
            )
            save_data(data)

            other_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {adm_token}"},
                json={
                    "client_name": "Заказ от другого пользователя",
                    "client_email": target_email,
                    "items": [
                        {
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                environ_base={"REMOTE_ADDR": "10.77.1.3"},
            )
            self.assertEqual(other_resp.status_code, 201)
            other_user_order_id = other_resp.get_json()["id"]

            # 5. User creates own order (without passing client_name/client_email explicitly -> defaults from profile)
            own_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {user_token}"},
                json={
                    "items": [
                        {
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                environ_base={"REMOTE_ADDR": "10.77.1.4"},
            )
            self.assertEqual(own_resp.status_code, 201)
            own_order = own_resp.get_json()
            own_order_id = own_order["id"]
            self.assertEqual(own_order["user_id"], user_id)
            self.assertEqual(own_order["client_name"], "Клиент Строгий ID")
            self.assertEqual(own_order["client_email"], target_email)

            # 6. GET /api/orders/my returns ONLY orders with user_id == current_user["id"]
            my_resp = self.client.get(
                "/api/orders/my",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            self.assertEqual(my_resp.status_code, 200)
            my_ids = [o["id"] for o in my_resp.get_json()]
            self.assertIn(own_order_id, my_ids)
            self.assertNotIn(legacy_guest_order_id, my_ids)
            self.assertNotIn(other_user_order_id, my_ids)
        finally:
            for oid in (legacy_guest_order_id, other_user_order_id, own_order_id):
                if oid is not None:
                    self.client.delete(
                        f"/api/crm/orders/{oid}",
                        headers={"Authorization": f"Bearer {adm_token}"},
                    )
            if user_id is not None:
                self.client.delete(
                    f"/api/admin/users/{user_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )

    def test_crm_order_update_validation_and_db_import_validation(self):
        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        order_id = None
        try:
            order_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {adm_token}"},
                json={
                    "client_name": "Тест Валидации CRM",
                    "items": [
                        {
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                environ_base={"REMOTE_ADDR": "10.77.2.1"},
            )
            self.assertEqual(order_resp.status_code, 201)
            order_id = order_resp.get_json()["id"]

            # Invalid email in CRM update -> 400
            bad_email = self.client.put(
                f"/api/crm/orders/{order_id}",
                json={"client_email": "not-an-email"},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(bad_email.status_code, 400)

            # Invalid deadline_date in CRM update -> 400
            bad_date = self.client.put(
                f"/api/crm/orders/{order_id}",
                json={"deadline_date": "31.12.2026"},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(bad_date.status_code, 400)

            # Valid deadline_date with time in CRM update -> 200
            good_datetime = self.client.put(
                f"/api/crm/orders/{order_id}",
                json={"deadline_date": "2026-12-31T15:30"},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(good_datetime.status_code, 200)
            self.assertEqual(good_datetime.get_json()["deadline_date"], "2026-12-31T15:30")

            # Invalid design_link in CRM update -> 400
            bad_link = self.client.put(
                f"/api/crm/orders/{order_id}",
                json={"design_link": "javascript:alert(1)"},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(bad_link.status_code, 400)

            # Invalid DB import (duplicate IDs) -> 400
            bad_import_dup = self.client.post(
                "/api/admin/db/import",
                json={"items": [{"id": 1, "name": "A"}, {"id": 1, "name": "B"}]},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(bad_import_dup.status_code, 400)

            # Invalid DB import (wrong collection type) -> 400
            bad_import_type = self.client.post(
                "/api/admin/db/import",
                json={"settings": {}, "products": "not-a-list"},
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            self.assertEqual(bad_import_type.status_code, 400)
        finally:
            if order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{order_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )

    def test_custom_role_permissions_matrix(self):
        from backend.storage import DEFAULT_ROLE_PERMISSIONS

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]

        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_token = mgr_login.get_json()["token"]

        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_token = prod_login.get_json()["token"]

        # 1. GET /api/catalog does NOT expose internal staff RBAC matrix (5.5)
        cat_resp = self.client.get("/api/catalog")
        self.assertEqual(cat_resp.status_code, 200)
        cat_data = cat_resp.get_json()
        self.assertNotIn("roles", cat_data)
        self.assertNotIn("role_permissions", cat_data)
        self.assertNotIn("role_order_statuses", cat_data)

        # Authenticated /api/admin/data still provides role_permissions in settings
        adm_data_resp = self.client.get(
            "/api/admin/data",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        self.assertEqual(adm_data_resp.status_code, 200)
        adm_perms = adm_data_resp.get_json()["settings"]["role_permissions"]
        self.assertFalse(adm_perms["production"]["manage_order_finances"])
        self.assertFalse(adm_perms["production"]["delete_orders"])
        self.assertTrue(adm_perms["manager"]["apply_discounts"])
        self.assertTrue(adm_perms["admin"]["delete_orders"])

        created_order_id = None
        client_user_id = None
        try:
            # 1b. PUT /api/admin/roles/client attempting to enable any permission must return 400
            bad_client_role_put = self.client.put(
                "/api/admin/roles/client",
                headers={"Authorization": f"Bearer {adm_token}"},
                json={"permissions": {"view_crm": True}},
            )
            self.assertEqual(bad_client_role_put.status_code, 400)

            # 2. Admin updates role_permissions via PUT /api/admin/settings:
            #    - grants production "manage_order_finances": True and "delete_orders": True
            #    - revokes "apply_discounts": False from manager
            #    - attempts to set "delete_orders": False for admin -> stays True
            #    - attempts to set "view_crm": True for client -> stays False
            custom_perms = {
                "client": {
                    "view_crm": True,
                    "manage_catalog": True,
                },
                "production": {
                    "manage_order_finances": True,
                    "delete_orders": True,
                },
                "manager": {
                    "apply_discounts": False,
                },
                "admin": {
                    "delete_orders": False,
                    "view_crm": False,
                },
            }
            upd_settings = self.client.put(
                "/api/admin/settings",
                headers={"Authorization": f"Bearer {adm_token}"},
                json={"role_permissions": custom_perms},
            )
            self.assertEqual(upd_settings.status_code, 200)
            saved_perms = upd_settings.get_json()["role_permissions"]
            self.assertTrue(all(v is False for v in saved_perms["client"].values()))
            self.assertTrue(saved_perms["production"]["manage_order_finances"])
            self.assertTrue(saved_perms["production"]["delete_orders"])
            self.assertFalse(saved_perms["manager"]["apply_discounts"])
            self.assertTrue(saved_perms["admin"]["delete_orders"])
            self.assertTrue(saved_perms["admin"]["view_crm"])

            # Verify unauthenticated guest receives 403 on all /api/crm/* endpoints
            self.assertEqual(self.client.get("/api/crm/orders").status_code, 403)
            self.assertEqual(
                self.client.put("/api/crm/orders/1001", json={"status": "in_progress"}).status_code,
                403,
            )
            self.assertEqual(self.client.post("/api/crm/orders/1001/claim").status_code, 403)
            self.assertEqual(self.client.delete("/api/crm/orders/1001").status_code, 403)
            self.assertEqual(self.client.get("/api/crm/notifications").status_code, 403)
            self.assertEqual(
                self.client.post("/api/crm/notifications/read", json={"mark_all": True}).status_code,
                403,
            )

            # Verify client user still receives 403 on all /api/crm/* endpoints
            reg_client = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Клиент Без Прав",
                    "email": "no_perms_client@example.com",
                    "password": "password123",
                },
                environ_base={"REMOTE_ADDR": "10.99.8.8"},
            )
            self.assertIn(reg_client.status_code, (200, 201))
            client_token = reg_client.get_json()["token"]
            client_user_id = reg_client.get_json()["user"]["id"]
            client_headers = {"Authorization": f"Bearer {client_token}"}
            self.assertEqual(
                self.client.get("/api/crm/orders", headers=client_headers).status_code, 403
            )
            self.assertEqual(
                self.client.put(
                    "/api/crm/orders/1001",
                    headers=client_headers,
                    json={"status": "in_progress"},
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.post(
                    "/api/crm/orders/1001/claim", headers=client_headers
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.delete(
                    "/api/crm/orders/1001", headers=client_headers
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.get(
                    "/api/crm/notifications", headers=client_headers
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.post(
                    "/api/crm/notifications/read",
                    headers=client_headers,
                    json={"mark_all": True},
                ).status_code,
                403,
            )

            # 4. Manager cannot apply discount in POST /api/orders (discount_percent resets to 0)
            order_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
                json={
                    "client_name": "ООО Матрица Прав",
                    "discount_percent": 20,
                    "items": [
                        {
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                environ_base={"REMOTE_ADDR": "10.99.1.1"},
            )
            self.assertEqual(order_resp.status_code, 201)
            created_order = order_resp.get_json()
            created_order_id = created_order["id"]
            self.assertEqual(created_order["discount_percent"], 0.0)
            self.assertEqual(created_order["total_price"], created_order["subtotal_price"])

            # 3. Production now sees total_price in GET /api/crm/orders and can delete the order
            prod_orders_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(prod_orders_resp.status_code, 200)
            prod_order = next(
                o for o in prod_orders_resp.get_json() if o["id"] == created_order_id
            )
            self.assertIn("total_price", prod_order)
            self.assertGreater(prod_order["total_price"], 0)

            del_resp = self.client.delete(
                f"/api/crm/orders/{created_order_id}",
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(del_resp.status_code, 200)
            created_order_id = None
        finally:
            # 5. Restore default role_permissions
            self.client.put(
                "/api/admin/settings",
                headers={"Authorization": f"Bearer {adm_token}"},
                json={"role_permissions": DEFAULT_ROLE_PERMISSIONS},
            )
            if client_user_id is not None:
                self.client.delete(
                    f"/api/admin/users/{client_user_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )
            if created_order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{created_order_id}",
                    headers={"Authorization": f"Bearer {adm_token}"},
                )

    def test_custom_roles_crud_and_user_reassignment(self):
        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        custom_user_id = None
        try:
            # 1. List initial roles
            list_res = self.client.get("/api/admin/roles", headers=adm_headers)
            self.assertEqual(list_res.status_code, 200)
            initial_roles = list_res.get_json()
            initial_ids = {r["id"] for r in initial_roles}
            self.assertIn("admin", initial_ids)
            self.assertIn("client", initial_ids)

            # 2. Create custom role 'senior_mgr' with manage_catalog=True, manage_users=False
            create_role_res = self.client.post(
                "/api/admin/roles",
                headers=adm_headers,
                json={
                    "id": "senior_mgr",
                    "name": "Старший менеджер",
                    "permissions": {
                        "manage_kp": True,
                        "apply_discounts": True,
                        "view_crm": True,
                        "manage_catalog": True,
                        "manage_users": False,
                    },
                },
            )
            self.assertEqual(create_role_res.status_code, 201)
            created_role = create_role_res.get_json()
            self.assertEqual(created_role["id"], "senior_mgr")
            self.assertEqual(created_role["name"], "Старший менеджер")
            self.assertTrue(created_role["permissions"]["manage_catalog"])
            self.assertFalse(created_role["permissions"]["manage_users"])

            # 3. Rename custom role via PUT /api/admin/roles/senior_mgr
            rename_res = self.client.put(
                "/api/admin/roles/senior_mgr",
                headers=adm_headers,
                json={"name": "Ведущий менеджер"},
            )
            self.assertEqual(rename_res.status_code, 200)
            self.assertEqual(rename_res.get_json()["name"], "Ведущий менеджер")

            # 4. Create a user assigned to custom role 'senior_mgr'
            user_res = self.client.post(
                "/api/admin/users",
                headers=adm_headers,
                json={
                    "first_name": "Ирина",
                    "last_name": "Ролева",
                    "email": "senior_mgr_test@print.local",
                    "password": "password123",
                    "role": "senior_mgr",
                },
            )
            self.assertEqual(user_res.status_code, 201)
            created_user = user_res.get_json()
            custom_user_id = created_user["id"]
            self.assertEqual(created_user["role"], "senior_mgr")
            self.assertEqual(created_user["role_name"], "Ведущий менеджер")
            self.assertTrue(created_user["permissions"]["manage_catalog"])

            # 5. Log in as the custom role user
            custom_login = self.client.post(
                "/api/auth/login",
                json={"email": "senior_mgr_test@print.local", "password": "password123"},
            )
            self.assertEqual(custom_login.status_code, 200)
            custom_token = custom_login.get_json()["token"]
            custom_headers = {"Authorization": f"Bearer {custom_token}"}

            # Can read /api/admin/data (because manage_catalog=True)
            admin_data_res = self.client.get("/api/admin/data", headers=custom_headers)
            self.assertEqual(admin_data_res.status_code, 200)

            # Cannot manage users or roles (because manage_users=False)
            users_forbidden = self.client.get("/api/admin/users", headers=custom_headers)
            self.assertEqual(users_forbidden.status_code, 403)
            roles_forbidden = self.client.get("/api/admin/roles", headers=custom_headers)
            self.assertEqual(roles_forbidden.status_code, 403)

            # 6. Cannot delete system roles 'admin' or 'client'
            del_admin_role = self.client.delete("/api/admin/roles/admin", headers=adm_headers)
            self.assertEqual(del_admin_role.status_code, 400)
            del_client_role = self.client.delete("/api/admin/roles/client", headers=adm_headers)
            self.assertEqual(del_client_role.status_code, 400)

            # 7. Delete custom role 'senior_mgr' -> user is automatically reassigned to 'client'
            del_custom_role = self.client.delete("/api/admin/roles/senior_mgr", headers=adm_headers)
            self.assertEqual(del_custom_role.status_code, 200)

            users_list_after = self.client.get("/api/admin/users", headers=adm_headers).get_json()
            reassigned_user = next(u for u in users_list_after if u["id"] == custom_user_id)
            self.assertEqual(reassigned_user["role"], "client")
        finally:
            if custom_user_id is not None:
                self.client.delete(f"/api/admin/users/{custom_user_id}", headers=adm_headers)
            self.client.delete("/api/admin/roles/senior_mgr", headers=adm_headers)

    def test_shared_cart_create_and_public_open(self):
        from storage import load_data, save_data, SHARED_CART_TTL_SECONDS

        # 1. Create shared cart with tampered unitPrice/totalPrice and unauthorized discountPercent
        payload = {
            "items": [
                {
                    "productId": 301,
                    "productName": "Стандартная (90 × 50 мм)",
                    "categoryName": "Визитки",
                    "formatLabel": "90 × 50 мм",
                    "paperId": 21,
                    "paperLabel": "Плотная матовая бумага 300 г/м²",
                    "printSides": 2,
                    "printLabel": "Двусторонняя (4+4)",
                    "laminationSides": 0,
                    "laminationLabel": "Нет",
                    "extraParamsLabel": "Нет",
                    "quantity": 200,
                    "unitPrice": 0.01,
                    "totalPrice": 2.0,
                }
            ],
            "meta": {
                "customerName": "ООО Публичная Корзина",
                "comment": "Проверка ссылки",
                "discountPercent": 50,
            },
        }
        try:
            create_res = self.client.post(
                "/api/shared-carts",
                json=payload,
                environ_base={"REMOTE_ADDR": "10.66.1.1"},
            )
            self.assertEqual(create_res.status_code, 201)
            created = create_res.get_json()
            token = created["token"]
            self.assertRegex(token, r"^[a-f0-9]{32}$")
            self.assertEqual(created["path"], f"/cart?share={token}")
            # Discount must be reset to 0 for unauthenticated user
            self.assertEqual(created["meta"]["discountPercent"], 0.0)
            # Server must recalculate real price (not 2.0)
            self.assertGreater(created["items"][0]["totalPrice"], 100.0)
            self.assertGreater(created["items"][0]["unitPrice"], 0.5)
            self.assertNotIn("_internal_cost", created["items"][0])
            self.assertNotIn("internal_metrics", created)

            # 2. Second request with same cart composition returns a distinct CSPRNG token (4.4)
            second_res = self.client.post(
                "/api/shared-carts",
                json=payload,
                environ_base={"REMOTE_ADDR": "10.66.1.1"},
            )
            self.assertEqual(second_res.status_code, 201)
            second_token = second_res.get_json()["token"]
            self.assertRegex(second_token, r"^[a-f0-9]{32}$")
            self.assertNotEqual(second_token, token)

            # 3. Unauthenticated visitor fetches GET /api/shared-carts/<token>
            get_res = self.client.get(f"/api/shared-carts/{token}")
            self.assertEqual(get_res.status_code, 200)
            fetched = get_res.get_json()
            self.assertEqual(fetched["token"], token)
            self.assertEqual(len(fetched["items"]), 1)
            self.assertEqual(fetched["items"][0]["totalPrice"], created["items"][0]["totalPrice"])
            self.assertNotIn("_internal_cost", fetched["items"][0])
            self.assertNotIn("internal_metrics", fetched)

            # 4. Verify 7-day TTL (604800s) and physical deletion upon expiration
            import time
            from datetime import datetime, timezone

            self.assertEqual(SHARED_CART_TTL_SECONDS, 7 * 24 * 3600)
            data = load_data()
            stored_entry = next(
                (c for c in data.get("shared_carts", []) if c.get("token") == token),
                None,
            )
            self.assertIsNotNone(stored_entry)
            self.assertIn("expires_at_ts", stored_entry)
            self.assertIn("expires_at", stored_entry)

            # Shift expiration into the past (older than 7 days)
            past_ts = time.time() - (SHARED_CART_TTL_SECONDS + 60)
            past_iso = datetime.fromtimestamp(past_ts, timezone.utc).isoformat()
            stored_entry["created_at"] = past_iso
            stored_entry["expires_at_ts"] = time.time() - 60
            stored_entry["expires_at"] = datetime.fromtimestamp(
                time.time() - 60, timezone.utc
            ).isoformat()
            save_data(data)

            expired_res = self.client.get(f"/api/shared-carts/{token}")
            self.assertEqual(expired_res.status_code, 404)
            self.assertIn("7 дней", expired_res.get_json().get("error", ""))

            # Ensure expired record was physically deleted from database.json
            after_data = load_data()
            remaining_tokens = [
                c.get("token") for c in after_data.get("shared_carts", []) if isinstance(c, dict)
            ]
            self.assertNotIn(token, remaining_tokens)

            # 5. Non-existent or invalid token returns 404
            missing_res = self.client.get("/api/shared-carts/0000000000000000")
            self.assertEqual(missing_res.status_code, 404)
            bad_token_res = self.client.get("/api/shared-carts/not-a-valid-hex-token!")
            self.assertEqual(bad_token_res.status_code, 404)
        finally:
            data = load_data()
            if "shared_carts" in data:
                data.pop("shared_carts", None)
                save_data(data)

    def test_role_allowed_order_statuses_enforcement(self):
        import time

        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
            environ_base={"REMOTE_ADDR": "10.99.8.1"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_data = prod_login.get_json()
        prod_token = prod_data["token"]
        self.assertEqual(
            prod_data["user"]["allowed_order_statuses"],
            ["prepress", "in_progress", "ready", "completed"],
        )

        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
            environ_base={"REMOTE_ADDR": "10.99.8.2"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_token = mgr_login.get_json()["token"]

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.8.3"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        test_email = f"status_perm_{int(time.time() * 1000)}@example.com"
        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "name": "ООО Статусы",
                "email": test_email,
                "password": "clientpassword123",
            },
            environ_base={"REMOTE_ADDR": "10.99.8.4"},
        )
        self.assertIn(reg_resp.status_code, (200, 201))
        client_token = reg_resp.get_json()["token"]
        client_user_id = reg_resp.get_json()["user"]["id"]

        created_order_id = None
        try:
            order_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "ООО Статусы",
                    "client_phone": "+7 (999) 555-44-33",
                    "client_email": test_email,
                    "comment": "Тест доступов к статусам",
                    "items": [
                        {
                            "id": "item-st-1",
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 100,
                            "formatLabel": "90 × 50 мм",
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(order_resp.status_code, 201)
            created_order_id = order_resp.get_json()["id"]

            # 1. Production by default cannot set status 'cancelled' or 'awaiting_payment' -> 403
            forbidden_cancel = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "cancelled"},
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(forbidden_cancel.status_code, 403)

            forbidden_pay_status = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "awaiting_payment"},
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(forbidden_pay_status.status_code, 403)

            # 2. Production can set status 'in_progress' and 'ready' -> 200
            ok_in_progress = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "in_progress"},
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(ok_in_progress.status_code, 200)
            self.assertEqual(ok_in_progress.get_json()["status"], "in_progress")

            ok_ready = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "ready"},
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(ok_ready.status_code, 200)
            self.assertEqual(ok_ready.get_json()["status"], "ready")

            # 3. Admin restricts production to only ['in_progress'] via PUT /api/admin/roles/production
            restrict_res = self.client.put(
                "/api/admin/roles/production",
                json={"allowed_order_statuses": ["in_progress"]},
                headers=adm_headers,
            )
            self.assertEqual(restrict_res.status_code, 200)
            self.assertEqual(restrict_res.get_json()["allowed_order_statuses"], ["in_progress"])

            # Now production cannot set 'completed' -> 403
            forbidden_completed = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "completed"},
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(forbidden_completed.status_code, 403)

            # 4. Assign order to manager, then Manager can set 'cancelled' -> 200
            self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"manager_id": mgr_login.get_json()["user"]["id"]},
                headers=adm_headers,
            )
            mgr_cancel = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "cancelled"},
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_cancel.status_code, 200)
            self.assertEqual(mgr_cancel.get_json()["status"], "cancelled")
        finally:
            self.client.put(
                "/api/admin/roles/production",
                json={
                    "allowed_order_statuses": [
                        "prepress",
                        "in_progress",
                        "ready",
                        "completed",
                    ]
                },
                headers=adm_headers,
            )
            if created_order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{created_order_id}",
                    headers=adm_headers,
                )
            if client_user_id is not None:
                self.client.delete(
                    f"/api/admin/users/{client_user_id}",
                    headers=adm_headers,
                )

    def test_crm_manager_own_orders_and_view_all_orders_permission(self):
        import time

        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
            environ_base={"REMOTE_ADDR": "10.99.9.1"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_token = prod_login.get_json()["token"]

        mgr_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
            environ_base={"REMOTE_ADDR": "10.99.9.2"},
        )
        self.assertEqual(mgr_login.status_code, 200)
        mgr_data = mgr_login.get_json()
        mgr_token = mgr_data["token"]
        mgr_user_id = mgr_data["user"]["id"]

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.9.3"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        test_email = f"client_vis_{int(time.time() * 1000)}@example.com"
        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "name": "ООО Видимость",
                "email": test_email,
                "password": "clientpassword123",
            },
            environ_base={"REMOTE_ADDR": "10.99.9.4"},
        )
        self.assertIn(reg_resp.status_code, (200, 201))
        client_token = reg_resp.get_json()["token"]
        client_user_id = reg_resp.get_json()["user"]["id"]

        order_m_id = None
        order_c_id = None
        try:
            # 1. Manager creates Order M, Client creates Order C
            resp_m = self.client.post(
                "/api/orders",
                json={
                    "client_name": "Клиент Менеджера",
                    "client_phone": "+7 (999) 111-22-33",
                    "items": [
                        {
                            "id": "item-m-1",
                            "productId": 301,
                            "productName": "Визитка Менеджера",
                            "quantity": 100,
                            "formatLabel": "90 × 50 мм",
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(resp_m.status_code, 201)
            order_m = resp_m.get_json()
            order_m_id = order_m["id"]
            self.assertEqual(order_m["manager_id"], mgr_user_id)
            self.assertTrue(bool(order_m.get("manager_name")))

            resp_c = self.client.post(
                "/api/orders",
                json={
                    "client_name": "Самостоятельный Клиент",
                    "client_phone": "+7 (999) 444-55-66",
                    "items": [
                        {
                            "id": "item-c-1",
                            "productId": 301,
                            "productName": "Визитка Клиента",
                            "quantity": 100,
                            "formatLabel": "90 × 50 мм",
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                headers={"Authorization": f"Bearer {client_token}"},
            )
            self.assertEqual(resp_c.status_code, 201)
            order_c = resp_c.get_json()
            order_c_id = order_c["id"]
            self.assertIsNone(order_c.get("manager_id"))
            self.assertEqual(order_c.get("manager_name"), "")

            # 2. Unassigned client Order C is visible to all managers along with own Order M
            mgr_unassigned_list_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_unassigned_list_resp.status_code, 200)
            mgr_unassigned_ids = [o["id"] for o in mgr_unassigned_list_resp.get_json()]
            self.assertIn(order_m_id, mgr_unassigned_ids)
            self.assertIn(order_c_id, mgr_unassigned_ids)

            # Once Order C is assigned to another staff member (e.g. admin), manager (view_all_orders=False)
            # sees Order M and does NOT see Order C.
            adm_user_id = adm_login.get_json()["user"]["id"]
            assign_other_resp = self.client.put(
                f"/api/crm/orders/{order_c_id}",
                json={"manager_id": adm_user_id},
                headers=adm_headers,
            )
            self.assertEqual(assign_other_resp.status_code, 200)

            mgr_list_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_list_resp.status_code, 200)
            mgr_orders = mgr_list_resp.get_json()
            mgr_ids = [o["id"] for o in mgr_orders]
            self.assertIn(order_m_id, mgr_ids)
            self.assertNotIn(order_c_id, mgr_ids)
            mgr_order_m = next(o for o in mgr_orders if o["id"] == order_m_id)
            self.assertEqual(mgr_order_m["manager_id"], mgr_user_id)
            self.assertTrue(bool(mgr_order_m.get("manager_name")))

            # 3. Attempt by manager to PUT /api/crm/orders/<Order C id> (assigned to another manager) returns 403
            mgr_put_foreign = self.client.put(
                f"/api/crm/orders/{order_c_id}",
                json={"status": "in_progress"},
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_put_foreign.status_code, 403)

            # 4. Production (view_all_orders=True) and Admin see both Order M and Order C
            prod_list_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {prod_token}"},
            )
            self.assertEqual(prod_list_resp.status_code, 200)
            prod_ids = [o["id"] for o in prod_list_resp.get_json()]
            self.assertIn(order_m_id, prod_ids)
            self.assertIn(order_c_id, prod_ids)

            adm_list_resp = self.client.get(
                "/api/crm/orders",
                headers=adm_headers,
            )
            self.assertEqual(adm_list_resp.status_code, 200)
            adm_ids = [o["id"] for o in adm_list_resp.get_json()]
            self.assertIn(order_m_id, adm_ids)
            self.assertIn(order_c_id, adm_ids)

            # 5. Admin enables "view_all_orders": True for manager via PUT /api/admin/settings
            enable_all_resp = self.client.put(
                "/api/admin/settings",
                json={"role_permissions": {"manager": {"view_all_orders": True}}},
                headers=adm_headers,
            )
            self.assertEqual(enable_all_resp.status_code, 200)

            mgr_list_all_resp = self.client.get(
                "/api/crm/orders",
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_list_all_resp.status_code, 200)
            mgr_all_ids = [o["id"] for o in mgr_list_all_resp.get_json()]
            self.assertIn(order_m_id, mgr_all_ids)
            self.assertIn(order_c_id, mgr_all_ids)

            mgr_put_ok = self.client.put(
                f"/api/crm/orders/{order_c_id}",
                json={"status": "in_progress"},
                headers={"Authorization": f"Bearer {mgr_token}"},
            )
            self.assertEqual(mgr_put_ok.status_code, 200)
            self.assertEqual(mgr_put_ok.get_json()["status"], "in_progress")
        finally:
            self.client.put(
                "/api/admin/settings",
                json={"role_permissions": {"manager": {"view_all_orders": False}}},
                headers=adm_headers,
            )
            for oid in (order_m_id, order_c_id):
                if oid is not None:
                    self.client.delete(f"/api/crm/orders/{oid}", headers=adm_headers)
            if client_user_id is not None:
                self.client.delete(
                    f"/api/admin/users/{client_user_id}",
                    headers=adm_headers,
                )

    def test_user_account_personal_and_product_specific_discounts(self):
        import time

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.10.1"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        test_email = f"client_disc_{int(time.time() * 1000)}@example.com"
        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "name": "ООО Персональная Скидка",
                "email": test_email,
                "password": "clientpassword123",
            },
            environ_base={"REMOTE_ADDR": "10.99.10.2"},
        )
        self.assertIn(reg_resp.status_code, (200, 201))
        reg_data = reg_resp.get_json()
        client_token = reg_data["token"]
        client_id = reg_data["user"]["id"]
        client_headers = {"Authorization": f"Bearer {client_token}"}

        created_order_id = None
        try:
            # 2. Admin configures 20% discount for client on category "business_cards" and product 101
            upd_resp = self.client.put(
                f"/api/admin/users/{client_id}",
                json={
                    "discount_percent": 20,
                    "discount_scope": "selected",
                    "discount_categories": ["business_cards"],
                    "discount_products": [101],
                },
                headers=adm_headers,
            )
            self.assertEqual(upd_resp.status_code, 200)
            upd_user = upd_resp.get_json()
            self.assertEqual(upd_user["discount_percent"], 20.0)
            self.assertEqual(upd_user["discount_scope"], "selected")
            self.assertEqual(upd_user["discount_categories"], ["business_cards"])
            self.assertEqual(upd_user["discount_products"], [101])

            # 3. Verify POST /api/calculate without token vs with client token
            # Product 301 (category "business_cards")
            anon_301 = self.client.post(
                "/api/calculate",
                json={"product_id": 301, "quantity": 200, "print_sides": 2},
            ).get_json()
            self.assertEqual(anon_301["discount_percent"], 0.0)
            self.assertEqual(anon_301["client_price"], anon_301["original_client_price"])

            disc_301 = self.client.post(
                "/api/calculate",
                json={"product_id": 301, "quantity": 200, "print_sides": 2},
                headers=client_headers,
            ).get_json()
            self.assertEqual(disc_301["discount_percent"], 20.0)
            self.assertEqual(disc_301["original_client_price"], anon_301["client_price"])
            self.assertLess(disc_301["client_price"], disc_301["original_client_price"])

            # Product 101 (explicitly in discount_products)
            disc_101 = self.client.post(
                "/api/calculate",
                json={"product_id": 101, "quantity": 200, "print_sides": 2},
                headers=client_headers,
            ).get_json()
            self.assertEqual(disc_101["discount_percent"], 20.0)
            self.assertLess(disc_101["client_price"], disc_101["original_client_price"])

            # Product 103 (category "flyers", not in discount list)
            disc_103 = self.client.post(
                "/api/calculate",
                json={"product_id": 103, "quantity": 200, "print_sides": 2},
                headers=client_headers,
            ).get_json()
            self.assertEqual(disc_103["discount_percent"], 0.0)
            self.assertEqual(disc_103["client_price"], disc_103["original_client_price"])

            # 4. Attempt by client to escalate discount_percent=80 via PUT /api/auth/profile is ignored
            prof_hack = self.client.put(
                "/api/auth/profile",
                json={"name": "ООО Персональная Скидка", "discount_percent": 80, "discount_scope": "all"},
                headers=client_headers,
            )
            self.assertEqual(prof_hack.status_code, 200)
            prof_user = prof_hack.get_json()["user"]
            self.assertEqual(prof_user["discount_percent"], 20.0)
            self.assertEqual(prof_user["discount_scope"], "selected")

            # 5. POST /api/orders from client with product 301 (discounted) and product 103 (base price)
            order_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "ООО Персональная Скидка",
                    "client_phone": "+7 (999) 777-66-55",
                    "items": [
                        {
                            "id": "item-301",
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 200,
                            "printSides": 2,
                        },
                        {
                            "id": "item-103",
                            "productId": 103,
                            "productName": "A5 (148 × 210 мм)",
                            "quantity": 200,
                            "printSides": 2,
                        },
                    ],
                },
                headers=client_headers,
            )
            self.assertEqual(order_resp.status_code, 201)
            created_order = order_resp.get_json()
            created_order_id = created_order["id"]
            item_301 = next(it for it in created_order["items"] if it["productId"] == 301)
            item_103 = next(it for it in created_order["items"] if it["productId"] == 103)
            self.assertEqual(item_301["totalPrice"], disc_301["client_price"])
            self.assertLess(item_301["totalPrice"], anon_301["client_price"])
            self.assertEqual(item_103["totalPrice"], disc_103["client_price"])
        finally:
            if created_order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{created_order_id}",
                    headers=adm_headers,
                )
            if client_id is not None:
                self.client.delete(
                    f"/api/admin/users/{client_id}",
                    headers=adm_headers,
                )

    def test_crm_notifications_by_role_scope_and_mark_read(self):
        import time

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.11.1"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        mgr1_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
            environ_base={"REMOTE_ADDR": "10.99.11.2"},
        )
        self.assertEqual(mgr1_login.status_code, 200)
        mgr1_token = mgr1_login.get_json()["token"]
        mgr1_headers = {"Authorization": f"Bearer {mgr1_token}"}

        prod_login = self.client.post(
            "/api/auth/login",
            json={"email": "production@print.local", "password": "prod1234"},
            environ_base={"REMOTE_ADDR": "10.99.11.3"},
        )
        self.assertEqual(prod_login.status_code, 200)
        prod_token = prod_login.get_json()["token"]
        prod_headers = {"Authorization": f"Bearer {prod_token}"}

        mgr2_email = f"mgr2_notif_{int(time.time() * 1000)}@print.local"
        create_mgr2 = self.client.post(
            "/api/admin/users",
            json={
                "first_name": "Ольга",
                "last_name": "Волкова",
                "email": mgr2_email,
                "password": "mgr2password123",
                "role": "manager",
            },
            headers=adm_headers,
        )
        self.assertEqual(create_mgr2.status_code, 201)
        mgr2_id = create_mgr2.get_json()["id"]

        mgr2_login = self.client.post(
            "/api/auth/login",
            json={"email": mgr2_email, "password": "mgr2password123"},
            environ_base={"REMOTE_ADDR": "10.99.11.4"},
        )
        self.assertEqual(mgr2_login.status_code, 200)
        mgr2_token = mgr2_login.get_json()["token"]
        mgr2_headers = {"Authorization": f"Bearer {mgr2_token}"}

        created_order_id = None
        try:
            # 2) Manager 1 creates a new order (status="new")
            order_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "ООО Нотификации",
                    "client_phone": "+7 (999) 222-33-44",
                    "items": [
                        {
                            "id": "item-notif-1",
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 100,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                headers=mgr1_headers,
                environ_base={"REMOTE_ADDR": "10.99.11.5"},
            )
            self.assertEqual(order_resp.status_code, 201)
            created_order_id = order_resp.get_json()["id"]

            # 3) Production does NOT receive notification while order is in status="new"
            prod_notif_initial = self.client.get(
                "/api/crm/notifications",
                headers=prod_headers,
            )
            self.assertEqual(prod_notif_initial.status_code, 200)
            prod_notif_initial_json = prod_notif_initial.get_json()
            self.assertFalse(
                any(
                    n["order_id"] == created_order_id
                    for n in prod_notif_initial_json["notifications"]
                )
            )

            # 4) Manager 1 moves order to status "in_progress"
            move_in_prog = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "in_progress"},
                headers=mgr1_headers,
            )
            self.assertEqual(move_in_prog.status_code, 200)

            # 5) Production now sees unread notification for this order (status "in_progress" is in production's scope)
            prod_notif_after = self.client.get(
                "/api/crm/notifications",
                headers=prod_headers,
            )
            self.assertEqual(prod_notif_after.status_code, 200)
            prod_notif_data = prod_notif_after.get_json()
            self.assertGreaterEqual(prod_notif_data["unread_count"], 1)
            prod_order_notifs = [
                n for n in prod_notif_data["notifications"] if n["order_id"] == created_order_id
            ]
            self.assertEqual(len(prod_order_notifs), 1)
            self.assertEqual(prod_order_notifs[0]["status"], "in_progress")
            self.assertFalse(prod_order_notifs[0]["is_read"])

            # 6) Second manager (without view_all_orders) does NOT receive notifications for Manager 1's order
            mgr2_notif = self.client.get(
                "/api/crm/notifications",
                headers=mgr2_headers,
            )
            self.assertEqual(mgr2_notif.status_code, 200)
            mgr2_notif_data = mgr2_notif.get_json()
            self.assertFalse(
                any(
                    n["order_id"] == created_order_id
                    for n in mgr2_notif_data["notifications"]
                )
            )

            # 7) Production marks all notifications as read -> unread_count becomes 0
            mark_read_resp = self.client.post(
                "/api/crm/notifications/read",
                json={"mark_all": True},
                headers=prod_headers,
            )
            self.assertEqual(mark_read_resp.status_code, 200)
            self.assertEqual(mark_read_resp.get_json()["unread_count"], 0)

            # 8) Production moves order to status "ready" ("Готов к выдаче") -> Manager 1 gets unread notification
            move_ready = self.client.put(
                f"/api/crm/orders/{created_order_id}",
                json={"status": "ready"},
                headers=prod_headers,
            )
            self.assertEqual(move_ready.status_code, 200)

            mgr1_notif = self.client.get(
                "/api/crm/notifications",
                headers=mgr1_headers,
            )
            self.assertEqual(mgr1_notif.status_code, 200)
            mgr1_notif_data = mgr1_notif.get_json()
            self.assertGreaterEqual(mgr1_notif_data["unread_count"], 1)
            ready_notifs = [
                n
                for n in mgr1_notif_data["notifications"]
                if n["order_id"] == created_order_id and n["status"] == "ready"
            ]
            self.assertEqual(len(ready_notifs), 1)
            self.assertFalse(ready_notifs[0]["is_read"])
            self.assertIn("Готов к выдаче", ready_notifs[0]["message"])
        finally:
            if created_order_id is not None:
                self.client.delete(
                    f"/api/crm/orders/{created_order_id}",
                    headers=adm_headers,
                )
            if mgr2_id is not None:
                self.client.delete(
                    f"/api/admin/users/{mgr2_id}",
                    headers=adm_headers,
                )

    def test_crm_unassigned_client_orders_visible_to_all_managers_until_claimed(self):
        import time

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.12.1"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_token = adm_login.get_json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        mgr1_login = self.client.post(
            "/api/auth/login",
            json={"email": "manager@print.local", "password": "manager1234"},
            environ_base={"REMOTE_ADDR": "10.99.12.2"},
        )
        self.assertEqual(mgr1_login.status_code, 200)
        mgr1_data = mgr1_login.get_json()
        mgr1_token = mgr1_data["token"]
        mgr1_id = mgr1_data["user"]["id"]
        mgr1_headers = {"Authorization": f"Bearer {mgr1_token}"}

        mgr2_email = f"mgr2_claim_{int(time.time() * 1000)}@print.local"
        create_mgr2 = self.client.post(
            "/api/admin/users",
            json={
                "first_name": "Дмитрий",
                "last_name": "Орлов",
                "email": mgr2_email,
                "password": "mgr2password123",
                "role": "manager",
            },
            headers=adm_headers,
        )
        self.assertEqual(create_mgr2.status_code, 201)
        mgr2_id = create_mgr2.get_json()["id"]

        mgr2_login = self.client.post(
            "/api/auth/login",
            json={"email": mgr2_email, "password": "mgr2password123"},
            environ_base={"REMOTE_ADDR": "10.99.12.3"},
        )
        self.assertEqual(mgr2_login.status_code, 200)
        mgr2_token = mgr2_login.get_json()["token"]
        mgr2_headers = {"Authorization": f"Bearer {mgr2_token}"}

        client_email = f"client_claim_{int(time.time() * 1000)}@example.com"
        reg_client = self.client.post(
            "/api/auth/register",
            json={
                "name": "Клиент Свободный Заказ",
                "email": client_email,
                "password": "clientpassword123",
            },
            environ_base={"REMOTE_ADDR": "10.99.12.4"},
        )
        self.assertIn(reg_client.status_code, (200, 201))
        client_token = reg_client.get_json()["token"]
        client_id = reg_client.get_json()["user"]["id"]
        client_headers = {"Authorization": f"Bearer {client_token}"}

        staff_order_id = None
        client_order_id = None
        try:
            # 1) Manager 1 creates an order -> immediately assigned to Manager 1, NOT visible to Manager 2
            staff_order_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "Прямой заказ Менеджера 1",
                    "client_phone": "+7 (999) 100-10-10",
                    "items": [
                        {
                            "id": "item-staff-1",
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 100,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                headers=mgr1_headers,
                environ_base={"REMOTE_ADDR": "10.99.12.5"},
            )
            self.assertEqual(staff_order_resp.status_code, 201)
            staff_order = staff_order_resp.get_json()
            staff_order_id = staff_order["id"]
            self.assertEqual(staff_order["manager_id"], mgr1_id)

            mgr2_list_1 = self.client.get("/api/crm/orders", headers=mgr2_headers)
            self.assertEqual(mgr2_list_1.status_code, 200)
            self.assertNotIn(staff_order_id, [o["id"] for o in mgr2_list_1.get_json()])

            # 2) Client creates an order -> unassigned (manager_id is None) and visible to BOTH Manager 1 and Manager 2
            client_order_resp = self.client.post(
                "/api/orders",
                json={
                    "client_name": "Клиент с сайта",
                    "client_phone": "+7 (999) 200-20-20",
                    "items": [
                        {
                            "id": "item-client-1",
                            "productId": 301,
                            "productName": "Стандартная (90 × 50 мм)",
                            "quantity": 100,
                            "paperId": 21,
                            "printSides": 2,
                        }
                    ],
                },
                headers=client_headers,
                environ_base={"REMOTE_ADDR": "10.99.12.6"},
            )
            self.assertEqual(client_order_resp.status_code, 201)
            client_order = client_order_resp.get_json()
            client_order_id = client_order["id"]
            self.assertIsNone(client_order.get("manager_id"))

            mgr1_before = self.client.get("/api/crm/orders", headers=mgr1_headers)
            self.assertEqual(mgr1_before.status_code, 200)
            self.assertIn(client_order_id, [o["id"] for o in mgr1_before.get_json()])

            mgr2_before = self.client.get("/api/crm/orders", headers=mgr2_headers)
            self.assertEqual(mgr2_before.status_code, 200)
            self.assertIn(client_order_id, [o["id"] for o in mgr2_before.get_json()])

            # 3) Manager 1 claims the unassigned client order
            claim_resp = self.client.post(
                f"/api/crm/orders/{client_order_id}/claim",
                headers=mgr1_headers,
            )
            self.assertEqual(claim_resp.status_code, 200)
            claimed_data = claim_resp.get_json()
            self.assertEqual(claimed_data["manager_id"], mgr1_id)
            self.assertTrue(bool(claimed_data.get("manager_name")))

            # 4) After claim: Manager 1 still sees the order, Manager 2 no longer sees it
            mgr1_after = self.client.get("/api/crm/orders", headers=mgr1_headers)
            self.assertEqual(mgr1_after.status_code, 200)
            self.assertIn(client_order_id, [o["id"] for o in mgr1_after.get_json()])

            mgr2_after = self.client.get("/api/crm/orders", headers=mgr2_headers)
            self.assertEqual(mgr2_after.status_code, 200)
            self.assertNotIn(client_order_id, [o["id"] for o in mgr2_after.get_json()])

            # 5) Manager 2 attempting to claim an already-claimed order gets 409 Conflict
            claim_conflict = self.client.post(
                f"/api/crm/orders/{client_order_id}/claim",
                headers=mgr2_headers,
            )
            self.assertEqual(claim_conflict.status_code, 409)

            # 6) Manager 1 saves a comment on the order -> comment_author_id and comment_author_name are recorded
            comment_resp = self.client.put(
                f"/api/crm/orders/{client_order_id}",
                json={"comment": "Срочная печать на плотной бумаге"},
                headers=mgr1_headers,
            )
            self.assertEqual(comment_resp.status_code, 200)
            comment_data = comment_resp.get_json()
            self.assertEqual(comment_data["comment"], "Срочная печать на плотной бумаге")
            self.assertEqual(comment_data["comment_author_id"], mgr1_id)
            self.assertTrue(bool(comment_data.get("comment_author_name")))
            self.assertTrue(bool(comment_data.get("comment_updated_at")))

            # 7) Manager 1 clears the comment -> comment and author metadata are cleared
            clear_comment_resp = self.client.put(
                f"/api/crm/orders/{client_order_id}",
                json={"comment": ""},
                headers=mgr1_headers,
            )
            self.assertEqual(clear_comment_resp.status_code, 200)
            cleared_comment_data = clear_comment_resp.get_json()
            self.assertEqual(cleared_comment_data["comment"], "")
            self.assertIsNone(cleared_comment_data["comment_author_id"])
            self.assertEqual(cleared_comment_data["comment_author_name"], "")
            self.assertEqual(cleared_comment_data["comment_updated_at"], "")
            self.assertEqual(cleared_comment_data["comments"], [])

            # 8) Manager 1 adds multiple comments and deletes a specific comment by id
            add_cmt_1 = self.client.put(
                f"/api/crm/orders/{client_order_id}",
                json={"add_comment": "Первый комментарий"},
                headers=mgr1_headers,
            )
            self.assertEqual(add_cmt_1.status_code, 200)
            cmt_data_1 = add_cmt_1.get_json()
            self.assertGreaterEqual(len(cmt_data_1["comments"]), 1)
            first_cmt_id = cmt_data_1["comments"][0]["id"]
            self.assertEqual(cmt_data_1["comments"][0]["text"], "Первый комментарий")
            self.assertEqual(cmt_data_1["comment"], "Первый комментарий")

            add_cmt_2 = self.client.put(
                f"/api/crm/orders/{client_order_id}",
                json={"add_comment": "Второй комментарий"},
                headers=mgr1_headers,
            )
            self.assertEqual(add_cmt_2.status_code, 200)
            cmt_data_2 = add_cmt_2.get_json()
            self.assertEqual(
                [c["text"] for c in cmt_data_2["comments"]],
                ["Первый комментарий", "Второй комментарий"],
            )
            self.assertEqual(cmt_data_2["comment"], "Второй комментарий")

            del_cmt_1 = self.client.put(
                f"/api/crm/orders/{client_order_id}",
                json={"delete_comment_id": first_cmt_id},
                headers=mgr1_headers,
            )
            self.assertEqual(del_cmt_1.status_code, 200)
            cmt_data_after_del = del_cmt_1.get_json()
            self.assertEqual([c["text"] for c in cmt_data_after_del["comments"]], ["Второй комментарий"])
            self.assertEqual(cmt_data_after_del["comment"], "Второй комментарий")
        finally:
            for oid in (staff_order_id, client_order_id):
                if oid is not None:
                    self.client.delete(f"/api/crm/orders/{oid}", headers=adm_headers)
            for uid in (mgr2_id, client_id):
                if uid is not None:
                    self.client.delete(f"/api/admin/users/{uid}", headers=adm_headers)

    def test_auth_login_register_rate_limit_and_recaptcha(self):
        # 1) Missing captcha_token when X-Require-Captcha: 1 is set -> 400
        login_missing_captcha = self.client.post(
            "/api/auth/login",
            headers={"X-Require-Captcha": "1"},
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.55.0.1"},
        )
        self.assertEqual(login_missing_captcha.status_code, 400)

        reg_missing_captcha = self.client.post(
            "/api/auth/register",
            headers={"X-Require-Captcha": "1"},
            json={
                "name": "Капча Тест",
                "email": "captcha_missing@example.com",
                "password": "password123",
            },
            environ_base={"REMOTE_ADDR": "10.55.0.2"},
        )
        self.assertEqual(reg_missing_captcha.status_code, 400)

        # 2) Invalid captcha_token -> 400
        login_bad_captcha = self.client.post(
            "/api/auth/login",
            headers={"X-Require-Captcha": "1"},
            json={
                "email": "admin@print.local",
                "password": "admin1234",
                "captcha_token": "invalid_captcha_token",
            },
            environ_base={"REMOTE_ADDR": "10.55.0.3"},
        )
        self.assertEqual(login_bad_captcha.status_code, 400)

        # 3) Valid captcha_token -> passes captcha check and logs in
        login_ok_captcha = self.client.post(
            "/api/auth/login",
            headers={"X-Require-Captcha": "1"},
            json={
                "email": "admin@print.local",
                "password": "admin1234",
                "captcha_token": "test_valid_token",
            },
            environ_base={"REMOTE_ADDR": "10.55.0.4"},
        )
        self.assertEqual(login_ok_captcha.status_code, 200)
        self.assertIn("token", login_ok_captcha.get_json())

        # 4) Register rate limit: 5 requests per minute per IP allowed, 6th returns 429
        for i in range(5):
            r = self.client.post(
                "/api/auth/register",
                json={"name": "Тест", "email": "bad-email", "password": "123"},
                environ_base={"REMOTE_ADDR": "10.55.1.1"},
            )
            self.assertEqual(r.status_code, 400)
        r_6th = self.client.post(
            "/api/auth/register",
            json={"name": "Тест", "email": "bad-email", "password": "123"},
            environ_base={"REMOTE_ADDR": "10.55.1.1"},
        )
        self.assertEqual(r_6th.status_code, 429)

        # 5) Login rate limit: 10 requests per minute per IP allowed, 11th returns 429
        for i in range(10):
            l_resp = self.client.post(
                "/api/auth/login",
                json={"email": "", "password": ""},
                environ_base={"REMOTE_ADDR": "10.55.1.2"},
            )
            self.assertEqual(l_resp.status_code, 400)
        l_11th = self.client.post(
            "/api/auth/login",
            json={"email": "", "password": ""},
            environ_base={"REMOTE_ADDR": "10.55.1.2"},
        )
        self.assertEqual(l_11th.status_code, 429)

    def test_argon2id_upgrade_password_policy_and_profile_current_password(self):
        import time
        from werkzeug.security import generate_password_hash
        from storage import save_data

        adm_headers = self._login_admin_headers("10.88.1.1")
        email = f"argon2_{int(time.time() * 1000)}@example.com"
        uid = None

        try:
            # 1) Password < 8 chars or > 128 chars rejected on register
            short_reg = self.client.post(
                "/api/auth/register",
                json={"name": "Короткий", "email": email, "password": "short12"},
                environ_base={"REMOTE_ADDR": "10.88.1.2"},
            )
            self.assertEqual(short_reg.status_code, 400)

            long_reg = self.client.post(
                "/api/auth/register",
                json={"name": "Длинный", "email": email, "password": "a" * 129},
                environ_base={"REMOTE_ADDR": "10.88.1.2"},
            )
            self.assertEqual(long_reg.status_code, 400)

            # 2) Valid registration stores $argon2id$ hash
            ok_reg = self.client.post(
                "/api/auth/register",
                json={"name": "Аргон Клиент", "email": email, "password": "StrongPassword123!"},
                environ_base={"REMOTE_ADDR": "10.88.1.3"},
            )
            self.assertEqual(ok_reg.status_code, 201)
            uid = ok_reg.get_json()["user"]["id"]
            user_token = ok_reg.get_json()["token"]
            user_headers = {"Authorization": f"Bearer {user_token}"}

            raw_data = load_data()
            stored_user = next(u for u in raw_data["users"] if u["id"] == uid)
            self.assertTrue(stored_user["password_hash"].startswith("$argon2id$"))

            # 3) Downgrade stored hash to legacy pbkdf2:sha256 and verify transparent upgrade on login
            stored_user["password_hash"] = generate_password_hash(
                "StrongPassword123!", method="pbkdf2:sha256"
            )
            save_data(raw_data)

            # Over-length password on login rejected fast without KDF crash
            overlong_login = self.client.post(
                "/api/auth/login",
                json={"email": email, "password": "x" * 5000},
                environ_base={"REMOTE_ADDR": "10.88.1.4"},
            )
            self.assertEqual(overlong_login.status_code, 401)

            relogin = self.client.post(
                "/api/auth/login",
                json={"email": email, "password": "StrongPassword123!"},
                environ_base={"REMOTE_ADDR": "10.88.1.4"},
            )
            self.assertEqual(relogin.status_code, 200)
            user_token = relogin.get_json()["token"]
            user_headers = {"Authorization": f"Bearer {user_token}"}

            upgraded_data = load_data()
            upgraded_user = next(u for u in upgraded_data["users"] if u["id"] == uid)
            self.assertTrue(upgraded_user["password_hash"].startswith("$argon2id$"))

            # 4) Profile Email change WITHOUT current_password -> 400 (3.4)
            new_email = f"updated_{email}"
            no_pw_email = self.client.put(
                "/api/auth/profile",
                headers=user_headers,
                json={"email": new_email},
            )
            self.assertEqual(no_pw_email.status_code, 400)

            wrong_pw_email = self.client.put(
                "/api/auth/profile",
                headers=user_headers,
                json={"email": new_email, "current_password": "WrongPassword999"},
            )
            self.assertEqual(wrong_pw_email.status_code, 400)

            ok_pw_email = self.client.put(
                "/api/auth/profile",
                headers=user_headers,
                json={"email": new_email, "current_password": "StrongPassword123!"},
            )
            self.assertEqual(ok_pw_email.status_code, 200)
            self.assertEqual(ok_pw_email.get_json()["user"]["email"], new_email)
        finally:
            if uid is not None:
                self.client.delete(f"/api/admin/users/{uid}", headers=adm_headers)

    def test_delegated_manage_users_privilege_escalation_and_db_import_guards(self):
        import time

        adm_headers = self._login_admin_headers("10.88.2.1")
        role_id = f"hr_lead_{int(time.time()) % 100000}"
        hr_uid = None

        try:
            # Create a custom non-admin role with ONLY manage_users=True (no delete_orders, no manage_catalog)
            create_role = self.client.post(
                "/api/admin/roles",
                headers=adm_headers,
                json={"id": role_id, "name": "HR Менеджер"},
            )
            self.assertEqual(create_role.status_code, 201)

            upd_role = self.client.put(
                f"/api/admin/roles/{role_id}",
                headers=adm_headers,
                json={"permissions": {"manage_users": True, "view_crm": True}},
            )
            self.assertEqual(upd_role.status_code, 200)

            create_hr = self.client.post(
                "/api/admin/users",
                headers=adm_headers,
                json={
                    "email": f"{role_id}@print.local",
                    "password": "HrPassword123!",
                    "role": role_id,
                    "first_name": "HR",
                },
            )
            self.assertEqual(create_hr.status_code, 201)
            hr_uid = create_hr.get_json()["id"]

            hr_login = self.client.post(
                "/api/auth/login",
                json={"email": f"{role_id}@print.local", "password": "HrPassword123!"},
                environ_base={"REMOTE_ADDR": "10.88.2.2"},
            )
            self.assertEqual(hr_login.status_code, 200)
            hr_headers = {"Authorization": f"Bearer {hr_login.get_json()['token']}"}

            # 1) Delegated HR cannot create an admin user (5.1)
            esc_admin = self.client.post(
                "/api/admin/users",
                headers=hr_headers,
                json={
                    "email": "evil_admin@print.local",
                    "password": "EvilPassword123!",
                    "role": "admin",
                },
            )
            self.assertEqual(esc_admin.status_code, 403)

            # 2) Delegated HR cannot grant permissions they do not possess (e.g., delete_orders) (5.1)
            esc_perm = self.client.put(
                f"/api/admin/roles/{role_id}",
                headers=hr_headers,
                json={"permissions": {"manage_users": True, "view_crm": True, "delete_orders": True}},
            )
            self.assertEqual(esc_perm.status_code, 403)

            # 3) Delegated HR cannot export or import full DB (4.3)
            self.assertEqual(
                self.client.get("/api/admin/db/export", headers=hr_headers).status_code,
                403,
            )
            self.assertEqual(
                self.client.post("/api/admin/db/import", headers=hr_headers, json={}).status_code,
                403,
            )

            # 4) Admin DB import rejects snapshot without an admin user or with plaintext password_hash (4.3)
            no_admin_import = self.client.post(
                "/api/admin/db/import",
                headers=adm_headers,
                json={
                    "users": [
                        {
                            "id": 1,
                            "email": "client@print.local",
                            "role": "client",
                            "password_hash": "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaGhhc2g",
                        }
                    ]
                },
            )
            self.assertEqual(no_admin_import.status_code, 400)

            bad_hash_import = self.client.post(
                "/api/admin/db/import",
                headers=adm_headers,
                json={
                    "users": [
                        {
                            "id": 1,
                            "email": "admin@print.local",
                            "role": "admin",
                            "password_hash": "plaintext_not_hashed",
                        }
                    ]
                },
            )
            self.assertEqual(bad_hash_import.status_code, 400)

            # 5) Shared cart GET rate limit blocks enumeration bursts (4.4)
            for _ in range(30):
                r = self.client.get(
                    "/api/shared-carts/00000000000000000000000000000000",
                    environ_base={"REMOTE_ADDR": "10.88.2.99"},
                )
                self.assertEqual(r.status_code, 404)
            r_limited = self.client.get(
                "/api/shared-carts/00000000000000000000000000000000",
                environ_base={"REMOTE_ADDR": "10.88.2.99"},
            )
            self.assertEqual(r_limited.status_code, 429)
        finally:
            if hr_uid is not None:
                self.client.delete(f"/api/admin/users/{hr_uid}", headers=adm_headers)
            self.client.delete(f"/api/admin/roles/{role_id}", headers=adm_headers)

    def test_priority1_kdf_concurrency_guard_and_shared_line_item_pricing(self):
        import uuid
        from concurrent.futures import ThreadPoolExecutor
        from unittest.mock import patch
        import app as app_module
        from storage import load_data, save_data

        adm_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.99.1.1"},
        )
        self.assertEqual(adm_login.status_code, 200)
        adm_headers = {"Authorization": f"Bearer {adm_login.get_json()['token']}"}

        test_email = f"p1_{uuid.uuid4().hex[:8]}@example.com"
        created_uid = None
        created_order_id = None
        try:
            reg = self.client.post(
                "/api/auth/register",
                json={"name": "P1 User", "email": test_email, "password": "Password123!"},
                environ_base={"REMOTE_ADDR": "10.99.1.2"},
            )
            self.assertEqual(reg.status_code, 201)
            user_token = reg.get_json()["token"]
            created_uid = reg.get_json()["user"]["id"]

            # 1) Grant a 15% personal discount to verify order vs shared-cart pricing distinction
            upd_disc = self.client.put(
                f"/api/admin/users/{created_uid}",
                headers=adm_headers,
                json={"discount_percent": 15, "discount_scope": "all"},
            )
            self.assertEqual(upd_disc.status_code, 200)

            # 2) Concurrent logins succeed cleanly without holding _DATA_LOCK during Argon2id KDF
            def _login_worker(idx: int) -> int:
                with app_module.app.test_client() as local_client:
                    r = local_client.post(
                        "/api/auth/login",
                        json={"email": test_email, "password": "Password123!"},
                        environ_base={"REMOTE_ADDR": f"10.99.2.{idx + 1}"},
                    )
                    return r.status_code

            with ThreadPoolExecutor(max_workers=4) as pool:
                statuses = list(pool.map(_login_worker, range(4)))
            self.assertEqual(statuses, [200, 200, 200, 200])

            # 3) TOCTOU guard: if token_version/password_hash mutates while KDF runs outside _DATA_LOCK,
            #    PUT /api/auth/profile aborts with 409 Conflict instead of clobbering concurrent changes.
            real_verify = app_module.verify_password

            def _mutating_verify(stored: str, pwd: str):
                res = real_verify(stored, pwd)
                with app_module._DATA_LOCK:
                    snap = load_data()
                    for u in snap.get("users", []):
                        if int(u.get("id", 0)) == created_uid:
                            u["token_version"] = int(u.get("token_version", 1) or 1) + 1
                            break
                    save_data(snap)
                return res

            with patch.object(app_module, "verify_password", side_effect=_mutating_verify):
                conflict_resp = self.client.put(
                    "/api/auth/profile",
                    headers={"Authorization": f"Bearer {user_token}"},
                    json={"current_password": "Password123!", "new_password": "NewPassword456!"},
                )
            self.assertEqual(conflict_resp.status_code, 409)

            # Re-login to obtain fresh token after simulated concurrent token_version bump
            fresh_login = self.client.post(
                "/api/auth/login",
                json={"email": test_email, "password": "Password123!"},
                environ_base={"REMOTE_ADDR": "10.99.1.3"},
            )
            self.assertEqual(fresh_login.status_code, 200)
            fresh_user_token = fresh_login.get_json()["token"]

            # 4) Shared _build_priced_line_items helper: compare shared-cart (public price + calc inputs)
            #    vs order (applies 15% personal user discount, strips _internal_cost from response)
            line_item_input = {
                "productId": 301,
                "productName": "Стандартная (90 × 50 мм)",
                "quantity": 200,
                "paperId": 21,
                "printSides": 2,
                "laminationSides": 0,
            }
            sc_resp = self.client.post(
                "/api/shared-carts",
                json={"items": [line_item_input]},
                environ_base={"REMOTE_ADDR": "10.99.1.4"},
            )
            self.assertEqual(sc_resp.status_code, 201)
            sc_tok = sc_resp.get_json()["token"]
            sc_data = self.client.get(
                f"/api/shared-carts/{sc_tok}",
                environ_base={"REMOTE_ADDR": "10.99.1.4"},
            ).get_json()
            sc_item = sc_data["items"][0]
            self.assertEqual(sc_item["paperId"], 21)
            self.assertEqual(sc_item["printSides"], 2)
            self.assertNotIn("_internal_cost", sc_item)
            public_total = sc_item["totalPrice"]
            self.assertGreater(public_total, 0)

            ord_resp = self.client.post(
                "/api/orders",
                headers={"Authorization": f"Bearer {fresh_user_token}"},
                json={"client_name": "P1 User", "items": [line_item_input]},
                environ_base={"REMOTE_ADDR": "10.99.1.5"},
            )
            self.assertEqual(ord_resp.status_code, 201)
            ord_json = ord_resp.get_json()
            created_order_id = ord_json["id"]
            ord_item = ord_json["items"][0]
            self.assertNotIn("_internal_cost", ord_item)
            self.assertLess(ord_item["totalPrice"], public_total)
        finally:
            if created_order_id is not None:
                self.client.delete(f"/api/crm/orders/{created_order_id}", headers=adm_headers)
            if created_uid is not None:
                self.client.delete(f"/api/admin/users/{created_uid}", headers=adm_headers)

    def test_strict_https_redirect_reject_hsts_cors_and_image_sanitizer(self):
        from unittest.mock import patch
        import app as app_module
        from storage import sanitize_image_url

        # 1) External http:// image URLs are rejected; https:// and /uploads/ are allowed
        self.assertEqual(sanitize_image_url("http://example.com/photo.jpg"), "")
        self.assertEqual(sanitize_image_url("//example.com/photo.jpg"), "")
        self.assertEqual(
            sanitize_image_url("https://cdn.example.com/photo.jpg"),
            "https://cdn.example.com/photo.jpg",
        )
        self.assertEqual(sanitize_image_url("/uploads/prod_1.png"), "/uploads/prod_1.png")

        # 2) CORS origin parser strips non-loopback http:// origins when force_https=True
        raw_origins = (
            "http://localhost:3000, http://insecure.example.ru, https://secure.example.ru/"
        )
        self.assertEqual(
            app_module.parse_allowed_origins(raw_origins, force_https=False),
            [
                "http://localhost:3000",
                "http://insecure.example.ru",
                "https://secure.example.ru",
            ],
        )
        self.assertEqual(
            app_module.parse_allowed_origins(raw_origins, force_https=True),
            ["http://localhost:3000", "https://secure.example.ru"],
        )

        # 3) Strict HTTPS request enforcement & HSTS / CSP headers
        with patch.dict(os.environ, {"PRINT_CALC_FORCE_HTTPS": "1"}):
            # 3a) Plain HTTP GET without Authorization -> 308 redirect to https://
            r_get = self.client.get(
                "/api/catalog?lang=ru",
                headers={"Host": "calc.example.ru"},
                environ_base={"REMOTE_ADDR": "203.0.113.10", "wsgi.url_scheme": "http"},
            )
            self.assertEqual(r_get.status_code, 308)
            self.assertEqual(
                r_get.headers.get("Location"), "https://calc.example.ru/api/catalog?lang=ru"
            )
            self.assertNotIn("Strict-Transport-Security", r_get.headers)

            # 3b) Open-redirect attempt via ///evil.example.com/phish path is collapsed to single /
            r_open_redir = self.client.get(
                "///evil.example.com/phish",
                headers={"Host": "calc.example.ru"},
                environ_base={"REMOTE_ADDR": "203.0.113.10", "wsgi.url_scheme": "http"},
            )
            self.assertEqual(r_open_redir.status_code, 308)
            self.assertEqual(
                r_open_redir.headers.get("Location"),
                "https://calc.example.ru/evil.example.com/phish",
            )

            # 3c) Host header injection attempt -> 400 Bad Request
            r_bad_host = self.client.get(
                "/api/catalog",
                headers={"Host": "evil.com/injected"},
                environ_base={"REMOTE_ADDR": "203.0.113.10", "wsgi.url_scheme": "http"},
            )
            self.assertEqual(r_bad_host.status_code, 400)

            # 3d) Plain HTTP POST or GET with Authorization -> 403 Forbidden (no redirect!)
            r_post = self.client.post(
                "/api/auth/login",
                json={"email": "admin@print.local", "password": "admin1234"},
                headers={"Host": "calc.example.ru"},
                environ_base={"REMOTE_ADDR": "203.0.113.10", "wsgi.url_scheme": "http"},
            )
            self.assertEqual(r_post.status_code, 403)
            self.assertIn("HTTPS", (r_post.get_json() or {}).get("error", ""))

            r_auth_get = self.client.get(
                "/api/auth/me",
                headers={"Host": "calc.example.ru", "Authorization": "Bearer secret-tok"},
                environ_base={"REMOTE_ADDR": "203.0.113.10", "wsgi.url_scheme": "http"},
            )
            self.assertEqual(r_auth_get.status_code, 403)

            # 3e) Loopback (127.0.0.1 / localhost) remains allowed for local dev & healthchecks
            r_loopback = self.client.get(
                "/api/catalog",
                headers={"Host": "127.0.0.1:5000"},
                environ_base={"REMOTE_ADDR": "127.0.0.1", "wsgi.url_scheme": "http"},
            )
            self.assertEqual(r_loopback.status_code, 200)
            self.assertNotIn("Strict-Transport-Security", r_loopback.headers)

            # 3f) HTTPS request succeeds and sets HSTS + upgrade-insecure-requests
            r_https = self.client.get(
                "/api/catalog",
                headers={"Host": "calc.example.ru"},
                base_url="https://calc.example.ru",
                environ_base={"REMOTE_ADDR": "203.0.113.10"},
            )
            self.assertEqual(r_https.status_code, 200)
            self.assertEqual(
                r_https.headers.get("Strict-Transport-Security"),
                "max-age=31536000; includeSubDomains",
            )
            self.assertIn(
                "upgrade-insecure-requests",
                r_https.headers.get("Content-Security-Policy", ""),
            )


class TestWideFormatSqmRollPricing(unittest.TestCase):
    def setUp(self):
        import app as flask_app_module
        from storage import replace_full_data

        self.app_mod = flask_app_module
        self.replace_full_data = replace_full_data
        self.snapshot = copy.deepcopy(load_data())
        self.client = flask_app_module.app.test_client()

        login_resp = self.client.post(
            "/api/auth/login",
            json={"email": "admin@print.local", "password": "admin1234"},
            environ_base={"REMOTE_ADDR": "10.88.0.1"},
        )
        self.assertEqual(login_resp.status_code, 200)
        self.adm_headers = {"Authorization": f"Bearer {login_resp.get_json()['token']}"}

    def tearDown(self):
        self.replace_full_data(self.snapshot)

    def test_apply_sqm_price_sets_roll_prices_by_group_and_category_and_drives_calculation(self):
        data_before = load_data()
        frontlit_before = next(
            i for i in data_before["items"] if i["category"] == "wf_banners" and i["resource"] == 160
        )
        laminated_before = next(
            i for i in data_before["items"] if i["category"] == "wf_banners" and i["resource"] == 80
        )
        film_before = next(
            i for i in data_before["items"] if i["category"] == "wf_banners" and i.get("group") == "Плёнка ПВХ"
        )
        canvas_before = next(
            i for i in data_before["items"] if i["category"] == "wf_banners" and abs(i["resource"] - 22.86) < 0.01
        )

        calc_before = self.client.post(
            "/api/calculate",
            json={
                "product_id": 2001,
                "paper_id": frontlit_before["id"],
                "width_mm": 2000,
                "height_mm": 1000,
                "quantity": 1,
                "selected_params": {"eyelets": False, "edge_gluing": False},
            },
            headers=self.adm_headers,
        )
        self.assertEqual(calc_before.status_code, 200)
        calc_before_json = calc_before.get_json()
        self.assertAlmostEqual(
            calc_before_json["internal"]["breakdown"]["paper_cost_per_m2"],
            round(frontlit_before["price"] / frontlit_before["resource"], 2),
            places=2,
        )

        # 1) Apply 150 ₽/м² ONLY to group "Баннерная ткань"
        apply_group_resp = self.client.post(
            "/api/admin/material-categories/wf_banners/apply-sqm-price",
            json={"price_per_m2": 150, "group": "Баннерная ткань"},
            headers=self.adm_headers,
        )
        self.assertEqual(apply_group_resp.status_code, 200)
        apply_group_json = apply_group_resp.get_json()
        self.assertEqual(apply_group_json["updated_count"], 2)
        self.assertEqual(
            apply_group_json["material_category"]["group_prices_per_m2"]["Баннерная ткань"],
            150.0,
        )

        data_after_group = load_data()
        frontlit_after = next(i for i in data_after_group["items"] if i["id"] == frontlit_before["id"])
        laminated_after = next(i for i in data_after_group["items"] if i["id"] == laminated_before["id"])
        film_after = next(i for i in data_after_group["items"] if i["id"] == film_before["id"])

        self.assertEqual(frontlit_after["price"], 24000.0)  # 150 * 160
        self.assertEqual(laminated_after["price"], 12000.0)  # 150 * 80
        self.assertEqual(film_after["price"], film_before["price"])  # untouched

        # Order calculation now uses 150 ₽/м²
        calc_after = self.client.post(
            "/api/calculate",
            json={
                "product_id": 2001,
                "paper_id": frontlit_before["id"],
                "width_mm": 2000,
                "height_mm": 1000,
                "quantity": 1,
                "selected_params": {"eyelets": False, "edge_gluing": False},
            },
            headers=self.adm_headers,
        )
        self.assertEqual(calc_after.status_code, 200)
        calc_after_json = calc_after.get_json()
        total_area = calc_after_json["internal"]["breakdown"]["total_area_m2"]
        self.assertEqual(calc_after_json["internal"]["breakdown"]["paper_cost_per_m2"], 150.0)
        self.assertAlmostEqual(
            calc_after_json["internal"]["breakdown"]["paper_cost"],
            round(total_area * 150.0, 2),
            places=1,
        )
        self.assertGreater(calc_after_json["client_price"], calc_before_json["client_price"])

        # 2) Adding a new roll in "Баннерная ткань" without explicit price auto-computes from 150 ₽/м²
        add_roll_resp = self.client.post(
            "/api/admin/items",
            json={
                "category": "wf_banners",
                "name": "Баннер литой 510 г/м² (рулон 2.5×50м)",
                "client_name": "Баннер литой 510 г/м²",
                "group": "Баннерная ткань",
                "resource": 125,
                "enable_for_categories": ["wf_banners_cat"],
            },
            headers=self.adm_headers,
        )
        self.assertEqual(add_roll_resp.status_code, 201)
        added_roll = add_roll_resp.get_json()
        self.assertEqual(added_roll["price"], 18750.0)  # 150 * 125
        self.assertEqual(added_roll["price_per_m2"], 150.0)

        # Updating roll area (resource) from 125 -> 100 m² recalculates roll price to 15000 ₽
        upd_roll_resp = self.client.put(
            f"/api/admin/items/{added_roll['id']}",
            json={"resource": 100, "price": added_roll["price"]},
            headers=self.adm_headers,
        )
        self.assertEqual(upd_roll_resp.status_code, 200)
        self.assertEqual(upd_roll_resp.get_json()["price"], 15000.0)

        # 3) Apply 135.5 ₽/м² to ALL rolls in wf_banners (including fractional 22.86 m² canvas)
        apply_all_resp = self.client.post(
            "/api/admin/material-categories/wf_banners/apply-sqm-price",
            json={"price_per_m2": 135.5, "group": "ALL"},
            headers=self.adm_headers,
        )
        self.assertEqual(apply_all_resp.status_code, 200)
        apply_all_json = apply_all_resp.get_json()
        self.assertGreaterEqual(apply_all_json["updated_count"], 6)

        data_after_all = load_data()
        canvas_after = next(i for i in data_after_all["items"] if i["id"] == canvas_before["id"])
        self.assertEqual(canvas_after["price"], 3097.53)  # round(135.5 * 22.86, 2)

        canvas_prod = next(
            p
            for p in data_after_all["products"]
            if canvas_before["id"] in (p.get("allowed_paper_ids") or [])
        )
        calc_canvas = self.client.post(
            "/api/calculate",
            json={
                "product_id": canvas_prod["id"],
                "paper_id": canvas_before["id"],
                "width_mm": 1000,
                "height_mm": 1000,
                "quantity": 1,
            },
            headers=self.adm_headers,
        )
        self.assertEqual(calc_canvas.status_code, 200)
        self.assertEqual(
            calc_canvas.get_json()["internal"]["breakdown"]["paper_cost_per_m2"],
            135.5,
        )


if __name__ == "__main__":
    unittest.main()



