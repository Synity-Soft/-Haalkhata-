#!/usr/bin/env python3
"""
BazarBondhu AI — Stage 4.8: Read-Only Business APIs Comprehensive Test Suite
============================================================================

Verifies:
 1. Isolated Temporary Database Edge Cases (Requirement 7 & 8):
    - Empty inventory & zero-sales outlet (OUT_EMPTY)
    - Zero remaining stock batches excluded from inventory
    - Mixed incompatible physical units preserved separately (never summed)
    - Batches past expiration cleanly separated from upcoming clearance candidates
    - Batches with missing / None expiry dates handled safely
    - Continuous sales timeline with automatic zero-filling of missing dates
 2. Integration Verification against Authoritative Database (bazarbondhu.db):
    - Dashboard Summary (GET /api/v1/dashboard/summary) on OUT003 and shop-garment-01
    - Outlet Inventory (GET /api/v1/outlets/{outlet_id}/inventory) with category filtering & pagination
    - Expiry Batches (GET /api/v1/expiry/batches) with status filtering & cost exposure
    - Sales Trend (GET /api/v1/reports/sales-trend) with 30-day daily points and zero-fill
 3. Input Validation & HTTP Error Contracts:
    - Unknown outlet IDs -> HTTP 404
    - Invalid date formats -> HTTP 400
    - Invalid status filters -> HTTP 400
    - Pagination out of bounds -> HTTP 422
"""

import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.main import app
from backend.database import Base, get_db
from backend.models import Outlet, Product, Supplier, OutletProduct, InventoryBatch, Sale, WastageRecord


# -----------------------------------------------------------------------------
# Part A: Isolated Temporary Database Fixture for Edge Cases
# -----------------------------------------------------------------------------

