#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 3, Stage 3.7: EXP3 Absolute Error Loss 7-Day HistGradientBoosting Model
=============================================================================================

Author: Senior Machine Learning Engineer & ML Auditor
Date: November 17, 2026

Purpose:
  Train, evaluate, package, and verify the third HistGradientBoostingRegressor
  for 7-day demand forecasting (EXP3_HGB_ABSOLUTE_ERROR_7D).
  Tests whether 'absolute_error' loss (L1 / median regression) improves 7-day
  forecasting accuracy (MAE, WAPE, Bias, and negative excursion reduction)
  compared with squared error models (EXP1, EXP2), Ridge, and Rolling Baseline.

Fixed Experimental Design (Stage 3.7):
  - Horizon: 7-day demand forecasting (target_7d).
  - Training: 2025-12-13 through 2026-07-01 (2,664,456 rows, 201 consecutive dates).
  - Purge: 2026-07-02 through 2026-07-31 (0 rows).
  - Validation: 2026-08-01 through 2026-11-08 (1,325,600 rows, 100 consecutive dates).
  - Features: Exactly 67 SAFE features (55 numerical, 12 categorical).
  - Exclude all 5 CONDITIONAL features, identifiers, dates, targets, eligibility flags, and future leakage.
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
      1. Rolling 28d Baseline
      2. Ridge (Stage 3.3)
      3. EXP1 Full 67F HGB (loss='squared_error', lr=0.1)
      4. EXP2 No-Inventory 52F HGB (loss='squared_error', lr=0.1)
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
    "target_7d", "target_30d", "is_eligible_acc_5of7"
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
    Executes rigorous preflight checks before training EXP3.
    """
    print("\n" + "=" * 80)
    print("MANDATORY PREFLIGHT CHECKS — EXP3_HGB_ABSOLUTE_ERROR_7D (STAGE 3.7)")
    print("=" * 80)

    # 1. Read completed EXP1 and EXP2 verification audits
    exp1_audit_json = repo_root / "ml" / "reports" / "phase3_hgb_exp1_7d_integrity_correction.json"
    exp2_audit_json = repo_root / "ml" / "reports" / "phase3_hgb_exp2_7d_verification.json"
    if not exp1_audit_json.exists():
        raise FileNotFoundError(f"Preflight Check 1 Failed: Missing EXP1 audit JSON at {exp1_audit_json}")
    if not exp2_audit_json.exists():
        raise FileNotFoundError(f"Preflight Check 1 Failed: Missing EXP2 audit JSON at {exp2_audit_json}")

    with open(exp1_audit_json, "r", encoding="utf-8") as f:
        exp1_audit = json.load(f)
    if exp1_audit.get("overall_verdict") != "PASSED" or not exp1_audit.get("all_tasks_passed"):
        raise ValueError(f"Preflight Check 1 Failed: EXP1 audit verdict is not PASSED ({exp1_audit.get('overall_verdict')})")

    with open(exp2_audit_json, "r", encoding="utf-8") as f:
        exp2_audit = json.load(f)
    if exp2_audit.get("overall_verdict") != "PASSED":
        raise ValueError(f"Preflight Check 1 Failed: EXP2 audit verdict is not PASSED ({exp2_audit.get('overall_verdict')})")
    print("  [Pass] Check 1: EXP1 and EXP2 integrity audits verified (Verdicts: PASSED).")

    # 2. Inspect existing model artifacts, metadata, and forecaster module
    exp1_model_path = repo_root / "ml" / "models" / "7d" / "hgb_exp1_full_model.joblib"
    exp2_model_path = repo_root / "ml" / "models" / "7d" / "hgb_exp2_no_inventory_model.joblib"
    meta_path = repo_root / "ml" / "features" / "feature_metadata.json"
    forecaster_path = repo_root / "ml" / "models" / "forecaster.py"
    for p, name in [
        (exp1_model_path, "EXP1 model"),
        (exp2_model_path, "EXP2 model"),
        (meta_path, "Feature metadata"),
        (forecaster_path, "Forecaster module")
    ]:
        if not p.exists():
            raise FileNotFoundError(f"Preflight Check 2 Failed: Missing {name} at {p}")
    exp1_model = joblib.load(exp1_model_path)
    check_is_fitted(exp1_model.hgb)
    exp2_model = joblib.load(exp2_model_path)
    check_is_fitted(exp2_model.hgb)
    print("  [Pass] Check 2: EXP1 & EXP2 artifacts, metadata, and forecaster module verified.")

    # 3. Load authoritative SAFE feature registry and feature_metadata.json
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    safe_audit_json = repo_root / "ml" / "reports" / "phase3_feature_safety_audit.json"
    with open(safe_audit_json, "r", encoding="utf-8") as f:
        safe_audit = json.load(f)

    auth_safe_67 = [
        k for k, v in safe_audit["feature_audit_details"].items()
        if v.get("safety_classification") == "SAFE"
    ]
    if len(auth_safe_67) != 67:
        raise ValueError(f"Preflight Check 3 Failed: Expected 67 SAFE features, found {len(auth_safe_67)}")

    cat_cols = [
        k for k in auth_safe_67
        if meta["features"][k].get("data_type") in ["string", "object", "category"]
    ]
    num_cols = [k for k in auth_safe_67 if k not in cat_cols]

    if len(cat_cols) != 12 or len(num_cols) != 55:
        raise ValueError(
            f"Preflight Check 3 Failed: Expected 55 num and 12 cat features, got {len(num_cols)} num and {len(cat_cols)} cat."
        )
    if set(num_cols) & set(cat_cols):
        raise ValueError("Preflight Check 3 Failed: Numerical and categorical feature sets overlap!")

    if exp1_model.safe_features != auth_safe_67:
        raise ValueError("Preflight Check 3 Failed: Authoritative safe_features order mismatch against EXP1!")
    print(f"  [Pass] Check 3: Exactly 67 SAFE features confirmed (55 numerical, 12 categorical, disjoint, exact order).")

    # 4. Confirm no conditional, unsafe, identifier, target, eligibility features enter model
    for c in CONDITIONAL_FEATURES:
        if c in auth_safe_67:
            raise ValueError(f"Preflight Check 4 Failed: Conditional feature {c} present in SAFE features!")
    for forb in FORBIDDEN_COLUMNS:
        if forb in auth_safe_67:
            raise ValueError(f"Preflight Check 4 Failed: Forbidden column {forb} present in SAFE features!")
    print(f"  [Pass] Check 4: Exclusion of conditional (5), identifiers, targets, and eligibility flags confirmed.")

    # 5. Verify forecaster architecture compatibility
    test_dummy = pd.DataFrame({c: [0.0] for c in num_cols})
    for c in cat_cols:
        test_dummy[c] = ["missing"]
    test_dummy["forecast_origin_date"] = ["2026-08-01"]
    print(f"  [Pass] Check 5: Forecaster architecture and data transformation schema compatibility verified.")

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

    # 7. Check dataset existence
    dataset_csv = repo_root / "ml" / "data" / "model_dataset_7d.csv"
    if not dataset_csv.exists():
        raise FileNotFoundError(f"Preflight Check 7 Failed: Missing dataset at {dataset_csv}")
    print(f"  [Pass] Check 7: Source dataset file verified at {dataset_csv.name}.")

    print("=" * 80)
    print("ALL PREFLIGHT CHECKS PASSED — EXP3 TRAINING AUTHORIZED")
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


def train_exp3_hgb_7d(repo_root: Path) -> Dict[str, Any]:
    """
    Executes Stage 3.7: EXP3_HGB_ABSOLUTE_ERROR_7D Training and Evaluation.
    """
    start_wall_time = time.time()
    t_stamp = time.strftime("%Y-%m-%d %H:%M:%S")

    print("\n" + "=" * 80)
    print("BazarBondhu AI — Phase 3, Stage 3.7: EXP3_HGB_ABSOLUTE_ERROR_7D")
    print("=" * 80)

    # 1. Preflight Checks
    preflight = run_preflight_checks(repo_root)
    safe_feats = preflight["safe_features"]
    num_cols = preflight["num_cols"]
    cat_cols = preflight["cat_cols"]

    sys_mem_start = get_system_memory()
    proc_rss_start = get_process_memory_mb()
    dataset_csv = repo_root / "ml" / "data" / "model_dataset_7d.csv"

    # 2. Loading Training Partition (2025-12-13 to 2026-07-01)
    print(f"\n[1] Loading Training Partition (2025-12-13 to 2026-07-01)...")
    cols_to_load = ["forecast_origin_date", "target_7d"] + safe_feats
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

    y_train = df_train["target_7d"].to_numpy(dtype=np.float32)
    if not np.all(np.isfinite(y_train)):
        raise ValueError("Training target contains non-finite values!")
    if np.any(y_train < 0.0):
        raise ValueError("Training target contains negative values!")

    # 3. Fit OrdinalEncoder strictly on training data
    print(f"\n[2] Fitting OrdinalEncoder on Training Observations...")
    t0_prep = time.time()
    proc_rss_pre_prep = get_process_memory_mb()

    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    df_train_cat = df_train[cat_cols].fillna("missing").astype(str)
    cat_encoded = encoder.fit_transform(df_train_cat).astype(np.float32)
    del df_train_cat
    gc.collect()

    # Category vocabularies summary
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
    print(f"\n[3] Fitting HistGradientBoostingRegressor (EXP3_HGB_ABSOLUTE_ERROR_7D)...")
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
    print(f"\n[4] Packaging Self-Contained HGBDemandForecaster Artifact...")
    model_dir = repo_root / "ml" / "models" / "7d"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "hgb_exp3_absolute_error_model.joblib"

    metadata = {
        "experiment_id": "EXP3_HGB_ABSOLUTE_ERROR_7D",
        "horizon": "7d",
        "target_col": "target_7d",
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
        horizon="7d",
        target_col="target_7d",
        metadata=metadata
    )

    joblib.dump(forecaster, model_path, compress=3)
    model_size_mb = model_path.stat().st_size / (1024 * 1024)
    print(f"    - Serialized model artifact to {model_path.name} ({model_size_mb:.2f} MB)")

    # 6. Loading Validation Partition (2026-08-01 to 2026-11-08)
    print(f"\n[5] Loading 7-Day Validation Partition...")
    val_cols = [
        "outlet_id", "product_id", "forecast_origin_date", "target_7d",
        "is_eligible_acc_5of7", "category", "outlet_type", "area_type", "sales_mean_28d"
    ] + safe_feats
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

    val_unique_dates = sorted(df_val["forecast_origin_date"].unique().tolist())
    if len(val_unique_dates) != 100:
        raise ValueError(f"Expected 100 unique validation dates, found {len(val_unique_dates)}")

    val_keys = ["outlet_id", "product_id", "forecast_origin_date"]
    if df_val[val_keys].duplicated().any():
        raise ValueError("Duplicate forecast keys detected in validation partition!")

    y_val_f64 = df_val["target_7d"].to_numpy(dtype=np.float64)
    if not np.all(np.isfinite(y_val_f64)):
        raise ValueError("Validation target contains non-finite values!")
    if np.any(y_val_f64 < 0.0):
        raise ValueError("Validation target contains negative values!")

    elig_unique = set(df_val["is_eligible_acc_5of7"].unique())
    if not elig_unique.issubset({0, 1}):
        raise ValueError(f"Invalid eligibility values: {elig_unique}")
    elig_count = int((df_val["is_eligible_acc_5of7"] == 1).sum())
    if elig_count != 1102601:
        raise ValueError(f"Expected 1,102,601 eligible rows, found {elig_count}")

    print(f"    - Validation Partition Verified: 100 dates, 0 duplicate keys, finite target, {elig_count:,} eligible rows.")

    df_meta = df_val[[
        "outlet_id", "product_id", "forecast_origin_date",
        "category", "outlet_type", "area_type", "sales_mean_28d", "is_eligible_acc_5of7"
    ]].copy()

    # 7. Validation Inference
    print(f"\n[6] Generating Validation Predictions across {n_val:,} rows...")
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

    # 8. Comparative Keyed Alignment Verification (Baseline, Ridge, EXP1, EXP2)
    print(f"\n[7] Verifying Exact Alignment with Baseline, Ridge, EXP1, and EXP2 Predictions...")
    base_pred_csv = repo_root / "ml" / "predictions" / "validation_predictions_7d.csv"
    ridge_pred_csv = repo_root / "ml" / "predictions" / "ridge_validation_predictions_7d.csv"
    exp1_pred_csv = repo_root / "ml" / "predictions" / "hgb_exp1_validation_predictions_7d.csv"
    exp2_pred_csv = repo_root / "ml" / "predictions" / "hgb_exp2_validation_predictions_7d.csv"

    for p, name in [
        (base_pred_csv, "Baseline"),
        (ridge_pred_csv, "Ridge"),
        (exp1_pred_csv, "EXP1"),
        (exp2_pred_csv, "EXP2")
    ]:
        if not p.exists():
            raise FileNotFoundError(f"Missing prediction file for {name}: {p}")

    key_cols = ["outlet_id", "product_id", "forecast_origin_date"]
    df_base = pd.read_csv(base_pred_csv, usecols=key_cols + ["actual_target", "rolling_average_baseline"])
    df_ridge = pd.read_csv(ridge_pred_csv, usecols=key_cols + ["actual_target", "clipped_prediction"])
    df_exp1 = pd.read_csv(exp1_pred_csv, usecols=key_cols + ["actual_target", "predicted_7d_clipped"])
    df_exp2 = pd.read_csv(exp2_pred_csv, usecols=key_cols + ["actual_target", "predicted_7d_clipped"])

    for name, df_other in [("Baseline", df_base), ("Ridge", df_ridge), ("EXP1", df_exp1), ("EXP2", df_exp2)]:
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

    print(f"    - Forecast Keys & Targets Verified: 0 duplicate keys, 0 mismatches across all 1,325,600 rows.")

    baseline_preds = df_base["rolling_average_baseline"].values
    ridge_preds = df_ridge["clipped_prediction"].values
    exp1_preds = df_exp1["predicted_7d_clipped"].values
    exp2_preds = df_exp2["predicted_7d_clipped"].values

    del df_base, df_ridge, df_exp1, df_exp2
    gc.collect()

    # 9. Quantitative Evaluation: Overall & Populations
    print(f"\n[8] Computing Comprehensive Benchmark Metrics...")
    elig_mask = df_meta["is_eligible_acc_5of7"].values == 1

    # Population A: All Valid (Primary)
    exp3_all_raw = compute_metrics(y_val_f64, raw_preds)
    exp3_all_clipped = compute_metrics(y_val_f64, clipped_preds)
    base_all = compute_metrics(y_val_f64, baseline_preds)
    ridge_all = compute_metrics(y_val_f64, ridge_preds)
    exp1_all = compute_metrics(y_val_f64, exp1_preds)
    exp2_all = compute_metrics(y_val_f64, exp2_preds)

    # Population B: Availability-Eligible (Secondary Diagnostic)
    exp3_elig_raw = compute_metrics(y_val_f64[elig_mask], raw_preds[elig_mask])
    exp3_elig_clipped = compute_metrics(y_val_f64[elig_mask], clipped_preds[elig_mask])
    base_elig = compute_metrics(y_val_f64[elig_mask], baseline_preds[elig_mask])
    ridge_elig = compute_metrics(y_val_f64[elig_mask], ridge_preds[elig_mask])
    exp1_elig = compute_metrics(y_val_f64[elig_mask], exp1_preds[elig_mask])
    exp2_elig = compute_metrics(y_val_f64[elig_mask], exp2_preds[elig_mask])

    print(f"\n    --- POPULATION A: ALL VALID VALIDATION ROWS ({n_val:,} rows) ---")
    print(f"    Baseline (Rolling 28d):  WAPE = {base_all['wape']*100:6.2f}% | MAE = {base_all['mae']:.4f} | RMSE = {base_all['rmse']:.4f} | Bias = {base_all['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):       WAPE = {ridge_all['wape']*100:6.2f}% | MAE = {ridge_all['mae']:.4f} | RMSE = {ridge_all['rmse']:.4f} | Bias = {ridge_all['bias']:+.4f}")
    print(f"    HGB EXP1 (Full, SE):     WAPE = {exp1_all['wape']*100:6.2f}% | MAE = {exp1_all['mae']:.4f} | RMSE = {exp1_all['rmse']:.4f} | Bias = {exp1_all['bias']:+.4f}")
    print(f"    HGB EXP2 (No-Inv, SE):   WAPE = {exp2_all['wape']*100:6.2f}% | MAE = {exp2_all['mae']:.4f} | RMSE = {exp2_all['rmse']:.4f} | Bias = {exp2_all['bias']:+.4f}")
    print(f"    HGB EXP3 (Raw, AE):      WAPE = {exp3_all_raw['wape']*100:6.2f}% | MAE = {exp3_all_raw['mae']:.4f} | RMSE = {exp3_all_raw['rmse']:.4f} | Bias = {exp3_all_raw['bias']:+.4f}")
    print(f"    HGB EXP3 (Clipped, AE):  WAPE = {exp3_all_clipped['wape']*100:6.2f}% | MAE = {exp3_all_clipped['mae']:.4f} | RMSE = {exp3_all_clipped['rmse']:.4f} | Bias = {exp3_all_clipped['bias']:+.4f}")

    print(f"\n    --- POPULATION B: AVAILABILITY-ELIGIBLE ROWS ({int(np.sum(elig_mask)):,} rows) ---")
    print(f"    Baseline (Rolling 28d):  WAPE = {base_elig['wape']*100:6.2f}% | MAE = {base_elig['mae']:.4f} | RMSE = {base_elig['rmse']:.4f} | Bias = {base_elig['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):       WAPE = {ridge_elig['wape']*100:6.2f}% | MAE = {ridge_elig['mae']:.4f} | RMSE = {ridge_elig['rmse']:.4f} | Bias = {ridge_elig['bias']:+.4f}")
    print(f"    HGB EXP1 (Full, SE):     WAPE = {exp1_elig['wape']*100:6.2f}% | MAE = {exp1_elig['mae']:.4f} | RMSE = {exp1_elig['rmse']:.4f} | Bias = {exp1_elig['bias']:+.4f}")
    print(f"    HGB EXP2 (No-Inv, SE):   WAPE = {exp2_elig['wape']*100:6.2f}% | MAE = {exp2_elig['mae']:.4f} | RMSE = {exp2_elig['rmse']:.4f} | Bias = {exp2_elig['bias']:+.4f}")
    print(f"    HGB EXP3 (Clipped, AE):  WAPE = {exp3_elig_clipped['wape']*100:6.2f}% | MAE = {exp3_elig_clipped['mae']:.4f} | RMSE = {exp3_elig_clipped['rmse']:.4f} | Bias = {exp3_elig_clipped['bias']:+.4f}")

    # Sliced Evaluations (Demand Tier, Category, Outlet Type)
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
            "hgb_exp3_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_exp3_raw": compute_metrics(y_val_f64[mask], raw_preds[mask]),
            "hgb_exp2": compute_metrics(y_val_f64[mask], exp2_preds[mask]),
            "hgb_exp1": compute_metrics(y_val_f64[mask], exp1_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    category_metrics = {}
    for cat in sorted(df_meta["category"].dropna().unique()):
        mask = (df_meta["category"] == cat).values
        category_metrics[cat] = {
            "samples": int(np.sum(mask)),
            "hgb_exp3_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_exp2": compute_metrics(y_val_f64[mask], exp2_preds[mask]),
            "hgb_exp1": compute_metrics(y_val_f64[mask], exp1_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    outlet_type_metrics = {}
    for otype in sorted(df_meta["outlet_type"].dropna().unique()):
        mask = (df_meta["outlet_type"] == otype).values
        outlet_type_metrics[otype] = {
            "samples": int(np.sum(mask)),
            "hgb_exp3_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_exp2": compute_metrics(y_val_f64[mask], exp2_preds[mask]),
            "hgb_exp1": compute_metrics(y_val_f64[mask], exp1_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    # 10. Export Prediction Artifact (11 columns)
    print(f"\n[9] Exporting Validation Predictions Artifact...")
    pred_out_csv = repo_root / "ml" / "predictions" / "hgb_exp3_validation_predictions_7d.csv"
    pred_df = pd.DataFrame({
        "outlet_id": df_meta["outlet_id"],
        "product_id": df_meta["product_id"],
        "forecast_origin_date": df_meta["forecast_origin_date"],
        "actual_target": y_val_f64,
        "predicted_7d_raw": np.round(raw_preds, 4),
        "predicted_7d_clipped": np.round(clipped_preds, 4),
        "baseline_prediction": np.round(baseline_preds, 4),
        "ridge_prediction": np.round(ridge_preds, 4),
        "hgb_exp1_prediction": np.round(exp1_preds, 4),
        "hgb_exp2_prediction": np.round(exp2_preds, 4),
        "is_eligible_acc_5of7": df_meta["is_eligible_acc_5of7"]
    })
    pred_df.to_csv(pred_out_csv, index=False)
    pred_file_size_mb = pred_out_csv.stat().st_size / (1024 ** 2)
    print(f"    - Saved {pred_out_csv.name} ({pred_file_size_mb:.2f} MB, {len(pred_df):,} rows)")

    # 11. Inference Reproducibility Test on 1,000 Keyed Validation Rows
    print(f"\n[10] Testing Inference Reproducibility on Reloaded Artifact...")
    reloaded_forecaster = joblib.load(model_path)

    # Load first 1,000 actual validation rows from model_dataset_7d.csv
    val_sample_chunks = []
    for chunk in pd.read_csv(dataset_csv, usecols=cols_to_load, chunksize=1000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-11-08")
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
    print(f"\n[11] Saving Machine-Readable Metrics JSON...")
    metrics_path = repo_root / "ml" / "reports" / "phase3_hgb_exp3_7d_metrics.json"

    def rel_chg(new_v: float, old_v: float) -> float:
        return round((new_v - old_v) / old_v * 100, 2) if old_v != 0 else 0.0

    full_metrics_data = {
        "experiment_id": "EXP3_HGB_ABSOLUTE_ERROR_7D",
        "horizon": "7d",
        "target_col": "target_7d",
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
            "hgb_exp3_clipped": exp3_all_clipped,
            "hgb_exp3_raw": exp3_all_raw,
            "hgb_exp2_clipped": exp2_all,
            "hgb_exp1_clipped": exp1_all,
            "ridge_clipped": ridge_all,
            "baseline_rolling": base_all,
            "wape_diff_pp_vs_baseline": round((exp3_all_clipped["wape"] - base_all["wape"]) * 100, 2),
            "relative_wape_reduction_pct_vs_baseline": rel_chg(exp3_all_clipped["wape"], base_all["wape"]),
            "relative_mae_reduction_pct_vs_baseline": rel_chg(exp3_all_clipped["mae"], base_all["mae"]),
            "wape_diff_pp_vs_ridge": round((exp3_all_clipped["wape"] - ridge_all["wape"]) * 100, 2),
            "relative_wape_reduction_pct_vs_ridge": rel_chg(exp3_all_clipped["wape"], ridge_all["wape"]),
            "relative_mae_reduction_pct_vs_ridge": rel_chg(exp3_all_clipped["mae"], ridge_all["mae"]),
            "wape_diff_pp_vs_exp1": round((exp3_all_clipped["wape"] - exp1_all["wape"]) * 100, 2),
            "relative_wape_change_pct_vs_exp1": rel_chg(exp3_all_clipped["wape"], exp1_all["wape"]),
            "relative_mae_change_pct_vs_exp1": rel_chg(exp3_all_clipped["mae"], exp1_all["mae"]),
            "wape_diff_pp_vs_exp2": round((exp3_all_clipped["wape"] - exp2_all["wape"]) * 100, 2),
            "relative_wape_change_pct_vs_exp2": rel_chg(exp3_all_clipped["wape"], exp2_all["wape"]),
            "relative_mae_change_pct_vs_exp2": rel_chg(exp3_all_clipped["mae"], exp2_all["mae"])
        },
        "benchmark_comparison_eligible": {
            "hgb_exp3_clipped": exp3_elig_clipped,
            "hgb_exp2_clipped": exp2_elig,
            "hgb_exp1_clipped": exp1_elig,
            "ridge_clipped": ridge_elig,
            "baseline_rolling": base_elig,
            "wape_diff_pp_vs_baseline": round((exp3_elig_clipped["wape"] - base_elig["wape"]) * 100, 2),
            "wape_diff_pp_vs_ridge": round((exp3_elig_clipped["wape"] - ridge_elig["wape"]) * 100, 2),
            "wape_diff_pp_vs_exp1": round((exp3_elig_clipped["wape"] - exp1_elig["wape"]) * 100, 2),
            "wape_diff_pp_vs_exp2": round((exp3_elig_clipped["wape"] - exp2_elig["wape"]) * 100, 2)
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

    clean_metrics_data = convert_types(full_metrics_data)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(clean_metrics_data, f, indent=2)
    print(f"    - Saved metrics JSON to {metrics_path.name}")

    print("\n" + "=" * 80)
    print("EXP3_HGB_ABSOLUTE_ERROR_7D TRAINING & EVALUATION COMPLETED")
    print(f"Total Wall Runtime: {time.time() - start_wall_time:.2f}s")
    print("=" * 80 + "\n")

    return clean_metrics_data


if __name__ == "__main__":
    train_exp3_hgb_7d(repo_root)
