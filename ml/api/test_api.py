#!/usr/bin/env python3
"""
BazarBondhu AI — FastAPI Test Suite
===================================

Verifies all 10 mandatory API test requirements:
 1. Root endpoint (GET /) -> 200
 2. Health endpoint (GET /health) -> 200
 3. Valid prediction request (POST /api/v1/predict) -> 200
 4. Unknown outlet (POST /api/v1/predict) -> 404
 5. Unknown product (POST /api/v1/predict) -> 404
 6. Invalid date format (POST /api/v1/predict) -> 400
 7. Unsupported date boundary (POST /api/v1/predict) -> 400
 8. Products endpoint with a valid outlet (GET /api/v1/products/OUT001) -> 200
 9. Products endpoint with an invalid outlet (GET /api/v1/products/OUT999) -> 404
 10. Service initialization failure handling -> 503
"""

import sys
import time
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.api.main import app


def run_api_tests():
    print("=" * 72)
    print("BazarBondhu AI — FastAPI Comprehensive Test Suite (10 Checks)")
    print("=" * 72)

    passed_checks = 0
    total_checks = 10

    # Initialize TestClient within lifespan context
    print("\n[Setup] Initializing TestClient and triggering FastAPI lifespan startup...")
    t0 = time.time()
    with TestClient(app) as client:
        print(f"        Lifespan startup complete in {time.time() - t0:.2f} s")

        # ---------------------------------------------------------------------
        # Check 1: Root endpoint
        # ---------------------------------------------------------------------
        print("\n[Check 01/10] Testing GET / (Root Endpoint)...")
        r = client.get("/")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "online"
        assert "version" in data and "api_name" in data
        passed_checks += 1
        print(f"      PASSED: status_code={r.status_code}, api_name='{data['api_name']}', version='{data['version']}'")

        # ---------------------------------------------------------------------
        # Check 2: Health endpoint
        # ---------------------------------------------------------------------
        print("\n[Check 02/10] Testing GET /health (Health Endpoint)...")
        r = client.get("/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "healthy"
        assert data["prediction_service_initialized"] is True
        assert data["model_7d_loaded"] is True
        assert data["model_30d_loaded"] is True
        assert data["earliest_supported_date"] == "2025-12-13"
        assert data["latest_supported_date"] == "2026-11-15"
        passed_checks += 1
        print(f"      PASSED: status='{data['status']}', 7d_id='{data['model_7d_id']}', 30d_id='{data['model_30d_id']}'")
        print(f"              Supported date window: [{data['earliest_supported_date']} to {data['latest_supported_date']}]")

        # ---------------------------------------------------------------------
        # Check 3: Valid prediction request
        # ---------------------------------------------------------------------
        print("\n[Check 03/10] Testing POST /api/v1/predict (Valid Request)...")
        payload = {
            "outlet_id": "OUT001",
            "product_id": "PRD047",
            "forecast_date": "2026-08-01"
        }
        r = client.post("/api/v1/predict", json=payload)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["outlet_id"] == "OUT001"
        assert data["product_id"] == "PRD047"
        assert data["forecast_date"] == "2026-08-01"
        assert data["forecast_7d"] is not None and data["forecast_7d"] >= 0.0
        assert data["forecast_30d"] is not None and data["forecast_30d"] >= 0.0
        assert data["execution_time_ms"] > 0.0
        passed_checks += 1
        print(f"      PASSED: 7d_fcst={data['forecast_7d']:.4f}, 30d_fcst={data['forecast_30d']:.4f}, latency={data['execution_time_ms']:.2f} ms")

        # ---------------------------------------------------------------------
        # Check 4: Unknown outlet
        # ---------------------------------------------------------------------
        print("\n[Check 04/10] Testing POST /api/v1/predict with Unknown Outlet...")
        payload = {
            "outlet_id": "OUT999",
            "product_id": "PRD047",
            "forecast_date": "2026-08-01"
        }
        r = client.post("/api/v1/predict", json=payload)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is False
        assert data["error_type"] == "NOT_FOUND"
        assert "OUT999" in data["detail"]
        passed_checks += 1
        print(f"      PASSED: Correctly returned HTTP 404: {data['detail']}")

        # ---------------------------------------------------------------------
        # Check 5: Unknown product
        # ---------------------------------------------------------------------
        print("\n[Check 05/10] Testing POST /api/v1/predict with Unknown Product...")
        payload = {
            "outlet_id": "OUT001",
            "product_id": "PRD999",
            "forecast_date": "2026-08-01"
        }
        r = client.post("/api/v1/predict", json=payload)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is False
        assert data["error_type"] == "NOT_FOUND"
        assert "PRD999" in data["detail"]
        passed_checks += 1
        print(f"      PASSED: Correctly returned HTTP 404: {data['detail']}")

        # ---------------------------------------------------------------------
        # Check 6: Invalid date format
        # ---------------------------------------------------------------------
        print("\n[Check 06/10] Testing POST /api/v1/predict with Invalid Date Format...")
        payload = {
            "outlet_id": "OUT001",
            "product_id": "PRD047",
            "forecast_date": "2026/08/01"
        }
        r = client.post("/api/v1/predict", json=payload)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is False
        assert data["error_type"] == "INVALID_REQUEST"
        passed_checks += 1
        print(f"      PASSED: Correctly returned HTTP 400 for malformed date string: {data['detail']}")

        # ---------------------------------------------------------------------
        # Check 7: Unsupported date boundary (past calendar end or warmup)
        # ---------------------------------------------------------------------
        print("\n[Check 07/10] Testing POST /api/v1/predict with Unsupported Date (Past Calendar / Warmup)...")
        # Test A: Past calendar end (e.g. 2026-11-17)
        payload_future = {
            "outlet_id": "OUT001",
            "product_id": "PRD047",
            "forecast_date": "2026-11-17"
        }
        r = client.post("/api/v1/predict", json=payload_future)
        assert r.status_code == 400, f"Expected 400 for 2026-11-17, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is False
        assert "outside the valid timeline range" in data["detail"]

        # Test B: Warmup period (e.g. 2025-11-20)
        payload_warmup = {
            "outlet_id": "OUT001",
            "product_id": "PRD047",
            "forecast_date": "2025-11-20"
        }
        r2 = client.post("/api/v1/predict", json=payload_warmup)
        assert r2.status_code == 400, f"Expected 400 for warmup date, got {r2.status_code}: {r2.text}"

        passed_checks += 1
        print(f"      PASSED: Correctly returned HTTP 400 for future date 2026-11-17 & warmup date 2025-11-20.")

        # ---------------------------------------------------------------------
        # Check 8: Products endpoint with valid outlet
        # ---------------------------------------------------------------------
        print("\n[Check 08/10] Testing GET /api/v1/products/OUT001 (Valid Outlet)...")
        r = client.get("/api/v1/products/OUT001")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["outlet_id"] == "OUT001"
        assert data["total_products"] > 0
        assert len(data["products"]) == data["total_products"]
        # Verify first product structure
        p0 = data["products"][0]
        assert "product_id" in p0 and "category" in p0 and "selling_price_bdt" in p0
        passed_checks += 1
        print(f"      PASSED: Returned {data['total_products']} products for OUT001. Sample: {p0['product_id']} ({p0['category']} - ৳ {p0['selling_price_bdt']})")

        # ---------------------------------------------------------------------
        # Check 9: Products endpoint with invalid outlet
        # ---------------------------------------------------------------------
        print("\n[Check 09/10] Testing GET /api/v1/products/OUT999 (Invalid Outlet)...")
        r = client.get("/api/v1/products/OUT999")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is False
        assert data["error_type"] == "NOT_FOUND"
        assert "OUT999" in data["detail"]
        passed_checks += 1
        print(f"      PASSED: Correctly returned HTTP 404: {data['detail']}")

    # -------------------------------------------------------------------------
    # Check 10: Service initialization failure handling (HTTP 503)
    # -------------------------------------------------------------------------
    print("\n[Check 10/10] Testing Service Initialization Failure Handling (HTTP 503)...")
    # Simulate failed initialization by patching get_prediction_service to raise an error during lifespan
    with patch("ml.api.main.get_prediction_service", side_effect=RuntimeError("Simulated Model Missing")):
        with TestClient(app) as degraded_client:
            # Root should still be accessible
            r_root = degraded_client.get("/")
            assert r_root.status_code == 200

            # Health should report unhealthy with error detail
            r_health = degraded_client.get("/health")
            assert r_health.status_code == 200
            assert r_health.json()["status"] == "unhealthy"
            assert r_health.json()["prediction_service_initialized"] is False

            # Prediction endpoint must return HTTP 503
            r_pred = degraded_client.post(
                "/api/v1/predict",
                json={"outlet_id": "OUT001", "product_id": "PRD047", "forecast_date": "2026-08-01"}
            )
            assert r_pred.status_code == 503, f"Expected 503, got {r_pred.status_code}: {r_pred.text}"
            data = r_pred.json()
            assert data["success"] is False
            assert data["error_type"] == "SERVICE_UNAVAILABLE"

            # Products endpoint must return HTTP 503
            r_prod = degraded_client.get("/api/v1/products/OUT001")
            assert r_prod.status_code == 503

    passed_checks += 1
    print("      PASSED: Correctly degraded to HTTP 503 on service initialization failure without crashing.")

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 72)
    print(f"FASTAPI TEST SUITE SUMMARY: {passed_checks}/{total_checks} CHECKS PASSED (100%)")
    print("=" * 72)


if __name__ == "__main__":
    run_api_tests()
