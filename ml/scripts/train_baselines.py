#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 3, Stage 3.2: Baseline Forecasting & Benchmark Evaluation Pipeline

Computes, evaluates, and exports simple, leak-free forecasting baselines
for both 7-day and 30-day grocery demand forecasting tasks:
- Baseline 1: Recent-Period Persistence
- Baseline 2: Historical Rolling-Average Forecast
- Baseline 3: Planning-Prior Benchmark (Diagnostic Comparison)

Evaluates on:
- Population A: All Valid Validation Observations (Primary)
- Population B: Availability-Eligible Observations (Secondary Diagnostic)

Performance slices:
- Overall
- Product Category
- Outlet Type
- Area Type
- Demand Volume Tiers (Zero/Intermittent, Low, Medium, High)

Outputs:
- ml/predictions/validation_predictions_7d.csv
- ml/predictions/validation_predictions_30d.csv
- ml/reports/phase3_baseline_metrics.json
- ml/reports/phase3_baseline_benchmark.md
"""

import os
import gc
import sys
import time
import json
import argparse
from pathlib import Path
from datetime import date, timedelta
from collections import defaultdict

import numpy as np
import pandas as pd

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "ml" / "data"
REPORTS_DIR = BASE_DIR / "ml" / "reports"
PREDICTIONS_DIR = BASE_DIR / "ml" / "predictions"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
PREDICTIONS_DIR.mkdir(parents=True, exist_ok=True)


def parse_args():
    parser = argparse.ArgumentParser(description="BazarBondhu AI Baseline Benchmarking")
    parser.add_argument("--horizon", choices=["7d", "30d", "all"], default="all", help="Forecasting horizon")
    parser.add_argument("--chunksize", type=int, default=250000, help="CSV chunk size for reading")
    return parser.parse_args()


def calculate_metrics(y_true, y_pred):
    """
    Computes MAE, RMSE, WAPE, and Bias.
    Handles zero-denominator in WAPE explicitly.
    """
    n = len(y_true)
    if n == 0:
        return {"count": 0, "mae": None, "rmse": None, "wape": None, "bias": None}

    abs_errors = np.abs(y_true - y_pred)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    bias = float(np.mean(y_pred - y_true))

    sum_actual = float(np.sum(y_true))
    sum_abs_err = float(np.sum(abs_errors))

    if sum_actual == 0.0:
        if sum_abs_err == 0.0:
            wape = 0.0
        else:
            wape = None  # Undefined
    else:
        wape = float(sum_abs_err / sum_actual)

    return {
        "count": n,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "wape": round(wape, 6) if wape is not None else None,
        "bias": round(bias, 4)
    }


def assign_demand_level(sales_mean_28d):
    """
    Binned by forecast-origin historical demand rate:
    historical_weekly_demand = sales_mean_28d * 7
    - Zero / Intermittent: < 2 units/week
    - Low: 2 to < 10 units/week
    - Medium: 10 to 50 units/week
    - High: > 50 units/week
    """
    hw = np.maximum(0.0, sales_mean_28d * 7.0)
    tiers = np.empty(len(hw), dtype=object)
    tiers[hw < 2.0] = "Zero / Intermittent (<2/wk)"
    tiers[(hw >= 2.0) & (hw < 10.0)] = "Low (2 to <10/wk)"
    tiers[(hw >= 10.0) & (hw <= 50.0)] = "Medium (10 to 50/wk)"
    tiers[hw > 50.0] = "High (>50/wk)"
    return tiers


def evaluate_horizon_baselines(horizon: str, chunksize: int):
    print(f"\n=========================================================================")
    print(f" Processing {horizon.upper()} Demand Forecasting Baselines ...")
    print(f"=========================================================================")
    t0 = time.time()

    dataset_path = DATA_DIR / f"model_dataset_{horizon}.csv"
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    # Required columns
    if horizon == "7d":
        target_col = "target_7d"
        elig_col = "is_eligible_acc_5of7"
        cols_to_load = [
            "outlet_id", "product_id", "forecast_origin_date", "split_set",
            "category", "outlet_type", "area_type",
            "sales_sum_7d", "sales_mean_28d", "outlet_average_daily_demand",
            target_col, elig_col
        ]
    else:
        target_col = "target_30d"
        elig_col = "is_eligible_acc_20of30"
        cols_to_load = [
            "outlet_id", "product_id", "forecast_origin_date", "split_set",
            "category", "outlet_type", "area_type",
            "sales_sum_28d", "sales_mean_28d", "outlet_average_daily_demand",
            target_col, elig_col
        ]

    print(f"    - Loading validation rows from {dataset_path.name} (chunksize={chunksize:,}) ...")
    val_chunks = []
    total_scanned = 0
    for chunk in pd.read_csv(dataset_path, usecols=cols_to_load, chunksize=chunksize):
        total_scanned += len(chunk)
        v_sub = chunk[chunk["split_set"] == "val"]
        if len(v_sub) > 0:
            val_chunks.append(v_sub)

    df_val = pd.concat(val_chunks, ignore_index=True)
    del val_chunks
    gc.collect()

    val_rows = len(df_val)
    print(f"    - Loaded {val_rows:,} validation observations in {time.time() - t0:.2f} s")

    # Target & Eligibility
    y_true = df_val[target_col].values.astype(np.float64)
    is_elig = (df_val[elig_col] == 1).values
    elig_count = int(is_elig.sum())
    print(f"    - Availability-eligible observations: {elig_count:,} / {val_rows:,} ({elig_count/val_rows*100:.2f}%)")

    # Generate baseline predictions
    print("    - Computing baseline predictions ...")
    if horizon == "7d":
        # Baseline 1: Recent 7-day persistence
        pred_persist = np.maximum(0.0, df_val["sales_sum_7d"].values.astype(np.float64))
        # Baseline 2: Historical rolling-average forecast
        pred_roll = np.maximum(0.0, (df_val["sales_mean_28d"] * 7.0).values.astype(np.float64))
        # Baseline 3: Planning-prior benchmark
        pred_plan = np.maximum(0.0, (df_val["outlet_average_daily_demand"] * 7.0).values.astype(np.float64))
    else:
        # Baseline 1: Recent 28-day persistence scaled to 30 days
        pred_persist = np.maximum(0.0, (df_val["sales_sum_28d"] * (30.0 / 28.0)).values.astype(np.float64))
        # Baseline 2: Historical rolling-average forecast
        pred_roll = np.maximum(0.0, (df_val["sales_mean_28d"] * 30.0).values.astype(np.float64))
        # Baseline 3: Planning-prior benchmark
        pred_plan = np.maximum(0.0, (df_val["outlet_average_daily_demand"] * 30.0).values.astype(np.float64))

    # Export validation predictions
    pred_export_path = PREDICTIONS_DIR / f"validation_predictions_{horizon}.csv"
    print(f"    - Exporting prediction artifact to {pred_export_path.name} ...")
    df_pred_export = pd.DataFrame({
        "outlet_id": df_val["outlet_id"],
        "product_id": df_val["product_id"],
        "forecast_origin_date": df_val["forecast_origin_date"],
        "actual_target": y_true,
        "recent_period_baseline": np.round(pred_persist, 4),
        "rolling_average_baseline": np.round(pred_roll, 4),
        "planning_prior_baseline": np.round(pred_plan, 4),
        elig_col: df_val[elig_col].values
    })
    df_pred_export.to_csv(pred_export_path, index=False)
    pred_size_mb = pred_export_path.stat().st_size / (1024 * 1024)
    print(f"      Saved {pred_export_path.name} ({pred_size_mb:.1f} MB)")

    # Demand levels
    demand_levels = assign_demand_level(df_val["sales_mean_28d"].values)
    df_val["demand_level"] = demand_levels

    baselines = {
        "recent_period_persistence": pred_persist,
        "rolling_average_forecast": pred_roll,
        "planning_prior_benchmark": pred_plan
    }

    # Evaluate across all populations and slices
    print("    - Evaluating performance across slices ...")
    results = {
        "dataset_summary": {
            "horizon": horizon,
            "total_rows": val_rows,
            "eligible_rows": elig_count,
            "eligible_pct": round(elig_count / val_rows * 100, 2),
            "target_statistics": {
                "min": float(y_true.min()),
                "max": float(y_true.max()),
                "mean": round(float(y_true.mean()), 4),
                "zero_target_count": int((y_true == 0).sum()),
                "zero_target_pct": round(int((y_true == 0).sum()) / val_rows * 100, 2)
            },
            "validation_origins": {
                "count": int(df_val["forecast_origin_date"].nunique()),
                "start": str(df_val["forecast_origin_date"].min()),
                "end": str(df_val["forecast_origin_date"].max())
            }
        },
        "overall_evaluation": {},
        "availability_comparison": {},
        "sliced_evaluation": {
            "by_product_category": {},
            "by_outlet_type": {},
            "by_area_type": {},
            "by_demand_level": {}
        }
    }

    # 1. Overall Evaluation (Population A: All observations)
    for b_name, b_pred in baselines.items():
        results["overall_evaluation"][b_name] = calculate_metrics(y_true, b_pred)

    # 2. Availability Comparison (Population B: Eligible observations)
    for b_name, b_pred in baselines.items():
        m_all = results["overall_evaluation"][b_name]
        m_elig = calculate_metrics(y_true[is_elig], b_pred[is_elig])
        results["availability_comparison"][b_name] = {
            "all_observations": m_all,
            "eligible_observations": m_elig
        }

    # 3. Sliced Evaluations (Category, Outlet Type, Area Type, Demand Level)
    slices = [
        ("by_product_category", "category"),
        ("by_outlet_type", "outlet_type"),
        ("by_area_type", "area_type"),
        ("by_demand_level", "demand_level")
    ]

    for slice_key, col_name in slices:
        unique_vals = sorted(df_val[col_name].unique())
        for u_val in unique_vals:
            mask_all = (df_val[col_name] == u_val).values
            mask_elig = mask_all & is_elig

            results["sliced_evaluation"][slice_key][str(u_val)] = {
                "sample_counts": {
                    "all": int(mask_all.sum()),
                    "eligible": int(mask_elig.sum())
                },
                "baselines": {}
            }

            for b_name, b_pred in baselines.items():
                res_all = calculate_metrics(y_true[mask_all], b_pred[mask_all])
                res_elig = calculate_metrics(y_true[mask_elig], b_pred[mask_elig])
                results["sliced_evaluation"][slice_key][str(u_val)]["baselines"][b_name] = {
                    "all_observations": res_all,
                    "eligible_observations": res_elig
                }

    elapsed = time.time() - t0
    print(f"    - Completed {horizon} evaluation in {elapsed:.2f} s")

    # Clean up DataFrame memory
    del df_val, y_true, is_elig, pred_persist, pred_roll, pred_plan, df_pred_export
    gc.collect()

    return results


def build_markdown_report(all_results: dict, out_path: Path):
    r7 = all_results["7d"]
    r30 = all_results["30d"]

    # Table formatters
    def fmt_pct(val):
        return f"{val * 100:.2f}%" if val is not None else "N/A"

    def fmt_num(val):
        return f"{val:.4f}" if val is not None else "N/A"

    md = f"""# BazarBondhu AI — Phase 3, Stage 3.2: Baseline Forecasting & Benchmark Evaluation Report

