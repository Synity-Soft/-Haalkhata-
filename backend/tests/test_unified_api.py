#!/usr/bin/env python3
"""
BazarBondhu AI — Unified Backend Comprehensive Test Suite
=========================================================

Verifies:
 1. Unified application startup and Root endpoint (GET /)
 2. SQLite Database connectivity & direct query execution
 3. Unified health check (GET /api/health)
 4. Legacy ML health check (GET /health)
 5. Shops catalog endpoint (GET /api/shops) with filtering & pagination
 6. ML demand prediction with canonical IDs (POST /api/v1/predict)
 7. ML demand prediction with frontend mock IDs via mapping layer (POST /api/v1/predict)
 8. Outlet product catalog endpoint (GET /api/v1/products/{outlet_id})
 9. Unknown outlet, unknown product, and unmapped mock product handling (HTTP 404)
 10. CORS preflight and response header configuration
 11. Graceful degradation when ML service fails initialization (HTTP 503 for ML, HTTP 200 for DB)
"""

import sys
import time
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.main import app
from backend.database import engine, SessionLocal
from backend.models import Outlet


def run_unified_backend_tests():
    print("=" * 76)
    print("BazarBondhu AI — Unified Backend Comprehensive Test Suite")
    print("=" * 76)

    passed_checks = 0
    total_checks = 11

    # -------------------------------------------------------------------------
    # Check 1: Direct Database Connectivity & Session Factory
    # -------------------------------------------------------------------------
    print("\n[Check 01/11] Testing Direct SQLite Database Connectivity...")
    with SessionLocal() as session:
        outlet_count = session.execute(text("SELECT count(*) FROM outlets")).scalar()
        assert outlet_count == 200, f"Expected 200 outlets, got {outlet_count}"
        first_outlet = session.get(Outlet, "OUT001")
        assert first_outlet is not None
        assert first_outlet.outlet_name == "Nobo Bazar 001"
    passed_checks += 1
    print(f"      PASSED: SQLite connectivity verified. Found {outlet_count} outlets in database.")

    # Initialize TestClient within unified lifespan
    print("\n[Setup] Initializing TestClient and starting unified application lifespan...")
    t0 = time.time()
    with TestClient(app) as client:
        print(f"        Lifespan startup complete in {time.time() - t0:.2f} s")

        # ---------------------------------------------------------------------
        # Check 2: Root Endpoint
        # ---------------------------------------------------------------------
        print("\n[Check 02/11] Testing GET / (Unified Root Endpoint)...")
        r = client.get("/")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "online"
        assert "BazarBondhu AI" in data["api_name"]
        assert data["version"] == "1.0.0"
        passed_checks += 1
        print(f"      PASSED: Root endpoint returned 200: {data['api_name']} v{data['version']}")

        # ---------------------------------------------------------------------
        # Check 3: Unified Health Endpoint (GET /api/health)
        # ---------------------------------------------------------------------
        print("\n[Check 03/11] Testing GET /api/health (Unified Health Endpoint)...")
        r = client.get("/api/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "healthy", f"Expected healthy status, got {data['status']}"
        assert data["database"]["status"] == "connected"
        assert data["database"]["engine"] == "sqlite"
        assert data["database"]["total_records"] == 200
        assert data["ml_service"]["status"] == "ready"
        assert data["ml_service"]["prediction_service_initialized"] is True
        assert data["ml_service"]["model_7d_loaded"] is True
        assert data["ml_service"]["model_30d_loaded"] is True
        passed_checks += 1
        print(f"      PASSED: Unified health reported '{data['status']}' (DB: {data['database']['status']}, ML: {data['ml_service']['status']})")

        # ---------------------------------------------------------------------
        # Check 4: Legacy ML Health Endpoint (GET /health)
        # ---------------------------------------------------------------------
        print("\n[Check 04/11] Testing GET /health (Legacy ML Health Endpoint)...")
        r = client.get("/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "healthy"
        assert data["prediction_service_initialized"] is True
        assert data["earliest_supported_date"] == "2025-12-13"
        assert data["latest_supported_date"] == "2026-11-15"
        passed_checks += 1
        print(f"      PASSED: Legacy ML health verified. Supported window: [{data['earliest_supported_date']} to {data['latest_supported_date']}]")

        # ---------------------------------------------------------------------
        # Check 5: Shops Endpoint (GET /api/shops)
        # ---------------------------------------------------------------------
        print("\n[Check 05/11] Testing GET /api/shops (Shops Catalog & Filtering)...")
        r = client.get("/api/shops")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        shops = r.json()
        assert isinstance(shops, list)
        assert len(shops) == 200, f"Expected 200 shops, got {len(shops)}"
        sample_shop = shops[0]
        assert sample_shop["id"] == "OUT001"
        assert sample_shop["name"] == "Nobo Bazar 001"
        assert "areaType" in sample_shop and sample_shop["areaType"] is not None

        # Test filtering by area type
        r_filtered = client.get("/api/shops", params={"area_type": "University / student areas"})
        assert r_filtered.status_code == 200
        student_shops = r_filtered.json()
        assert len(student_shops) == 20, f"Expected 20 student area shops, got {len(student_shops)}"

        # Test pagination
        r_paged = client.get("/api/shops", params={"limit": 5, "offset": 10})
        assert r_paged.status_code == 200
        paged_shops = r_paged.json()
        assert len(paged_shops) == 5
        assert paged_shops[0]["id"] == "OUT011"
        passed_checks += 1
        print(f"      PASSED: Returned 200 shops. Area filtering ('University / student areas': 20) and pagination confirmed.")

        # ---------------------------------------------------------------------
        # Check 6: ML Prediction with Canonical IDs (POST /api/v1/predict)
        # ---------------------------------------------------------------------
        print("\n[Check 06/11] Testing POST /api/v1/predict (Canonical IDs: OUT001, PRD047)...")
        payload_canonical = {
            "outlet_id": "OUT001",
            "product_id": "PRD047",
            "forecast_date": "2026-08-01",
            "horizon": "both"
        }
        r = client.post("/api/v1/predict", json=payload_canonical)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["outlet_id"] == "OUT001"
        assert data["product_id"] == "PRD047"
        assert data["forecast_7d"] is not None and data["forecast_7d"] >= 0.0
        assert data["forecast_30d"] is not None and data["forecast_30d"] >= 0.0
        assert data["execution_time_ms"] > 0.0
        passed_checks += 1
        print(f"      PASSED: 7d_fcst={data['forecast_7d']:.4f}, 30d_fcst={data['forecast_30d']:.4f}, latency={data['execution_time_ms']:.2f} ms")

        # ---------------------------------------------------------------------
        # Check 7: ML Prediction with Frontend Mock IDs (Audited Mapping Resolution)
        # ---------------------------------------------------------------------
        print("\n[Check 07/11] Testing POST /api/v1/predict (Audited Mock IDs: shop-garment-01, prod-s2-chili)...")
        # 7a. Verified exact mapped pair stocked at OUT003 (prod-s2-chili -> PRD013)
        payload_mock_stocked = {
            "outlet_id": "shop-garment-01",
            "product_id": "prod-s2-chili",
            "forecast_date": "2026-08-01",
            "horizon": "both"
        }
        r = client.post("/api/v1/predict", json=payload_mock_stocked)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["outlet_id"] == "OUT003", f"Expected mapped outlet OUT003, got {data['outlet_id']}"
        assert data["product_id"] == "PRD013", f"Expected mapped product PRD013, got {data['product_id']}"
        assert data["forecast_7d"] is not None and data["forecast_7d"] >= 0.0
        print(f"      PASSED: shop-garment-01 -> OUT003, prod-s2-chili -> PRD013 predicted: 7d_fcst={data['forecast_7d']:.4f}")

        # 7b. Verified exact mapped pair where product is not stocked at OUT001 (prod-s1-rice-mini -> PRD001)
        payload_mock_unstocked = {
            "outlet_id": "shop-student-01",
            "product_id": "prod-s1-rice-mini",
            "forecast_date": "2026-08-01",
            "horizon": "both"
        }
        r_unstocked = client.post("/api/v1/predict", json=payload_mock_unstocked)
        assert r_unstocked.status_code == 404, f"Expected 404 for unstocked pair, got {r_unstocked.status_code}: {r_unstocked.text}"
        assert "not found in outlet_products catalog" in r_unstocked.json()["detail"]

        # 7c. Unmapped mock product (prod-s1-tea correctly resolves to None and returns 404)
        payload_unmapped = {
            "outlet_id": "shop-student-01",
            "product_id": "prod-s1-tea",
            "forecast_date": "2026-08-01",
            "horizon": "both"
        }
        r_unmapped = client.post("/api/v1/predict", json=payload_unmapped)
        assert r_unmapped.status_code == 404, f"Expected 404 for unmapped product, got {r_unmapped.status_code}: {r_unmapped.text}"
        passed_checks += 1
        print("      PASSED: Stocked pair returned 200; unstocked pair returned 404; unmapped mock product returned 404.")

        # ---------------------------------------------------------------------
        # Check 8: Registered Products Catalog (GET /api/v1/products/{outlet_id})
        # ---------------------------------------------------------------------
        print("\n[Check 08/11] Testing GET /api/v1/products/{outlet_id} (Canonical and Mock Outlet)...")
        r_can = client.get("/api/v1/products/OUT001")
        assert r_can.status_code == 200, f"Expected 200, got {r_can.status_code}: {r_can.text}"
        data_can = r_can.json()
        assert data_can["total_products"] == 88

        # Test with mapped mock shop ID
        r_mock = client.get("/api/v1/products/shop-student-01")
        assert r_mock.status_code == 200, f"Expected 200, got {r_mock.status_code}: {r_mock.text}"
        data_mock = r_mock.json()
        assert data_mock["outlet_id"] == "OUT001"
        assert data_mock["total_products"] == 88
        passed_checks += 1
        print(f"      PASSED: Canonical OUT001 and mapped shop-student-01 both returned 88 registered products.")

        # ---------------------------------------------------------------------
        # Check 9: Unknown Outlet, Unknown Product & Unmapped Mock Product (HTTP 404)
        # ---------------------------------------------------------------------
        print("\n[Check 09/11] Testing Unknown & Unmapped Entity Handling (HTTP 404)...")
        # 9a. Unknown outlet
        r_unk_out = client.post("/api/v1/predict", json={"outlet_id": "OUT999", "product_id": "PRD001", "forecast_date": "2026-08-01"})
        assert r_unk_out.status_code == 404
        assert r_unk_out.json()["error_type"] == "NOT_FOUND"

        # 9b. Unknown product
        r_unk_prd = client.post("/api/v1/predict", json={"outlet_id": "OUT001", "product_id": "PRD999", "forecast_date": "2026-08-01"})
        assert r_unk_prd.status_code == 404
        assert r_unk_prd.json()["error_type"] == "NOT_FOUND"

        # 9c. Unmapped mock product (prod-s3-saffron has no counterpart in catalog)
        r_unmapped = client.post("/api/v1/predict", json={"outlet_id": "shop-student-01", "product_id": "prod-s3-saffron", "forecast_date": "2026-08-01"})
        assert r_unmapped.status_code == 404
        assert r_unmapped.json()["error_type"] == "NOT_FOUND"

        # 9d. Unknown outlet catalog
        r_cat_unk = client.get("/api/v1/products/OUT999")
        assert r_cat_unk.status_code == 404
        passed_checks += 1
        print("      PASSED: Unknown outlets, unknown products, and unmapped mock products all rejected with HTTP 404 (No silent coercion).")

        # ---------------------------------------------------------------------
        # Check 10: CORS Headers & Preflight
        # ---------------------------------------------------------------------
        print("\n[Check 10/11] Testing CORS Configuration & Preflight Headers...")
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        }
        r_options = client.options("/api/shops", headers=headers)
        assert r_options.status_code == 200, f"Expected 200, got {r_options.status_code}: {r_options.text}"
        assert r_options.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert r_options.headers.get("access-control-allow-credentials") == "true"

        # Actual GET request with Origin
        r_cors_get = client.get("/api/shops", headers={"Origin": "http://localhost:5173"})
        assert r_cors_get.headers.get("access-control-allow-origin") == "http://localhost:5173"
        passed_checks += 1
        print("      PASSED: CORS preflight (OPTIONS) and response headers correctly configured for http://localhost:5173.")

    # -------------------------------------------------------------------------
    # Check 11: Graceful Degradation on ML Service Failure (HTTP 503 for ML, HTTP 200 for DB)
    # -------------------------------------------------------------------------
    print("\n[Check 11/11] Testing Graceful Degradation on ML Service Failure...")
    with patch("backend.main.get_prediction_service", side_effect=RuntimeError("Simulated Model Missing")):
        with TestClient(app) as degraded_client:
            # Root is accessible
            r_root = degraded_client.get("/")
            assert r_root.status_code == 200

            # Unified Health reports degraded
            r_health = degraded_client.get("/api/health")
            assert r_health.status_code == 200
            data_health = r_health.json()
            assert data_health["status"] == "degraded"
            assert data_health["database"]["status"] == "connected"
            assert data_health["ml_service"]["status"] == "unavailable"

            # DB shops endpoint remains completely operational (HTTP 200)
            r_shops = degraded_client.get("/api/shops")
            assert r_shops.status_code == 200
            assert len(r_shops.json()) == 200

            # Prediction endpoint returns HTTP 503
            r_pred = degraded_client.post(
                "/api/v1/predict",
                json={"outlet_id": "OUT001", "product_id": "PRD047", "forecast_date": "2026-08-01"}
            )
            assert r_pred.status_code == 503
            assert r_pred.json()["error_type"] == "SERVICE_UNAVAILABLE"

            # Products endpoint returns HTTP 503
            r_prod = degraded_client.get("/api/v1/products/OUT001")
            assert r_prod.status_code == 503
            assert r_prod.json()["error_type"] == "SERVICE_UNAVAILABLE"

    passed_checks += 1
    print("      PASSED: Database operations remained online (HTTP 200) while ML degraded cleanly to HTTP 503 without server crash.")

    # -------------------------------------------------------------------------
    # Test Suite Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 76)
    print(f"UNIFIED BACKEND TEST SUITE: {passed_checks}/{total_checks} CHECKS PASSED (100%)")
    print("=" * 76)


if __name__ == "__main__":
    run_unified_backend_tests()
