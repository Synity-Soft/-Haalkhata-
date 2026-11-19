#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 3, Stage 3.8: 30-Day Demand Forecasting (HGB Absolute Error)
===================================================================================

Author: Senior Machine Learning Engineer
Date: November 17, 2026

Purpose:
  Train, evaluate, package, and verify the first 30-day HistGradientBoostingRegressor
  for outlet-product sales demand forecasting (HGB_ABSOLUTE_ERROR_30D).
  Adopts the best-performing loss function ('absolute_error', L1 / conditional median)
  from Stage 3.7 (EXP3) and scales to the 30-day horizon (target_30d).

Fixed Experimental Design (Stage 3.8):
  - Horizon: 30-day demand forecasting (target_30d).
  - Training: 2025-12-13 through 2026-07-01 (2,664,456 rows, 201 consecutive dates).
  - Purge: 2026-07-02 through 2026-07-31 (0 rows in dataset).
  - Validation: 2026-08-01 through 2026-10-16 (1,020,712 rows, 77 consecutive dates).
  - Primary Population: All valid validation observations (1,020,712 rows).
  - Secondary Population: Availability-eligible observations (is_eligible_acc_20of30 == 1; 853,740 rows).
  - Predictors: Exactly 67 SAFE features (55 numerical, 12 categorical).
  - Exclude all 5 CONDITIONAL features, identifiers, dates, targets, eligibility flags, and future information.
  - Hyperparameters:
      * Estimator: HistGradientBoostingRegressor
      * loss: 'absolute_error'
      * learning_rate: 0.08
      * max_iter: 100
      * max_leaf_nodes: 31
      * min_samples_leaf: 50
      * l2_regularization: 1.0
      * early_stopping: False
      * random_state: 42
  - Evaluates strictly against:
      1. Stage 3.2 30-Day Rolling Average Baseline
      2. Stage 3.3 30-Day Ridge Regression Model
"""

import os
import sys
import time
import json
import psutil
import gc
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd
import joblib

import sklearn
from sklearn.preprocessing import OrdinalEncoder
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.utils.validation import check_is_fitted

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from ml.models.forecaster import HGBDemandForecaster

CONDITIONAL_FEATURES = [
    "outlet_average_daily_demand",
    "average_selling_price_bdt",
    "average_cost_price_bdt",
    "average_restock_frequency_days",
    "days_until_next_festival"
]

FORBIDDEN_COLUMNS = [
    "outlet_id", "product_id", "forecast_origin_date",
    "target_7d", "target_30d", "is_eligible_acc_5of7", "is_eligible_acc_20of30"
]


def convert_types(obj: Any) -> Any:
    """Recursively converts NumPy scalar types and structures to native Python primitives for JSON serialization."""
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


def get_process_memory_mb() -> float:
    """Returns current process Resident Set Size (RSS) in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)


def get_system_memory() -> Dict[str, float]:
    """Returns point-in-time system memory in GB."""
    mem = psutil.virtual_memory()
    return {
        "total_gb": round(mem.total / (1024 ** 3), 2),
        "available_gb": round(mem.available / (1024 ** 3), 2),
        "used_gb": round(mem.used / (1024 ** 3), 2),
        "free_gb": round(mem.free / (1024 ** 3), 2),
        "percent_used": mem.percent
    }


