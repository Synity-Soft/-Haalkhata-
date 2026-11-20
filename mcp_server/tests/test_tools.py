"""Unit and integration tests for Haalkhata MCP tools against the SQLite database."""

import unittest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from mcp_server.db import get_readonly_session
from mcp_server.tools import (
    execute_check_expiry,
    execute_get_business_insights,
    execute_get_customer_dues,
    execute_get_inventory,
    execute_get_low_stock,
    execute_get_sales_summary,
)


class TestReadOnlyEnforcement(unittest.TestCase):
    """Verify that the database connection is strictly read-only."""

    def test_insert_rejected(self):
        """INSERT operations must be rejected by PRAGMA query_only."""
        with self.assertRaises(OperationalError):
            with get_readonly_session() as session:
                session.execute(
                    text("INSERT INTO products (id, name, sku) VALUES ('TEST01', 'Test Item', 'SKU-TEST')")
                )
                session.commit()

    def test_update_rejected(self):
        """UPDATE operations must be rejected."""
        with self.assertRaises(OperationalError):
            with get_readonly_session() as session:
                session.execute(text("UPDATE products SET name = 'Hacked' WHERE id = 'PRD001'"))
                session.commit()

    def test_delete_rejected(self):
        """DELETE operations must be rejected."""
        with self.assertRaises(OperationalError):
            with get_readonly_session() as session:
                session.execute(text("DELETE FROM products WHERE id = 'PRD001'"))
                session.commit()

    def test_create_table_rejected(self):
        """DDL CREATE TABLE operations must be rejected."""
        with self.assertRaises(OperationalError):
            with get_readonly_session() as session:
                session.execute(text("CREATE TABLE hack_table (id INT)"))
                session.commit()


class TestGetInventory(unittest.TestCase):
    """Test get_inventory tool."""

    def test_default_inventory(self):
        result = execute_get_inventory(outlet_id="OUT001", limit=10)
        self.assertEqual(result["outlet_id"], "OUT001")
        self.assertLessEqual(len(result["items"]), 10)
        self.assertGreater(result["total_products_found"], 0)

        # Verify item fields
        item = result["items"][0]
        self.assertIn("product_id", item)
        self.assertIn("product_name", item)
        self.assertIn("available_quantity", item)
        self.assertIn("selling_price_bdt", item)
        # Verify currency is in BDT (positive float)
        self.assertGreater(item["selling_price_bdt"], 0)

    def test_search_existing_product(self):
        result = execute_get_inventory(outlet_id="OUT001", search_query="Rice", limit=5)
        for item in result["items"]:
            self.assertTrue(
                "rice" in item["product_name"].lower() or "rice" in (item["sku"] or "").lower()
            )

    def test_search_non_existent_product(self):
        result = execute_get_inventory(outlet_id="OUT001", search_query="NonExistentItem999XYZ")
        self.assertEqual(len(result["items"]), 0)
        self.assertEqual(result["total_products_found"], 0)

    def test_category_filter(self):
        result = execute_get_inventory(outlet_id="OUT001", category="Groceries", limit=5)
        for item in result["items"]:
            self.assertEqual(item["category"], "Groceries")

    def test_invalid_outlet(self):
        with self.assertRaises(ValueError):
            execute_get_inventory(outlet_id="OUT_DOES_NOT_EXIST_999")

    def test_pagination(self):
        page1 = execute_get_inventory(outlet_id="OUT001", limit=5, offset=0)
        page2 = execute_get_inventory(outlet_id="OUT001", limit=5, offset=5)
        self.assertEqual(len(page1["items"]), 5)
        self.assertEqual(len(page2["items"]), 5)
        p1_ids = [i["product_id"] for i in page1["items"]]
        p2_ids = [i["product_id"] for i in page2["items"]]
        # Ensure no overlap
        self.assertEqual(len(set(p1_ids).intersection(set(p2_ids))), 0)


class TestGetLowStock(unittest.TestCase):
    """Test get_low_stock tool."""

    def test_reorder_point_threshold(self):
        result = execute_get_low_stock(outlet_id="OUT001", threshold_type="reorder_point", limit=20)
        self.assertIn("items", result)
        self.assertIn("low_stock_count", result)
        for item in result["items"]:
            self.assertLessEqual(item["current_stock"], item["reorder_point"])
            self.assertGreater(item["deficit_quantity"], 0)
            self.assertIn(item["urgency_status"], ["CRITICAL_STOCKOUT", "LOW_STOCK"])

    def test_minimum_stock_threshold(self):
        result = execute_get_low_stock(outlet_id="OUT001", threshold_type="minimum_stock", limit=20)
        for item in result["items"]:
            self.assertLessEqual(item["current_stock"], item["minimum_stock_level"])

    def test_invalid_outlet(self):
        with self.assertRaises(ValueError):
            execute_get_low_stock(outlet_id="NON_EXISTENT_OUTLET")


