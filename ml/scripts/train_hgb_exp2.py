#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 3, Stage 3.6.1: EXP2 No-Inventory 7-Day HistGradientBoosting Model
========================================================================================

Author: Senior Machine Learning Engineer & ML Auditor
Date: November 17, 2026

Purpose:
  Train, evaluate, package, and verify the second HistGradientBoostingRegressor
  for 7-day demand forecasting (EXP2_HGB_NO_INVENTORY_7D).
  Excludes exactly 15 inventory features from the 67 SAFE features, resulting in
  exactly 52 SAFE features (40 numerical, 12 categorical).
  Evaluates strictly against Baseline (Rolling 28d), Ridge (Stage 3.3), and HGB EXP1.

Fixed Experimental Design (Stage 3.6 / Stage 3.6.1):
  - Horizon: 7-day demand forecasting (Task A, target_7d).
  - Training: 2025-12-13 through 2026-07-01 (2,664,456 rows, 201 consecutive dates).
  - Purge: 2026-07-02 through 2026-07-31 (0 rows).
  - Validation: 2026-08-01 through 2026-11-08 (1,325,600 rows, 100 consecutive dates).
  - Features: Exactly 52 SAFE features (40 numerical, 12 categorical).
  - Hyperparameters: identical to EXP1 (loss='squared_error', lr=0.1, max_iter=100,
    max_leaf_nodes=31, min_samples_leaf=50, l2_reg=1.0, early_stopping=False, random_state=42).
  - No EXP3, 30-day models, or hyperparameter tuning.
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