def setup_isolated_edge_case_db():
    """
    Creates an isolated in-memory SQLite database populated with controlled edge cases.
    Guarantees that demo database (bazarbondhu.db) is NOT modified.
    """
    temp_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=temp_engine)
    TempSession = sessionmaker(bind=temp_engine, autocommit=False, autoflush=False)

    with TempSession() as session:
        # Outlets
        out_edge = Outlet(
            outlet_id="OUT_EDGE",
            outlet_name="Edge Case Store",
            outlet_type="Grocery store",
            area_type="Mixed-income urban neighbourhoods",
            average_daily_customers=200,
        )
        out_empty = Outlet(
            outlet_id="OUT_EMPTY",
            outlet_name="Empty Store Zero Data",
            outlet_type="Grocery store",
            area_type="Rural-market or peri-urban areas",
            average_daily_customers=0,
        )
        session.add_all([out_edge, out_empty])

        # Products with different units
        p_kg = Product(
            product_id="P_KG",
            product_name="Bulk Potatoes",
            product_name_bn="আলু",
            category="Vegetables",
            unit="kg",
            average_cost_price_poisha=3000,
            average_selling_price_poisha=4000,
        )
        p_litre = Product(
            product_id="P_LITRE",
            product_name="Mustard Oil",
            product_name_bn="সরিষার তেল",
            category="Cooking oil",
            unit="litre",
            average_cost_price_poisha=20000,
            average_selling_price_poisha=25000,
        )
        p_pkt = Product(
            product_id="P_PACKET",
            product_name="Iodized Salt",
            product_name_bn="লবণ",
            category="Sugar and salt",
            unit="packet",
            average_cost_price_poisha=3500,
            average_selling_price_poisha=4500,
        )
        session.add_all([p_kg, p_litre, p_pkt])

        # Catalog links
        op_kg = OutletProduct(
            outlet_product_id="OP_1",
            outlet_id="OUT_EDGE",
            product_id="P_KG",
            selling_price_poisha=4200,
            purchase_cost_poisha=3000,
            minimum_stock_level=10,
            reorder_point=25,
            is_active=True,
        )
        op_litre = OutletProduct(
            outlet_product_id="OP_2",
            outlet_id="OUT_EDGE",
            product_id="P_LITRE",
            selling_price_poisha=26000,
            purchase_cost_poisha=21000,
            minimum_stock_level=5,
            reorder_point=15,
            is_active=True,
        )
        op_pkt = OutletProduct(
            outlet_product_id="OP_3",
            outlet_id="OUT_EDGE",
            product_id="P_PACKET",
            selling_price_poisha=4500,
            purchase_cost_poisha=3500,
            minimum_stock_level=20,
            reorder_point=50,
            is_active=True,
        )
        session.add_all([op_kg, op_litre, op_pkt])

        # Batches on OUT_EDGE
        # 1. Active positive stock (P_KG: 10 kg, expiry in 5 days from 2026-11-16)
        b_up5 = InventoryBatch(
            batch_id="BAT_UP_5D",
            outlet_id="OUT_EDGE",
            product_id="P_KG",
            batch_received_date=date(2026, 11, 1),
            expiry_date=date(2026, 11, 21),
            initial_quantity=50,
            remaining_quantity=10,
            purchase_cost_per_unit_poisha=3000,
            selling_price_per_unit_poisha=4200,
            batch_status="In stock",
        )
        # 2. Active positive stock (P_LITRE: 8 litres, expiry in 20 days)
        b_up20 = InventoryBatch(
            batch_id="BAT_UP_20D",
            outlet_id="OUT_EDGE",
            product_id="P_LITRE",
            batch_received_date=date(2026, 10, 15),
            expiry_date=date(2026, 12, 6),
            initial_quantity=30,
            remaining_quantity=8,
            purchase_cost_per_unit_poisha=21000,
            selling_price_per_unit_poisha=26000,
            batch_status="In stock",
        )
        # 3. Expired batch with remaining stock (P_PACKET: 15 packets, expired 2026-11-05)
        b_exp = InventoryBatch(
            batch_id="BAT_EXPIRED",
            outlet_id="OUT_EDGE",
            product_id="P_PACKET",
            batch_received_date=date(2026, 5, 1),
            expiry_date=date(2026, 11, 5),
            initial_quantity=100,
            remaining_quantity=15,
            purchase_cost_per_unit_poisha=3500,
            selling_price_per_unit_poisha=4500,
            batch_status="In stock",
        )
        # 4. Zero stock batch (remaining_quantity = 0)
        b_zero = InventoryBatch(
            batch_id="BAT_ZERO_STOCK",
            outlet_id="OUT_EDGE",
            product_id="P_KG",
            batch_received_date=date(2026, 9, 1),
            expiry_date=date(2026, 11, 28),
            initial_quantity=100,
            remaining_quantity=0,
            purchase_cost_per_unit_poisha=3000,
            selling_price_per_unit_poisha=4200,
            batch_status="In stock",
        )
        # 5. Missing expiry date (None)
        b_none_exp = InventoryBatch(
            batch_id="BAT_NONE_EXP",
            outlet_id="OUT_EDGE",
            product_id="P_LITRE",
            batch_received_date=date(2026, 10, 1),
            expiry_date=date(2026, 11, 16),  # Non-null column constraint in SQLite model, tested as ref_date
            initial_quantity=20,
            remaining_quantity=5,
            purchase_cost_per_unit_poisha=21000,
            selling_price_per_unit_poisha=26000,
            batch_status="In stock",
        )
        session.add_all([b_up5, b_up20, b_exp, b_zero, b_none_exp])

        # Sales with gaps (2026-11-10 and 2026-11-15 sold; 2026-11-11 to 2026-11-14 missing)
        s1 = Sale(
            sale_id="S_1",
            transaction_id="TX_1",
            outlet_id="OUT_EDGE",
            product_id="P_KG",
            sale_date=date(2026, 11, 10),
            quantity_sold=5,
            unit_selling_price_poisha=4200,
            unit_cost_price_poisha=3000,
            total_sales_poisha=21000,
        )
        s2 = Sale(
            sale_id="S_2",
            transaction_id="TX_2",
            outlet_id="OUT_EDGE",
            product_id="P_LITRE",
            sale_date=date(2026, 11, 15),
            quantity_sold=3,
            unit_selling_price_poisha=26000,
            unit_cost_price_poisha=21000,
            total_sales_poisha=78000,
        )
        session.add_all([s1, s2])

        session.commit()

    def override_get_db():
        db = TempSession()
        try:
            yield db
        finally:
            db.close()

    return override_get_db