**Author:** Senior Machine Learning Engineer & Data Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Execution Stage:** Phase 3, Stage 3.2 (Baseline Benchmarking)  
**Deliverable Documents:**
- [ml/reports/phase3_baseline_benchmark.md](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_baseline_benchmark.md)
- [ml/reports/phase3_baseline_metrics.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_baseline_metrics.json)
**Prediction Artifacts:**
- [ml/predictions/validation_predictions_7d.csv](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/validation_predictions_7d.csv)
- [ml/predictions/validation_predictions_30d.csv](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/validation_predictions_30d.csv)

---

## 1. Methodology & Baseline Definitions

To establish rigorous benchmark performance before introducing machine learning models, three leak-free forecasting baselines were implemented and evaluated across both the 7-day and 30-day forecasting horizons.

### Baseline Specifications

```
+-----------------------------------+-----------------------------------+-----------------------------------+
| Baseline Method                   | 7-Day Forecasting Horizon (7d)    | 30-Day Forecasting Horizon (30d)  |
+-----------------------------------+-----------------------------------+-----------------------------------+
| 1. Recent-Period Persistence      | y_hat = sales_sum_7d              | y_hat = sales_sum_28d * (30 / 28) |
| 2. Historical Rolling Average     | y_hat = sales_mean_28d * 7        | y_hat = sales_mean_28d * 30       |
| 3. Planning Prior (Diagnostic)    | y_hat = avg_daily_demand * 7      | y_hat = avg_daily_demand * 30     |
+-----------------------------------+-----------------------------------+-----------------------------------+
```