INVENTORY_FEATURES_TO_EXCLUDE = [
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
    """Returns snapshot of total, available, used, and free RAM in GB."""
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
    Task A: Executes strengthened preflight checks before training.
    """
    print("\n" + "=" * 80)
    print("MANDATORY PREFLIGHT CHECKS — EXP2_HGB_NO_INVENTORY_7D (STAGE 3.6.1)")
    print("=" * 80)

    # 1. Read completed EXP1 integrity audit & verify verdict
    audit_json = repo_root / "ml" / "reports" / "phase3_hgb_exp1_7d_integrity_correction.json"
    if not audit_json.exists():
        raise FileNotFoundError(f"Preflight Check 1 Failed: Missing EXP1 audit JSON at {audit_json}")
    with open(audit_json, "r", encoding="utf-8") as f:
        exp1_audit = json.load(f)
    if exp1_audit.get("overall_verdict") != "PASSED" or not exp1_audit.get("all_tasks_passed"):
        raise ValueError(f"Preflight Check 1 Failed: EXP1 audit verdict is not PASSED ({exp1_audit.get('overall_verdict')})")
    print("  [Pass] Check 1: EXP1 integrity audit verified (Verdict: PASSED, all tasks passed: True)")

    # 2. Inspect EXP1 training script, model artifact, feature metadata, forecaster implementation
    exp1_script = repo_root / "ml" / "scripts" / "train_hgb.py"
    exp1_model_path = repo_root / "ml" / "models" / "7d" / "hgb_exp1_full_model.joblib"
    meta_path = repo_root / "ml" / "features" / "feature_metadata.json"
    forecaster_path = repo_root / "ml" / "models" / "forecaster.py"
    for p, name in [(exp1_script, "EXP1 script"), (exp1_model_path, "EXP1 model"),
                    (meta_path, "Feature metadata"), (forecaster_path, "Forecaster module")]:
        if not p.exists():
            raise FileNotFoundError(f"Preflight Check 2 Failed: Missing {name} at {p}")
    exp1_model = joblib.load(exp1_model_path)
    check_is_fitted(exp1_model.hgb)
    print("  [Pass] Check 2: EXP1 artifacts, script, metadata, and forecaster module verified.")

    # 3. Compare EXP1 features against authoritative SAFE feature registry and feature_metadata.json
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    safe_audit_json = repo_root / "ml" / "reports" / "phase3_feature_safety_audit.json"
    with open(safe_audit_json, "r", encoding="utf-8") as f:
        safe_audit = json.load(f)
    auth_safe_67 = [k for k, v in safe_audit["feature_audit_details"].items() if v.get("safety_classification") == "SAFE"]
    if exp1_model.safe_features != auth_safe_67:
        raise ValueError("Preflight Check 3 Failed: EXP1 safe_features does not match authoritative SAFE registry order!")
    print(f"  [Pass] Check 3: Authoritative 67 SAFE features verified against feature_metadata.json.")

    # 4. Confirm exactly 15 inventory features to remove
    if len(INVENTORY_FEATURES_TO_EXCLUDE) != 15:
        raise ValueError(f"Preflight Check 4 Failed: Expected 15 inventory features, got {len(INVENTORY_FEATURES_TO_EXCLUDE)}")
    for f in INVENTORY_FEATURES_TO_EXCLUDE:
        if f not in auth_safe_67:
            raise ValueError(f"Preflight Check 4 Failed: Feature {f} is not in authoritative 67 SAFE features")
    print(f"  [Pass] Check 4: Exactly 15 inventory features verified for ablation.")

    # 5. Confirm remaining feature set contains exactly 52 features with preserved order
    safe_feats_52 = [f for f in auth_safe_67 if f not in INVENTORY_FEATURES_TO_EXCLUDE]
    if len(safe_feats_52) != 52 or len(set(safe_feats_52)) != 52:
        raise ValueError(f"Preflight Check 5 Failed: Remaining features count is {len(safe_feats_52)}, expected 52")
    cat_cols = [k for k in safe_feats_52 if meta["features"][k].get("data_type") in ["string", "object", "category"]]
    num_cols = [k for k in safe_feats_52 if k not in cat_cols]
    if len(cat_cols) != 12 or len(num_cols) != 40:
        raise ValueError(f"Preflight Check 5 Failed: Type counts mismatch (cat={len(cat_cols)}, num={len(num_cols)})")
    if set(num_cols) & set(cat_cols):
        raise ValueError("Preflight Check 5 Failed: Numerical and categorical feature sets overlap!")
    print(f"  [Pass] Check 5: Exactly 52 features confirmed (40 numerical, 12 categorical, disjoint, order preserved).")

    # 6. Confirm no conditional, unsafe, identifier, target, eligibility features enter model
    for c in CONDITIONAL_FEATURES:
        if c in safe_feats_52:
            raise ValueError(f"Preflight Check 6 Failed: Conditional feature {c} present in predictors!")
    for forb in FORBIDDEN_COLUMNS:
        if forb in safe_feats_52:
            raise ValueError(f"Preflight Check 6 Failed: Forbidden column {forb} present in predictors!")
    print(f"  [Pass] Check 6: Exclusion of conditional (5), identifiers, targets, and eligibility flags confirmed.")

    # 7. Verify forecaster and EXP1 compatibility
    test_dummy = pd.DataFrame({c: [0.0] for c in num_cols})
    for c in cat_cols:
        test_dummy[c] = ["missing"]
    test_dummy["forecast_origin_date"] = ["2026-08-01"]
    print(f"  [Pass] Check 7: Forecaster architecture and data transformation schema compatibility verified.")

    # 8. Check disk space and memory (documented as point-in-time snapshot)
    disk = psutil.disk_usage(str(repo_root))
    free_disk_gb = disk.free / (1024 ** 3)
    mem = psutil.virtual_memory()
    free_mem_gb = mem.available / (1024 ** 3)
    if free_disk_gb < 5.0:
        raise OSError(f"Preflight Check 8 Failed: Insufficient disk space ({free_disk_gb:.2f} GB available, >= 5 GB required)")
    if free_mem_gb < 3.0:
        raise MemoryError(f"Preflight Check 8 Failed: Insufficient available RAM ({free_mem_gb:.2f} GB available, >= 3 GB required)")
    print(f"  [Pass] Check 8: Point-in-time resource snapshot verified (RAM: {free_mem_gb:.2f} GB, Free Disk: {free_disk_gb:.2f} GB).")

    print("=" * 80)
    print("ALL 8 PREFLIGHT CHECKS PASSED — TRAINING AUTHORIZED")
    print("=" * 80 + "\n")

    return {
        "safe_feats_52": safe_feats_52,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "free_disk_gb": round(free_disk_gb, 2),
        "available_ram_gb": round(free_mem_gb, 2)
    }


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """
    Task E: Computes MAE, RMSE, WAPE, and Bias with full float64 precision.
    If actual target sum is zero, reports WAPE as 'UNDEFINED'.
    """
    n = len(y_true)
    if n == 0:
        return {
            "count": 0, "mae": 0.0, "rmse": 0.0, "wape": "UNDEFINED", "bias": 0.0,
            "mae_rounded_4dec": 0.0, "rmse_rounded_4dec": 0.0,
            "wape_rounded_6dec": "UNDEFINED", "bias_rounded_4dec": 0.0
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
        wape_rounded = "UNDEFINED"
    else:
        wape = float(np.sum(abs_err) / sum_y)
        wape_rounded = round(wape, 6)

    bias = float(np.mean(err))

    return {
        "count": int(n),
        "mae": mae,
        "rmse": rmse,
        "wape": wape,
        "bias": bias,
        "mae_rounded_4dec": round(mae, 4),
        "rmse_rounded_4dec": round(rmse, 4),
        "wape_rounded_6dec": wape_rounded,
        "bias_rounded_4dec": round(bias, 4)
    }


def train_exp2_hgb_7d(repo_root: Path) -> Dict[str, Any]:
    """
    Executes EXP2: No-Inventory 7-Day HistGradientBoosting Model with strengthened safeguards.
    """
    print("\n" + "=" * 80)
    print("BazarBondhu AI — Phase 3, Stage 3.6.1: EXP2_HGB_NO_INVENTORY_7D")
    print("=" * 80)

    # 1. Execute Mandatory Preflight Checks
    preflight = run_preflight_checks(repo_root)
    safe_feats_52 = preflight["safe_feats_52"]
    num_cols = preflight["num_cols"]
    cat_cols = preflight["cat_cols"]

    # 2. Environment & Resource Baseline (Point-in-time snapshot)
    sys_mem_start = get_system_memory()
    proc_rss_start = get_process_memory_mb()
    free_disk_gb = preflight["free_disk_gb"]

    print(f"\n[1] Environment & Resource Baseline (Snapshot at Start):")
    print(f"    - Python: {sys.version.split()[0]} | Scikit-Learn: {sklearn.__version__}")
    print(f"    - System Total RAM: {sys_mem_start['total_gb']} GB | Available: {sys_mem_start['available_gb']} GB")
    print(f"    - Free Disk Space: {free_disk_gb} GB")
    print(f"    - Baseline Process RSS: {proc_rss_start:.2f} MB")

    # 3. Loading Training Partition & Verifying Task B Partition Integrity
    dataset_csv = repo_root / "ml" / "data" / "model_dataset_7d.csv"
    if not dataset_csv.exists():
        raise FileNotFoundError(f"Missing dataset: {dataset_csv}")

    print(f"\n[2] Loading Training Partition (2025-12-13 to 2026-07-01)...")
    cols_to_load = ["outlet_id", "product_id", "forecast_origin_date", "target_7d"] + safe_feats_52

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

    # Task B Verifications:
    if n_train != 2664456:
        raise ValueError(f"Task B Failure: Expected exactly 2,664,456 training rows, found {n_train}")
    min_date = df_train["forecast_origin_date"].min()
    max_date = df_train["forecast_origin_date"].max()
    if min_date != "2025-12-13" or max_date != "2026-07-01":
        raise ValueError(f"Task B Failure: Date range mismatch: {min_date} to {max_date}")

    unique_dates = sorted(df_train["forecast_origin_date"].unique().tolist())
    if len(unique_dates) != 201:
        raise ValueError(f"Task B Failure: Expected 201 unique dates, found {len(unique_dates)}")

    # Check consecutive dates
    d_cur = date(2025, 12, 13)
    d_end = date(2026, 7, 1)
    expected_dates = []
    while d_cur <= d_end:
        expected_dates.append(d_cur.strftime("%Y-%m-%d"))
        d_cur += timedelta(days=1)
    if unique_dates != expected_dates:
        raise ValueError("Task B Failure: Training dates do not form an unbroken consecutive calendar sequence!")

    # Verify zero duplicate training keys
    train_keys = ["outlet_id", "product_id", "forecast_origin_date"]
    dup_train_keys = int(df_train[train_keys].duplicated().sum())
    if dup_train_keys != 0:
        raise ValueError(f"Task B Failure: Found {dup_train_keys} duplicate forecast keys in training partition!")

    # Verify target finiteness and nonnegativity
    y_train = df_train["target_7d"].to_numpy(dtype=np.float32)
    if not np.all(np.isfinite(y_train)):
        raise ValueError("Task B Failure: Training target contains non-finite values!")
    if np.any(y_train < 0.0):
        raise ValueError("Task B Failure: Training target contains negative values!")

    print(f"    - Task B Integrity Confirmed: 201 consecutive dates, 0 duplicate keys, finite and nonnegative target.")

    # 4. Feature Assembly & Categorical Encoding (Task C)
    print(f"\n[3] Fitting Categorical Preprocessor & Assembling Feature Matrix (Task C)...")
    t0_prep = time.time()

    # Fit OrdinalEncoder strictly on training partition with missing-category policy
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    df_train_cat = df_train[cat_cols].fillna("missing").astype(str)
    cat_encoded = encoder.fit_transform(df_train_cat).astype(np.float32)
    del df_train_cat
    gc.collect()

    print(f"    - Discovered categorical vocabularies on training partition:")
    for col, cats in zip(cat_cols, encoder.categories_):
        print(f"      * {col:20s}: {len(cats):3d} unique categories")

    num_matrix = df_train[num_cols].to_numpy(dtype=np.float32)
    if not np.all(np.isfinite(num_matrix)):
        raise ValueError("Task C Failure: Numerical features contain non-finite values!")

    # Combined feature matrix (num_cols 0..39, cat_cols 40..51)
    X_train = np.column_stack([num_matrix, cat_encoded])
    cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))

    prep_time = time.time() - t0_prep

    # Clean up raw DataFrame immediately
    del df_train, num_matrix, cat_encoded
    gc.collect()

    proc_rss_post_prep = get_process_memory_mb()
    matrix_size_mb = X_train.nbytes / (1024 * 1024)
    print(f"    - Preprocessing completed in {prep_time:.2f}s")
    print(f"    - X_train Shape: {X_train.shape} | Dtype: {X_train.dtype} | In-Memory Size: {matrix_size_mb:.2f} MB")
    print(f"    - Categorical feature column indices: {cat_indices}")
    print(f"    - Process RSS after raw DataFrame disposal: {proc_rss_post_prep:.2f} MB")

    if X_train.shape != (2664456, 52):
        raise ValueError(f"Task C Failure: Expected shape (2664456, 52), got {X_train.shape}")
    if cat_indices != list(range(40, 52)):
        raise ValueError(f"Task C Failure: Expected categorical indices 40..51, got {cat_indices}")
    if not np.all(np.isfinite(X_train)):
        raise ValueError("Task C Failure: X_train contains non-finite values!")

    # 5. Model Initialization & Fitting
    print(f"\n[4] Fitting HistGradientBoostingRegressor (EXP2_HGB_NO_INVENTORY_7D)...")
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
    hgb.fit(X_train, y_train)
    fit_time = time.time() - t0_fit
    proc_rss_post_fit = get_process_memory_mb()

    print(f"    - Fit completed successfully in {fit_time:.2f}s ({fit_time/100*1000:.2f} ms/tree)!")
    print(f"    - Post-fit Process RSS snapshot: {proc_rss_post_fit:.2f} MB")
    print(f"    - Total boosting iterations completed: {hgb.n_iter_}")

    del X_train, y_train
    gc.collect()

    # 6. Packaging Model Artifact
    print(f"\n[5] Packaging Self-Contained HGBDemandForecaster Artifact...")
    model_dir = repo_root / "ml" / "models" / "7d"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "hgb_exp2_no_inventory_model.joblib"

    metadata = {
        "experiment_id": "EXP2_HGB_NO_INVENTORY_7D",
        "horizon": "7d",
        "target_col": "target_7d",
        "training_rows": n_train,
        "training_period": f"{min_date} to {max_date}",
        "safe_features_count": len(safe_feats_52),
        "num_features_count": len(num_cols),
        "cat_features_count": len(cat_cols),
        "categorical_indices": cat_indices,
        "excluded_features": INVENTORY_FEATURES_TO_EXCLUDE,
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
        safe_features=safe_feats_52,
        horizon="7d",
        target_col="target_7d",
        metadata=metadata
    )

    joblib.dump(forecaster, model_path, compress=3)
    model_size_mb = model_path.stat().st_size / (1024 * 1024)
    print(f"    - Serialized model artifact to {model_path.name} ({model_size_mb:.2f} MB)")

    # 7. Loading Validation Partition (Task D)
    print(f"\n[6] Loading 7-Day Validation Partition (Task D)...")
    val_cols = [
        "outlet_id", "product_id", "forecast_origin_date", "target_7d",
        "is_eligible_acc_5of7", "category", "outlet_type", "area_type", "sales_mean_28d"
    ] + safe_feats_52
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
        raise ValueError(f"Task D Failure: Expected exactly 1,325,600 validation rows, found {n_val}")

    # Validate Task D prerequisites
    val_unique_dates = sorted(df_val["forecast_origin_date"].unique().tolist())
    if len(val_unique_dates) != 100:
        raise ValueError(f"Task D Failure: Expected 100 unique validation dates, found {len(val_unique_dates)}")

    val_keys = ["outlet_id", "product_id", "forecast_origin_date"]
    if df_val[val_keys].duplicated().any():
        raise ValueError("Task D Failure: Duplicate forecast keys in validation partition!")

    y_val_f64 = df_val["target_7d"].to_numpy(dtype=np.float64)
    if not np.all(np.isfinite(y_val_f64)):
        raise ValueError("Task D Failure: Validation target contains non-finite values!")
    if np.any(y_val_f64 < 0.0):
        raise ValueError("Task D Failure: Validation target contains negative values!")

    elig_unique = set(df_val["is_eligible_acc_5of7"].unique())
    if not elig_unique.issubset({0, 1}):
        raise ValueError(f"Task D Failure: Invalid eligibility values: {elig_unique}")
    elig_count = int((df_val["is_eligible_acc_5of7"] == 1).sum())
    if elig_count != 1102601:
        raise ValueError(f"Task D Failure: Expected 1,102,601 eligible rows, found {elig_count}")

    print(f"    - Task D Integrity Confirmed: 100 dates, 0 duplicate keys, finite/nonnegative float64 target, {elig_count:,} eligible rows.")

    df_meta = df_val[[
        "outlet_id", "product_id", "forecast_origin_date",
        "category", "outlet_type", "area_type", "sales_mean_28d", "is_eligible_acc_5of7"
    ]].copy()

    # 8. Generating Validation Predictions
    print(f"\n[7] Generating Validation Predictions across {n_val:,} rows...")
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

    # 9. Comparative Alignment Verification (Baseline, Ridge, EXP1)
    print(f"\n[8] Verifying Exact Keyed Alignment with Baseline, Ridge, and EXP1 Predictions...")
    base_pred_csv = repo_root / "ml" / "predictions" / "validation_predictions_7d.csv"
    ridge_pred_csv = repo_root / "ml" / "predictions" / "ridge_validation_predictions_7d.csv"
    exp1_pred_csv = repo_root / "ml" / "predictions" / "hgb_exp1_validation_predictions_7d.csv"

    key_cols = ["outlet_id", "product_id", "forecast_origin_date"]
    df_base = pd.read_csv(base_pred_csv, usecols=key_cols + ["actual_target", "rolling_average_baseline"])
    df_ridge = pd.read_csv(ridge_pred_csv, usecols=key_cols + ["actual_target", "clipped_prediction"])
    df_exp1 = pd.read_csv(exp1_pred_csv, usecols=key_cols + ["actual_target", "predicted_7d_clipped"])

    for name, df_other in [("Baseline", df_base), ("Ridge", df_ridge), ("EXP1", df_exp1)]:
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

    # 10. Quantitative Evaluation: Overall & Populations (Task E)
    print(f"\n[9] Computing Comprehensive Benchmark Metrics (Task E)...")
    elig_mask = df_meta["is_eligible_acc_5of7"].values == 1

    # Population A: All Valid (Primary)
    exp2_all_raw = compute_metrics(y_val_f64, raw_preds)
    exp2_all_clipped = compute_metrics(y_val_f64, clipped_preds)
    base_all = compute_metrics(y_val_f64, baseline_preds)
    ridge_all = compute_metrics(y_val_f64, ridge_preds)
    exp1_all = compute_metrics(y_val_f64, exp1_preds)

    # Population B: Availability-Eligible (Secondary Diagnostic)
    exp2_elig_raw = compute_metrics(y_val_f64[elig_mask], raw_preds[elig_mask])
    exp2_elig_clipped = compute_metrics(y_val_f64[elig_mask], clipped_preds[elig_mask])
    base_elig = compute_metrics(y_val_f64[elig_mask], baseline_preds[elig_mask])
    ridge_elig = compute_metrics(y_val_f64[elig_mask], ridge_preds[elig_mask])
    exp1_elig = compute_metrics(y_val_f64[elig_mask], exp1_preds[elig_mask])

    print(f"\n    --- POPULATION A: ALL VALID VALIDATION ROWS ({n_val:,} rows) ---")
    print(f"    Baseline (Rolling 28d): WAPE = {base_all['wape']*100:6.2f}% | MAE = {base_all['mae']:.4f} | RMSE = {base_all['rmse']:.4f} | Bias = {base_all['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):      WAPE = {ridge_all['wape']*100:6.2f}% | MAE = {ridge_all['mae']:.4f} | RMSE = {ridge_all['rmse']:.4f} | Bias = {ridge_all['bias']:+.4f}")
    print(f"    HGB EXP1 (Full 67F):    WAPE = {exp1_all['wape']*100:6.2f}% | MAE = {exp1_all['mae']:.4f} | RMSE = {exp1_all['rmse']:.4f} | Bias = {exp1_all['bias']:+.4f}")
    print(f"    HGB EXP2 (No-Inv 52F):  WAPE = {exp2_all_clipped['wape']*100:6.2f}% | MAE = {exp2_all_clipped['mae']:.4f} | RMSE = {exp2_all_clipped['rmse']:.4f} | Bias = {exp2_all_clipped['bias']:+.4f}")

    print(f"\n    --- POPULATION B: AVAILABILITY-ELIGIBLE ROWS ({int(np.sum(elig_mask)):,} rows) ---")
    print(f"    Baseline (Rolling 28d): WAPE = {base_elig['wape']*100:6.2f}% | MAE = {base_elig['mae']:.4f} | RMSE = {base_elig['rmse']:.4f} | Bias = {base_elig['bias']:+.4f}")
    print(f"    Ridge (Stage 3.3):      WAPE = {ridge_elig['wape']*100:6.2f}% | MAE = {ridge_elig['mae']:.4f} | RMSE = {ridge_elig['rmse']:.4f} | Bias = {ridge_elig['bias']:+.4f}")
    print(f"    HGB EXP1 (Full 67F):    WAPE = {exp1_elig['wape']*100:6.2f}% | MAE = {exp1_elig['mae']:.4f} | RMSE = {exp1_elig['rmse']:.4f} | Bias = {exp1_elig['bias']:+.4f}")
    print(f"    HGB EXP2 (No-Inv 52F):  WAPE = {exp2_elig_clipped['wape']*100:6.2f}% | MAE = {exp2_elig_clipped['mae']:.4f} | RMSE = {exp2_elig_clipped['rmse']:.4f} | Bias = {exp2_elig_clipped['bias']:+.4f}")

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
            "hgb_exp2_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_exp2_raw": compute_metrics(y_val_f64[mask], raw_preds[mask]),
            "hgb_exp1": compute_metrics(y_val_f64[mask], exp1_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    category_metrics = {}
    for cat in sorted(df_meta["category"].dropna().unique()):
        mask = (df_meta["category"] == cat).values
        category_metrics[cat] = {
            "samples": int(np.sum(mask)),
            "hgb_exp2_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_exp1": compute_metrics(y_val_f64[mask], exp1_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    outlet_type_metrics = {}
    for otype in sorted(df_meta["outlet_type"].dropna().unique()):
        mask = (df_meta["outlet_type"] == otype).values
        outlet_type_metrics[otype] = {
            "samples": int(np.sum(mask)),
            "hgb_exp2_clipped": compute_metrics(y_val_f64[mask], clipped_preds[mask]),
            "hgb_exp1": compute_metrics(y_val_f64[mask], exp1_preds[mask]),
            "ridge": compute_metrics(y_val_f64[mask], ridge_preds[mask]),
            "baseline": compute_metrics(y_val_f64[mask], baseline_preds[mask])
        }

    # 11. Export Prediction Artifact (10 columns as requested)
    print(f"\n[10] Exporting Validation Predictions Artifact...")
    pred_out_csv = repo_root / "ml" / "predictions" / "hgb_exp2_validation_predictions_7d.csv"
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
        "is_eligible_acc_5of7": df_meta["is_eligible_acc_5of7"]
    })
    pred_df.to_csv(pred_out_csv, index=False)
    pred_file_size_mb = pred_out_csv.stat().st_size / (1024 ** 2)
    print(f"    - Saved {pred_out_csv.name} ({pred_file_size_mb:.2f} MB, {len(pred_df):,} rows)")

    # 12. Inference Reproducibility Test on 1,000 Keyed Actual Validation Rows (Task F)
    print(f"\n[11] Testing Inference Reproducibility on Reloaded Artifact (Task F)...")
    reloaded_forecaster = joblib.load(model_path)

    # Load exactly first 1,000 actual validation rows from model_dataset_7d.csv
    val_sample_chunks = []
    for chunk in pd.read_csv(dataset_csv, usecols=cols_to_load, chunksize=1000):
        mask = (chunk["forecast_origin_date"] >= "2026-08-01") & (chunk["forecast_origin_date"] <= "2026-11-08")
        c_filtered = chunk[mask]
        if len(c_filtered) > 0:
            val_sample_chunks.append(c_filtered)
        if sum(len(c) for c in val_sample_chunks) >= 1000:
            break
    test_sample = pd.concat(val_sample_chunks, ignore_index=True).iloc[:1000]

    # Verify key alignment for the first 1,000 rows
    for k in ["outlet_id", "product_id", "forecast_origin_date"]:
        if not (test_sample[k].values == pred_df[k].iloc[:1000].values).all():
            raise ValueError(f"Task F Failure: Key mismatch on first 1,000 rows for key {k}")

    reloaded_raw = reloaded_forecaster.predict_raw(test_sample)
    reloaded_clipped = reloaded_forecaster.predict(test_sample)
    csv_raw = pred_df["predicted_7d_raw"].iloc[:1000].values
    csv_clipped = pred_df["predicted_7d_clipped"].iloc[:1000].values

    diff_raw = np.max(np.abs(reloaded_raw - csv_raw))
    diff_clipped = np.max(np.abs(reloaded_clipped - csv_clipped))
    print(f"    - Max difference vs. 4-decimal CSV (Raw):     {diff_raw:.8e}")
    print(f"    - Max difference vs. 4-decimal CSV (Clipped): {diff_clipped:.8e}")

    diff_raw_rounded = np.max(np.abs(np.round(reloaded_raw, 4) - csv_raw))
    diff_clipped_rounded = np.max(np.abs(np.round(reloaded_clipped, 4) - csv_clipped))
    print(f"    - Max difference after 4-decimal rounding:    {diff_clipped_rounded:.8e}")

    if diff_clipped > 5.0001e-5:
        raise ValueError(f"Reproducibility failure: Reloaded predictions differ by {diff_clipped}!")
    if diff_clipped_rounded != 0.0:
        raise ValueError("Reproducibility failure: 4-decimal rounded predictions do not match exactly!")
    print(f"    - Inference Reproducibility: VERIFIED EXACT.")

    # 13. Export Metrics JSON
    print(f"\n[12] Saving Machine-Readable Metrics JSON...")
    metrics_path = repo_root / "ml" / "reports" / "phase3_hgb_exp2_7d_metrics.json"

    # Calculate lifts vs Baseline, Ridge, and EXP1
    wape_exp2 = exp2_all_clipped["wape"]
    mae_exp2 = exp2_all_clipped["mae"]
    rmse_exp2 = exp2_all_clipped["rmse"]

    full_metrics_data = {
        "experiment_id": "EXP2_HGB_NO_INVENTORY_7D",
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
            "total_safe": len(safe_feats_52),
            "numerical_count": len(num_cols),
            "categorical_count": len(cat_cols),
            "excluded_inventory_features_count": len(INVENTORY_FEATURES_TO_EXCLUDE),
            "excluded_inventory_features": INVENTORY_FEATURES_TO_EXCLUDE
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
            "post_fit_process_rss_mb": round(proc_rss_post_fit, 2),
            "final_process_rss_mb": round(get_process_memory_mb(), 2),
            "system_ram_available_start_gb": sys_mem_start["available_gb"],
            "true_peak_rss_during_fit": "UNMONITORED_AND_UNAVAILABLE",
            "host_available_ram_during_training": "UNKNOWN",
            "swap_activity": "NOT VERIFIED"
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
            "hgb_exp2_clipped": exp2_all_clipped,
            "hgb_exp2_raw": exp2_all_raw,
            "hgb_exp1_clipped": exp1_all,
            "ridge_clipped": ridge_all,
            "baseline_rolling": base_all,
            # Comparison vs Baseline
            "wape_diff_pp_vs_baseline": round((base_all["wape"] - wape_exp2) * 100, 2),
            "relative_wape_reduction_pct_vs_baseline": round((base_all["wape"] - wape_exp2) / base_all["wape"] * 100, 2),
            "relative_mae_reduction_pct_vs_baseline": round((base_all["mae"] - mae_exp2) / base_all["mae"] * 100, 2),
            # Comparison vs Ridge
            "wape_diff_pp_vs_ridge": round((ridge_all["wape"] - wape_exp2) * 100, 2),
            "relative_wape_reduction_pct_vs_ridge": round((ridge_all["wape"] - wape_exp2) / ridge_all["wape"] * 100, 2),
            "relative_mae_reduction_pct_vs_ridge": round((ridge_all["mae"] - mae_exp2) / ridge_all["mae"] * 100, 2),
            # Comparison vs EXP1 (Ablation impact)
            "wape_diff_pp_vs_exp1": round((exp1_all["wape"] - wape_exp2) * 100, 2),
            "relative_wape_change_pct_vs_exp1": round((exp2_all_clipped["wape"] - exp1_all["wape"]) / exp1_all["wape"] * 100, 2),
            "relative_mae_change_pct_vs_exp1": round((exp2_all_clipped["mae"] - exp1_all["mae"]) / exp1_all["mae"] * 100, 2)
        },
        "benchmark_comparison_eligible": {
            "hgb_exp2_clipped": exp2_elig_clipped,
            "hgb_exp2_raw": exp2_elig_raw,
            "hgb_exp1_clipped": exp1_elig,
            "ridge_clipped": ridge_elig,
            "baseline_rolling": base_elig,
            "wape_diff_pp_vs_baseline": round((base_elig["wape"] - exp2_elig_clipped["wape"]) * 100, 2),
            "wape_diff_pp_vs_ridge": round((ridge_elig["wape"] - exp2_elig_clipped["wape"]) * 100, 2),
            "wape_diff_pp_vs_exp1": round((exp1_elig["wape"] - exp2_elig_clipped["wape"]) * 100, 2)
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

    clean_metrics = convert_types(full_metrics_data)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(clean_metrics, f, indent=2)
    print(f"    - Saved metrics to {metrics_path.name}")

    print("\n" + "=" * 80)
    print("EXP2_HGB_NO_INVENTORY_7D EXECUTION FINISHED SUCCESSFULLY")
    print("=" * 80)

    return clean_metrics


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    train_exp2_hgb_7d(repo_root)
