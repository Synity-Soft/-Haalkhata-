#!/usr/bin/env python3
"""
BazarBondhu AI — Feature Builder Parity & Robustness Verification
==================================================================

Comprehensive test suite verifying:
1. Feature Parity: 100 deterministic samples (50 train, 50 validation) against
   ground-truth feature values from model_dataset_7d.csv across all 67 SAFE features.
2. Schema Invariants: Exact 67 columns, 55 numerical, 12 categorical, zero NaNs.
3. Exclusion Invariants: Strict absence of 5 CONDITIONAL features and forbidden targets/IDs.
4. Error Handling: Rejection of unknown outlets, products, unregistered pairs,
   and dates with insufficient history or invalid formats.
"""

import io
import sys
import time
from pathlib import Path
from typing import List, Tuple, Dict, Any

import numpy as np
import pandas as pd

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from ml.inference.feature_builder import (
    InferenceFeatureBuilder,
    get_feature_builder,
    build_features,
    SAFE_FEATURES,
    NUM_COLS,
    CAT_COLS,
    CONDITIONAL_FEATURES,
    FORBIDDEN_COLUMNS,
)


def load_sample_dataset_rows(dataset_path: Path, n_train: int = 50, n_val: int = 50) -> pd.DataFrame:
    """
    Deterministically samples n_train rows from training partition
    and n_val rows from validation partition in model_dataset_7d.csv.
    """
    # Total dataset: 2,664,456 train rows, 1,325,600 val rows
    train_indices = np.linspace(500, 2600000, n_train, dtype=int).tolist()
    val_indices = np.linspace(2665000, 3985000, n_val, dtype=int).tolist()
    target_indices = set(train_indices + val_indices)
    max_idx = max(target_indices)

    sample_lines = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        header = f.readline()
        sample_lines.append(header)
        for i, line in enumerate(f):
            if i in target_indices:
                sample_lines.append(line)
            if i >= max_idx:
                break

    df_samples = pd.read_csv(io.StringIO("".join(sample_lines)))
    return df_samples


def run_feature_parity_test(builder: InferenceFeatureBuilder, df_samples: pd.DataFrame) -> Dict[str, Any]:
    """
    Executes feature parity verification on the sampled rows against builder output.
    """
    print(f"\n[Test 1/3] Running Feature Parity Verification ({len(df_samples)} samples)...")
    total_comparisons = 0
    passed_comparisons = 0
    discrepancies = []
    max_num_diff = 0.0
    extraction_times_ms = []

    for idx, row in df_samples.iterrows():
        o_id = str(row["outlet_id"])
        p_id = str(row["product_id"])
        d_str = str(row["forecast_origin_date"])

        t0 = time.perf_counter()
        feats_df = builder.build_features(o_id, p_id, d_str)
        t_ms = (time.perf_counter() - t0) * 1000.0
        extraction_times_ms.append(t_ms)

        # 1. Output shape & column ordering check
        assert feats_df.shape == (1, 67), f"Expected shape (1, 67), got {feats_df.shape}"
        assert list(feats_df.columns) == SAFE_FEATURES, "Column names/order do not match SAFE_FEATURES"

        # 2. Strict exclusion check
        for cond_f in CONDITIONAL_FEATURES:
            assert cond_f not in feats_df.columns, f"CONDITIONAL feature '{cond_f}' leaked into output"
        for forb_col in FORBIDDEN_COLUMNS:
            assert forb_col not in feats_df.columns, f"FORBIDDEN column '{forb_col}' leaked into output"

        # 3. Individual feature comparison
        for f in SAFE_FEATURES:
            total_comparisons += 1
            computed_val = feats_df[f].iloc[0]
            stored_val = row[f]

            if f in NUM_COLS:
                comp_num = float(computed_val)
                stor_num = float(stored_val)
                diff = abs(comp_num - stor_num)
                if diff > max_num_diff:
                    max_num_diff = diff

                # CSV serialization uses float32 representation (1e-4 tolerance is strict and safe)
                if diff <= 1e-4:
                    passed_comparisons += 1
                else:
                    discrepancies.append({
                        "sample_idx": idx,
                        "outlet_id": o_id,
                        "product_id": p_id,
                        "origin_date": d_str,
                        "feature": f,
                        "computed": comp_num,
                        "stored": stor_num,
                        "diff": diff
                    })
            else:
                comp_str = str(computed_val).strip()
                stor_str = str(stored_val).strip()
                if comp_str == stor_str:
                    passed_comparisons += 1
                else:
                    discrepancies.append({
                        "sample_idx": idx,
                        "outlet_id": o_id,
                        "product_id": p_id,
                        "origin_date": d_str,
                        "feature": f,
                        "computed": comp_str,
                        "stored": stor_str,
                        "diff": "CAT_MISMATCH"
                    })

    avg_time_ms = float(np.mean(extraction_times_ms))
    p95_time_ms = float(np.percentile(extraction_times_ms, 95))

    print(f"      Total samples tested: {len(df_samples)} (50 train, 50 validation)")
    print(f"      Total feature assertions: {total_comparisons:,}")
    print(f"      Passed assertions: {passed_comparisons:,} / {total_comparisons:,}")
    print(f"      Max numerical absolute difference: {max_num_diff:.4e}")
    print(f"      Latency: avg={avg_time_ms:.3f} ms, p95={p95_time_ms:.3f} ms per sample")

    if discrepancies:
        print(f"      FAILED: Found {len(discrepancies)} discrepancies!")
        for d in discrepancies[:5]:
            print(f"        {d}")
        raise AssertionError(f"Feature parity verification failed with {len(discrepancies)} discrepancies.")

    print("      PASSED: 100% parity across all 67 SAFE features!")
    return {
        "samples_count": len(df_samples),
        "total_comparisons": total_comparisons,
        "passed_comparisons": passed_comparisons,
        "discrepancies_count": len(discrepancies),
        "max_num_diff": max_num_diff,
        "avg_latency_ms": avg_time_ms,
        "p95_latency_ms": p95_time_ms
    }