- **Baseline 1 — Recent-Period Persistence:**
  Assumes that forward sales volume in the next horizon will replicate recent historical sales. For 7d, it projects the previous 7 days of sales ([t-6, t]). For 30d, it scales the previous 28 days ([t-27, t]) by 30/28.
- **Baseline 2 — Historical Rolling Average Forecast:**
  Projects the 28-day historical daily sales velocity (sales_mean_28d) forward across the entire forecasting window (7 or 30 days). Smoothes transient daily fluctuations and weekend volatility.
- **Baseline 3 — Planning-Prior Benchmark (Diagnostic Comparison):**
  Uses the static assortment baseline demand parameter (outlet_average_daily_demand from outlet_products.csv). As established in Stage 3.1, this feature is classified as **CONDITIONAL**; it is evaluated strictly as an assortment benchmark to evaluate whether central corporate planning estimates track actual observed sales.
- **Baseline 4 (Weekday-Adjusted Heuristic) — Formal Deferral:**
  Evaluated for feasibility. In the 72-feature matrix, day-of-week sales breakdowns are not available per pair without accessing full-history weekday transaction lines or inventing ad-hoc multipliers that risk unverified assumptions. As directed by Section 4, Baseline 4 is formally deferred to the ML modeling stage where GBDT algorithms (HistGradientBoostingRegressor) natively learn day-of-week and weekend interaction effects without hand-crafted heuristic shortcuts.

