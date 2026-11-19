#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 3, Stage 3.6.1: EXP2 Independent Verification Script
==========================================================================

Author: Senior Machine Learning Engineer & Independent ML Auditor
Date: November 17, 2026

Purpose:
  Perform an independent, empirical audit and verification of the
  EXP2_HGB_NO_INVENTORY_7D experiment.
  Audits all integrity checks specified in Stage 3.6 and Stage 3.6.1:
  1. Exact 52-feature membership and order.
  2. Exact numerical (40) and categorical (12) membership against authoritative metadata.
  3. Estimator input count = 52 (hgb.n_features_in_ == 52).
  4. Actual categorical indices = [40..51].
  5. Encoder fitted state and unknown-category configuration (12 vocabularies, unk=-1).
  6. Empirical encoder training provenance (12/12 features reconstructed from training partition only).
  7. Exact 15 inventory feature exclusion (0 found in model).
  8. Conditional (5) and forbidden feature exclusion.
  9. Full training (201 dates) and validation (100 dates) sequences from source data.
  10. Exact source partition row counts (Train: 2,664,456; Purge: 0; Val: 1,325,600).
  11. Source and prediction forecast-key uniqueness (0 duplicates).
  12. 100% validation key coverage (1,325,600 keys match source validation slice).
  13. Target equality against baseline, Ridge, and EXP1 after explicit key alignment (diff = 0.0).
  14. Embedded baseline, Ridge, and EXP1 prediction equality after key alignment (diff = 0.0).
  15. Finite values in every prediction column (0 NaN, 0 Inf).
  16. Clipping consistency across all 1,325,600 rows.
  17. Reproducibility on the same 1,000 keyed validation rows (raw diff <= 5e-5, 4-dec diff = 0.0).
  18. Eligibility data validation (binary in {0, 1}, 1,102,601 eligible rows, 1,325,600 total rows).
  19. Independent float64 metric recalculation with empty-population guard (UNDEFINED for empty sets).
  20. Memory reporting honesty (standardized honesty classifications).

Safeguards:
  - Guard against missing files/columns, unequal lengths, and empty datasets.
  - No hardcoded audit results (purge rows, train rows, and val rows are empirically counted from dataset).
  - Fully independent computation; does not trust metrics JSON.