def run_schema_and_finiteness_tests(builder: InferenceFeatureBuilder):
    """
    Validates output DataFrame structure, data types, and numerical finiteness.
    """
    print("\n[Test 2/3] Running Schema & Numerical Finiteness Checks...")
    df = builder.build_features("OUT001", "PRD047", "2026-08-01")

    # Shape
    assert df.shape == (1, 67), f"Expected shape (1, 67), got {df.shape}"

    # Types and Finiteness
    for c in NUM_COLS:
        val = df[c].iloc[0]
        assert np.issubdtype(type(val), np.number), f"Column {c} is not numeric, got {type(val)}"
        assert np.isfinite(val), f"Column {c} has non-finite value: {val}"
        assert not pd.isna(val), f"Column {c} contains NaN"

    for c in CAT_COLS:
        val = df[c].iloc[0]
        assert isinstance(val, str), f"Column {c} is not string, got {type(val)}"
        assert len(val) > 0, f"Column {c} is empty string"

    print("      PASSED: Schema, column types, and numerical finiteness confirmed.")


def run_error_handling_tests(builder: InferenceFeatureBuilder):
    """
    Tests that invalid inputs and edge cases are rejected with clear ValueErrors.
    """
    print("\n[Test 3/3] Running Input Validation & Error Handling Checks...")

    # 1. Unknown outlet
    try:
        builder.build_features("OUT999", "PRD047", "2026-08-01")
        assert False, "Should have raised ValueError on unknown outlet_id"
    except ValueError as e:
        assert "Unknown outlet_id" in str(e), f"Unexpected message: {e}"

    # 2. Unknown product
    try:
        builder.build_features("OUT001", "PRD999", "2026-08-01")
        assert False, "Should have raised ValueError on unknown product_id"
    except ValueError as e:
        assert "Unknown product_id" in str(e), f"Unexpected message: {e}"

    # 3. Unregistered pair
    # Outlet OUT001 with a product not stocked at OUT001
    # Find a product not stocked at OUT001
    out001_prods = {p for o, p in builder.op_pairs if o == "OUT001"}
    unstocked_prod = next(p for p in builder.known_products if p not in out001_prods)
    try:
        builder.build_features("OUT001", unstocked_prod, "2026-08-01")
        assert False, "Should have raised ValueError on unregistered pair"
    except ValueError as e:
        assert "not found in outlet_products catalog" in str(e), f"Unexpected message: {e}"

    # 4. Insufficient history (origin date in warmup period: before day 27 / 2025-12-13)
    try:
        builder.build_features("OUT001", "PRD047", "2025-11-20")
        assert False, "Should have raised ValueError on insufficient history"
    except ValueError as e:
        assert "requires at least 28 days of history" in str(e), f"Unexpected message: {e}"

    # 5. Out of bounds date
    try:
        builder.build_features("OUT001", "PRD047", "2027-01-01")
        assert False, "Should have raised ValueError on out-of-range date"
    except ValueError as e:
        assert "outside the valid timeline range" in str(e), f"Unexpected message: {e}"

    # 6. Invalid date format
    try:
        builder.build_features("OUT001", "PRD047", "invalid-date")
        assert False, "Should have raised ValueError on invalid date"
    except ValueError:
        pass

    print("      PASSED: All 6 error handling and boundary edge cases verified.")


def main():
    print("=" * 70)
    print("BazarBondhu AI — Feature Builder Comprehensive Parity Test")
    print("=" * 70)

    dataset_path = REPO_ROOT / "ml" / "data" / "model_dataset_7d.csv"
    if not dataset_path.exists():
        print(f"ERROR: Dataset file not found at {dataset_path}")
        sys.exit(1)

    t0_init = time.time()
    builder = get_feature_builder()
    print(f"Feature builder initialized in {time.time() - t0_init:.2f} s")

    # Sample 100 rows
    t0_sample = time.time()
    df_samples = load_sample_dataset_rows(dataset_path, n_train=50, n_val=50)
    print(f"Sampled {len(df_samples)} ground-truth rows in {time.time() - t0_sample:.2f} s")

    # Run tests
    parity_results = run_feature_parity_test(builder, df_samples)
    run_schema_and_finiteness_tests(builder)
    run_error_handling_tests(builder)

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED SUCCESSFULLY (3/3 Test Suites)")
    print("=" * 70)
    print(f"Summary:")
    print(f"- Ground-truth verification samples: {parity_results['samples_count']}")
    print(f"- Feature assertions evaluated: {parity_results['total_comparisons']:,}")
    print(f"- Feature parity success rate: 100.0% ({parity_results['passed_comparisons']:,}/{parity_results['total_comparisons']:,})")
    print(f"- Max numerical discrepancy: {parity_results['max_num_diff']:.2e} (<= 1e-4 target)")
    print(f"- Mean extraction latency: {parity_results['avg_latency_ms']:.3f} ms / call")
    print(f"- P95 extraction latency: {parity_results['p95_latency_ms']:.3f} ms / call")
    print("=" * 70)


if __name__ == "__main__":
    main()