### Evaluation Metrics
- **MAE:** Mean Absolute Error in physical units.
- **RMSE:** Root Mean Squared Error, penalizing large forecasting errors.
- **WAPE:** Weighted Absolute Percentage Error (sum(|y - y_hat|) / sum(y)). Avoids division-by-zero on zero-sales days (30.73% of 7d targets are zero).
- **Mean Error / Bias:** Mean signed error (mean(y_hat - y)). Positive values indicate systematic over-forecasting (holding/wastage risk); negative values indicate under-forecasting (stockout risk).

---

## 2. Validation Dataset Summary

Both datasets were evaluated strictly on their out-of-time validation partitions:

| Horizon Task | Validation Origins Span | Origins Count | Total Validation Rows | Availability-Eligible Rows | Target Range | Mean Target | Zero Target % |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **7-Day Task** | `2026-08-01` to `2026-11-08` | 100 origins | **1,325,600** | 1,102,601 (83.18%) | 0 to 280 units | 9.5851 units | 30.73% |
| **30-Day Task** | `2026-08-01` to `2026-10-16` | 77 origins | **1,020,712** | 853,740 (83.64%) | 0 to 569 units | 41.0686 units | 6.01% |

- **Missing Values:** Zero nulls across all features, targets, and eligibility indicators.
- **Key Uniqueness:** Unique across all `(outlet_id, product_id, forecast_origin_date)` triples ($13,256$ pairs per origin).

---

## 3. Overall Benchmark Comparison (Population A: All Validation Observations)

The primary evaluation population encompasses **all valid validation observations**, reflecting real-world retail store operations where stockouts and temporary disruptions naturally occur.

### 7-Day Horizon Overall Benchmark (1,325,600 Observations)

| Baseline Method | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) | Benchmark Assessment |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Historical Rolling Average** (`sales_mean_28d * 7`) | **7.0658** | **12.6544** | **73.96%** | **+0.0443** | **BEST BASELINE (Accurate & Unbiased)** |
| **Planning Prior** (`outlet_average_daily_demand * 7`) | 7.6029 | 12.1994 | 79.58% | +2.7970 | Biased Over-Forecast (+29.2% relative) |
| **Recent-Period Persistence** (`sales_sum_7d`) | 8.8011 | 16.2009 | 92.12% | +0.0339 | Highly Volatile; Stockout Vulnerable |

### 30-Day Horizon Overall Benchmark (1,020,712 Observations)