"""

import sys
import json
import gc
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.utils.validation import check_is_fitted

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from ml.models.forecaster import HGBDemandForecaster

INVENTORY_15 = [
    "current_stock_quantity",
    "stock_received_7d",
    "stock_received_28d",
    "stock_wastage_7d",
    "stock_wastage_28d",
    "days_since_last_restock",
    "stock_to_recent_sales_ratio",
    "reorder_point",
    "minimum_stock_level",
    "maximum_stock_level",
    "stock_expiring_next_7d",
    "stock_expiring_next_30d",
    "nearest_expiry_days",
    "expiring_batch_count",
    "inventory_capacity_sku"
]

CONDITIONAL_5 = [
    "outlet_average_daily_demand",
    "average_selling_price_bdt",
    "average_cost_price_bdt",
    "average_restock_frequency_days",
    "days_until_next_festival"
]

FORBIDDEN = [
    "outlet_id", "product_id", "forecast_origin_date",
    "target_7d", "target_30d", "is_eligible_acc_5of7"
]


def convert_types(obj: Any) -> Any:
    """Recursively converts NumPy scalar types and structures to native Python primitives for clean JSON serialization."""
    if isinstance(obj, dict):
        return {k: convert_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_types(v) for v in obj]
    elif isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    elif isinstance(obj, (np.floating, float)):
        return float(obj)
    elif isinstance(obj, (np.integer, int)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return convert_types(obj.tolist())
    return obj


def independent_compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """
    Task 4: Independent float64 metric computation with empty-population and zero-target guards.
    An empty population returns count=0 and MAE, RMSE, WAPE, Bias as 'UNDEFINED'.
    """
    n = len(y_true)
    if n == 0:
        return {
            "count": 0,
            "mae": "UNDEFINED",
            "rmse": "UNDEFINED",
            "wape": "UNDEFINED",
            "bias": "UNDEFINED"
        }

    y_true_f64 = np.asarray(y_true, dtype=np.float64)
    y_pred_f64 = np.asarray(y_pred, dtype=np.float64)

    err = y_pred_f64 - y_true_f64
    abs_err = np.abs(err)
    mae = float(np.mean(abs_err))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    sum_y = float(np.sum(y_true_f64))

    if sum_y == 0.0:
        wape = "UNDEFINED"
    else:
        wape = float(np.sum(abs_err) / sum_y)

    bias = float(np.mean(err))

    return {
        "count": int(n),
        "mae": mae,
        "rmse": rmse,
        "wape": wape,
        "bias": bias
    }


def run_independent_verification() -> Dict[str, Any]:
    print("=" * 80)
    print("BazarBondhu AI — Phase 3, Stage 3.6.1: EXP2 Independent Technical Verification")
    print("=" * 80)

    audit_path = repo_root / "ml" / "reports" / "phase3_feature_safety_audit.json"
    meta_path = repo_root / "ml" / "features" / "feature_metadata.json"
    model_path = repo_root / "ml" / "models" / "7d" / "hgb_exp2_no_inventory_model.joblib"
    pred_path = repo_root / "ml" / "predictions" / "hgb_exp2_validation_predictions_7d.csv"
    metrics_path = repo_root / "ml" / "reports" / "phase3_hgb_exp2_7d_metrics.json"
    dataset_path = repo_root / "ml" / "data" / "model_dataset_7d.csv"
    base_pred_csv = repo_root / "ml" / "predictions" / "validation_predictions_7d.csv"
    ridge_pred_csv = repo_root / "ml" / "predictions" / "ridge_validation_predictions_7d.csv"
    exp1_pred_csv = repo_root / "ml" / "predictions" / "hgb_exp1_validation_predictions_7d.csv"

    results = {}

    # Initial check: Required files existence
    missing_files = []
    for p, name in [
        (audit_path, "feature_safety_audit.json"),
        (meta_path, "feature_metadata.json"),
        (model_path, "hgb_exp2_no_inventory_model.joblib"),
        (pred_path, "hgb_exp2_validation_predictions_7d.csv"),
        (metrics_path, "phase3_hgb_exp2_7d_metrics.json"),
        (dataset_path, "model_dataset_7d.csv"),
        (base_pred_csv, "validation_predictions_7d.csv"),
        (ridge_pred_csv, "ridge_validation_predictions_7d.csv"),
        (exp1_pred_csv, "hgb_exp1_validation_predictions_7d.csv")
    ]:
        if not p.exists():
            missing_files.append(f"{name} at {p}")

    if missing_files:
        error_msg = f"Missing required file(s): {missing_files}"
        print(f"[FAIL] {error_msg}")
        return {"all_passed": False, "failure_reason": error_msg}

    # Load artifacts safely
    try:
        with open(audit_path, "r", encoding="utf-8") as f:
            audit = json.load(f)
        auth_safe_67 = [k for k, v in audit["feature_audit_details"].items() if v.get("safety_classification") == "SAFE"]

        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

        forecaster = joblib.load(model_path)
        check_is_fitted(forecaster.hgb)

        with open(metrics_path, "r", encoding="utf-8") as f:
            reported_metrics = json.load(f)

        df_pred = pd.read_csv(pred_path)
    except Exception as e:
        error_msg = f"Artifact loading failed: {e}"
        print(f"[FAIL] {error_msg}")
        return {"all_passed": False, "failure_reason": error_msg}

    # --------------------------------------------------------------------------
    # Check 1: Exact 52-feature membership and order
    # --------------------------------------------------------------------------
    safe_52 = forecaster.safe_features
    expected_safe_52 = [f for f in auth_safe_67 if f not in INVENTORY_15]
    c1 = (safe_52 == expected_safe_52 and len(safe_52) == 52 and len(set(safe_52)) == 52)
    results["check_1_exact_52_feature_membership_and_order"] = {
        "passed": bool(c1),
        "count": len(safe_52),
        "exact_order_match": safe_52 == expected_safe_52
    }
    print(f"Check 1 (52 feature membership & preserved order): {'PASSED' if c1 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 2: Exact numerical (40) and categorical (12) membership against metadata
    # --------------------------------------------------------------------------
    num_cols = forecaster.num_cols
    cat_cols = forecaster.cat_cols
    expected_cat_12 = [k for k in safe_52 if meta["features"][k].get("data_type") in ["string", "object", "category"]]
    expected_num_40 = [k for k in safe_52 if k not in expected_cat_12]

    c2 = (num_cols == expected_num_40 and cat_cols == expected_cat_12 and
          len(num_cols) == 40 and len(cat_cols) == 12 and
          set(num_cols).isdisjoint(set(cat_cols)))
    results["check_2_exact_num_cat_partition"] = {
        "passed": bool(c2),
        "num_count": len(num_cols),
        "cat_count": len(cat_cols),
        "disjoint": bool(set(num_cols).isdisjoint(set(cat_cols))),
        "num_order_match": num_cols == expected_num_40,
        "cat_order_match": cat_cols == expected_cat_12
    }
    print(f"Check 2 (40 numerical, 12 categorical, disjoint): {'PASSED' if c2 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 3: Estimator input count = 52
    # --------------------------------------------------------------------------
    c3 = (forecaster.hgb.n_features_in_ == 52)
    results["check_3_estimator_n_features_in"] = {
        "passed": bool(c3),
        "n_features_in": int(forecaster.hgb.n_features_in_)
    }
    print(f"Check 3 (Estimator n_features_in_ == 52): {'PASSED' if c3 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 4: Actual categorical indices = [40..51]
    # --------------------------------------------------------------------------
    expected_cat_indices = list(range(40, 52))
    actual_cat_indices = list(forecaster.hgb.categorical_features)
    c4 = (actual_cat_indices == expected_cat_indices)
    results["check_4_categorical_indices"] = {
        "passed": bool(c4),
        "actual_indices": actual_cat_indices,
        "expected_indices": expected_cat_indices
    }
    print(f"Check 4 (Categorical indices == [40..51]): {'PASSED' if c4 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 5: Encoder fitted state and unknown-category configuration
    # --------------------------------------------------------------------------
    encoder = forecaster.encoder
    c5 = (len(encoder.categories_) == 12 and hasattr(encoder, "categories_") and
          encoder.unknown_value == -1 and encoder.handle_unknown == "use_encoded_value")
    results["check_5_encoder_fitted_state_and_unknown_config"] = {
        "passed": bool(c5),
        "category_features_count": len(encoder.categories_),
        "handle_unknown": encoder.handle_unknown,
        "unknown_value": encoder.unknown_value
    }
    print(f"Check 5 (Encoder fitted, 12 vocabs, unknown_value=-1): {'PASSED' if c5 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Chunked Source Scan for Tasks 1, 2: Row Counts, Date Sequences, & Provenance
    # --------------------------------------------------------------------------
    print("\nExecuting chunked scan over source dataset for row counts and provenance reconstruction...")
    train_dates_set = set()
    val_dates_set = set()
    purge_rows_count = 0
    train_rows_count = 0
    val_rows_count = 0
    total_dataset_rows = 0

    reconstructed_train_cats = defaultdict(set)
    usecols_scan = ["forecast_origin_date"] + cat_cols

    for chunk in pd.read_csv(dataset_path, usecols=usecols_scan, chunksize=200000):
        dates = chunk["forecast_origin_date"].values
        total_dataset_rows += len(dates)

        t_mask = (dates >= "2025-12-13") & (dates <= "2026-07-01")
        p_mask = (dates >= "2026-07-02") & (dates <= "2026-07-31")
        v_mask = (dates >= "2026-08-01") & (dates <= "2026-11-08")

        train_rows_count += int(t_mask.sum())
        purge_rows_count += int(p_mask.sum())
        val_rows_count += int(v_mask.sum())

        train_dates_set.update(dates[t_mask])
        val_dates_set.update(dates[v_mask])

        # Task 1: Reconstruct expected category vocabularies from training partition only
        if t_mask.any():
            c_train = chunk[t_mask]
            for col in cat_cols:
                # Apply exact same missing-value normalization as EXP2 forecaster
                vals = c_train[col].fillna("missing").astype(str).unique()
                reconstructed_train_cats[col].update(vals)

    # --------------------------------------------------------------------------
    # Check 6: Empirical Encoder Training Provenance (Task 1)
    # --------------------------------------------------------------------------
    provenance_details = {}
    all_provenance_passed = True

    for col, saved_cats in zip(cat_cols, encoder.categories_):
        recon_sorted = sorted(list(reconstructed_train_cats[col]))
        saved_list = list(saved_cats)

        missing_in_saved = [c for c in recon_sorted if c not in saved_list]
        unexpected_in_saved = [c for c in saved_list if c not in recon_sorted]
        order_match = (recon_sorted == saved_list)

        col_passed = (len(missing_in_saved) == 0 and len(unexpected_in_saved) == 0 and order_match)
        if not col_passed:
            all_provenance_passed = False

        provenance_details[col] = {
            "expected_count": len(recon_sorted),
            "actual_count": len(saved_list),
            "missing_categories": missing_in_saved,
            "unexpected_categories": unexpected_in_saved,
            "exact_order_match": order_match,
            "passed": col_passed
        }

    c6 = all_provenance_passed
    results["check_6_encoder_training_provenance"] = {
        "passed": bool(c6),
        "all_12_features_match_training_partition_exactly": bool(c6),
        "per_feature_vocabularies": provenance_details
    }
    print(f"Check 6 (Empirical Encoder Training Provenance: 12/12 features match): {'PASSED' if c6 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 7: Exact 15 inventory feature exclusion
    # --------------------------------------------------------------------------
    excluded_present = [f for f in INVENTORY_15 if f in safe_52]
    c7 = (len(excluded_present) == 0)
    results["check_7_inventory_15_excluded"] = {
        "passed": bool(c7),
        "excluded_features_found_in_model": excluded_present
    }
    print(f"Check 7 (15 inventory features excluded): {'PASSED' if c7 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 8: Conditional and forbidden feature exclusion
    # --------------------------------------------------------------------------
    cond_present = [f for f in CONDITIONAL_5 if f in safe_52]
    forb_present = [f for f in FORBIDDEN if f in safe_52]
    c8 = (len(cond_present) == 0 and len(forb_present) == 0)
    results["check_8_no_conditional_or_forbidden"] = {
        "passed": bool(c8),
        "conditional_features_found": cond_present,
        "forbidden_columns_found": forb_present
    }
    print(f"Check 8 (No conditional or forbidden features): {'PASSED' if c8 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 9: Full training and validation date sequences from source data (Task 2)
    # --------------------------------------------------------------------------
    train_dates_sorted = sorted(list(train_dates_set))
    val_dates_sorted = sorted(list(val_dates_set))

    d_cur = date(2025, 12, 13)
    d_end = date(2026, 7, 1)
    exp_train_dates = []
    while d_cur <= d_end:
        exp_train_dates.append(d_cur.strftime("%Y-%m-%d"))
        d_cur += timedelta(days=1)

    d_cur = date(2026, 8, 1)
    d_end = date(2026, 11, 8)
    exp_val_dates = []
    while d_cur <= d_end:
        exp_val_dates.append(d_cur.strftime("%Y-%m-%d"))
        d_cur += timedelta(days=1)

    c9 = (train_dates_sorted == exp_train_dates and len(train_dates_sorted) == 201 and
          val_dates_sorted == exp_val_dates and len(val_dates_sorted) == 100)
    results["check_9_full_date_sequences_from_source"] = {
        "passed": bool(c9),
        "training_unique_dates": len(train_dates_sorted),
        "validation_unique_dates": len(val_dates_sorted),
        "training_sequence_consecutive": train_dates_sorted == exp_train_dates,
        "validation_sequence_consecutive": val_dates_sorted == exp_val_dates
    }
    print(f"Check 9 (Date sequences: 201 train dates, 100 val dates): {'PASSED' if c9 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 10: Exact source partition row counts & empirical zero purge rows (Task 2)
    # --------------------------------------------------------------------------
    c10 = (train_rows_count == 2664456 and purge_rows_count == 0 and
           val_rows_count == 1325600 and total_dataset_rows == 3990056)
    results["check_10_exact_source_partition_row_counts"] = {
        "passed": bool(c10),
        "training_rows_scanned": train_rows_count,
        "expected_training_rows": 2664456,
        "purge_rows_scanned": purge_rows_count,
        "expected_purge_rows": 0,
        "validation_rows_scanned": val_rows_count,
        "expected_validation_rows": 1325600,
        "total_source_rows_scanned": total_dataset_rows,
        "expected_total_rows": 3990056
    }
    print(f"Check 10 (Source Partition Counts: Train=2,664,456, Purge=0, Val=1,325,600): {'PASSED' if c10 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 11: Source and prediction forecast-key uniqueness
    # --------------------------------------------------------------------------
    key_cols = ["outlet_id", "product_id", "forecast_origin_date"]
    dup_pred_keys = int(df_pred[key_cols].duplicated().sum())

    source_val_keys_list = []
    for chunk in pd.read_csv(dataset_path, usecols=key_cols, chunksize=200000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-11-08")
        if mask.any():
            source_val_keys_list.append(chunk[mask])
    df_source_val = pd.concat(source_val_keys_list, ignore_index=True)
    dup_source_keys = int(df_source_val[key_cols].duplicated().sum())

    c11 = (dup_pred_keys == 0 and dup_source_keys == 0)
    results["check_11_forecast_key_uniqueness"] = {
        "passed": bool(c11),
        "dup_pred_keys": dup_pred_keys,
        "dup_source_val_keys": dup_source_keys
    }
    print(f"Check 11 (Key uniqueness: pred dups={dup_pred_keys}, source dups={dup_source_keys}): {'PASSED' if c11 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 12: 100% validation key coverage
    # --------------------------------------------------------------------------
    c12 = (
        len(df_pred) == len(df_source_val) == 1325600 and
        (df_pred["outlet_id"].values == df_source_val["outlet_id"].values).all() and
        (df_pred["product_id"].values == df_source_val["product_id"].values).all() and
        (df_pred["forecast_origin_date"].values == df_source_val["forecast_origin_date"].values).all()
    )
    results["check_12_100pct_validation_key_coverage"] = {
        "passed": bool(c12),
        "pred_count": len(df_pred),
        "source_count": len(df_source_val),
        "keys_identically_aligned": bool(c12)
    }
    print(f"Check 12 (100% validation key coverage vs dataset): {'PASSED' if c12 else 'FAILED'}")
    del df_source_val
    gc.collect()

    # --------------------------------------------------------------------------
    # Check 13: Target equality against baseline, Ridge, and EXP1 after key alignment
    # --------------------------------------------------------------------------
    df_base = pd.read_csv(base_pred_csv, usecols=key_cols + ["actual_target", "rolling_average_baseline"])
    df_ridge = pd.read_csv(ridge_pred_csv, usecols=key_cols + ["actual_target", "clipped_prediction"])
    df_exp1 = pd.read_csv(exp1_pred_csv, usecols=key_cols + ["actual_target", "predicted_7d_clipped"])

    for name, df_other in [("Baseline", df_base), ("Ridge", df_ridge), ("EXP1", df_exp1)]:
        if len(df_pred) != len(df_other):
            raise ValueError(f"Length divergence vs {name}")
        km = (
            (df_pred["outlet_id"].values != df_other["outlet_id"].values) |
            (df_pred["product_id"].values != df_other["product_id"].values) |
            (df_pred["forecast_origin_date"].values != df_other["forecast_origin_date"].values)
        )
        if km.any():
            raise ValueError(f"Key mismatch vs {name} on {km.sum()} rows")

    diff_base_tgt = float(np.max(np.abs(df_pred["actual_target"].values - df_base["actual_target"].values)))
    diff_ridge_tgt = float(np.max(np.abs(df_pred["actual_target"].values - df_ridge["actual_target"].values)))
    diff_exp1_tgt = float(np.max(np.abs(df_pred["actual_target"].values - df_exp1["actual_target"].values)))

    c13 = (diff_base_tgt == 0.0 and diff_ridge_tgt == 0.0 and diff_exp1_tgt == 0.0 and
           np.all(df_pred["actual_target"].values >= 0.0))
    results["check_13_targets_match_exactly_after_alignment"] = {
        "passed": bool(c13),
        "max_diff_vs_baseline": diff_base_tgt,
        "max_diff_vs_ridge": diff_ridge_tgt,
        "max_diff_vs_exp1": diff_exp1_tgt,
        "targets_nonnegative": bool(np.all(df_pred["actual_target"].values >= 0.0))
    }
    print(f"Check 13 (Targets match Baseline, Ridge, EXP1: max diff = 0.0): {'PASSED' if c13 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 14: Embedded baseline, Ridge, and EXP1 prediction equality after key alignment
    # --------------------------------------------------------------------------
    diff_base_pred = float(np.max(np.abs(df_pred["baseline_prediction"].values - np.round(df_base["rolling_average_baseline"].values, 4))))
    mismatches_base = int(np.sum(df_pred["baseline_prediction"].values != np.round(df_base["rolling_average_baseline"].values, 4)))

    diff_ridge_pred = float(np.max(np.abs(df_pred["ridge_prediction"].values - np.round(df_ridge["clipped_prediction"].values, 4))))
    mismatches_ridge = int(np.sum(df_pred["ridge_prediction"].values != np.round(df_ridge["clipped_prediction"].values, 4)))

    diff_exp1_pred = float(np.max(np.abs(df_pred["hgb_exp1_prediction"].values - np.round(df_exp1["predicted_7d_clipped"].values, 4))))
    mismatches_exp1 = int(np.sum(df_pred["hgb_exp1_prediction"].values != np.round(df_exp1["predicted_7d_clipped"].values, 4)))

    c14 = (diff_base_pred == 0.0 and mismatches_base == 0 and
           diff_ridge_pred == 0.0 and mismatches_ridge == 0 and
           diff_exp1_pred == 0.0 and mismatches_exp1 == 0)
    results["check_14_embedded_benchmark_predictions_aligned"] = {
        "passed": bool(c14),
        "max_diff_baseline_prediction": diff_base_pred,
        "mismatches_baseline": mismatches_base,
        "max_diff_ridge_prediction": diff_ridge_pred,
        "mismatches_ridge": mismatches_ridge,
        "max_diff_exp1_prediction": diff_exp1_pred,
        "mismatches_exp1": mismatches_exp1
    }
    print(f"Check 14 (Embedded benchmark predictions aligned: 0 mismatches): {'PASSED' if c14 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 15: Finite values in every prediction column
    # --------------------------------------------------------------------------
    pred_cols = [
        "actual_target", "predicted_7d_raw", "predicted_7d_clipped",
        "baseline_prediction", "ridge_prediction", "hgb_exp1_prediction"
    ]
    non_finite = {c: int((~np.isfinite(df_pred[c].values)).sum()) for c in pred_cols}
    c15 = all(v == 0 for v in non_finite.values())
    results["check_15_all_prediction_columns_finite"] = {
        "passed": bool(c15),
        "non_finite_counts": non_finite
    }
    print(f"Check 15 (All prediction columns finite): {'PASSED' if c15 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 16: Clipping consistency across all 1,325,600 rows
    # --------------------------------------------------------------------------
    clip_recomputed = np.clip(df_pred["predicted_7d_raw"].values, 0, None)
    clip_diff = np.max(np.abs(df_pred["predicted_7d_clipped"].values - clip_recomputed))
    c16 = (clip_diff <= 1e-4 and df_pred["predicted_7d_clipped"].min() >= 0.0)
    results["check_16_clipping_consistency"] = {
        "passed": bool(c16),
        "max_clip_diff": float(clip_diff),
        "clipped_min": float(df_pred["predicted_7d_clipped"].min())
    }
    print(f"Check 16 (Clipping consistency across 1.32M rows): {'PASSED' if c16 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 17: Reproducibility on the same 1,000 keyed validation rows
    # --------------------------------------------------------------------------
    val_cols = ["outlet_id", "product_id", "forecast_origin_date"] + safe_52
    val_sample_chunks = []
    for chunk in pd.read_csv(dataset_path, usecols=val_cols, chunksize=1000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-11-08")
        c_filt = chunk[mask]
        if len(c_filt) > 0:
            val_sample_chunks.append(c_filt)
        if sum(len(c) for c in val_sample_chunks) >= 1000:
            break
    sample_1000 = pd.concat(val_sample_chunks, ignore_index=True).iloc[:1000]

    key_align_1000 = (
        (sample_1000["outlet_id"].values == df_pred["outlet_id"].iloc[:1000].values).all() and
        (sample_1000["product_id"].values == df_pred["product_id"].iloc[:1000].values).all() and
        (sample_1000["forecast_origin_date"].values == df_pred["forecast_origin_date"].iloc[:1000].values).all()
    )

    reloaded_raw = forecaster.predict_raw(sample_1000)
    reloaded_clipped = forecaster.predict(sample_1000)
    csv_raw = df_pred["predicted_7d_raw"].iloc[:1000].values
    csv_clipped = df_pred["predicted_7d_clipped"].iloc[:1000].values

    diff_raw = float(np.max(np.abs(reloaded_raw - csv_raw)))
    diff_clipped = float(np.max(np.abs(reloaded_clipped - csv_clipped)))
    diff_raw_rounded = float(np.max(np.abs(np.round(reloaded_raw, 4) - csv_raw)))
    diff_clipped_rounded = float(np.max(np.abs(np.round(reloaded_clipped, 4) - csv_clipped)))

    c17 = (key_align_1000 and diff_clipped <= 5.0001e-5 and diff_clipped_rounded == 0.0 and diff_raw_rounded == 0.0)
    results["check_17_reproducibility_on_keyed_sample"] = {
        "passed": bool(c17),
        "key_alignment_1000": bool(key_align_1000),
        "max_diff_raw_vs_csv": diff_raw,
        "max_diff_clipped_vs_csv": diff_clipped,
        "max_diff_raw_rounded": diff_raw_rounded,
        "max_diff_clipped_rounded": diff_clipped_rounded
    }
    print(f"Check 17 (Reproducibility on 1,000 keyed rows): {'PASSED' if c17 else 'FAILED'} (diff={diff_clipped:.6e}, rounded={diff_clipped_rounded})")

    # --------------------------------------------------------------------------
    # Check 18: Eligibility Data Validation (Task 3)
    # --------------------------------------------------------------------------
    has_elig_col = "is_eligible_acc_5of7" in df_pred.columns
    null_elig_count = int(df_pred["is_eligible_acc_5of7"].isna().sum()) if has_elig_col else -1
    elig_vals_set = set(df_pred["is_eligible_acc_5of7"].unique()) if has_elig_col else set()
    elig_subset_binary = elig_vals_set.issubset({0, 1})
    elig_count = int((df_pred["is_eligible_acc_5of7"] == 1).sum()) if has_elig_col else -1
    all_valid_count = len(df_pred)

    c18 = (has_elig_col and null_elig_count == 0 and elig_subset_binary and
           elig_count == 1102601 and all_valid_count == 1325600)
    results["check_18_eligibility_data_validation"] = {
        "passed": bool(c18),
        "column_present": bool(has_elig_col),
        "null_count": null_elig_count,
        "unique_values": sorted(list(elig_vals_set)),
        "is_binary_0_1": bool(elig_subset_binary),
        "eligible_rows_count": elig_count,
        "expected_eligible_rows": 1102601,
        "all_valid_rows_count": all_valid_count,
        "expected_all_valid_rows": 1325600
    }
    print(f"Check 18 (Eligibility Data: binary in {{0,1}}, 1,102,601 eligible / 1,325,600 total): {'PASSED' if c18 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 19: Independent Float64 Metric Recalculation & Empty-Population Guard (Tasks 3, 4)
    # --------------------------------------------------------------------------
    y_true_f64 = df_pred["actual_target"].to_numpy(dtype=np.float64)
    p_clipped_f64 = df_pred["predicted_7d_clipped"].to_numpy(dtype=np.float64)
    elig_mask = (df_pred["is_eligible_acc_5of7"] == 1).values

    recalc_all = independent_compute_metrics(y_true_f64, p_clipped_f64)
    recalc_elig = independent_compute_metrics(y_true_f64[elig_mask], p_clipped_f64[elig_mask])

    # Test empty-population guard
    empty_test = independent_compute_metrics(np.array([], dtype=np.float64), np.array([], dtype=np.float64))
    empty_guard_passed = (
        empty_test["count"] == 0 and
        empty_test["mae"] == "UNDEFINED" and
        empty_test["rmse"] == "UNDEFINED" and
        empty_test["wape"] == "UNDEFINED" and
        empty_test["bias"] == "UNDEFINED"
    )

    rep_all = reported_metrics["benchmark_comparison_all_valid"]["hgb_exp2_clipped"]
    rep_elig = reported_metrics["benchmark_comparison_eligible"]["hgb_exp2_clipped"]

    diff_all_mae = abs(recalc_all["mae"] - rep_all["mae"])
    diff_all_rmse = abs(recalc_all["rmse"] - rep_all["rmse"])
    diff_all_wape = abs(recalc_all["wape"] - rep_all["wape"])
    diff_all_bias = abs(recalc_all["bias"] - rep_all["bias"])

    diff_elig_mae = abs(recalc_elig["mae"] - rep_elig["mae"])
    diff_elig_rmse = abs(recalc_elig["rmse"] - rep_elig["rmse"])
    diff_elig_wape = abs(recalc_elig["wape"] - rep_elig["wape"])
    diff_elig_bias = abs(recalc_elig["bias"] - rep_elig["bias"])

    c19 = (
        empty_guard_passed and
        diff_all_mae <= 5e-5 and diff_all_rmse <= 5e-5 and diff_all_wape <= 1e-5 and diff_all_bias <= 5e-5 and
        diff_elig_mae <= 5e-5 and diff_elig_rmse <= 5e-5 and diff_elig_wape <= 1e-5 and diff_elig_bias <= 5e-5
    )
    results["check_19_independent_metric_recalculation_and_guard"] = {
        "passed": bool(c19),
        "empty_population_guard_verified": bool(empty_guard_passed),
        "all_valid_recalculated": recalc_all,
        "eligible_recalculated": recalc_elig,
        "discrepancies_all_valid": {
            "mae_diff": diff_all_mae,
            "rmse_diff": diff_all_rmse,
            "wape_diff": diff_all_wape,
            "bias_diff": diff_all_bias
        },
        "discrepancies_eligible": {
            "mae_diff": diff_elig_mae,
            "rmse_diff": diff_elig_rmse,
            "wape_diff": diff_elig_wape,
            "bias_diff": diff_elig_bias
        }
    }
    print(f"Check 19 (Metrics Recalculation & Empty-Population Guard): {'PASSED' if c19 else 'FAILED'}")

    # --------------------------------------------------------------------------
    # Check 20: Memory reporting honesty
    # --------------------------------------------------------------------------
    mem_rep = reported_metrics["memory"]
    c20 = (
        mem_rep.get("true_peak_rss_during_fit") == "UNMONITORED_AND_UNAVAILABLE" and
        mem_rep.get("host_available_ram_during_training") == "UNKNOWN" and
        mem_rep.get("swap_activity") == "NOT VERIFIED"
    )
    results["check_20_honest_memory_reporting"] = {
        "passed": bool(c20),
        "true_peak_rss_during_fit": mem_rep.get("true_peak_rss_during_fit"),
        "host_available_ram_during_training": mem_rep.get("host_available_ram_during_training"),
        "swap_activity": mem_rep.get("swap_activity")
    }
    print(f"Check 20 (Honest memory classification): {'PASSED' if c20 else 'FAILED'}")

    all_passed = all(r["passed"] for r in results.values())
    print("\n" + "=" * 80)
    print(f"OVERALL VERIFICATION RESULT: {'PASSED' if all_passed else 'FAILED'} ({sum(1 for r in results.values() if r['passed'])} / {len(results)} checks passed)")
    print("=" * 80)

    # Save verification JSON
    verif_path = repo_root / "ml" / "reports" / "phase3_hgb_exp2_7d_verification.json"
    verif_data = convert_types({
        "stage": "Phase 3, Stage 3.6.1",
        "experiment_id": "EXP2_HGB_NO_INVENTORY_7D",
        "all_passed": all_passed,
        "total_checks": len(results),
        "passed_checks": sum(1 for r in results.values() if r["passed"]),
        "overall_verdict": "PASSED" if all_passed else "FAILED",
        "checks": results
    })
    with open(verif_path, "w", encoding="utf-8") as f:
        json.dump(verif_data, f, indent=2)
    print(f"Saved verification results to {verif_path.name}")

    return verif_data


if __name__ == "__main__":
    verif = run_independent_verification()
    sys.exit(0 if verif.get("all_passed") else 1)