class TestGetSalesSummary(unittest.TestCase):
    """Test get_sales_summary tool."""

    def test_sales_summary_valid_range(self):
        result = execute_get_sales_summary(
            start_date="2026-11-01",
            end_date="2026-11-15",
            outlet_id="OUT001",
            limit_top_products=5,
        )
        self.assertEqual(result["outlet_id"], "OUT001")
        self.assertGreater(result["total_sales_bdt"], 0)
        self.assertGreater(result["transaction_count"], 0)
        self.assertGreater(result["estimated_gross_profit_bdt"], 0)
        self.assertIn("payment_methods", result)
        self.assertIn("top_selling_products", result)
        self.assertLessEqual(len(result["top_selling_products"]), 5)

    def test_sales_all_outlets(self):
        result = execute_get_sales_summary(
            start_date="2026-11-01",
            end_date="2026-11-05",
            outlet_id=None,
        )
        self.assertIsNone(result["outlet_id"])
        self.assertGreater(result["total_sales_bdt"], 0)

    def test_sales_empty_future_range(self):
        result = execute_get_sales_summary(
            start_date="2099-01-01",
            end_date="2099-01-05",
            outlet_id="OUT001",
        )
        self.assertEqual(result["transaction_count"], 0)
        self.assertEqual(result["total_sales_bdt"], 0.0)

    def test_invalid_date_format(self):
        with self.assertRaises(ValueError):
            execute_get_sales_summary(start_date="invalid-date", end_date="2026-11-15")

    def test_start_date_after_end_date(self):
        with self.assertRaises(ValueError):
            execute_get_sales_summary(start_date="2026-11-20", end_date="2026-11-10")


class TestCheckExpiry(unittest.TestCase):
    """Test check_expiry tool."""

    def test_check_expiry_30_days(self):
        result = execute_check_expiry(
            outlet_id="OUT001",
            days_ahead=30,
            reference_date="2026-11-16",
            include_already_expired=True,
            limit=25,
        )
        self.assertIn("batches", result)
        self.assertIn("total_batches_at_risk", result)
        self.assertIn("already_expired_count", result)
        self.assertIn("urgent_clearance_count", result)

        for batch in result["batches"]:
            self.assertIn("urgency_status", batch)
            self.assertIn("recommended_clearance_action", batch)
            self.assertIn("days_remaining", batch)

    def test_exclude_already_expired(self):
        result = execute_check_expiry(
            outlet_id="OUT001",
            days_ahead=30,
            reference_date="2026-11-16",
            include_already_expired=False,
            limit=20,
        )
        for batch in result["batches"]:
            self.assertGreaterEqual(batch["days_remaining"], 0)

    def test_invalid_outlet(self):
        with self.assertRaises(ValueError):
            execute_check_expiry(outlet_id="OUTLET_999999")


class TestGetCustomerDues(unittest.TestCase):
    """Test get_customer_dues tool."""

    def test_customer_dues_schema_audit(self):
        result = execute_get_customer_dues(outlet_id="OUT001")
        self.assertEqual(result["status"], "managed_client_side_in_dexie")
        self.assertIn("message", result)
        self.assertIn("sqlite_database", result)
        self.assertIn("schema_audit", result)
        self.assertEqual(result["schema_audit"]["customer_credit_table_present"], False)
        self.assertIn("checked_tables", result)
        self.assertIn("bazarbondhu.db", result["sqlite_database"])
        self.assertIn("supplier_liabilities_available", result)


class TestGetBusinessInsights(unittest.TestCase):
    """Test get_business_insights tool."""

    def test_business_insights(self):
        result = execute_get_business_insights(
            outlet_id="OUT001",
            reference_date="2026-11-16",
            days=30,
        )
        self.assertIn("financial_summary", result)
        self.assertIn("inventory_health", result)
        self.assertIn("wastage_loss_summary", result)
        self.assertIn("actionable_recommendations", result)

        fin = result["financial_summary"]
        self.assertGreater(fin["total_sales_bdt"], 0)
        self.assertGreater(fin["gross_margin_percent"], 0)

        inv = result["inventory_health"]
        self.assertGreater(inv["stocked_skus_count"], 0)
        self.assertGreater(inv["cost_valuation_bdt"], 0)

        # Check recommendations
        self.assertIsInstance(result["actionable_recommendations"], list)
        self.assertGreater(len(result["actionable_recommendations"]), 0)


if __name__ == "__main__":
    unittest.main()