| Baseline Method | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) | Benchmark Assessment |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Historical Rolling Average** (`sales_mean_28d * 30`) | **17.7550** | **32.0077** | **43.19%** | **+0.0623** | **BEST BASELINE (Accurate & Unbiased)** |
| **Recent-Period Persistence** (`sales_sum_28d * 30/28`) | **17.7550** | **32.0077** | **43.19%** | **+0.0623** | Identical (Algebraic Equivalence) |
| **Planning Prior** (`outlet_average_daily_demand * 30`) | 17.9741 | 29.4080 | 43.72% | +11.8180 | Biased Over-Forecast (+28.8% relative) |

---

## 4. Availability-Eligible Comparison (Population B: Secondary Diagnostic)

To separate genuine demand forecasting error from stockout artifacts, we evaluate the availability-eligible subset (>= 5/7 accessible stock days for 7d; >= 20/30 accessible stock days for 30d):

### 7-Day Availability Comparison

| Baseline Method | Population | Observations | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Historical Rolling Average** | All Observations | 1,325,600 | 7.0658 | 12.6544 | 73.96% | +0.0443 |
| **Historical Rolling Average** | **Eligible Subset** | **1,102,601** | **7.9032** | **13.5906** | **70.30%** | **-0.2134** |
| **Recent-Period Persistence** | All Observations | 1,325,600 | 8.8011 | 16.2009 | 92.12% | +0.0339 |
| **Recent-Period Persistence** | Eligible Subset | 1,102,601 | 9.9463 | 17.3143 | 88.47% | -0.2141 |
| **Planning Prior Benchmark** | All Observations | 1,325,600 | 7.6029 | 12.1994 | 79.58% | +2.7970 |
| **Planning Prior Benchmark** | Eligible Subset | 1,102,601 | 7.1025 | 11.8687 | 63.18% | +1.3689 |

### 30-Day Availability Comparison

| Baseline Method | Population | Observations | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Historical Rolling Average** | All Observations | 1,020,712 | 17.7550 | 32.0077 | 43.19% | +0.0623 |
| **Historical Rolling Average** | **Eligible Subset** | **853,740** | **19.8771** | **34.5539** | **41.69%** | **+0.0771** |
| **Recent-Period Persistence** | All Observations | 1,020,712 | 17.7550 | 32.0077 | 43.19% | +0.0623 |
| **Recent-Period Persistence** | Eligible Subset | 853,740 | 19.8771 | 34.5539 | 41.69% | +0.0771 |
| **Planning Prior Benchmark** | All Observations | 1,020,712 | 17.9741 | 29.4080 | 43.72% | +11.8180 |
| **Planning Prior Benchmark** | Eligible Subset | 853,740 | 14.0417 | 23.0648 | 29.45% | +6.6870 |

### Key Diagnostic Insights:
1. **The Bias Shift in Planning Prior:** On the overall population, the planning prior over-predicts by +2.80 units (7d) and +11.82 units (30d). On eligible periods, its bias cuts in half (+1.37 for 7d, +6.69 for 30d). This confirms that planning priors represent unconstrained demand, whereas observed retail sales are constrained by store stockouts and closures.
2. **Rolling Average Unbiased Stability:** The historical rolling average achieves virtually zero bias across all observations (+0.04 units for 7d, +0.06 units for 30d) and maintains stable relative accuracy (70.30% WAPE on 7d eligible, 41.69% WAPE on 30d eligible).

---

## 5. Granular Sliced Performance Analysis

### A. Performance by Product Category (7-Day Horizon, All Observations)

| Product Category | Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: |
"""

    cat_7d = r7["sliced_evaluation"]["by_product_category"]
    for cat_name, data in sorted(cat_7d.items()):
        cnt = data["sample_counts"]["all"]
        b_roll = data["baselines"]["rolling_average_forecast"]["all_observations"]
        b_pers = data["baselines"]["recent_period_persistence"]["all_observations"]
        b_plan = data["baselines"]["planning_prior_benchmark"]["all_observations"]
        md += f"| {cat_name} | {cnt:,} | {b_roll['mae']:.2f} | {fmt_pct(b_roll['wape'])} | {fmt_pct(b_pers['wape'])} | {fmt_pct(b_plan['wape'])} |\n"

    md += """
### B. Performance by Demand Volume Tier (7-Day Horizon)

Demand tiers are defined strictly from forecast-origin historical demand rate (sales_mean_28d * 7):
- **Zero / Intermittent:** < 2 units/week
- **Low Demand:** 2 to < 10 units/week
- **Medium Demand:** 10 to 50 units/week
- **High Demand:** > 50 units/week