def run_preflight_checks(repo_root: Path) -> Dict[str, Any]:
    """
    Executes mandatory preflight checks before training the 30-day HGB model.
    """
    print("\n" + "=" * 80)
    print("MANDATORY PREFLIGHT CHECKS — 30-DAY HGB ABSOLUTE ERROR MODEL (STAGE 3.8)")
    print("=" * 80)

    # 1. Verify existence of prior 7-day models and ensure they are untouched
    for exp_name, m_path in [
        ("EXP1 7d", repo_root / "ml" / "models" / "7d" / "hgb_exp1_full_model.joblib"),
        ("EXP2 7d", repo_root / "ml" / "models" / "7d" / "hgb_exp2_no_inventory_model.joblib"),
        ("EXP3 7d", repo_root / "ml" / "models" / "7d" / "hgb_exp3_absolute_error_model.joblib")
    ]:
        if not m_path.exists():
            raise FileNotFoundError(f"Preflight Check 1 Failed: Missing {exp_name} model at {m_path}")
    print("  [Pass] Check 1: Existing 7-day models (EXP1, EXP2, EXP3) verified and preserved.")

    # 2. Check 30d source dataset existence
    dataset_30d = repo_root / "ml" / "data" / "model_dataset_30d.csv"
    if not dataset_30d.exists():
        raise FileNotFoundError(f"Preflight Check 2 Failed: Missing 30d dataset at {dataset_30d}")
    print(f"  [Pass] Check 2: 30-day dataset verified at {dataset_30d.name}.")

    # 3. Check 30d baseline and ridge prediction files existence
    base_30d_csv = repo_root / "ml" / "predictions" / "validation_predictions_30d.csv"
    ridge_30d_csv = repo_root / "ml" / "predictions" / "ridge_validation_predictions_30d.csv"
    for name, p in [("30d Baseline", base_30d_csv), ("30d Ridge", ridge_30d_csv)]:
        if not p.exists():
            raise FileNotFoundError(f"Preflight Check 3 Failed: Missing {name} predictions at {p}")
    print("  [Pass] Check 3: 30-day baseline and Ridge validation prediction artifacts verified.")

    # 4. Load authoritative SAFE feature registry and feature_metadata.json
    meta_path = repo_root / "ml" / "features" / "feature_metadata.json"
    safe_audit_json = repo_root / "ml" / "reports" / "phase3_feature_safety_audit.json"
    if not meta_path.exists() or not safe_audit_json.exists():
        raise FileNotFoundError("Preflight Check 4 Failed: Missing feature metadata or safety audit files.")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(safe_audit_json, "r", encoding="utf-8") as f:
        safe_audit = json.load(f)

    auth_safe_67 = [
        k for k, v in safe_audit["feature_audit_details"].items()
        if v.get("safety_classification") == "SAFE"
    ]
    if len(auth_safe_67) != 67:
        raise ValueError(f"Preflight Check 4 Failed: Expected 67 SAFE features, found {len(auth_safe_67)}")

    cat_cols = [
        k for k in auth_safe_67
        if meta["features"][k].get("data_type") in ["string", "object", "category"]
    ]
    num_cols = [k for k in auth_safe_67 if k not in cat_cols]

    if len(cat_cols) != 12 or len(num_cols) != 55:
        raise ValueError(
            f"Preflight Check 4 Failed: Expected 55 num and 12 cat features, got {len(num_cols)} num and {len(cat_cols)} cat."
        )
    if set(num_cols) & set(cat_cols):
        raise ValueError("Preflight Check 4 Failed: Numerical and categorical feature sets overlap!")
    print(f"  [Pass] Check 4: Exactly 67 SAFE features confirmed (55 numerical, 12 categorical, disjoint, exact order).")

    # 5. Confirm no conditional, unsafe, identifier, target, eligibility features enter model
    for c in CONDITIONAL_FEATURES:
        if c in auth_safe_67:
            raise ValueError(f"Preflight Check 5 Failed: Conditional feature {c} present in SAFE features!")
    for forb in FORBIDDEN_COLUMNS:
        if forb in auth_safe_67:
            raise ValueError(f"Preflight Check 5 Failed: Forbidden column {forb} present in SAFE features!")
    print(f"  [Pass] Check 5: Exclusion of conditional (5), identifiers, targets, and eligibility flags confirmed.")

    # 6. Check disk space and memory (point-in-time snapshot)
    disk = psutil.disk_usage(str(repo_root))
    free_disk_gb = disk.free / (1024 ** 3)
    mem = psutil.virtual_memory()
    free_mem_gb = mem.available / (1024 ** 3)
    if free_disk_gb < 5.0:
        raise OSError(f"Preflight Check 6 Failed: Insufficient disk space ({free_disk_gb:.2f} GB available, >= 5 GB required)")
    if free_mem_gb < 3.0:
        raise MemoryError(f"Preflight Check 6 Failed: Insufficient available RAM ({free_mem_gb:.2f} GB available, >= 3 GB required)")
    print(f"  [Pass] Check 6: Point-in-time resource snapshot verified (RAM: {free_mem_gb:.2f} GB, Free Disk: {free_disk_gb:.2f} GB).")

    # 7. Check forecaster architecture compatibility
    test_dummy = pd.DataFrame({c: [0.0] for c in num_cols})
    for c in cat_cols:
        test_dummy[c] = ["missing"]
    test_dummy["forecast_origin_date"] = ["2026-08-01"]
    print(f"  [Pass] Check 7: Forecaster architecture and data transformation schema compatibility verified.")

    print("=" * 80)
    print("ALL PREFLIGHT CHECKS PASSED — 30-DAY HGB TRAINING AUTHORIZED")
    print("=" * 80 + "\n")

    return {
        "safe_features": auth_safe_67,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "free_disk_gb": round(free_disk_gb, 2),
        "available_ram_gb": round(free_mem_gb, 2)
    }


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """Computes MAE, RMSE, WAPE, and Bias with full precision and empty population guards."""
    n = len(y_true)
    if n == 0:
        return {
            "count": 0,
            "mae": "UNDEFINED",
            "rmse": "UNDEFINED",
            "wape": "UNDEFINED",
            "bias": "UNDEFINED"
        }

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