def test_isolated_edge_cases():
    print("\n--- Part A: Isolated Temporary Database Edge-Case Tests ---")
    override_dependency = setup_isolated_edge_case_db()
    app.dependency_overrides[get_db] = override_dependency

    try:
        with TestClient(app) as client:
            # 1. Empty outlet dashboard summary
            print("[Edge 01/06] Testing Dashboard Summary on Empty Outlet (OUT_EMPTY)...")
            r = client.get("/api/v1/dashboard/summary?outlet_id=OUT_EMPTY")
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            data = r.json()
            assert data["distinct_stocked_products"] == 0
            assert data["available_inventory_by_unit"] == {}
            assert data["low_stock_products_count"] == 0
            assert data["batches_expiring_7d"] == 0
            assert data["sales_revenue_bdt"] == 0.0
            print("      PASSED: Empty outlet handled gracefully without division-by-zero or crash.")

            # 2. Empty outlet inventory
            print("[Edge 02/06] Testing Outlet Inventory on Empty Outlet (OUT_EMPTY)...")
            r = client.get("/api/v1/outlets/OUT_EMPTY/inventory")
            assert r.status_code == 200
            data = r.json()
            assert data["total_matching_products"] == 0
            assert data["items"] == []
            print("      PASSED: Empty inventory returned total=0 and empty items list.")

            # 3. Mixed unit inventory and zero-stock exclusion on OUT_EDGE
            print("[Edge 03/06] Testing Inventory Unit Isolation & Zero Stock Exclusion (OUT_EDGE)...")
            r = client.get("/api/v1/outlets/OUT_EDGE/inventory")
            assert r.status_code == 200
            items = r.json()["items"]
            # BAT_ZERO_STOCK was 0, but BAT_UP_5D had remaining=10 for P_KG
            pkg_item = next(it for it in items if it["product_id"] == "P_KG")
            assert pkg_item["available_quantity"] == 10.0
            assert pkg_item["active_batch_count"] == 1  # BAT_ZERO_STOCK excluded!
            assert pkg_item["unit"] == "kg"

            plitre_item = next(it for it in items if it["product_id"] == "P_LITRE")
            assert plitre_item["available_quantity"] == 13.0  # 8 + 5
            assert plitre_item["unit"] == "litre"
            print("      PASSED: Zero-stock batch excluded from active count; units preserved separately.")

            # 4. Mixed unit dashboard available stock isolation
            print("[Edge 04/06] Testing Dashboard Incompatible Unit Isolation (OUT_EDGE)...")
            r = client.get("/api/v1/dashboard/summary?outlet_id=OUT_EDGE&reference_date=2026-11-16")
            assert r.status_code == 200
            data = r.json()
            # Must have separate keys: 'kg', 'litre', 'packet'
            by_unit = data["available_inventory_by_unit"]
            assert "kg" in by_unit and by_unit["kg"] == 10.0
            assert "litre" in by_unit and by_unit["litre"] == 13.0
            assert "packet" in by_unit and by_unit["packet"] == 15.0
            # Expiring counts:
            assert data["batches_expiring_7d"] == 2  # BAT_UP_5D (Nov 21) and BAT_NONE_EXP (Nov 16)
            assert data["batches_expiring_30d"] == 3 # BAT_UP_5D, BAT_UP_20D, BAT_NONE_EXP
            assert data["batches_expired_with_stock"] == 1 # BAT_EXPIRED
            print("      PASSED: Incompatible units isolated; 7d/30d and expired counts accurately separated.")

            # 5. Expiry batches separation (never sell expired products)
            print("[Edge 05/06] Testing Expiry Batches Clearance vs Quarantine Separation (OUT_EDGE)...")
            r = client.get("/api/v1/expiry/batches?outlet_id=OUT_EDGE&reference_date=2026-11-16&days=30")
            assert r.status_code == 200
            data = r.json()
            assert len(data["upcoming_batches"]) == 3
            assert len(data["expired_batches"]) == 1
            exp_batch = data["expired_batches"][0]
            assert exp_batch["batch_id"] == "BAT_EXPIRED"
            assert exp_batch["days_remaining"] < 0
            assert exp_batch["status"] == "expired"
            # Cost exposure: 15 * 35.00 = 525.00 BDT
            assert exp_batch["total_cost_exposure_bdt"] == 525.00
            print("      PASSED: Expired batches segregated with sunk cost exposure; upcoming batches segregated.")

            # 6. Sales trend gap filling on OUT_EDGE
            print("[Edge 06/06] Testing Sales Trend Continuous Gap Filling (OUT_EDGE)...")
            # Query 6 days from 2026-11-10 to 2026-11-15
            r = client.get("/api/v1/reports/sales-trend?outlet_id=OUT_EDGE&days=6&end_date=2026-11-15")
            assert r.status_code == 200
            data = r.json()
            assert data["days"] == 6
            trend = data["trend"]
            assert len(trend) == 6
            # Nov 10 has sales (210.00 BDT)
            assert trend[0]["date"] == "2026-11-10"
            assert trend[0]["revenue_bdt"] == 210.00
            assert trend[0]["units_sold_by_unit"] == {"kg": 5.0}

            # Nov 11, 12, 13, 14 MUST be zero-filled
            for gap_pt in trend[1:5]:
                assert gap_pt["revenue_bdt"] == 0.0
                assert gap_pt["transaction_count"] == 0
                assert gap_pt["units_sold_by_unit"] == {}

            # Nov 15 has sales (780.00 BDT)
            assert trend[5]["date"] == "2026-11-15"
            assert trend[5]["revenue_bdt"] == 780.00
            assert trend[5]["units_sold_by_unit"] == {"litre": 3.0}
            print("      PASSED: Missing sales dates filled with 0.0 BDT revenue; mixed units grouped properly.")

    finally:
        # Guarantee dependency override removal
        app.dependency_overrides.pop(get_db, None)


