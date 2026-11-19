#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 3, Stage 3.5: EXP1 Full-Dataset 7-Day HistGradientBoosting Model
====================================================================================

Author: Senior Machine Learning Engineer
Date: November 17, 2026

Purpose:
  Train, evaluate, and package the first full-dataset HistGradientBoostingRegressor
  for 7-day demand forecasting (EXP1_HGB_FULL_7D).
  Evaluates strictly against the Stage 3.2 Rolling Average Baseline and Stage 3.3 Ridge Model.

Strict Methodological Rules:
  1. Train solely on Task A (7-day demand, target_7d). Do NOT train 30-day or EXP2/EXP3.
  2. Chronological partitions: Training (2025-12-13 to 2026-07-01), 7D Val (2026-08-01 to 2026-11-08).
  3. Purge window (2026-07-02 to 2026-07-31) preserved.
  4. Features: Exactly the 67 SAFE features (55 numerical, 12 categorical).
  5. Exclude all 5 CONDITIONAL features, future sales, future availability, and IDs as predictors.
  6. Categorical encoding: OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
     fitted exclusively on training observations.
  7. Memory discipline: float32 casting, selective column read, immediate DataFrame disposal.
  8. Early stopping: False. max_iter: 100.
  9. Key alignment: Triple forecast keys must match Stage 3.2 baseline with 0 duplicates and 0 mismatches.
"""

import os
import sys
import time
import json
import psutil
import gc
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd
import joblib

import sklearn
from sklearn.preprocessing import OrdinalEncoder
from sklearn.ensemble import HistGradientBoostingRegressor

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from ml.models.forecaster import HGBDemandForecaster


def get_process_memory_mb() -> float:
    """Returns current process Resident Set Size (RSS) in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)


def get_system_memory() -> Dict[str, float]:
    """Returns total, available, used, and free RAM in GB."""
    mem = psutil.virtual_memory()
    return {
        "total_gb": round(mem.total / (1024 ** 3), 2),
        "available_gb": round(mem.available / (1024 ** 3), 2),
        "used_gb": round(mem.used / (1024 ** 3), 2),
        "free_gb": round(mem.free / (1024 ** 3), 2),
        "percent_used": mem.percent
    }


def load_feature_safety_metadata(repo_root: Path) -> Tuple[List[str], List[str], List[str]]:
    """
    Loads feature safety classifications from phase3_feature_safety_audit.json and
    returns (safe_features, num_cols, cat_cols).
    """
    audit_path = repo_root / "ml" / "reports" / "phase3_feature_safety_audit.json"
    meta_path = repo_root / "ml" / "features" / "feature_metadata.json"

    if not audit_path.exists():
        raise FileNotFoundError(f"Missing feature safety audit: {audit_path}")
    if not meta_path.exists():
        raise FileNotFoundError(f"Missing feature metadata registry: {meta_path}")

    with open(audit_path, "r", encoding="utf-8") as f:
        audit = json.load(f)
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    safe_feats = [
        k for k, v in audit["feature_audit_details"].items()
        if v.get("safety_classification") == "SAFE"
    ]
    if len(safe_feats) != 67:
        raise ValueError(f"Expected exactly 67 SAFE features, found {len(safe_feats)}")

    cat_cols = [
        k for k in safe_feats
        if meta["features"][k].get("data_type") in ["string", "object", "category"]
    ]
    num_cols = [k for k in safe_feats if k not in cat_cols]

    if len(cat_cols) != 12:
        raise ValueError(f"Expected 12 categorical features, found {len(cat_cols)}")
    if len(num_cols) != 55:
        raise ValueError(f"Expected 55 numerical features, found {len(num_cols)}")

    return safe_feats, num_cols, cat_cols


