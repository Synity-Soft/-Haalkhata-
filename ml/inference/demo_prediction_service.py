#!/usr/bin/env python3
"""
BazarBondhu AI — Standalone Prediction Service Demonstration
============================================================

Demonstrates real-time prediction using the standalone PredictionService
on actual outlet-product pairs from the dataset.

Demonstrates:
  1. Default dual-horizon prediction (predicting both 7-day and 30-day).
  2. Single-horizon predictions (7-day only, 30-day only).
  3. Batch / multi-pair predictions across diverse retail formats and categories.
  4. Preservation of raw model outputs and unrounded float precision.
  5. Pure demand forecasting without downstream inventory or purchasing logic.
"""

import sys
import time
from pathlib import Path
from pprint import pprint

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.inference.prediction_service import (
    get_prediction_service,
    predict,
    PredictionResult,
)


def main():
    print("=" * 76)
    print("         BazarBondhu AI — Prediction Service Demonstration")
    print("=" * 76)

    # 1. Initialize standalone service
    print("\n[Step 1] Initializing Standalone PredictionService...")
    t0 = time.time()
    service = get_prediction_service()
    print(f"         Service initialized in {time.time() - t0:.2f} s")
    print(f"         7-Day Model ID:  {service.model_7d_id}")
    print(f"         30-Day Model ID: {service.model_30d_id}")

    # 2. Basic Dual-Horizon Prediction
    print("\n[Step 2] Executing Default Dual-Horizon Prediction:")
    print("         Query: outlet_id='OUT001', product_id='PRD047', date='2026-08-01'")
    res_dual = service.predict(
        outlet_id="OUT001",
        product_id="PRD047",
        forecast_origin_date="2026-08-01"
    )
    print("\nStructured Prediction Output (as dictionary):")
    pprint(res_dual.to_dict(), indent=2, sort_dicts=False)

    # 3. Single-Horizon Predictions
    print("\n[Step 3] Executing Horizon-Specific Predictions:")

    # 7-day only
    res_7d = service.predict(
        outlet_id="OUT001",
        product_id="PRD047",
        forecast_origin_date="2026-08-01",
        horizon="7d"
    )
    print(f"         7-Day Only:  forecast_7d={res_7d.forecast_7d:.6f}, daily_implied={res_7d.daily_implied_demand_7d:.6f}, forecast_30d={res_7d.forecast_30d}")

    # 30-day only
    res_30d = service.predict(
        outlet_id="OUT001",
        product_id="PRD047",
        forecast_origin_date="2026-08-01",
        horizon="30d"
    )
    print(f"         30-Day Only: forecast_30d={res_30d.forecast_30d:.6f}, daily_implied={res_30d.daily_implied_demand_30d:.6f}, forecast_7d={res_30d.forecast_7d}")

    # 4. Multi-Pair Operational Forecasts
    print("\n[Step 4] Operational Forecasting Across Diverse Real Pairs (Validation Date: 2026-09-01):")
    pairs_to_test = [
        ("OUT001", "PRD047", "Grocery Store", "Fresh Flour"),
        ("OUT001", "PRD217", "Grocery Store", "Deshi Sugar"),
        ("OUT002", "PRD010", "Convenience Store", "Olympic Biscuits"),
        ("OUT005", "PRD150", "Supermarket", "Miniket Rice"),
        ("OUT010", "PRD211", "Megastore", "Dano Milk Powder"),
    ]

    print("-" * 88)
    print(f"{'Outlet':<8} {'Product':<8} {'Outlet Type':<18} {'Product Description':<20} {'7d Fcst':<10} {'30d Fcst':<10} {'Latency':<8}")
    print("-" * 88)

    for o_id, p_id, o_type, p_desc in pairs_to_test:
        r = service.predict(outlet_id=o_id, product_id=p_id, forecast_origin_date="2026-09-01")
        f7_str = f"{r.forecast_7d:.2f}" if r.forecast_7d is not None else "N/A"
        f30_str = f"{r.forecast_30d:.2f}" if r.forecast_30d is not None else "N/A"
        lat_str = f"{r.execution_time_ms:.2f} ms"
        print(f"{o_id:<8} {p_id:<8} {o_type:<18} {p_desc:<20} {f7_str:<10} {f30_str:<10} {lat_str:<8}")

    print("-" * 88)

    # 5. Direct Module-Level Convenience Function
    print("\n[Step 5] Direct Module-Level `predict()` Function Call:")
    res_direct = predict("OUT005", "PRD150", "2026-09-01")
    print(f"         Direct Call Status: {res_direct.status}")
    print(f"         Forecast 7d:        {res_direct.forecast_7d:.6f}")
    print(f"         Forecast 30d:       {res_direct.forecast_30d:.6f}")
    print(f"         Raw Output 7d:      {res_direct.raw_forecast_7d:.6f}")
    print(f"         Raw Output 30d:     {res_direct.raw_forecast_30d:.6f}")
    print(f"         Features Evaluated: {res_direct.feature_count}")
    print(f"         Latency:            {res_direct.execution_time_ms:.3f} ms")

    print("\n" + "=" * 76)
    print("DEMONSTRATION COMPLETED SUCCESSFULLY (No Backend/Database Dependencies)")
    print("=" * 76)


if __name__ == "__main__":
    main()