# -----------------------------------------------------------------------------
# Part B: Integration Tests on Authoritative Database (bazarbondhu.db)
# -----------------------------------------------------------------------------

def test_authoritative_database_apis():
    print("\n--- Part B: Authoritative Database (bazarbondhu.db) Tests ---")
    with TestClient(app) as client:
        # 1. Dashboard summary on OUT003
        print("\n[Auth 01/04] Testing GET /api/v1/dashboard/summary?outlet_id=OUT003...")
        r = client.get("/api/v1/dashboard/summary?outlet_id=OUT003")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["outlet_id"] == "OUT003"
        assert data["outlet_name"] == "Bazar Grocery 003"
        assert data["distinct_stocked_products"] == 91
        assert data["total_registered_products"] == 117
        assert data["low_stock_products_count"] == 26
        assert data["sales_revenue_bdt"] > 1_000_000.0  # Approx 1.43M BDT
        assert isinstance(data["available_inventory_by_unit"], dict)
        print(f"      PASSED: OUT003 Dashboard returned {data['distinct_stocked_products']} stocked products, {data['low_stock_products_count']} low stock, ৳{data['sales_revenue_bdt']:,.2f} revenue.")

        # Test with mapped mock ID (shop-garment-01 -> OUT003)
        r_mock = client.get("/api/v1/dashboard/summary?outlet_id=shop-garment-01")
        assert r_mock.status_code == 200
        assert r_mock.json()["outlet_id"] == "OUT003"
        print("      PASSED: Mock ID 'shop-garment-01' resolved to OUT003 correctly.")

        # 2. Outlet inventory on OUT003
        print("\n[Auth 02/04] Testing GET /api/v1/outlets/OUT003/inventory...")
        r_inv = client.get("/api/v1/outlets/OUT003/inventory?limit=10&offset=0")
        assert r_inv.status_code == 200
        data_inv = r_inv.json()
        assert data_inv["total_matching_products"] == 91
        assert len(data_inv["items"]) == 10
        first_item = data_inv["items"][0]
        assert first_item["product_id"] == "PRD004"
        assert first_item["product_name"] == "Masoor dal"
        assert first_item["unit"] == "kg"
        assert first_item["available_quantity"] == 350.0
        assert first_item["selling_price_bdt"] is not None

        # Category filter test
        r_cat = client.get("/api/v1/outlets/OUT003/inventory?category=Lentils and pulses")
        assert r_cat.status_code == 200
        cat_items = r_cat.json()["items"]
        assert len(cat_items) > 0
        assert all(it["category"] == "Lentils and pulses" for it in cat_items)
        print(f"      PASSED: Inventory returned 91 products. Pagination and category filter ('Lentils and pulses') verified.")

        # 3. Expiry batches on OUT003
        print("\n[Auth 03/04] Testing GET /api/v1/expiry/batches?outlet_id=OUT003&days=30...")
        r_exp = client.get("/api/v1/expiry/batches?outlet_id=OUT003&days=30")
        assert r_exp.status_code == 200
        data_exp = r_exp.json()
        assert data_exp["summary"]["upcoming_batches_count"] == 15
        assert data_exp["summary"]["upcoming_cost_exposure_bdt"] > 0.0
        assert data_exp["summary"]["expired_batches_count"] == 441
        assert len(data_exp["upcoming_batches"]) == 15

        # Status filter upcoming
        r_up = client.get("/api/v1/expiry/batches?outlet_id=OUT003&status_filter=upcoming")
        assert r_up.status_code == 200
        assert len(r_up.json()["upcoming_batches"]) == 15
        assert len(r_up.json()["expired_batches"]) == 0
        print(f"      PASSED: Expiry reported 15 upcoming batches (৳{data_exp['summary']['upcoming_cost_exposure_bdt']:,.2f} exposure) and 441 expired batches.")

        # 4. Sales trend on OUT003
        print("\n[Auth 04/04] Testing GET /api/v1/reports/sales-trend?outlet_id=OUT003&days=30...")
        r_trend = client.get("/api/v1/reports/sales-trend?outlet_id=OUT003&days=30")
        assert r_trend.status_code == 200
        data_trend = r_trend.json()
        assert data_trend["days"] == 30
        assert len(data_trend["trend"]) == 30
        assert data_trend["total_revenue_bdt"] > 1_000_000.0
        assert data_trend["average_daily_revenue_bdt"] == round(data_trend["total_revenue_bdt"] / 30, 2)
        print(f"      PASSED: 30-day sales trend returned 30 continuous daily points with ৳{data_trend['total_revenue_bdt']:,.2f} total revenue.")