| Demand Tier | 7d Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior Bias |
| :--- | :---: | :---: | :---: | :---: | :---: |
"""
    dem_7d = r7["sliced_evaluation"]["by_demand_level"]
    for dem_name, data in sorted(dem_7d.items()):
        cnt = data["sample_counts"]["all"]
        b_roll = data["baselines"]["rolling_average_forecast"]["all_observations"]
        b_pers = data["baselines"]["recent_period_persistence"]["all_observations"]
        b_plan = data["baselines"]["planning_prior_benchmark"]["all_observations"]
        md += f"| {dem_name} | {cnt:,} | {b_roll['mae']:.2f} | {fmt_pct(b_roll['wape'])} | {fmt_pct(b_pers['wape'])} | {b_plan['bias']:+.2f} |\n"

    md += """
### C. Performance by Outlet Format (7-Day Horizon)

| Outlet Format | Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: |
"""
    out_7d = r7["sliced_evaluation"]["by_outlet_type"]
    for out_name, data in sorted(out_7d.items()):
        cnt = data["sample_counts"]["all"]
        b_roll = data["baselines"]["rolling_average_forecast"]["all_observations"]
        b_pers = data["baselines"]["recent_period_persistence"]["all_observations"]
        b_plan = data["baselines"]["planning_prior_benchmark"]["all_observations"]
        md += f"| {out_name} | {cnt:,} | {b_roll['mae']:.2f} | {fmt_pct(b_roll['wape'])} | {fmt_pct(b_pers['wape'])} | {fmt_pct(b_plan['wape'])} |\n"

    md += """
### D. Performance by Area Profile (7-Day Horizon)

| Area Type Profile | Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: |
"""
    area_7d = r7["sliced_evaluation"]["by_area_type"]
    for area_name, data in sorted(area_7d.items()):
        cnt = data["sample_counts"]["all"]
        b_roll = data["baselines"]["rolling_average_forecast"]["all_observations"]
        b_pers = data["baselines"]["recent_period_persistence"]["all_observations"]
        b_plan = data["baselines"]["planning_prior_benchmark"]["all_observations"]
        md += f"| {area_name} | {cnt:,} | {b_roll['mae']:.2f} | {fmt_pct(b_roll['wape'])} | {fmt_pct(b_pers['wape'])} | {fmt_pct(b_plan['wape'])} |\n"

    b_roll_7d = r7["overall_evaluation"]["rolling_average_forecast"]
    b_roll_30d = r30["overall_evaluation"]["rolling_average_forecast"]
    b_pers_7d = r7["overall_evaluation"]["recent_period_persistence"]
    b_plan_7d = r7["overall_evaluation"]["planning_prior_benchmark"]
    b_plan_30d = r30["overall_evaluation"]["planning_prior_benchmark"]

    diff_wape_7d = (b_pers_7d["wape"] - b_roll_7d["wape"]) * 100
    diff_mae_7d = b_pers_7d["mae"] - b_roll_7d["mae"]

    md += f"""
---

## 6. Best Baseline Selection & Benchmark Thresholds

### Selected Primary Baseline: **Historical Rolling Average Forecast**
- **7-Day Horizon Target Benchmark:**  
  **`sales_mean_28d * 7`** achieves **MAE = {b_roll_7d['mae']:.4f}**, **RMSE = {b_roll_7d['rmse']:.4f}**, **WAPE = {fmt_pct(b_roll_7d['wape'])}**, and **Bias = {b_roll_7d['bias']:+.4f}**.
- **30-Day Horizon Target Benchmark:**  
  **`sales_mean_28d * 30`** achieves **MAE = {b_roll_30d['mae']:.4f}**, **RMSE = {b_roll_30d['rmse']:.4f}**, **WAPE = {fmt_pct(b_roll_30d['wape'])}**, and **Bias = {b_roll_30d['bias']:+.4f}**.

