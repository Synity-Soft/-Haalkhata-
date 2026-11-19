#!/usr/bin/env python3
"""
BazarBondhu AI — Prediction Service Comprehensive Test Suite
============================================================

Verifies all 13 mandatory functional and edge-case testing requirements for
PredictionService:
 1. Valid 7-day prediction.
 2. Valid 30-day prediction.
 3. Dual-horizon prediction.
 4. Multiple valid outlet-product pairs.
 5. Invalid outlet ID.
 6. Invalid product ID.
 7. Unregistered outlet-product pair.
 8. Invalid date format.
 9. Unsupported date boundary.
 10. Model loading failure.
 11. Feature schema mismatch.
 12. Non-finite prediction handling.
 13. Negative prediction handling (raw preserved, clipped non-negative).
"""

import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.inference.prediction_service import (
    PredictionService,
    PredictionResult,
    get_prediction_service,
    predict,
)
from ml.inference.feature_builder import (
    get_feature_builder,
    SAFE_FEATURES,
    NUM_COLS,
    CAT_COLS,
)


def run_tests():
    print("=" * 72)
    print("BazarBondhu AI — Prediction Service Test Suite (13 Checks)")
    print("=" * 72)

    # Initialize service
    t0 = time.time()
    service = get_prediction_service()
    print(f"Service initialized in {time.time() - t0:.2f} s")

    checks_passed = 0
    total_checks = 13

    # -------------------------------------------------------------------------
    # Test 1: Valid 7-day prediction
    # -------------------------------------------------------------------------
    print("\n[Check 01/13] Testing Valid 7-Day Prediction...")
    res_7d = service.predict(outlet_id="OUT001", product_id="PRD047", forecast_origin_date="2026-08-01", horizon="7d")
    assert isinstance(res_7d, PredictionResult), f"Expected PredictionResult, got {type(res_7d)}"
    assert res_7d.status == "SUCCESS"
    assert res_7d.horizon == "7d"
    assert res_7d.forecast_7d is not None and res_7d.forecast_7d >= 0.0
    assert res_7d.raw_forecast_7d is not None
    assert res_7d.daily_implied_demand_7d == res_7d.forecast_7d / 7.0
    assert res_7d.forecast_30d is None
    assert res_7d.raw_forecast_30d is None
    assert res_7d.daily_implied_demand_30d is None
    assert "7d" in res_7d.models and "30d" not in res_7d.models
    assert res_7d.feature_count == 67
    checks_passed += 1
    print(f"      PASSED: 7d forecast = {res_7d.forecast_7d:.4f}, daily implied = {res_7d.daily_implied_demand_7d:.4f}")

    # -------------------------------------------------------------------------
    # Test 2: Valid 30-day prediction
    # -------------------------------------------------------------------------
    print("\n[Check 02/13] Testing Valid 30-Day Prediction...")
    res_30d = service.predict(outlet_id="OUT001", product_id="PRD047", forecast_origin_date="2026-08-01", horizon="30d")
    assert isinstance(res_30d, PredictionResult)
    assert res_30d.status == "SUCCESS"
    assert res_30d.horizon == "30d"
    assert res_30d.forecast_30d is not None and res_30d.forecast_30d >= 0.0
    assert res_30d.raw_forecast_30d is not None
    assert res_30d.daily_implied_demand_30d == res_30d.forecast_30d / 30.0
    assert res_30d.forecast_7d is None
    assert res_30d.raw_forecast_7d is None
    assert res_30d.daily_implied_demand_7d is None
    assert "30d" in res_30d.models and "7d" not in res_30d.models
    checks_passed += 1
    print(f"      PASSED: 30d forecast = {res_30d.forecast_30d:.4f}, daily implied = {res_30d.daily_implied_demand_30d:.4f}")

    # -------------------------------------------------------------------------
    # Test 3: Dual-horizon prediction (default)
    # -------------------------------------------------------------------------
    print("\n[Check 03/13] Testing Dual-Horizon Prediction...")
    res_both = service.predict(outlet_id="OUT001", product_id="PRD047", forecast_origin_date="2026-08-01")
    assert res_both.status == "SUCCESS"
    assert res_both.horizon == "both"
    assert res_both.forecast_7d is not None and res_both.forecast_7d >= 0.0
    assert res_both.forecast_30d is not None and res_both.forecast_30d >= 0.0
    assert res_both.daily_implied_demand_7d == res_both.forecast_7d / 7.0
    assert res_both.daily_implied_demand_30d == res_both.forecast_30d / 30.0
    assert "7d" in res_both.models and "30d" in res_both.models
    # Validate to_dict conversion
    d = res_both.to_dict()
    assert isinstance(d, dict) and d["status"] == "SUCCESS"
    checks_passed += 1
    print(f"      PASSED: Dual forecast 7d={res_both.forecast_7d:.4f}, 30d={res_both.forecast_30d:.4f}")

    # -------------------------------------------------------------------------
    # Test 4: Multiple valid outlet-product pairs
    # -------------------------------------------------------------------------
    print("\n[Check 04/13] Testing Multiple Valid Outlet-Product Pairs...")
    sample_pairs = [
        ("OUT001", "PRD047"),  # Grocery store, Flour
        ("OUT001", "PRD217"),  # Grocery store, Sugar
        ("OUT002", "PRD010"),  # Convenience store, Biscuits
        ("OUT005", "PRD150"),  # Supermarket, Rice
        ("OUT010", "PRD211"),  # Megastore, Milk powder
    ]
    for o_id, p_id in sample_pairs:
        r = service.predict(outlet_id=o_id, product_id=p_id, forecast_origin_date="2026-08-15")
        assert r.status == "SUCCESS"
        assert r.forecast_7d is not None and r.forecast_7d >= 0.0
        assert r.forecast_30d is not None and r.forecast_30d >= 0.0
        print(f"        Pair ({o_id}, {p_id}): 7d={r.forecast_7d:.2f}, 30d={r.forecast_30d:.2f} (latency: {r.execution_time_ms:.2f} ms)")
    checks_passed += 1
    print("      PASSED: Successfully generated dual forecasts for 5 diverse pairs.")

    # -------------------------------------------------------------------------
    # Test 5: Invalid outlet ID
    # -------------------------------------------------------------------------
    print("\n[Check 05/13] Testing Invalid Outlet ID Rejection...")
    try:
        service.predict(outlet_id="OUT999", product_id="PRD047", forecast_origin_date="2026-08-01")
        assert False, "Should have raised ValueError on invalid outlet"
    except ValueError as e:
        assert "Unknown outlet_id 'OUT999'" in str(e)
        checks_passed += 1
        print(f"      PASSED: Correctly raised ValueError: {e}")

    # -------------------------------------------------------------------------
    # Test 6: Invalid product ID
    # -------------------------------------------------------------------------
    print("\n[Check 06/13] Testing Invalid Product ID Rejection...")
    try:
        service.predict(outlet_id="OUT001", product_id="PRD999", forecast_origin_date="2026-08-01")
        assert False, "Should have raised ValueError on invalid product"
    except ValueError as e:
        assert "Unknown product_id 'PRD999'" in str(e)
        checks_passed += 1
        print(f"      PASSED: Correctly raised ValueError: {e}")

    # -------------------------------------------------------------------------
    # Test 7: Unregistered outlet-product pair
    # -------------------------------------------------------------------------
    print("\n[Check 07/13] Testing Unregistered Pair Rejection...")
    # Find a product that OUT001 does not stock
    out001_prods = {p for o, p in service.feature_builder.op_pairs if o == "OUT001"}
    unregistered_prod = next(p for p in service.feature_builder.known_products if p not in out001_prods)
    try:
        service.predict(outlet_id="OUT001", product_id=unregistered_prod, forecast_origin_date="2026-08-01")
        assert False, "Should have raised ValueError on unregistered pair"
    except ValueError as e:
        assert "not found in outlet_products catalog" in str(e)
        checks_passed += 1
        print(f"      PASSED: Correctly raised ValueError for unstocked pair (OUT001, {unregistered_prod}): {e}")

    # -------------------------------------------------------------------------
    # Test 8: Invalid date format
    # -------------------------------------------------------------------------
    print("\n[Check 08/13] Testing Invalid Date Format Rejection...")
    for bad_date in ("2026/08/01", "01-08-2026", "2026-13-01", "not-a-date"):
        try:
            service.predict(outlet_id="OUT001", product_id="PRD047", forecast_origin_date=bad_date)
            assert False, f"Should have rejected invalid date format: {bad_date}"
        except ValueError:
            pass
    checks_passed += 1
    print("      PASSED: Correctly rejected malformed date strings.")

    # -------------------------------------------------------------------------
    # Test 9: Unsupported date boundary (warmup & out-of-range)
    # -------------------------------------------------------------------------
    print("\n[Check 09/13] Testing Date Boundary Rejection...")
    # 1. Warmup period (requires >= 28 days history, day 27 is 2025-12-13)
    try:
        service.predict(outlet_id="OUT001", product_id="PRD047", forecast_origin_date="2025-11-20")
        assert False, "Should have rejected date in warmup period"
    except ValueError as e:
        assert "requires at least 28 days of history" in str(e)

    # 2. Beyond catalog timeline (max is 2026-11-15)
    try:
        service.predict(outlet_id="OUT001", product_id="PRD047", forecast_origin_date="2027-01-01")
        assert False, "Should have rejected date beyond calendar timeline"
    except ValueError as e:
        assert "outside the valid timeline range" in str(e)

    checks_passed += 1
    print("      PASSED: Correctly rejected warmup origin dates and future boundary overruns.")

    # -------------------------------------------------------------------------
    # Test 10: Model loading failure
    # -------------------------------------------------------------------------
    print("\n[Check 10/13] Testing Model Loading Failure Handling...")
    non_existent_path = REPO_ROOT / "ml" / "models" / "7d" / "non_existent_model.joblib"
    try:
        PredictionService(model_7d_path=non_existent_path)
        assert False, "Should have raised FileNotFoundError for missing model"
    except FileNotFoundError as e:
        assert "Missing 7-day model artifact" in str(e)
        checks_passed += 1
        print(f"      PASSED: Correctly caught missing model file: {e}")

    # -------------------------------------------------------------------------
    # Test 11: Feature schema mismatch detection
    # -------------------------------------------------------------------------
    print("\n[Check 11/13] Testing Feature Schema Mismatch Detection...")
    # Case A: Missing columns
    df_missing = pd.DataFrame([{"sales_lag_1d": 1.0}])
    try:
        service.validate_feature_dataframe(df_missing)
        assert False, "Should have failed on missing columns"
    except KeyError as e:
        assert "Feature schema mismatch" in str(e)

    # Case B: Extra / forbidden columns
    valid_df = service.feature_builder.build_features("OUT001", "PRD047", "2026-08-01")
    df_forbidden = valid_df.copy()
    df_forbidden["target_7d"] = 10.0
    try:
        service.validate_feature_dataframe(df_forbidden)
        assert False, "Should have failed on forbidden column target_7d"
    except KeyError:
        # Extra columns violate list(df.columns) == SAFE_FEATURES
        pass

    # Case C: Conditional feature present
    df_conditional = valid_df.copy()
    df_conditional.insert(0, "outlet_average_daily_demand", 5.0)
    try:
        service.validate_feature_dataframe(df_conditional)
        assert False, "Should have failed on conditional feature"
    except KeyError:
        pass

    checks_passed += 1
    print("      PASSED: Correctly detected missing columns, forbidden targets, and conditional features.")

    # -------------------------------------------------------------------------
    # Test 12: Non-finite prediction handling
    # -------------------------------------------------------------------------
    print("\n[Check 12/13] Testing Non-Finite Prediction Handling...")
    # Create service instance with a mock model that outputs NaN / Inf
    mock_model_nan = MagicMock()
    mock_model_nan.safe_features = SAFE_FEATURES
    mock_model_nan.metadata = {"experiment_id": "MOCK_NAN"}
    mock_model_nan.predict_raw.return_value = np.array([np.nan])

    service_nan = PredictionService()
    service_nan.model_7d = mock_model_nan

    try:
        service_nan.predict("OUT001", "PRD047", "2026-08-01", horizon="7d")
        assert False, "Should have rejected NaN raw prediction"
    except ValueError as e:
        assert "generated non-finite raw forecast" in str(e)
        checks_passed += 1
        print(f"      PASSED: Correctly caught non-finite model output: {e}")

    # -------------------------------------------------------------------------
    # Test 13: Negative prediction handling (raw preserved, clipped non-negative)
    # -------------------------------------------------------------------------
    print("\n[Check 13/13] Testing Negative Prediction Handling & Raw Preservation...")
    # Create a mock model simulating negative raw linear/tree excursion
    mock_model_neg = MagicMock()
    mock_model_neg.safe_features = SAFE_FEATURES
    mock_model_neg.metadata = {"experiment_id": "MOCK_NEGATIVE"}
    mock_model_neg.predict_raw.return_value = np.array([-3.7542])

    service_neg = PredictionService()
    service_neg.model_7d = mock_model_neg

    res_neg = service_neg.predict("OUT001", "PRD047", "2026-08-01", horizon="7d")
    assert res_neg.raw_forecast_7d == -3.7542, f"Expected raw -3.7542, got {res_neg.raw_forecast_7d}"
    assert res_neg.forecast_7d == 0.0, f"Expected clipped 0.0, got {res_neg.forecast_7d}"
    assert res_neg.daily_implied_demand_7d == 0.0, f"Expected daily implied 0.0, got {res_neg.daily_implied_demand_7d}"
    assert res_neg.status == "SUCCESS"
    checks_passed += 1
    print(f"      PASSED: Raw negative ({res_neg.raw_forecast_7d}) preserved; clipped demand = {res_neg.forecast_7d:.1f}")

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 72)
    print(f"PREDICTION SERVICE TEST SUITE: {checks_passed}/{total_checks} CHECKS PASSED")
    print("=" * 72)


if __name__ == "__main__":
    run_tests()