def verify_feature_integrity(
    available_cols: List[str],
    safe_feats: List[str],
    num_cols: List[str],
    cat_cols: List[str]
) -> None:
    """Validates presence and exclusion of features."""
    conditional_features = [
        "outlet_average_daily_demand",
        "average_selling_price_bdt",
        "average_cost_price_bdt",
        "average_restock_frequency_days",
        "days_until_next_festival"
    ]
    if len(safe_feats) != 67:
        raise ValueError(f"Feature integrity failure: Expected 67 SAFE features, got {len(safe_feats)}")
    if len(cat_cols) != 12:
        raise ValueError(f"Feature integrity failure: Expected 12 categorical features, got {len(cat_cols)}")
    if len(num_cols) != 55:
        raise ValueError(f"Feature integrity failure: Expected 55 numerical features, got {len(num_cols)}")

    missing_safe = [f for f in safe_feats if f not in available_cols]
    if missing_safe:
        raise KeyError(f"Feature integrity failure: Dataset is missing required SAFE features: {missing_safe}")

    included_conditional = [f for f in safe_feats if f in conditional_features]
    if included_conditional:
        raise ValueError(f"Feature integrity violation: Conditional features included in safe set: {included_conditional}")


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes MAE, RMSE, WAPE, and Bias with full floating-point precision."""
    n = len(y_true)
    if n == 0:
        return {"count": 0, "mae": 0.0, "rmse": 0.0, "wape": 0.0, "bias": 0.0}

    err = y_pred - y_true
    abs_err = np.abs(err)
    mae = float(np.mean(abs_err))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    sum_y = float(np.sum(y_true))
    wape = float(np.sum(abs_err) / sum_y) if sum_y > 0 else 0.0
    bias = float(np.mean(err))

    return {
        "count": int(n),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "wape": round(wape, 6),
        "bias": round(bias, 4)
    }


def train_exp1_hgb_7d(repo_root: Path) -> Dict[str, Any]:
    """
    Executes EXP1: Full-Dataset 7-Day HistGradientBoosting Model.
    """
    print("\n" + "=" * 80)
    print("BazarBondhu AI — Phase 3, Stage 3.5: EXP1_HGB_FULL_7D")
    print("=" * 80)

    # 1. Resource and Environment Inspection
    sys_mem_start = get_system_memory()
    proc_rss_start = get_process_memory_mb()
    disk = psutil.disk_usage(str(repo_root))
    free_disk_gb = round(disk.free / (1024 ** 3), 2)

    print(f"\n[1] Environment & Resource Baseline:")
    print(f"    - Python: {sys.version.split()[0]} | Scikit-Learn: {sklearn.__version__}")
    print(f"    - System Total RAM: {sys_mem_start['total_gb']} GB | Available: {sys_mem_start['available_gb']} GB")
    print(f"    - Free Disk Space: {free_disk_gb} GB")
    print(f"    - Baseline Process RSS: {proc_rss_start:.2f} MB")

    if sys_mem_start["available_gb"] < 3.0:
        raise MemoryError(f"Insufficient available RAM: {sys_mem_start['available_gb']} GB. Minimum 3.0 GB required.")

    # 2. Feature Safety Metadata
    print(f"\n[2] Loading Feature Safety Metadata:")
    safe_feats, num_cols, cat_cols = load_feature_safety_metadata(repo_root)
    print(f"    - Approved SAFE features: {len(safe_feats)} (55 numerical, 12 categorical)")
    print(f"    - Numerical features (0..54): {num_cols[:3]} ... {num_cols[-2:]}")
    print(f"    - Categorical features (55..66): {cat_cols}")

    dataset_csv = repo_root / "ml" / "data" / "model_dataset_7d.csv"
    if not dataset_csv.exists():
        raise FileNotFoundError(f"Missing dataset: {dataset_csv}")

    # Inspect CSV header
    df_sample = pd.read_csv(dataset_csv, nrows=10)
    verify_feature_integrity(list(df_sample.columns), safe_feats, num_cols, cat_cols)
    del df_sample
    gc.collect()

    # 3. Loading Training Partition with Memory Discipline
    print(f"\n[3] Loading Training Partition (2025-12-13 to 2026-07-01)...")
    cols_to_load = ["forecast_origin_date", "target_7d"] + safe_feats
    
    t0_load = time.time()
    chunks = []
    for chunk in pd.read_csv(dataset_csv, usecols=cols_to_load, chunksize=100000):
        mask = (chunk["forecast_origin_date"] >= "2025-12-13") & (chunk["forecast_origin_date"] <= "2026-07-01")
        c_filtered = chunk[mask]
        if len(c_filtered) > 0:
            chunks.append(c_filtered)
        if (chunk["forecast_origin_date"] > "2026-07-01").any():
            break

    df_train = pd.concat(chunks, ignore_index=True)
    load_time = time.time() - t0_load
    del chunks
    gc.collect()

    n_train = len(df_train)
    print(f"    - Loaded {n_train:,} training rows in {load_time:.2f}s")
    if n_train != 2664456:
        raise ValueError(f"Expected exactly 2,664,456 training rows, found {n_train}")

    # Verify origin date bounds
    min_date = df_train["forecast_origin_date"].min()
    max_date = df_train["forecast_origin_date"].max()
    print(f"    - Verified Date Range: {min_date} to {max_date} (Purge window 2026-07-02..2026-07-31 preserved)")

    # 4. Feature Assembly & Categorical Encoding (Training only)
    print(f"\n[4] Fitting Categorical Preprocessor & Assembling Feature Matrix...")
    t0_prep = time.time()
    proc_rss_pre_prep = get_process_memory_mb()

    # Fit OrdinalEncoder strictly on training data
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    # Ensure strings are properly cast
    df_train_cat = df_train[cat_cols].astype(str)
    cat_encoded = encoder.fit_transform(df_train_cat).astype(np.float32)
    del df_train_cat
    gc.collect()

    # Check cardinalities
    print(f"    - Discovered categorical vocabularies on training partition:")
    for col, cats in zip(cat_cols, encoder.categories_):
        print(f"      * {col:20s}: {len(cats):3d} unique categories (max_bins check: {len(cats) <= 255})")

    # Extract numerical features as float32
    num_matrix = df_train[num_cols].to_numpy(dtype=np.float32)
    y_train = df_train["target_7d"].to_numpy(dtype=np.float32)

    # Combined feature matrix (num_cols 0..54, cat_cols 55..66)
    X_train = np.column_stack([num_matrix, cat_encoded])
    cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))

    prep_time = time.time() - t0_prep

    # Clean up raw DataFrame immediately to maintain memory budget
    del df_train, num_matrix, cat_encoded
    gc.collect()

    proc_rss_post_prep = get_process_memory_mb()
    matrix_size_mb = X_train.nbytes / (1024 * 1024)
    print(f"    - Preprocessing completed in {prep_time:.2f}s")
    print(f"    - X_train Shape: {X_train.shape} | Dtype: {X_train.dtype} | In-Memory Size: {matrix_size_mb:.2f} MB")
    print(f"    - Categorical feature column indices: {cat_indices}")
    print(f"    - Process RSS after raw DataFrame disposal: {proc_rss_post_prep:.2f} MB")

    # 5. Model Initialization & Fitting
    print(f"\n[5] Fitting HistGradientBoostingRegressor (EXP1_HGB_FULL_7D)...")
    print(f"    - Configuration:")
    print(f"      loss='squared_error', learning_rate=0.1, max_iter=100")
    print(f"      max_leaf_nodes=31, min_samples_leaf=50, l2_regularization=1.0")
    print(f"      early_stopping=False, random_state=42")

    hgb = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.1,
        max_iter=100,
        max_leaf_nodes=31,
        min_samples_leaf=50,
        l2_regularization=1.0,
        early_stopping=False,
        categorical_features=cat_indices,
        random_state=42
    )

    t0_fit = time.time()
    proc_rss_pre_fit = get_process_memory_mb()
    hgb.fit(X_train, y_train)
    fit_time = time.time() - t0_fit
    proc_rss_post_fit = get_process_memory_mb()

    print(f"    - Fit completed successfully in {fit_time:.2f}s ({fit_time/100*1000:.2f} ms/tree)!")
    print(f"    - Peak Process RSS during fit: {proc_rss_post_fit:.2f} MB (Delta: +{proc_rss_post_fit - proc_rss_pre_fit:.2f} MB)")
    print(f"    - Total boosting iterations completed: {hgb.n_iter_}")

    # Dispose of training matrix before validation loading
    del X_train, y_train
    gc.collect()
    print(f"    - Disposed training matrix. Post-cleanup RSS: {get_process_memory_mb():.2f} MB")

    # 6. Packaging Model Artifact
    print(f"\n[6] Packaging Self-Contained HGBDemandForecaster Artifact...")
    model_dir = repo_root / "ml" / "models" / "7d"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "hgb_exp1_full_model.joblib"

    metadata = {
        "experiment_id": "EXP1_HGB_FULL_7D",
        "horizon": "7d",
        "target_col": "target_7d",
        "training_rows": n_train,
        "training_period": f"{min_date} to {max_date}",
        "safe_features_count": len(safe_feats),
        "num_features_count": len(num_cols),
        "cat_features_count": len(cat_cols),
        "categorical_indices": cat_indices,
        "hyperparameters": {
            "loss": "squared_error",
            "learning_rate": 0.1,
            "max_iter": 100,
            "max_leaf_nodes": 31,
            "min_samples_leaf": 50,
            "l2_regularization": 1.0,
            "early_stopping": False,
            "random_state": 42
        },
        "timing": {
            "preprocessing_seconds": round(prep_time, 2),
            "fitting_seconds": round(fit_time, 2)
        }
    }

    forecaster = HGBDemandForecaster(
        encoder=encoder,
        hgb=hgb,
        num_cols=num_cols,
        cat_cols=cat_cols,
        safe_features=safe_feats,
        horizon="7d",
        target_col="target_7d",
        metadata=metadata
    )

    joblib.dump(forecaster, model_path, compress=3)
    model_size_mb = model_path.stat().st_size / (1024 * 1024)
    print(f"    - Serialized model artifact to {model_path.name} ({model_size_mb:.2f} MB)")

    # 7. Loading Validation Partition
    print(f"\n[7] Loading 7-Day Validation Partition (2026-08-01 to 2026-11-08)...")
    val_cols = [
        "outlet_id", "product_id", "forecast_origin_date", "target_7d",
        "is_eligible_acc_5of7", "category", "outlet_type", "area_type", "sales_mean_28d"
    ] + safe_feats

    # Ensure unique list of columns
    val_cols = list(dict.fromkeys(val_cols))

    t0_val_load = time.time()
    val_chunks = []
    for chunk in pd.read_csv(dataset_csv, usecols=val_cols, chunksize=100000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-11-08")
        c_filtered = chunk[mask]
        if len(c_filtered) > 0:
            val_chunks.append(c_filtered)
        if (chunk["forecast_origin_date"] > "2026-11-08").any():
            break

    df_val = pd.concat(val_chunks, ignore_index=True)
    val_load_time = time.time() - t0_val_load
    del val_chunks
    gc.collect()

    n_val = len(df_val)
    print(f"    - Loaded {n_val:,} validation rows in {val_load_time:.2f}s")
    if n_val != 1325600:
        raise ValueError(f"Expected exactly 1,325,600 validation rows, found {n_val}")

    # Extract metadata columns for evaluation
    df_meta = df_val[[
        "outlet_id", "product_id", "forecast_origin_date",
        "category", "outlet_type", "area_type", "sales_mean_28d", "is_eligible_acc_5of7"
    ]].copy()
    y_val = df_val["target_7d"].to_numpy(dtype=np.float32)

    # Transform validation features
    t0_val_prep = time.time()
    df_val_cat = df_val[cat_cols].astype(str)
    val_cat_encoded = encoder.transform(df_val_cat).astype(np.float32)
    val_num_matrix = df_val[num_cols].to_numpy(dtype=np.float32)
    X_val = np.column_stack([val_num_matrix, val_cat_encoded])
    val_prep_time = time.time() - t0_val_prep

    # Dispose of raw validation DataFrame
    del df_val, df_val_cat, val_cat_encoded, val_num_matrix
    gc.collect()

    # 8. Generating Validation Predictions
    print(f"\n[8] Generating Validation Predictions across {n_val:,} rows...")
    t0_pred = time.time()
    raw_preds = hgb.predict(X_val)
    pred_time = time.time() - t0_pred
    del X_val
    gc.collect()

    throughput = len(raw_preds) / pred_time
    print(f"    - Inference completed in {pred_time:.2f}s ({throughput:,.0f} rows/s)")

    # Check prediction finiteness and boundaries
    non_finite_count = int(np.sum(~np.isfinite(raw_preds)))
    if non_finite_count > 0:
        raise ValueError(f"Generated {non_finite_count} non-finite predictions (NaN or Inf)!")

    raw_min = float(np.min(raw_preds))
    raw_max = float(np.max(raw_preds))
    raw_mean = float(np.mean(raw_preds))
    neg_mask = raw_preds < 0
    neg_count = int(np.sum(neg_mask))
    neg_pct = float(neg_count / len(raw_preds) * 100)

    clipped_preds = np.clip(raw_preds, 0, None)
    clipped_min = float(np.min(clipped_preds))
    clipped_max = float(np.max(clipped_preds))
    clipped_mean = float(np.mean(clipped_preds))

    print(f"    - Raw Predictions: Min = {raw_min:.4f} | Max = {raw_max:.4f} | Mean = {raw_mean:.4f}")
    print(f"    - Negative Raw Count: {neg_count:,} ({neg_pct:.2f}%)")
    print(f"    - Clipped Predictions: Min = {clipped_min:.4f} | Max = {clipped_max:.4f} | Mean = {clipped_mean:.4f}")

    # 9. Baseline & Ridge Key Alignment Verification
    print(f"\n[9] Verifying Exact Alignment with Baseline and Ridge Predictions...")
    base_pred_csv = repo_root / "ml" / "predictions" / "validation_predictions_7d.csv"
    ridge_pred_csv = repo_root / "ml" / "predictions" / "ridge_validation_predictions_7d.csv"

    if not base_pred_csv.exists():
        raise FileNotFoundError(f"Missing baseline prediction file: {base_pred_csv}")
    if not ridge_pred_csv.exists():
        raise FileNotFoundError(f"Missing Ridge prediction file: {ridge_pred_csv}")

    key_cols = ["outlet_id", "product_id", "forecast_origin_date"]
    df_base = pd.read_csv(base_pred_csv, usecols=key_cols + ["rolling_average_baseline"])
    df_ridge = pd.read_csv(ridge_pred_csv, usecols=key_cols + ["clipped_prediction"])

    # Duplicate checks
    if df_meta[key_cols].duplicated().any():
        raise ValueError("Duplicate forecast keys detected in validation partition!")
    if df_base[key_cols].duplicated().any():
        raise ValueError("Duplicate forecast keys detected in baseline prediction file!")
    if df_ridge[key_cols].duplicated().any():
        raise ValueError("Duplicate forecast keys detected in Ridge prediction file!")

    # Exact key match assertions
    base_mismatch = (
        (df_meta["outlet_id"].values != df_base["outlet_id"].values) |
        (df_meta["product_id"].values != df_base["product_id"].values) |
        (df_meta["forecast_origin_date"].values != df_base["forecast_origin_date"].values)
    )
    if base_mismatch.any():
        raise ValueError(f"Key mismatch against baseline predictions: {np.sum(base_mismatch)} rows differ!")

    ridge_mismatch = (
        (df_meta["outlet_id"].values != df_ridge["outlet_id"].values) |
        (df_meta["product_id"].values != df_ridge["product_id"].values) |
        (df_meta["forecast_origin_date"].values != df_ridge["forecast_origin_date"].values)
    )
    if ridge_mismatch.any():
        raise ValueError(f"Key mismatch against Ridge predictions: {np.sum(ridge_mismatch)} rows differ!")

    print(f"    - Forecast Keys Verified: 0 duplicate keys, 0 key mismatches across all {n_val:,} rows.")

    baseline_preds = df_base["rolling_average_baseline"].values
    ridge_preds = df_ridge["clipped_prediction"].values

    # 10. Quantitative Evaluation: Overall & Populations
    print(f"\n[10] Computing Comprehensive Benchmark Metrics...")
    elig_mask = df_meta["is_eligible_acc_5of7"].values == 1

    # Population A: All Valid (Primary)
    hgb_all_raw = compute_metrics(y_val, raw_preds)
    hgb_all_clipped = compute_metrics(y_val, clipped_preds)
    base_all = compute_metrics(y_val, baseline_preds)
    ridge_all = compute_metrics(y_val, ridge_preds)

    # Population B: Availability-Eligible (Secondary Diagnostic)
    hgb_elig_raw = compute_metrics(y_val[elig_mask], raw_preds[elig_mask])
    hgb_elig_clipped = compute_metrics(y_val[elig_mask], clipped_preds[elig_mask])
    base_elig = compute_metrics(y_val[elig_mask], baseline_preds[elig_mask])
    ridge_elig = compute_metrics(y_val[elig_mask], ridge_preds[elig_mask])

    print(f"\n    --- POPULATION A: ALL VALID VALIDATION ROWS ({n_val:,} rows) ---")
    print(f"    Baseline (Rolling 28d): WAPE = {base_all['wape']*100:6.2f}% | MAE = {base_all['mae']:.4f} | RMSE = {base_all['rmse']:.4f} | Bias = {base_all['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):      WAPE = {ridge_all['wape']*100:6.2f}% | MAE = {ridge_all['mae']:.4f} | RMSE = {ridge_all['rmse']:.4f} | Bias = {ridge_all['bias']:+.4f}")
    print(f"    HGB EXP1 (Raw):         WAPE = {hgb_all_raw['wape']*100:6.2f}% | MAE = {hgb_all_raw['mae']:.4f} | RMSE = {hgb_all_raw['rmse']:.4f} | Bias = {hgb_all_raw['bias']:+.4f}")
    print(f"    HGB EXP1 (Clipped):     WAPE = {hgb_all_clipped['wape']*100:6.2f}% | MAE = {hgb_all_clipped['mae']:.4f} | RMSE = {hgb_all_clipped['rmse']:.4f} | Bias = {hgb_all_clipped['bias']:+.4f}")

    print(f"\n    --- POPULATION B: AVAILABILITY-ELIGIBLE ROWS ({int(np.sum(elig_mask)):,} rows) ---")
    print(f"    Baseline (Rolling 28d): WAPE = {base_elig['wape']*100:6.2f}% | MAE = {base_elig['mae']:.4f} | RMSE = {base_elig['rmse']:.4f} | Bias = {base_elig['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):      WAPE = {ridge_elig['wape']*100:6.2f}% | MAE = {ridge_elig['mae']:.4f} | RMSE = {ridge_elig['rmse']:.4f} | Bias = {ridge_elig['bias']:+.4f}")
    print(f"    HGB EXP1 (Clipped):     WAPE = {hgb_elig_clipped['wape']*100:6.2f}% | MAE = {hgb_elig_clipped['mae']:.4f} | RMSE = {hgb_elig_clipped['rmse']:.4f} | Bias = {hgb_elig_clipped['bias']:+.4f}")

    # Sliced Evaluations
    print(f"\n    - Computing Stratified Slices (Demand Tier, Category, Outlet Type)...")
    rate = df_meta["sales_mean_28d"].values * 7.0  # units/week
    tier_definitions = {
        "Zero / Intermittent (<2/wk)": rate < 2.0,
        "Low (2 to <10/wk)": (rate >= 2.0) & (rate < 10.0),
        "Medium (10 to 50/wk)": (rate >= 10.0) & (rate <= 50.0),
        "High (>50/wk)": rate > 50.0
    }

    tier_metrics = {}
    for tier_name, mask in tier_definitions.items():
        tier_metrics[tier_name] = {
            "samples": int(np.sum(mask)),
            "hgb_clipped": compute_metrics(y_val[mask], clipped_preds[mask]),
            "hgb_raw": compute_metrics(y_val[mask], raw_preds[mask]),
            "ridge": compute_metrics(y_val[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val[mask], baseline_preds[mask])
        }

    category_metrics = {}
    for cat in sorted(df_meta["category"].dropna().unique()):
        mask = (df_meta["category"] == cat).values
        category_metrics[cat] = {
            "samples": int(np.sum(mask)),
            "hgb_clipped": compute_metrics(y_val[mask], clipped_preds[mask]),
            "ridge": compute_metrics(y_val[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val[mask], baseline_preds[mask])
        }

    outlet_type_metrics = {}
    for otype in sorted(df_meta["outlet_type"].dropna().unique()):
        mask = (df_meta["outlet_type"] == otype).values
        outlet_type_metrics[otype] = {
            "samples": int(np.sum(mask)),
            "hgb_clipped": compute_metrics(y_val[mask], clipped_preds[mask]),
            "ridge": compute_metrics(y_val[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val[mask], baseline_preds[mask])
        }

    # 11. Export Prediction Artifact
    print(f"\n[11] Exporting Validation Predictions Artifact...")
    pred_out_csv = repo_root / "ml" / "predictions" / "hgb_exp1_validation_predictions_7d.csv"
    pred_df = pd.DataFrame({
        "outlet_id": df_meta["outlet_id"],
        "product_id": df_meta["product_id"],
        "forecast_origin_date": df_meta["forecast_origin_date"],
        "actual_target": y_val,
        "predicted_7d_raw": np.round(raw_preds, 4),
        "predicted_7d_clipped": np.round(clipped_preds, 4),
        "baseline_prediction": np.round(baseline_preds, 4),
        "ridge_prediction": np.round(ridge_preds, 4),
        "is_eligible_acc_5of7": df_meta["is_eligible_acc_5of7"]
    })
    pred_df.to_csv(pred_out_csv, index=False)
    pred_file_size_mb = pred_out_csv.stat().st_size / (1024 ** 2)
    print(f"    - Saved {pred_out_csv.name} ({pred_file_size_mb:.2f} MB, {len(pred_df):,} rows)")

    # 12. Inference Reproducibility Test
    print(f"\n[12] Testing Inference Reproducibility on Reloaded Artifact...")
    reloaded_forecaster = joblib.load(model_path)
    test_sample = pd.read_csv(dataset_csv, skiprows=range(1, 2664456 + 1), nrows=1000)
    reloaded_preds = reloaded_forecaster.predict(test_sample)
    in_memory_preds = clipped_preds[:1000]

    max_diff = float(np.max(np.abs(reloaded_preds - in_memory_preds)))
    print(f"    - Max absolute prediction difference: {max_diff:.8e}")
    if max_diff > 1e-5:
        raise ValueError(f"Reproducibility failure: Reloaded model differs by {max_diff}!")
    print(f"    - Inference Reproducibility: VERIFIED EXACT (Delta < 1e-5).")

    # 13. Export Metrics JSON
    print(f"\n[13] Saving Machine-Readable Metrics JSON...")
    metrics_path = repo_root / "ml" / "reports" / "phase3_hgb_exp1_7d_metrics.json"
    full_metrics_data = {
        "experiment_id": "EXP1_HGB_FULL_7D",
        "horizon": "7d",
        "target_col": "target_7d",
        "status": "COMPLETED",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "training_partition": {
            "start_date": min_date,
            "end_date": max_date,
            "rows": n_train
        },
        "validation_partition": {
            "start_date": df_meta["forecast_origin_date"].min(),
            "end_date": df_meta["forecast_origin_date"].max(),
            "rows": n_val
        },
        "features": {
            "total_safe": len(safe_feats),
            "numerical_count": len(num_cols),
            "categorical_count": len(cat_cols)
        },
        "timing": {
            "preprocessing_seconds": round(prep_time, 2),
            "fitting_seconds": round(fit_time, 2),
            "prediction_seconds": round(pred_time, 2),
            "prediction_throughput_rows_per_sec": round(throughput, 1)
        },
        "memory": {
            "baseline_process_rss_mb": round(proc_rss_start, 2),
            "post_prep_process_rss_mb": round(proc_rss_post_prep, 2),
            "peak_fit_process_rss_mb": round(proc_rss_post_fit, 2),
            "final_process_rss_mb": round(get_process_memory_mb(), 2),
            "system_ram_available_start_gb": sys_mem_start["available_gb"]
        },
        "prediction_statistics": {
            "raw_min": raw_min,
            "raw_max": raw_max,
            "raw_mean": raw_mean,
            "clipped_min": clipped_min,
            "clipped_max": clipped_max,
            "clipped_mean": clipped_mean,
            "negative_raw_count": neg_count,
            "negative_raw_pct": round(neg_pct, 2),
            "non_finite_count": non_finite_count
        },
        "benchmark_comparison_all_valid": {
            "hgb_clipped": hgb_all_clipped,
            "hgb_raw": hgb_all_raw,
            "ridge_clipped": ridge_all,
            "baseline_rolling": base_all,
            "wape_lift_pp_vs_baseline": round((base_all["wape"] - hgb_all_clipped["wape"]) * 100, 2),
            "wape_lift_pp_vs_ridge": round((ridge_all["wape"] - hgb_all_clipped["wape"]) * 100, 2),
            "mae_reduction_pct_vs_baseline": round((base_all["mae"] - hgb_all_clipped["mae"]) / base_all["mae"] * 100, 2),
            "mae_reduction_pct_vs_ridge": round((ridge_all["mae"] - hgb_all_clipped["mae"]) / ridge_all["mae"] * 100, 2)
        },
        "benchmark_comparison_eligible": {
            "hgb_clipped": hgb_elig_clipped,
            "ridge_clipped": ridge_elig,
            "baseline_rolling": base_elig,
            "wape_lift_pp_vs_baseline": round((base_elig["wape"] - hgb_elig_clipped["wape"]) * 100, 2),
            "wape_lift_pp_vs_ridge": round((ridge_elig["wape"] - hgb_elig_clipped["wape"]) * 100, 2)
        },
        "stratified_breakdowns": {
            "by_demand_tier": tier_metrics,
            "by_outlet_type": outlet_type_metrics,
            "by_product_category": category_metrics
        },
        "artifacts": {
            "model_path": str(model_path.relative_to(repo_root)),
            "model_size_mb": round(model_size_mb, 2),
            "predictions_path": str(pred_out_csv.relative_to(repo_root)),
            "predictions_size_mb": round(pred_file_size_mb, 2)
        }
    }

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(full_metrics_data, f, indent=2)
    print(f"    - Saved metrics to {metrics_path.name}")

    print("\n" + "=" * 80)
    print("EXP1_HGB_FULL_7D EXECUTION FINISHED SUCCESSFULLY")
    print("=" * 80)

    return full_metrics_data


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    train_exp1_hgb_7d(repo_root)