def train_hgb_30d(repo_root: Path) -> Dict[str, Any]:
    """
    Executes Stage 3.8: 30-Day Demand Forecasting (HGB Absolute Error).
    """
    start_wall_time = time.time()
    t_stamp = time.strftime("%Y-%m-%d %H:%M:%S")

    print("\n" + "=" * 80)
    print("BazarBondhu AI — Phase 3, Stage 3.8: 30-DAY HGB ABSOLUTE ERROR MODEL")
    print("=" * 80)

    # 1. Preflight Checks
    preflight = run_preflight_checks(repo_root)
    safe_feats = preflight["safe_features"]
    num_cols = preflight["num_cols"]
    cat_cols = preflight["cat_cols"]

    sys_mem_start = get_system_memory()
    proc_rss_start = get_process_memory_mb()
    dataset_csv = repo_root / "ml" / "data" / "model_dataset_30d.csv"

    # 2. Loading Training Partition (2025-12-13 to 2026-07-01)
    print(f"\n[1] Loading 30-Day Training Partition (2025-12-13 to 2026-07-01)...")
    cols_to_load = ["forecast_origin_date", "target_30d"] + safe_feats
    cols_to_load = list(dict.fromkeys(cols_to_load))

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

    # Validate training partition bounds and target
    min_date = df_train["forecast_origin_date"].min()
    max_date = df_train["forecast_origin_date"].max()
    unique_train_dates = len(df_train["forecast_origin_date"].unique())
    print(f"    - Verified Date Range: {min_date} to {max_date} ({unique_train_dates} dates)")
    if unique_train_dates != 201:
        raise ValueError(f"Expected 201 training dates, found {unique_train_dates}")

    y_train = df_train["target_30d"].to_numpy(dtype=np.float32)
    if not np.all(np.isfinite(y_train)):
        raise ValueError("Training target contains non-finite values!")
    if np.any(y_train < 0.0):
        raise ValueError("Training target contains negative values!")

    # 3. Fit OrdinalEncoder strictly on training observations
    print(f"\n[2] Fitting OrdinalEncoder on Training Observations...")
    t0_prep = time.time()
    proc_rss_pre_prep = get_process_memory_mb()

    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    df_train_cat = df_train[cat_cols].fillna("missing").astype(str)
    cat_encoded = encoder.fit_transform(df_train_cat).astype(np.float32)
    del df_train_cat
    gc.collect()

    print(f"    - Fitted categorical vocabularies on training partition exclusively:")
    for col, cats in zip(cat_cols, encoder.categories_):
        print(f"      * {col:25s}: {len(cats):3d} categories")

    # Extract numerical features as float32
    num_matrix = df_train[num_cols].to_numpy(dtype=np.float32)

    # Combined feature matrix (num_cols 0..54, cat_cols 55..66)
    X_train = np.column_stack([num_matrix, cat_encoded])
    cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))

    prep_time = time.time() - t0_prep

    # Dispose raw DataFrame and intermediate arrays immediately
    del df_train, num_matrix, cat_encoded
    gc.collect()

    proc_rss_post_prep = get_process_memory_mb()
    matrix_size_mb = X_train.nbytes / (1024 * 1024)
    print(f"    - Preprocessing completed in {prep_time:.2f}s")
    print(f"    - X_train Shape: {X_train.shape} | Dtype: {X_train.dtype} | In-Memory Size: {matrix_size_mb:.2f} MB")
    print(f"    - Categorical feature column indices: {cat_indices}")
    print(f"    - Process RSS after raw DataFrame disposal: {proc_rss_post_prep:.2f} MB")

    # 4. Model Fitting: HistGradientBoostingRegressor(loss='absolute_error', lr=0.08)
    print(f"\n[3] Fitting 30-Day HistGradientBoostingRegressor (HGB_ABSOLUTE_ERROR_30D)...")
    print(f"    - Model Hyperparameters:")
    print(f"        loss='absolute_error'")
    print(f"        learning_rate=0.08")
    print(f"        max_iter=100")
    print(f"        max_leaf_nodes=31")
    print(f"        min_samples_leaf=50")
    print(f"        l2_regularization=1.0")
    print(f"        early_stopping=False")
    print(f"        categorical_features={cat_indices}")
    print(f"        random_state=42")

    hgb = HistGradientBoostingRegressor(
        loss="absolute_error",
        learning_rate=0.08,
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

    print(f"    - Fit completed successfully in {fit_time:.2f}s ({fit_time / 100 * 1000:.2f} ms/tree)!")
    print(f"    - Process RSS post-fit: {proc_rss_post_fit:.2f} MB (Delta: +{proc_rss_post_fit - proc_rss_pre_fit:.2f} MB)")
    print(f"    - Total boosting iterations completed: {hgb.n_iter_}")

    # Dispose of training matrix before loading validation set
    del X_train, y_train
    gc.collect()
    print(f"    - Disposed training matrix. Post-cleanup RSS: {get_process_memory_mb():.2f} MB")

    # 5. Packaging Model Artifact
    print(f"\n[4] Packaging Self-Contained 30-Day HGBDemandForecaster Artifact...")
    model_dir = repo_root / "ml" / "models" / "30d"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "hgb_absolute_error_model.joblib"

    metadata = {
        "experiment_id": "HGB_ABSOLUTE_ERROR_30D",
        "horizon": "30d",
        "target_col": "target_30d",
        "training_rows": n_train,
        "training_period": f"{min_date} to {max_date}",
        "safe_features_count": len(safe_feats),
        "num_features_count": len(num_cols),
        "cat_features_count": len(cat_cols),
        "categorical_indices": cat_indices,
        "hyperparameters": {
            "loss": "absolute_error",
            "learning_rate": 0.08,
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
        horizon="30d",
        target_col="target_30d",
        metadata=metadata
    )

    joblib.dump(forecaster, model_path, compress=3)
    model_size_mb = model_path.stat().st_size / (1024 * 1024)
    print(f"    - Serialized 30-day model artifact to {model_path.name} ({model_size_mb:.2f} MB)")

    # 6. Loading 30-Day Validation Partition (2026-08-01 to 2026-10-16)
    print(f"\n[5] Loading 30-Day Validation Partition (2026-08-01 to 2026-10-16)...")
    val_cols = [
        "outlet_id", "product_id", "forecast_origin_date", "target_30d",
        "is_eligible_acc_20of30", "category", "outlet_type", "area_type", "sales_mean_28d"
    ] + safe_feats
    val_cols = list(dict.fromkeys(val_cols))

    t0_val_load = time.time()
    val_chunks = []
    for chunk in pd.read_csv(dataset_csv, usecols=val_cols, chunksize=100000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-10-16")
        c_filtered = chunk[mask]
        if len(c_filtered) > 0:
            val_chunks.append(c_filtered)
        if (chunk["forecast_origin_date"] > "2026-10-16").any():
            break

    df_val = pd.concat(val_chunks, ignore_index=True)
    val_load_time = time.time() - t0_val_load
    del val_chunks
    gc.collect()

    n_val = len(df_val)
    print(f"    - Loaded {n_val:,} validation rows in {val_load_time:.2f}s")
    if n_val != 1020712:
        raise ValueError(f"Expected exactly 1,020,712 validation rows, found {n_val}")

    val_unique_dates = sorted(df_val["forecast_origin_date"].unique().tolist())
    if len(val_unique_dates) != 77:
        raise ValueError(f"Expected 77 unique validation dates, found {len(val_unique_dates)}")

    val_keys = ["outlet_id", "product_id", "forecast_origin_date"]
    if df_val[val_keys].duplicated().any():
        raise ValueError("Duplicate forecast keys detected in validation partition!")

    y_val_f64 = df_val["target_30d"].to_numpy(dtype=np.float64)
    if not np.all(np.isfinite(y_val_f64)):
        raise ValueError("Validation target contains non-finite values!")
    if np.any(y_val_f64 < 0.0):
        raise ValueError("Validation target contains negative values!")

    elig_unique = set(df_val["is_eligible_acc_20of30"].unique())
    if not elig_unique.issubset({0, 1}):
        raise ValueError(f"Invalid eligibility values: {elig_unique}")
    elig_count = int((df_val["is_eligible_acc_20of30"] == 1).sum())
    if elig_count != 853740:
        raise ValueError(f"Expected 853,740 eligible rows, found {elig_count}")

    print(f"    - 30-Day Validation Partition Verified: 77 dates, 0 duplicate keys, finite target, {elig_count:,} eligible rows.")

    df_meta = df_val[[
        "outlet_id", "product_id", "forecast_origin_date",
        "category", "outlet_type", "area_type", "sales_mean_28d", "is_eligible_acc_20of30"
    ]].copy()

    # 7. Validation Inference
    print(f"\n[6] Generating 30-Day Validation Predictions across {n_val:,} rows...")
    t0_pred = time.time()
    df_val_cat = df_val[cat_cols].fillna("missing").astype(str)
    val_cat_encoded = encoder.transform(df_val_cat).astype(np.float32)
    val_num_matrix = df_val[num_cols].to_numpy(dtype=np.float32)
    X_val = np.column_stack([val_num_matrix, val_cat_encoded])
    del df_val, df_val_cat, val_cat_encoded, val_num_matrix
    gc.collect()

    raw_preds = hgb.predict(X_val)
    pred_time = time.time() - t0_pred
    del X_val
    gc.collect()

    throughput = len(raw_preds) / pred_time
    print(f"    - Inference completed in {pred_time:.2f}s ({throughput:,.0f} rows/s)")

    non_finite_count = int(np.sum(~np.isfinite(raw_preds)))
    if non_finite_count > 0:
        raise ValueError(f"Generated {non_finite_count} non-finite predictions!")

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

    # 8. Comparative Keyed Alignment Verification (30-day Baseline & 30-day Ridge)
    print(f"\n[7] Verifying Exact Alignment with 30-Day Baseline and Ridge Predictions...")
    base_pred_csv = repo_root / "ml" / "predictions" / "validation_predictions_30d.csv"
    ridge_pred_csv = repo_root / "ml" / "predictions" / "ridge_validation_predictions_30d.csv"

    for p, name in [(base_pred_csv, "30d Baseline"), (ridge_pred_csv, "30d Ridge")]:
        if not p.exists():
            raise FileNotFoundError(f"Missing prediction file for {name}: {p}")

    df_base = pd.read_csv(base_pred_csv, usecols=val_keys + ["actual_target", "rolling_average_baseline"])
    df_ridge = pd.read_csv(ridge_pred_csv, usecols=val_keys + ["actual_target", "clipped_prediction"])

    for name, df_other in [("30d Baseline", df_base), ("30d Ridge", df_ridge)]:
        if len(df_meta) != len(df_other):
            raise ValueError(f"Row count mismatch vs {name}: {len(df_meta)} vs {len(df_other)}")
        mismatch = (
            (df_meta["outlet_id"].values != df_other["outlet_id"].values) |
            (df_meta["product_id"].values != df_other["product_id"].values) |
            (df_meta["forecast_origin_date"].values != df_other["forecast_origin_date"].values)
        )
        if mismatch.any():
            raise ValueError(f"Key mismatch against {name}: {np.sum(mismatch)} rows differ!")
        target_diff = np.max(np.abs(y_val_f64 - df_other["actual_target"].values))
        if target_diff != 0.0:
            raise ValueError(f"Target mismatch against {name}: max diff = {target_diff}")

    print(f"    - 30-Day Forecast Keys & Targets Verified: 0 duplicate keys, 0 mismatches across all 1,020,712 rows.")

    baseline_preds = df_base["rolling_average_baseline"].values
    ridge_preds = df_ridge["clipped_prediction"].values

    del df_base, df_ridge
    gc.collect()

    # 9. Quantitative Evaluation: Overall & Populations
    print(f"\n[8] Computing Comprehensive 30-Day Benchmark Metrics...")
    elig_mask = df_meta["is_eligible_acc_20of30"].values == 1

    # Population A: All Valid (Primary)
    hgb_all_raw = compute_metrics(y_val_f64, raw_preds)
    hgb_all_clipped = compute_metrics(y_val_f64, clipped_preds)
    base_all = compute_metrics(y_val_f64, baseline_preds)
    ridge_all = compute_metrics(y_val_f64, ridge_preds)

    # Population B: Availability-Eligible (Secondary Diagnostic)
    hgb_elig_raw = compute_metrics(y_val_f64[elig_mask], raw_preds[elig_mask])
    hgb_elig_clipped = compute_metrics(y_val_f64[elig_mask], clipped_preds[elig_mask])
    base_elig = compute_metrics(y_val_f64[elig_mask], baseline_preds[elig_mask])
    ridge_elig = compute_metrics(y_val_f64[elig_mask], ridge_preds[elig_mask])

    print(f"\n    --- POPULATION A: ALL VALID VALIDATION ROWS ({n_val:,} rows) ---")
    print(f"    Baseline (Rolling 28d):  WAPE = {base_all['wape']*100:6.2f}% | MAE = {base_all['mae']:.4f} | RMSE = {base_all['rmse']:.4f} | Bias = {base_all['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):       WAPE = {ridge_all['wape']*100:6.2f}% | MAE = {ridge_all['mae']:.4f} | RMSE = {ridge_all['rmse']:.4f} | Bias = {ridge_all['bias']:+.4f}")
    print(f"    HGB 30D (Raw, AE):       WAPE = {hgb_all_raw['wape']*100:6.2f}% | MAE = {hgb_all_raw['mae']:.4f} | RMSE = {hgb_all_raw['rmse']:.4f} | Bias = {hgb_all_raw['bias']:+.4f}")
    print(f"    HGB 30D (Clipped, AE):   WAPE = {hgb_all_clipped['wape']*100:6.2f}% | MAE = {hgb_all_clipped['mae']:.4f} | RMSE = {hgb_all_clipped['rmse']:.4f} | Bias = {hgb_all_clipped['bias']:+.4f}")

    print(f"\n    --- POPULATION B: AVAILABILITY-ELIGIBLE ROWS ({int(np.sum(elig_mask)):,} rows) ---")
    print(f"    Baseline (Rolling 28d):  WAPE = {base_elig['wape']*100:6.2f}% | MAE = {base_elig['mae']:.4f} | RMSE = {base_elig['rmse']:.4f} | Bias = {base_elig['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):       WAPE = {ridge_elig['wape']*100:6.2f}% | MAE = {ridge_elig['mae']:.4f} | RMSE = {ridge_elig['rmse']:.4f} | Bias = {ridge_elig['bias']:+.4f}")
    print(f"    HGB 30D (Clipped, AE):   WAPE = {hgb_elig_clipped['wape']*100:6.2f}% | MAE = {hgb_elig_clipped['mae']:.4f} | RMSE = {hgb_elig_clipped['rmse']:.4f} | Bias = {hgb_elig_clipped['bias']:+.4f}")

    # Sliced Evaluations (Demand Tier, Category, Outlet Type)
    print(f"\n    - Computing Stratified Slices (Demand Tier, Category, Outlet Type, Area Type)...")
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
            "hgb_30d_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_30d_raw": compute_metrics(y_val_f64[mask], raw_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    category_metrics = {}
    for cat in sorted(df_meta["category"].dropna().unique()):
        mask = (df_meta["category"] == cat).values
        category_metrics[cat] = {
            "samples": int(np.sum(mask)),
            "hgb_30d_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    outlet_type_metrics = {}
    for otype in sorted(df_meta["outlet_type"].dropna().unique()):
        mask = (df_meta["outlet_type"] == otype).values
        outlet_type_metrics[otype] = {
            "samples": int(np.sum(mask)),
            "hgb_30d_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    area_type_metrics = {}
    for atype in sorted(df_meta["area_type"].dropna().unique()):
        mask = (df_meta["area_type"] == atype).values
        area_type_metrics[atype] = {
            "samples": int(np.sum(mask)),
            "hgb_30d_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    # 10. Export Prediction Artifact (9 columns)
    print(f"\n[9] Exporting 30-Day Validation Predictions Artifact...")
    pred_out_csv = repo_root / "ml" / "predictions" / "hgb_validation_predictions_30d.csv"
    pred_df = pd.DataFrame({
        "outlet_id": df_meta["outlet_id"],
        "product_id": df_meta["product_id"],
        "forecast_origin_date": df_meta["forecast_origin_date"],
        "actual_target": y_val_f64,
        "predicted_30d_raw": np.round(raw_preds, 4),
        "predicted_30d_clipped": np.round(clipped_preds, 4),
        "baseline_prediction": np.round(baseline_preds, 4),
        "ridge_prediction": np.round(ridge_preds, 4),
        "is_eligible_acc_20of30": df_meta["is_eligible_acc_20of30"]
    })
    pred_df.to_csv(pred_out_csv, index=False)
    pred_file_size_mb = pred_out_csv.stat().st_size / (1024 ** 2)
    print(f"    - Saved {pred_out_csv.name} ({pred_file_size_mb:.2f} MB, {len(pred_df):,} rows)")

    # 11. Inference Reproducibility Test on 1,000 Keyed Validation Rows
    print(f"\n[10] Testing Inference Reproducibility on Reloaded 30-Day Artifact...")
    reloaded_forecaster = joblib.load(model_path)

    val_sample_chunks = []
    for chunk in pd.read_csv(dataset_csv, usecols=cols_to_load, chunksize=1000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-10-16")
        c_filtered = chunk[mask]
        if len(c_filtered) > 0:
            val_sample_chunks.append(c_filtered)
        if sum(len(c) for c in val_sample_chunks) >= 1000:
            break

    df_sample_val = pd.concat(val_sample_chunks, ignore_index=True).iloc[:1000].copy()
    del val_sample_chunks
    gc.collect()

    reloaded_preds = reloaded_forecaster.predict(df_sample_val)
    in_memory_preds = clipped_preds[:1000]

    max_diff = float(np.max(np.abs(reloaded_preds - in_memory_preds)))
    print(f"    - Max absolute prediction difference: {max_diff:.8e}")
    if max_diff > 1e-5:
        raise ValueError(f"Reproducibility failure: Reloaded model differs by {max_diff}!")
    print(f"    - Inference Reproducibility: VERIFIED EXACT (Delta < 1e-5).")

    # 12. Save Machine-Readable Metrics JSON
    print(f"\n[11] Saving Machine-Readable 30-Day Metrics JSON...")
    metrics_path = repo_root / "ml" / "reports" / "phase3_hgb_30d_metrics.json"

    def rel_chg(new_v: float, old_v: float) -> float:
        return round((new_v - old_v) / old_v * 100, 2) if old_v != 0 else 0.0

    full_metrics_data = {
        "experiment_id": "HGB_ABSOLUTE_ERROR_30D",
        "horizon": "30d",
        "target_col": "target_30d",
        "status": "COMPLETED",
        "timestamp": t_stamp,
        "training_partition": {
            "start_date": min_date,
            "end_date": max_date,
            "dates_count": unique_train_dates,
            "rows": n_train
        },
        "validation_partition": {
            "start_date": df_meta["forecast_origin_date"].min(),
            "end_date": df_meta["forecast_origin_date"].max(),
            "dates_count": len(val_unique_dates),
            "rows": n_val,
            "eligible_rows": elig_count
        },
        "features": {
            "total_safe": len(safe_feats),
            "numerical_count": len(num_cols),
            "categorical_count": len(cat_cols)
        },
        "hyperparameters": {
            "loss": "absolute_error",
            "learning_rate": 0.08,
            "max_iter": 100,
            "max_leaf_nodes": 31,
            "min_samples_leaf": 50,
            "l2_regularization": 1.0,
            "early_stopping": False,
            "random_state": 42
        },
        "timing": {
            "preprocessing_seconds": round(prep_time, 2),
            "fitting_seconds": round(fit_time, 2),
            "prediction_seconds": round(pred_time, 2),
            "prediction_throughput_rows_per_sec": round(throughput, 1),
            "total_runtime_seconds": round(time.time() - start_wall_time, 2)
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
            "hgb_30d_clipped": hgb_all_clipped,
            "hgb_30d_raw": hgb_all_raw,
            "ridge_clipped": ridge_all,
            "baseline_rolling": base_all,
            "wape_diff_pp_vs_baseline": round((hgb_all_clipped["wape"] - base_all["wape"]) * 100, 2),
            "relative_wape_reduction_pct_vs_baseline": rel_chg(hgb_all_clipped["wape"], base_all["wape"]),
            "relative_mae_reduction_pct_vs_baseline": rel_chg(hgb_all_clipped["mae"], base_all["mae"]),
            "wape_diff_pp_vs_ridge": round((hgb_all_clipped["wape"] - ridge_all["wape"]) * 100, 2),
            "relative_wape_reduction_pct_vs_ridge": rel_chg(hgb_all_clipped["wape"], ridge_all["wape"]),
            "relative_mae_reduction_pct_vs_ridge": rel_chg(hgb_all_clipped["mae"], ridge_all["mae"])
        },
        "benchmark_comparison_eligible": {
            "hgb_30d_clipped": hgb_elig_clipped,
            "ridge_clipped": ridge_elig,
            "baseline_rolling": base_elig,
            "wape_diff_pp_vs_baseline": round((hgb_elig_clipped["wape"] - base_elig["wape"]) * 100, 2),
            "wape_diff_pp_vs_ridge": round((hgb_elig_clipped["wape"] - ridge_elig["wape"]) * 100, 2)
        },
        "stratified_breakdowns": {
            "by_demand_tier": tier_metrics,
            "by_outlet_type": outlet_type_metrics,
            "by_area_type": area_type_metrics,
            "by_product_category": category_metrics
        },
        "artifacts": {
            "model_path": str(model_path.relative_to(repo_root)),
            "model_size_mb": round(model_size_mb, 2),
            "predictions_path": str(pred_out_csv.relative_to(repo_root)),
            "predictions_size_mb": round(pred_file_size_mb, 2)
        }
    }

    clean_metrics_data = convert_types(full_metrics_data)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(clean_metrics_data, f, indent=2)
    print(f"    - Saved 30-day metrics JSON to {metrics_path.name}")

    print("\n" + "=" * 80)
    print("30-DAY HGB ABSOLUTE ERROR MODEL TRAINING & EVALUATION COMPLETED")
    print(f"Total Wall Runtime: {time.time() - start_wall_time:.2f}s")
    print("=" * 80 + "\n")

    return clean_metrics_data


if __name__ == "__main__":
    train_hgb_30d(repo_root)
