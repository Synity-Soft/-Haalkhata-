#!/usr/bin/env python3
"""
BazarBondhu AI — Phase 2: Feature Engineering & Dataset Preparation Pipeline

Reproducible feature engineering pipeline generating model-ready tabular datasets
for 7-day and 30-day grocery demand forecasting.

Grain:
    one row = one outlet_id + one product_id + one forecast_origin_date

Deliverables:
    ml/data/model_dataset_7d.csv (or .parquet if pyarrow/fastparquet available)
    ml/data/model_dataset_30d.csv (or .parquet if pyarrow/fastparquet available)
    ml/features/feature_metadata.json
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path
from datetime import date, timedelta
from collections import defaultdict

import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# Configuration and Paths
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = BASE_DIR / "DataSets"
ML_DIR = BASE_DIR / "ml"
FEATURES_DIR = ML_DIR / "features"
DATA_DIR = ML_DIR / "data"
REPORTS_DIR = ML_DIR / "reports"

DATA_DIR.mkdir(parents=True, exist_ok=True)
FEATURES_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Detect Parquet engine availability
try:
    import pyarrow
    PARQUET_ENGINE = "pyarrow"
except ImportError:
    try:
        import fastparquet
        PARQUET_ENGINE = "fastparquet"
    except ImportError:
        PARQUET_ENGINE = None


def parse_args():
    parser = argparse.ArgumentParser(description="Build BazarBondhu AI forecasting datasets.")
    parser.add_argument("--horizon", choices=["7d", "30d", "all"], default="all", help="Forecasting horizon to build")
    parser.add_argument("--chunk-size", type=int, default=10, help="Number of origin dates per processing chunk")
    parser.add_argument("--output-format", choices=["auto", "csv", "parquet"], default="auto", help="Output file format")
    parser.add_argument("--quick-test", action="store_true", help="Run quick test on small subset of origins")
    return parser.parse_args()


def load_raw_data():
    print("[1/6] Loading source datasets from DataSets/ ...")
    t0 = time.time()
    df_sales = pd.read_csv(
        DATASET_DIR / "sales.csv",
        usecols=["outlet_id", "product_id", "sale_date", "quantity_sold", "batch_id"]
    )
    df_batches = pd.read_csv(
        DATASET_DIR / "inventory_batches.csv",
        usecols=["batch_id", "outlet_id", "product_id", "initial_quantity", "batch_received_date", "expiry_date", "remaining_quantity"]
    )
    df_wastage = pd.read_csv(
        DATASET_DIR / "wastage_records.csv",
        usecols=["batch_id", "outlet_id", "product_id", "wastage_date", "wasted_quantity"]
    )
    df_op = pd.read_csv(
        DATASET_DIR / "outlet_products.csv",
        usecols=[
            "outlet_id", "product_id", "selling_price_bdt", "purchase_cost_bdt",
            "minimum_stock_level", "maximum_stock_level", "reorder_point",
            "average_daily_demand", "is_active"
        ]
    )
    df_outlets = pd.read_csv(
        DATASET_DIR / "outlets.csv",
        usecols=[
            "outlet_id", "outlet_type", "business_size", "division", "district",
            "area_type", "inventory_capacity_sku", "average_restock_frequency_days",
            "has_refrigeration", "has_pos_system"
        ]
    )
    df_products = pd.read_csv(
        DATASET_DIR / "products.csv",
        usecols=[
            "product_id", "category", "subcategory", "brand", "unit", "package_size",
            "perishable_status", "typical_shelf_life_days", "storage_type",
            "average_cost_price_bdt", "average_selling_price_bdt", "is_essential_item"
        ]
    )
    df_calendar = pd.read_csv(DATASET_DIR / "calendar_events.csv")
    df_promotions = pd.read_csv(
        DATASET_DIR / "promotions_discounts.csv",
        usecols=["outlet_id", "product_id", "start_date", "end_date"]
    )
    df_metrics = pd.read_csv(
        DATASET_DIR / "daily_outlet_metrics.csv",
        usecols=["outlet_id", "date", "total_transactions"]
    )
    print(f"      Loaded 9 source tables in {time.time() - t0:.2f} s")
    return {
        "sales": df_sales,
        "batches": df_batches,
        "wastage": df_wastage,
        "op": df_op,
        "outlets": df_outlets,
        "products": df_products,
        "calendar": df_calendar,
        "promotions": df_promotions,
        "metrics": df_metrics
    }


def build_daily_matrices(raw):
    print("[2/6] Building daily panel matrices (13,256 pairs x 365 days) ...")
    t0 = time.time()

    df_sales = raw["sales"]
    df_batches = raw["batches"]
    df_wastage = raw["wastage"]
    df_op = raw["op"]
    df_metrics = raw["metrics"]
    df_promotions = raw["promotions"]

    # Catalog indexing
    op_pairs = list(df_op[["outlet_id", "product_id"]].itertuples(index=False))
    pair_to_idx = {p: i for i, p in enumerate(op_pairs)}
    N = len(op_pairs)

    # Gregorian date calendar mapping
    start_d = date.fromisoformat("2025-11-16")
    canonical_dates = [(start_d + timedelta(days=i)).isoformat() for i in range(365)]
    d_to_idx = {d: i for i, d in enumerate(canonical_dates)}

    # Batch maps for fast lookup
    b_sales = defaultdict(lambda: defaultdict(int))
    for s in df_sales.itertuples(index=False):
        b_sales[s.batch_id][d_to_idx[s.sale_date]] += s.quantity_sold

    b_waste = defaultdict(lambda: defaultdict(int))
    for w in df_wastage.itertuples(index=False):
        if w.wastage_date in d_to_idx:
            b_waste[w.batch_id][d_to_idx[w.wastage_date]] += w.wasted_quantity

    # Allocate flow and stock matrices
    batch_sum_open = np.zeros((N, 365), dtype=np.int64)
    batch_sum_recv = np.zeros((N, 365), dtype=np.int64)
    batch_sum_sale = np.zeros((N, 365), dtype=np.int64)
    batch_sum_waste = np.zeros((N, 365), dtype=np.int64)
    batch_sum_exp = np.zeros((N, 365), dtype=np.int64)
    batch_sum_close = np.zeros((N, 365), dtype=np.int64)

    # Expiry-related matrices
    exp_7d = np.zeros((N, 365), dtype=np.int32)
    exp_30d = np.zeros((N, 365), dtype=np.int32)
    exp_count = np.zeros((N, 365), dtype=np.int16)
    nearest_exp = np.full((N, 365), 999, dtype=np.int16)

    # Batch lifecycle simulation (strictly matches Phase 1.6.3 verified logic)
    for b in df_batches.itertuples(index=False):
        p_idx = pair_to_idx[(b.outlet_id, b.product_id)]
        r_idx = d_to_idx[b.batch_received_date]
        e_idx = d_to_idx.get(b.expiry_date, 365) # 365 if after calendar end
        init_q = b.initial_quantity
        s_dict = b_sales.get(b.batch_id, {})
        w_dict = b_waste.get(b.batch_id, {})

        cur_stock = 0
        end_day = min(364, e_idx)
        for d in range(r_idx, end_day + 1):
            op_q = 0 if d == r_idx else cur_stock
            rc_q = init_q if d == r_idx else 0
            intraday = op_q + rc_q
            sq = s_dict.get(d, 0)
            wq = w_dict.get(d, 0)
            qty_before_exp = intraday - sq - wq

            if d == e_idx:
                expired_amount = qty_before_exp
                cl_q = 0
            else:
                expired_amount = 0
                cl_q = qty_before_exp

            cur_stock = cl_q

            batch_sum_open[p_idx, d] += op_q
            batch_sum_recv[p_idx, d] += rc_q
            batch_sum_sale[p_idx, d] += sq
            batch_sum_waste[p_idx, d] += wq
            batch_sum_exp[p_idx, d] += expired_amount
            batch_sum_close[p_idx, d] += cl_q

            # Forward expiry features known at close of day d
            if cl_q > 0 and e_idx > d:
                rem_days = e_idx - d
                if rem_days <= 7:
                    exp_7d[p_idx, d] += cl_q
                if rem_days <= 30:
                    exp_30d[p_idx, d] += cl_q
                    exp_count[p_idx, d] += 1
                if rem_days < nearest_exp[p_idx, d]:
                    nearest_exp[p_idx, d] = rem_days

    # Restock elapsed days
    days_since_restock = np.zeros((N, 365), dtype=np.int16)
    last_restock = np.full(N, -999, dtype=np.int32)
    for d in range(365):
        has_recv = batch_sum_recv[:, d] > 0
        last_restock[has_recv] = d
        days_since_restock[:, d] = np.where(last_restock == -999, 999, d - last_restock).astype(np.int16)

    # Promotion matrix
    prom_mat = np.zeros((N, 365), dtype=np.int8)
    for p in df_promotions.itertuples(index=False):
        if (p.outlet_id, p.product_id) in pair_to_idx and p.start_date in d_to_idx:
            prom_mat[pair_to_idx[(p.outlet_id, p.product_id)], d_to_idx[p.start_date]] = 1

    # Availability & Store-closure masking
    intraday_stock = batch_sum_open + batch_sum_recv
    any_intraday_stock_available = ((intraday_stock > 0) | (batch_sum_sale > 0)).astype(np.int8)

    zero_tx_metrics = df_metrics[df_metrics["total_transactions"] == 0]
    zero_tx_set = set(zip(zero_tx_metrics["outlet_id"], zero_tx_metrics["date"].map(d_to_idx)))
    is_zero_tx = np.zeros((N, 365), dtype=bool)
    for p_idx, p in enumerate(op_pairs):
        for d in range(365):
            if (p.outlet_id, d) in zero_tx_set:
                is_zero_tx[p_idx, d] = True

    customer_accessible_avail = np.copy(any_intraday_stock_available)
    customer_accessible_avail[is_zero_tx] = 0

    print(f"      Reconstructed daily panel matrices in {time.time() - t0:.2f} s")

    return {
        "op_pairs": op_pairs,
        "pair_to_idx": pair_to_idx,
        "canonical_dates": canonical_dates,
        "d_to_idx": d_to_idx,
        "sales_mat": batch_sum_sale.astype(np.float32),
        "recv_mat": batch_sum_recv.astype(np.int32),
        "waste_mat": batch_sum_waste.astype(np.int32),
        "close_mat": batch_sum_close.astype(np.int32),
        "days_since_restock": days_since_restock,
        "exp_7d": exp_7d,
        "exp_30d": exp_30d,
        "exp_count": exp_count,
        "nearest_exp": nearest_exp,
        "prom_mat": prom_mat,
        "phys_avail": any_intraday_stock_available,
        "acc_avail": customer_accessible_avail
    }


def prepare_static_features(raw, op_pairs):
    print("[3/6] Preparing static catalog features (outlet, product, pair attributes) ...")
    df_op = raw["op"]
    df_outlets = raw["outlets"]
    df_products = raw["products"]

    # Index outlets and products
    df_outlets = df_outlets.set_index("outlet_id")
    df_products = df_products.set_index("product_id")
    df_op = df_op.set_index(["outlet_id", "product_id"])

    # Prepare catalog dataframe in exact pair order
    records = []
    for o_id, p_id in op_pairs:
        o_row = df_outlets.loc[o_id]
        p_row = df_products.loc[p_id]
        op_row = df_op.loc[(o_id, p_id)]

        records.append({
            "outlet_id": o_id,
            "product_id": p_id,
            # Outlet attributes
            "outlet_type": str(o_row["outlet_type"]),
            "business_size": str(o_row["business_size"]),
            "division": str(o_row["division"]),
            "district": str(o_row["district"]),
            "area_type": str(o_row["area_type"]),
            "inventory_capacity_sku": int(o_row["inventory_capacity_sku"]),
            "average_restock_frequency_days": int(o_row["average_restock_frequency_days"]),
            "has_refrigeration": int(o_row["has_refrigeration"]),
            "has_pos_system": int(o_row["has_pos_system"]),
            # Product attributes
            "category": str(p_row["category"]),
            "subcategory": str(p_row["subcategory"]),
            "brand": str(p_row["brand"]),
            "unit": str(p_row["unit"]),
            "package_size": str(p_row["package_size"]),
            "perishable_status": str(p_row["perishable_status"]),
            "typical_shelf_life_days": int(p_row["typical_shelf_life_days"]),
            "storage_type": str(p_row["storage_type"]),
            "average_cost_price_bdt": float(p_row["average_cost_price_bdt"]),
            "average_selling_price_bdt": float(p_row["average_selling_price_bdt"]),
            "is_essential_item": int(p_row["is_essential_item"]),
            # Outlet-product pair attributes
            "outlet_selling_price_bdt": float(op_row["selling_price_bdt"]),
            "outlet_purchase_cost_bdt": float(op_row["purchase_cost_bdt"]),
            "reorder_point": int(op_row["reorder_point"]),
            "minimum_stock_level": int(op_row["minimum_stock_level"]),
            "maximum_stock_level": int(op_row["maximum_stock_level"]),
            "outlet_average_daily_demand": float(op_row["average_daily_demand"])
        })

    static_df = pd.DataFrame.from_records(records)
    return static_df


def prepare_calendar_lookup(canonical_dates, df_calendar):
    """
    Computes Gregorian calendar and festival indicators for all 365 days.
    """
    d_to_idx = {d: i for i, d in enumerate(canonical_dates)}

    # Festival start dates
    festivals = [
        ("Ramadan", "2026-02-18", "2026-03-19"),
        ("Eid-ul-Fitr", "2026-03-19", "2026-03-23"),
        ("Pohela Boishakh", "2026-04-14", "2026-04-14"),
        ("Eid-ul-Adha", "2026-05-26", "2026-05-31"),
        ("Durga Puja", "2026-10-20", "2026-10-21")
    ]

    festival_starts = [d_to_idx[f[1]] for f in festivals]

    lookup = []
    for d_idx, d_str in enumerate(canonical_dates):
        cur_d = date.fromisoformat(d_str)

        # Day of week: Monday=0, Sunday=6
        dow = cur_d.weekday()
        dom = cur_d.day
        month = cur_d.month
        woy = cur_d.isocalendar()[1]

        # Bangladesh weekend: Friday (4) and Saturday (5)
        is_wknd = 1 if dow in (4, 5) else 0
        is_m_start = 1 if dom <= 3 else 0
        is_m_end = 1 if dom >= 28 else 0

        # Festival windows
        is_ram = 1 if (d_to_idx["2026-02-18"] <= d_idx <= d_to_idx["2026-03-19"]) else 0
        is_eid1 = 1 if (d_to_idx["2026-03-19"] <= d_idx <= d_to_idx["2026-03-23"]) else 0
        is_pb = 1 if (d_idx == d_to_idx["2026-04-14"]) else 0
        is_eid2 = 1 if (d_to_idx["2026-05-26"] <= d_idx <= d_to_idx["2026-05-31"]) else 0
        is_dp = 1 if (d_to_idx["2026-10-20"] <= d_idx <= d_to_idx["2026-10-21"]) else 0

        # Days until next festival
        upcoming = [f_idx - d_idx for f_idx in festival_starts if f_idx >= d_idx]
        days_to_fest = min(upcoming) if upcoming else 999

        lookup.append({
            "day_of_week": np.int8(dow),
            "day_of_month": np.int8(dom),
            "month": np.int8(month),
            "week_of_year": np.int8(woy),
            "is_weekend": np.int8(is_wknd),
            "is_month_start": np.int8(is_m_start),
            "is_month_end": np.int8(is_m_end),
            "is_ramadan": np.int8(is_ram),
            "is_eid_fitr": np.int8(is_eid1),
            "is_eid_adha": np.int8(is_eid2),
            "is_pohela_boishakh": np.int8(is_pb),
            "is_durga_puja": np.int8(is_dp),
            "days_until_next_festival": np.int16(days_to_fest)
        })

    return lookup


def generate_horizon_dataset(
    horizon: str,
    matrices: dict,
    static_df: pd.DataFrame,
    cal_lookup: list,
    chunk_size: int,
    output_format: str,
    quick_test: bool
):
    print(f"\n[4/6] Generating model dataset for {horizon} horizon ...")
    t0 = time.time()

    canonical_dates = matrices["canonical_dates"]
    N = len(matrices["op_pairs"])
    sales_mat = matrices["sales_mat"]
    close_mat = matrices["close_mat"]
    recv_mat = matrices["recv_mat"]
    waste_mat = matrices["waste_mat"]
    days_since_restock = matrices["days_since_restock"]
    exp_7d = matrices["exp_7d"]
    exp_30d = matrices["exp_30d"]
    exp_count = matrices["exp_count"]
    nearest_exp = matrices["nearest_exp"]
    prom_mat = matrices["prom_mat"]
    phys_avail = matrices["phys_avail"]
    acc_avail = matrices["acc_avail"]

    # Precompute cumulative sums for sales, receipts, wastage, promotions
    sales_cumsum = np.pad(np.cumsum(sales_mat, axis=1), ((0, 0), (1, 0)))
    sales_nonzero_cumsum = np.pad(np.cumsum((sales_mat > 0).astype(np.int32), axis=1), ((0, 0), (1, 0)))
    recv_cumsum = np.pad(np.cumsum(recv_mat, axis=1), ((0, 0), (1, 0)))
    waste_cumsum = np.pad(np.cumsum(waste_mat, axis=1), ((0, 0), (1, 0)))
    prom_cumsum = np.pad(np.cumsum(prom_mat, axis=1), ((0, 0), (1, 0)))

    # Temporal split configuration
    # Warmup: days 0..26 (2025-11-16 to 2025-12-12)
    # Training: days 27..227 (2025-12-13 to 2026-07-01, 201 origins)
    # Purge: days 228..257 (2026-07-02 to 2026-07-31, 30 days)
    # Validation start: day 258 (2026-08-01)
    train_origins = list(range(27, 228)) # 201 origins

    if horizon == "7d":
        h_days = 7
        val_max_idx = 364 - 7 # 357 (2026-11-08)
        val_origins = list(range(258, val_max_idx + 1)) # 100 origins
    elif horizon == "30d":
        h_days = 30
        val_max_idx = 364 - 30 # 334 (2026-10-16)
        val_origins = list(range(258, val_max_idx + 1)) # 77 origins
    else:
        raise ValueError(f"Unknown horizon: {horizon}")

    if quick_test:
        train_origins = train_origins[:3]
        val_origins = val_origins[:2]
        print(f"      [QUICK-TEST MODE] Running on {len(train_origins)} train and {len(val_origins)} val origins")

    all_origins = [(t_idx, "train") for t_idx in train_origins] + [(t_idx, "val") for t_idx in val_origins]
    total_origins = len(all_origins)
    total_samples = N * total_origins

    print(f"      Origins to generate: {len(train_origins)} train + {len(val_origins)} val = {total_origins} origins")
    print(f"      Total output rows: {total_samples:,} rows")

    # Output paths
    csv_path = DATA_DIR / f"model_dataset_{horizon}.csv"
    parquet_path = DATA_DIR / f"model_dataset_{horizon}.parquet"

    # Remove existing files
    if csv_path.exists():
        csv_path.unlink()
    if parquet_path.exists():
        parquet_path.unlink()

    # Determine format
    use_parquet = (output_format == "parquet") or (output_format == "auto" and PARQUET_ENGINE is not None)
    if not use_parquet and output_format == "parquet":
        print(f"      [WARNING] Parquet format requested but engine unavailable. Falling back to CSV.")
        use_parquet = False

    # Process in origin chunks
    total_written = 0
    chunk_list = [all_origins[i:i + chunk_size] for i in range(0, len(all_origins), chunk_size)]

    for c_i, chunk in enumerate(chunk_list):
        chunk_dfs = []
        for t_idx, split_set in chunk:
            origin_date_str = canonical_dates[t_idx]
            cal_feats = cal_lookup[t_idx]

            # -------------------------------------------------------------
            # A. Historical Sales Features
            # -------------------------------------------------------------
            lag_1d = sales_mat[:, t_idx]
            lag_2d = sales_mat[:, t_idx - 1]
            lag_3d = sales_mat[:, t_idx - 2]
            lag_7d = sales_mat[:, t_idx - 6]
            lag_14d = sales_mat[:, t_idx - 13]
            lag_28d = sales_mat[:, t_idx - 27]

            sum_7d = sales_cumsum[:, t_idx + 1] - sales_cumsum[:, t_idx - 6]
            sum_14d = sales_cumsum[:, t_idx + 1] - sales_cumsum[:, t_idx - 13]
            sum_28d = sales_cumsum[:, t_idx + 1] - sales_cumsum[:, t_idx - 27]

            mean_7d = sum_7d / 7.0
            mean_14d = sum_14d / 14.0
            mean_28d = sum_28d / 28.0

            win_7d = sales_mat[:, t_idx - 6 : t_idx + 1]
            win_14d = sales_mat[:, t_idx - 13 : t_idx + 1]
            win_28d = sales_mat[:, t_idx - 27 : t_idx + 1]

            std_7d = np.std(win_7d, axis=1)
            std_14d = np.std(win_14d, axis=1)
            std_28d = np.std(win_28d, axis=1)

            max_7d = np.max(win_7d, axis=1)
            max_28d = np.max(win_28d, axis=1)

            nonzero_7d = (sales_nonzero_cumsum[:, t_idx + 1] - sales_nonzero_cumsum[:, t_idx - 6]).astype(np.int16)
            nonzero_28d = (sales_nonzero_cumsum[:, t_idx + 1] - sales_nonzero_cumsum[:, t_idx - 27]).astype(np.int16)

            # -------------------------------------------------------------
            # B. Inventory Features
            # -------------------------------------------------------------
            cur_stock = close_mat[:, t_idx]
            recv_7d = recv_cumsum[:, t_idx + 1] - recv_cumsum[:, t_idx - 6]
            recv_28d = recv_cumsum[:, t_idx + 1] - recv_cumsum[:, t_idx - 27]
            waste_7d = waste_cumsum[:, t_idx + 1] - waste_cumsum[:, t_idx - 6]
            waste_28d = waste_cumsum[:, t_idx + 1] - waste_cumsum[:, t_idx - 27]
            since_restock = days_since_restock[:, t_idx]
            stock_to_sales = cur_stock / (sum_7d + 1.0)

            exp_7d_val = exp_7d[:, t_idx]
            exp_30d_val = exp_30d[:, t_idx]
            nearest_exp_val = nearest_exp[:, t_idx]
            exp_count_val = exp_count[:, t_idx]

            # -------------------------------------------------------------
            # C & D. Promos & Static features already aligned
            # -------------------------------------------------------------
            prom_active = prom_mat[:, t_idx]
            prom_7d = (prom_cumsum[:, t_idx + 1] - prom_cumsum[:, t_idx - 6]).astype(np.int8)
            prom_28d = (prom_cumsum[:, t_idx + 1] - prom_cumsum[:, t_idx - 27]).astype(np.int8)

            # -------------------------------------------------------------
            # E. Target and Availability / Censoring (Strictly Separate!)
            # -------------------------------------------------------------
            target_slice = sales_mat[:, t_idx + 1 : t_idx + 1 + h_days]
            target_val = np.sum(target_slice, axis=1).astype(np.int32)

            phys_slice = phys_avail[:, t_idx + 1 : t_idx + 1 + h_days]
            phys_days = np.sum(phys_slice, axis=1).astype(np.int8)

            acc_slice = acc_avail[:, t_idx + 1 : t_idx + 1 + h_days]
            acc_days = np.sum(acc_slice, axis=1).astype(np.int8)

            # Assemble DataFrame for this origin
            df_origin = pd.DataFrame({
                "outlet_id": static_df["outlet_id"],
                "product_id": static_df["product_id"],
                "forecast_origin_date": origin_date_str,
                "split_set": split_set,

                # Sales features
                "sales_lag_1d": lag_1d.astype(np.float32),
                "sales_lag_2d": lag_2d.astype(np.float32),
                "sales_lag_3d": lag_3d.astype(np.float32),
                "sales_lag_7d": lag_7d.astype(np.float32),
                "sales_lag_14d": lag_14d.astype(np.float32),
                "sales_lag_28d": lag_28d.astype(np.float32),
                "sales_sum_7d": sum_7d.astype(np.float32),
                "sales_sum_14d": sum_14d.astype(np.float32),
                "sales_sum_28d": sum_28d.astype(np.float32),
                "sales_mean_7d": mean_7d.astype(np.float32),
                "sales_mean_14d": mean_14d.astype(np.float32),
                "sales_mean_28d": mean_28d.astype(np.float32),
                "sales_std_7d": std_7d.astype(np.float32),
                "sales_std_14d": std_14d.astype(np.float32),
                "sales_std_28d": std_28d.astype(np.float32),
                "sales_max_7d": max_7d.astype(np.float32),
                "sales_max_28d": max_28d.astype(np.float32),
                "sales_nonzero_days_7d": nonzero_7d,
                "sales_nonzero_days_28d": nonzero_28d,

                # Inventory features
                "current_stock_quantity": cur_stock.astype(np.int32),
                "stock_received_7d": recv_7d.astype(np.int32),
                "stock_received_28d": recv_28d.astype(np.int32),
                "stock_wastage_7d": waste_7d.astype(np.int32),
                "stock_wastage_28d": waste_28d.astype(np.int32),
                "days_since_last_restock": since_restock,
                "stock_to_recent_sales_ratio": stock_to_sales.astype(np.float32),
                "reorder_point": static_df["reorder_point"],
                "minimum_stock_level": static_df["minimum_stock_level"],
                "maximum_stock_level": static_df["maximum_stock_level"],
                "stock_expiring_next_7d": exp_7d_val,
                "stock_expiring_next_30d": exp_30d_val,
                "nearest_expiry_days": nearest_exp_val,
                "expiring_batch_count": exp_count_val,

                # Outlet features
                "outlet_type": static_df["outlet_type"],
                "business_size": static_df["business_size"],
                "division": static_df["division"],
                "district": static_df["district"],
                "area_type": static_df["area_type"],
                "inventory_capacity_sku": static_df["inventory_capacity_sku"],
                "average_restock_frequency_days": static_df["average_restock_frequency_days"],
                "has_refrigeration": static_df["has_refrigeration"],
                "has_pos_system": static_df["has_pos_system"],

                # Product features
                "category": static_df["category"],
                "subcategory": static_df["subcategory"],
                "brand": static_df["brand"],
                "unit": static_df["unit"],
                "package_size": static_df["package_size"],
                "perishable_status": static_df["perishable_status"],
                "typical_shelf_life_days": static_df["typical_shelf_life_days"],
                "storage_type": static_df["storage_type"],
                "average_cost_price_bdt": static_df["average_cost_price_bdt"],
                "average_selling_price_bdt": static_df["average_selling_price_bdt"],
                "is_essential_item": static_df["is_essential_item"],
                "outlet_selling_price_bdt": static_df["outlet_selling_price_bdt"],
                "outlet_purchase_cost_bdt": static_df["outlet_purchase_cost_bdt"],
                "outlet_average_daily_demand": static_df["outlet_average_daily_demand"],

                # Calendar features
                "day_of_week": cal_feats["day_of_week"],
                "day_of_month": cal_feats["day_of_month"],
                "month": cal_feats["month"],
                "week_of_year": cal_feats["week_of_year"],
                "is_weekend": cal_feats["is_weekend"],
                "is_month_start": cal_feats["is_month_start"],
                "is_month_end": cal_feats["is_month_end"],
                "is_ramadan": cal_feats["is_ramadan"],
                "is_eid_fitr": cal_feats["is_eid_fitr"],
                "is_eid_adha": cal_feats["is_eid_adha"],
                "is_pohela_boishakh": cal_feats["is_pohela_boishakh"],
                "is_durga_puja": cal_feats["is_durga_puja"],
                "days_until_next_festival": cal_feats["days_until_next_festival"],

                # Promotion features
                "promotion_active_at_origin": prom_active,
                "promotion_days_last_7d": prom_7d,
                "promotion_days_last_28d": prom_28d
            })

            # Target & Eligibility columns (strictly non-features)
            if horizon == "7d":
                df_origin["target_7d"] = target_val
                df_origin["physical_avail_days_7d"] = phys_days
                df_origin["accessible_avail_days_7d"] = acc_days
                df_origin["is_eligible_phys_4of7"] = (phys_days >= 4).astype(np.int8)
                df_origin["is_eligible_phys_5of7"] = (phys_days >= 5).astype(np.int8)
                df_origin["is_eligible_phys_6of7"] = (phys_days >= 6).astype(np.int8)
                df_origin["is_eligible_phys_7of7"] = (phys_days >= 7).astype(np.int8)
                df_origin["is_eligible_acc_4of7"] = (acc_days >= 4).astype(np.int8)
                df_origin["is_eligible_acc_5of7"] = (acc_days >= 5).astype(np.int8)
                df_origin["is_eligible_acc_6of7"] = (acc_days >= 6).astype(np.int8)
                df_origin["is_eligible_acc_7of7"] = (acc_days >= 7).astype(np.int8)
            else:
                df_origin["target_30d"] = target_val
                df_origin["physical_avail_days_30d"] = phys_days
                df_origin["accessible_avail_days_30d"] = acc_days
                df_origin["is_eligible_phys_15of30"] = (phys_days >= 15).astype(np.int8)
                df_origin["is_eligible_phys_20of30"] = (phys_days >= 20).astype(np.int8)
                df_origin["is_eligible_phys_25of30"] = (phys_days >= 25).astype(np.int8)
                df_origin["is_eligible_phys_30of30"] = (phys_days >= 30).astype(np.int8)
                df_origin["is_eligible_acc_15of30"] = (acc_days >= 15).astype(np.int8)
                df_origin["is_eligible_acc_20of30"] = (acc_days >= 20).astype(np.int8)
                df_origin["is_eligible_acc_25of30"] = (acc_days >= 25).astype(np.int8)
                df_origin["is_eligible_acc_30of30"] = (acc_days >= 30).astype(np.int8)

            chunk_dfs.append(df_origin)

        # Concatenate chunk and write out
        chunk_combined = pd.concat(chunk_dfs, ignore_index=True)
        is_first = (c_i == 0)

        # Write CSV
        chunk_combined.to_csv(csv_path, mode="w" if is_first else "a", header=is_first, index=False)

        total_written += len(chunk_combined)
        progress = (c_i + 1) / len(chunk_list) * 100
        print(f"      [Chunk {c_i+1}/{len(chunk_list)}] Written {total_written:,} rows ({progress:.1f}%) ...")

    file_size_mb = csv_path.stat().st_size / (1024 * 1024)
    print(f"      Completed {horizon} dataset: {total_written:,} rows written to {csv_path.name} ({file_size_mb:.1f} MB) in {time.time() - t0:.2f} s")

    # If parquet engine is present, convert CSV to Parquet
    if use_parquet and PARQUET_ENGINE:
        print(f"      Writing {parquet_path.name} using engine={PARQUET_ENGINE} ...")
        t_pq = time.time()
        # Read back in chunks and save to parquet
        df_all = pd.read_csv(csv_path)
        df_all.to_parquet(parquet_path, engine=PARQUET_ENGINE, index=False)
        pq_size_mb = parquet_path.stat().st_size / (1024 * 1024)
        print(f"      Saved {parquet_path.name} ({pq_size_mb:.1f} MB) in {time.time() - t_pq:.2f} s")

    return {
        "horizon": horizon,
        "rows": total_written,
        "train_origins_count": len(train_origins),
        "val_origins_count": len(val_origins),
        "train_rows": len(train_origins) * N,
        "val_rows": len(val_origins) * N,
        "csv_path": str(csv_path),
        "csv_size_mb": round(file_size_mb, 2),
        "parquet_path": str(parquet_path) if (use_parquet and parquet_path.exists()) else None,
        "format_used": "parquet" if (use_parquet and parquet_path.exists()) else "csv"
    }


def main():
    args = parse_args()
    print("=========================================================================")
    print(" BazarBondhu AI — Phase 2: Feature Engineering & Dataset Pipeline       ")
    print("=========================================================================")
    print(f" Python Version:  {sys.version.split()[0]}")
    print(f" Pandas Version:  {pd.__version__}")
    print(f" NumPy Version:   {np.__version__}")
    print(f" Parquet Engine:  {PARQUET_ENGINE if PARQUET_ENGINE else 'UNAVAILABLE (Documented limitation; CSV operational)'}")
    print("=========================================================================\n")

    t_start = time.time()

    # Step 1: Load raw data
    raw = load_raw_data()

    # Step 2: Build daily matrices
    matrices = build_daily_matrices(raw)

    # Step 3: Prepare static features and calendar lookup
    static_df = prepare_static_features(raw, matrices["op_pairs"])
    cal_lookup = prepare_calendar_lookup(matrices["canonical_dates"], raw["calendar"])

    # Step 4: Generate datasets
    results = {}
    if args.horizon in ("7d", "all"):
        res_7d = generate_horizon_dataset(
            "7d", matrices, static_df, cal_lookup, args.chunk_size, args.output_format, args.quick_test
        )
        results["7d"] = res_7d

    if args.horizon in ("30d", "all"):
        res_30d = generate_horizon_dataset(
            "30d", matrices, static_df, cal_lookup, args.chunk_size, args.output_format, args.quick_test
        )
        results["30d"] = res_30d

    total_time = time.time() - t_start
    print("\n=========================================================================")
    print(f" Feature Generation Pipeline Complete in {total_time:.2f} s")
    print("=========================================================================")
    for h, res in results.items():
        print(f" Horizon {h}: {res['rows']:,} rows ({res['train_rows']:,} train / {res['val_rows']:,} val) -> {res['format_used'].upper()}")
    print("=========================================================================\n")


if __name__ == "__main__":
    main()