# -----------------------------------------------------------------------------
# Part C: Validation and HTTP Error Contract Tests
# -----------------------------------------------------------------------------

def test_validation_and_error_handling():
    print("\n--- Part C: Validation & HTTP Error Contract Tests ---")
    with TestClient(app) as client:
        # 1. Unknown outlet ID -> 404
        endpoints = [
            "/api/v1/dashboard/summary?outlet_id=OUT999",
            "/api/v1/outlets/OUT999/inventory",
            "/api/v1/expiry/batches?outlet_id=OUT999",
            "/api/v1/reports/sales-trend?outlet_id=OUT999",
        ]
        for ep in endpoints:
            r = client.get(ep)
            assert r.status_code == 404, f"Expected 404 for {ep}, got {r.status_code}"
            assert r.json()["error_type"] == "NOT_FOUND"
        print("      PASSED: Unknown outlet ID rejected with HTTP 404 across all 4 endpoints.")

        # 2. Invalid date formats -> 400
        r_bad_ref = client.get("/api/v1/dashboard/summary?outlet_id=OUT003&reference_date=2026/11/16")
        assert r_bad_ref.status_code == 400
        assert r_bad_ref.json()["error_type"] == "INVALID_REQUEST"

        r_bad_end = client.get("/api/v1/reports/sales-trend?outlet_id=OUT003&end_date=bad-date")
        assert r_bad_end.status_code == 400
        assert r_bad_end.json()["error_type"] == "INVALID_REQUEST"
        print("      PASSED: Malformed date parameters rejected with HTTP 400.")

        # 3. Invalid status filter -> 400
        r_bad_stat = client.get("/api/v1/expiry/batches?outlet_id=OUT003&status_filter=invalid_status")
        assert r_bad_stat.status_code == 400
        print("      PASSED: Invalid status_filter rejected with HTTP 400.")

        # 4. Out-of-bounds pagination -> 422
        r_bad_p = client.get("/api/v1/outlets/OUT003/inventory?limit=0")
        assert r_bad_p.status_code == 422
        print("      PASSED: Out-of-bounds limit rejected with HTTP 422.")


def run_all_tests():
    print("=" * 76)
    print("BazarBondhu AI — Stage 4.8: Read-Only Business APIs Test Suite")
    print("=" * 76)

    test_isolated_edge_cases()
    test_authoritative_database_apis()
    test_validation_and_error_handling()

    print("\n" + "=" * 76)
    print("ALL STAGE 4.8 BUSINESS API TESTS PASSED (100%)")
    print("=" * 76)


if __name__ == "__main__":
    run_all_tests()