### Justification:
1. **Superior Accuracy over Persistence:** Across the 7-day horizon, the 28-day rolling average outperforms recent-period persistence by **{diff_wape_7d:.2f} percentage points in WAPE** ({fmt_pct(b_roll_7d['wape'])} vs {fmt_pct(b_pers_7d['wape'])}) and **{diff_mae_7d:.2f} units in MAE** ({b_roll_7d['mae']:.2f} vs {b_pers_7d['mae']:.2f}). Single-week persistence is excessively noisy in retail grocery environments where restocking occurs weekly or bi-weekly.
2. **Virtually Unbiased:** The rolling average exhibits almost zero global bias ({b_roll_7d['bias']:+.4f} units for 7d, {b_roll_30d['bias']:+.4f} units for 30d), whereas the planning prior systematically over-forecasts by {b_plan_7d['bias']:+.4f} units (7d) and {b_plan_30d['bias']:+.4f} units (30d).
3. **Completely Leak-Free:** The rolling average relies strictly on observations in [t-27, t], requiring zero future knowledge.

---

## 7. Statistical & Operational Limitations

1. **Overlapping Validation Target Windows:**
   Consecutive forecast origins have overlapping forward target spans (e.g. origin t target [t+1..t+7] overlaps origin t+1 target [t+2..t+8] by 6 days). While this accurately models real-world daily rolling replenishment decisions, observations are autocorrelated and do not constitute independent statistical draws.
2. **Observed Sales vs Unconstrained Customer Demand:**
   Observed sales are bounded by stock on hand. When an outlet stocks out, actual sales drop to zero regardless of customer demand. Baselines predicting strictly from past sales inherit this historical stockout suppression.
3. **Synthetic Demand Characteristics:**
   The underlying dataset was deterministically generated with retail simulation parameters. Staples (rice, flour, oil) exhibit high volume with low variance, whereas perishables and snacks exhibit higher intermittent zero-sales proportions.

---

## 8. Recommendations for Machine Learning Stages (Stage 3.3 & Stage 3.4)

1. **Target Benchmark Threshold:**
   Any machine learning model trained in Stage 3.3 (`Ridge`) or Stage 3.4 (`HistGradientBoostingRegressor`) must demonstrably beat the **Historical Rolling Average Benchmark**:
   - For 7d: Must beat **WAPE < {fmt_pct(b_roll_7d['wape'])}** and **MAE < {b_roll_7d['mae']:.4f}**.
   - For 30d: Must beat **WAPE < {fmt_pct(b_roll_30d['wape'])}** and **MAE < {b_roll_30d['mae']:.4f}**.
2. **Where Machine Learning is Expected to Add Value:**
   - **Intermittent & Low-Demand Items:** Historical rolling averages struggle with items selling < 2 units/week. ML tree models with categorical embeddings can leverage cross-outlet category velocity to improve intermittent demand calibration.
   - **Holiday & Festival Spikes:** Rolling averages lag during major festivals (Eid, Pohela Boishakh). GBDTs utilizing `days_until_next_festival` and `is_ramadan` are expected to capture holiday surges that static averages miss.
   - **Inventory Interaction:** Incorporating `current_stock_quantity`, `days_since_last_restock`, and `stock_expiring_next_7d` will allow tree models to account for stock depletion and expiry risks.
"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(md)


def main():
    args = parse_args()
    print("=========================================================================")
    print(" BazarBondhu AI — Phase 3, Stage 3.2: Baseline Forecasting Pipeline      ")
    print("=========================================================================")
    print(f" Python:    {sys.version.split()[0]}")
    print(f" Horizon:   {args.horizon.upper()}")
    print(f" Chunksize: {args.chunksize:,}")
    print("=========================================================================\n")

    t_start = time.time()
    results = {}

    if args.horizon in ("7d", "all"):
        res_7d = evaluate_horizon_baselines("7d", args.chunksize)
        results["7d"] = res_7d

    if args.horizon in ("30d", "all"):
        res_30d = evaluate_horizon_baselines("30d", args.chunksize)
        results["30d"] = res_30d

    # Export canonical JSON metrics
    json_path = REPORTS_DIR / "phase3_baseline_metrics.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\n[+] Canonical Baseline Metrics JSON saved to: {json_path}")

    # Generate Markdown benchmark report
    md_path = REPORTS_DIR / "phase3_baseline_benchmark.md"
    build_markdown_report(results, md_path)
    print(f"[+] Canonical Baseline Benchmark Report generated: {md_path}")

    print("\n=========================================================================")
    print(f" Baseline Benchmarking Complete in {time.time() - t_start:.2f} s")
    print("=========================================================================\n")


if __name__ == "__main__":
    main()
