#!/usr/bin/env python3
"""
BazarBondhu AI — Dual-Horizon Demand Forecast Inference Demo
============================================================

Demonstrates end-to-end inference using the real-time feature builder and the
two verified production models:
  - 7-Day Model:  EXP3 HistGradientBoostingRegressor (L1 loss)
  - 30-Day Model: HistGradientBoostingRegressor (L1 loss)

Usage:
    python3 ml/inference/demo_inference.py [--outlet OUT001] [--product PRD047] [--date 2026-08-01] [--show-features]
"""

import sys
import time
import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from ml.inference.feature_builder import (
    get_feature_builder,
    build_features,
    SAFE_FEATURES,
    NUM_COLS,
    CAT_COLS,
)


def parse_args():
    parser = argparse.ArgumentParser(description="BazarBondhu AI Forecast Inference Demo")
    parser.add_argument("--outlet", type=str, default="OUT001", help="Outlet ID (default: OUT001)")
    parser.add_argument("--product", type=str, default="PRD047", help="Product ID (default: PRD047)")
    parser.add_argument("--date", type=str, default="2026-08-01", help="Forecast origin date YYYY-MM-DD (default: 2026-08-01)")
    parser.add_argument("--show-features", action="store_true", help="Display all 67 constructed feature values")
    return parser.parse_args()


def load_forecasting_models(repo_root: Path):
    """Loads the verified 7-day and 30-day models."""
    path_7d = repo_root / "ml" / "models" / "7d" / "hgb_exp3_absolute_error_model.joblib"
    path_30d = repo_root / "ml" / "models" / "30d" / "hgb_absolute_error_model.joblib"

    if not path_7d.exists():
        raise FileNotFoundError(f"7-Day model artifact missing at: {path_7d}")
    if not path_30d.exists():
        raise FileNotFoundError(f"30-Day model artifact missing at: {path_30d}")

    t0 = time.perf_counter()
    model_7d = joblib.load(path_7d)
    model_30d = joblib.load(path_30d)
    load_time_ms = (time.perf_counter() - t0) * 1000

    return model_7d, model_30d, load_time_ms


def main():
    args = parse_args()

    print("=" * 72)
    print("      BazarBondhu AI — Dual-Horizon Demand Forecast Inference")
    print("=" * 72)

    # 1. Load models
    print("\n[1/4] Loading verified forecasting models...")
    model_7d, model_30d, t_load_ms = load_forecasting_models(REPO_ROOT)
    print(f"      Loaded 7-Day  Model: {model_7d.metadata.get('model_name', 'HGB_7D')}")
    print(f"      Loaded 30-Day Model: {model_30d.metadata.get('model_name', 'HGB_30D')}")
    print(f"      Model load latency: {t_load_ms:.2f} ms")

    # 2. Initialize Feature Builder
    print("\n[2/4] Initializing Inference Feature Builder...")
    t0_init = time.perf_counter()
    builder = get_feature_builder()
    t_init_s = time.perf_counter() - t0_init
    print(f"      Feature builder ready ({t_init_s:.2f} s initial load & indexing)")

    # 3. Build Features for Target Query
    print(f"\n[3/4] Extracting 67 SAFE features for:")
    print(f"      Outlet:        {args.outlet}")
    print(f"      Product:       {args.product}")
    print(f"      Origin Date:   {args.date}")

    t0_feat = time.perf_counter()
    features_df = builder.build_features(args.outlet, args.product, args.date)
    t_feat_ms = (time.perf_counter() - t0_feat) * 1000
    print(f"      Feature extraction latency: {t_feat_ms:.3f} ms")
    print(f"      Constructed features: {features_df.shape[1]} columns (55 numerical, 12 categorical)")

    # Optional: Display feature table
    if args.show_features:
        print("\n--- Constructed 67 SAFE Features ---")
        for i, col in enumerate(SAFE_FEATURES, 1):
            val = features_df[col].iloc[0]
            val_type = "num" if col in NUM_COLS else "cat"
            print(f"  [{i:02d}] {col:32s} ({val_type}): {val}")
        print("------------------------------------")

    # 4. Generate Predictions
    print("\n[4/4] Generating predictions across both horizons...")

    # 7-day prediction
    t0_p7 = time.perf_counter()
    pred_7d_arr = model_7d.predict(features_df)
    t_p7_ms = (time.perf_counter() - t0_p7) * 1000
    pred_7d = float(pred_7d_arr[0])

    # 30-day prediction
    t0_p30 = time.perf_counter()
    pred_30d_arr = model_30d.predict(features_df)
    t_p30_ms = (time.perf_counter() - t0_p30) * 1000
    pred_30d = float(pred_30d_arr[0])

    # Metadata & Context for interpretation
    selling_price = float(features_df["outlet_selling_price_bdt"].iloc[0])
    cur_stock = int(features_df["current_stock_quantity"].iloc[0])
    recent_sales_7d = float(features_df["sales_sum_7d"].iloc[0])
    reorder_pt = int(features_df["reorder_point"].iloc[0])
    min_stock = int(features_df["minimum_stock_level"].iloc[0])
    unit = str(features_df["unit"].iloc[0])
    brand = str(features_df["brand"].iloc[0])
    category = str(features_df["category"].iloc[0])

    daily_rate_7d = pred_7d / 7.0
    daily_rate_30d = pred_30d / 30.0

    rev_7d = pred_7d * selling_price
    rev_30d = pred_30d * selling_price

    days_of_supply = (cur_stock / daily_rate_7d) if daily_rate_7d > 0 else 999.0

    print("\n" + "=" * 72)
    print("                    FORECAST INFERENCE SUMMARY")
    print("=" * 72)
    print(f"Context:")
    print(f"  • Category / Brand:    {category} / {brand}")
    print(f"  • Selling Price:       ৳ {selling_price:.2f} BDT per {unit}")
    print(f"  • Current Stock:       {cur_stock} {unit} (Reorder Point: {reorder_pt}, Min: {min_stock})")
    print(f"  • Past 7-Day Sales:    {recent_sales_7d:.1f} {unit}")
    print(f"  • Current Stock Runout:{days_of_supply:.1f} days of supply based on 7-day forecast")
    print("-" * 72)
    print(f"Forecast Horizon: 7 Days (t+1 to t+7)")
    print(f"  • Predicted Demand:    {pred_7d:.2f} {unit} (~{round(pred_7d)} units)")
    print(f"  • Daily Implied Demand:{daily_rate_7d:.2f} {unit} / day")
    print(f"  • Estimated Revenue:   ৳ {rev_7d:,.2f} BDT")
    print(f"  • Model Latency:       {t_p7_ms:.3f} ms")
    print("-" * 72)
    print(f"Forecast Horizon: 30 Days (t+1 to t+30)")
    print(f"  • Predicted Demand:    {pred_30d:.2f} {unit} (~{round(pred_30d)} units)")
    print(f"  • Daily Implied Demand:{daily_rate_30d:.2f} {unit} / day")
    print(f"  • Estimated Revenue:   ৳ {rev_30d:,.2f} BDT")
    print(f"  • Model Latency:       {t_p30_ms:.3f} ms")
    print("-" * 72)
    print(f"End-to-End Latency:")
    print(f"  • Feature Construction: {t_feat_ms:.3f} ms")
    print(f"  • Dual Model Inference: {t_p7_ms + t_p30_ms:.3f} ms")
    print(f"  • Total Request Time:   {t_feat_ms + t_p7_ms + t_p30_ms:.3f} ms")
    print("=" * 72)


if __name__ == "__main__":
    main()
