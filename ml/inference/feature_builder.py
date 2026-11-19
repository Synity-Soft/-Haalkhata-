#!/usr/bin/env python3
"""
BazarBondhu AI — Inference Feature Builder
==========================================

Constructs the exact 67 SAFE features required by the selected 7-day and 30-day
HistGradientBoostingRegressor forecasting models (EXP3_7D and HGB_30D).

Architecture:
- High-performance in-memory simulation of daily inventory flows and sales windows.
- Strict schema validation: exactly 67 SAFE features (55 numerical, 12 categorical).
- Zero data leakage: only information available on or before the forecast origin date.
- Explicit safety checks: reject unknown pairs, dates with insufficient history, and non-finite values.
- Zero inclusion of CONDITIONAL features or forbidden metadata/targets.
"""

import os
import sys
from pathlib import Path
from datetime import date, timedelta
from typing import Optional, Union, Dict, List, Tuple
from collections import defaultdict

import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# Feature Registry Constants
# -----------------------------------------------------------------------------

SAFE_FEATURES: List[str] = [
    # Historical sales features (19)
    "sales_lag_1d", "sales_lag_2d", "sales_lag_3d", "sales_lag_7d", "sales_lag_14d", "sales_lag_28d",
    "sales_sum_7d", "sales_mean_7d", "sales_std_7d",
    "sales_sum_14d", "sales_mean_14d", "sales_std_14d",
    "sales_sum_28d", "sales_mean_28d", "sales_std_28d",
    "sales_max_7d", "sales_nonzero_days_7d", "sales_max_28d", "sales_nonzero_days_28d",
    # Inventory features (14)
    "current_stock_quantity", "stock_received_7d", "stock_received_28d",
    "stock_wastage_7d", "stock_wastage_28d", "days_since_last_restock",
    "stock_to_recent_sales_ratio", "reorder_point", "minimum_stock_level",
    "maximum_stock_level", "stock_expiring_next_7d", "stock_expiring_next_30d",
    "nearest_expiry_days", "expiring_batch_count",
    # Outlet features (8: 5 categorical, 3 numerical)
    "outlet_type", "business_size", "division", "district", "area_type",
    "inventory_capacity_sku", "has_refrigeration", "has_pos_system",
    # Product features (9: 7 categorical, 2 numerical)
    "category", "subcategory", "brand", "unit", "package_size",
    "perishable_status", "typical_shelf_life_days", "storage_type", "is_essential_item",
    # Outlet-product pair pricing features (2 numerical)
    "outlet_selling_price_bdt", "outlet_purchase_cost_bdt",
    # Calendar features (12 numerical)
    "day_of_week", "day_of_month", "month", "week_of_year",
    "is_weekend", "is_month_start", "is_month_end",
    "is_ramadan", "is_eid_fitr", "is_eid_adha", "is_pohela_boishakh", "is_durga_puja",
    # Promotion features (3 numerical)
    "promotion_active_at_origin", "promotion_days_last_7d", "promotion_days_last_28d"
]

NUM_COLS: List[str] = [
    "sales_lag_1d", "sales_lag_2d", "sales_lag_3d", "sales_lag_7d", "sales_lag_14d", "sales_lag_28d",
    "sales_sum_7d", "sales_mean_7d", "sales_std_7d", "sales_sum_14d", "sales_mean_14d", "sales_std_14d",
    "sales_sum_28d", "sales_mean_28d", "sales_std_28d", "sales_max_7d", "sales_nonzero_days_7d",
    "sales_max_28d", "sales_nonzero_days_28d", "current_stock_quantity", "stock_received_7d",
    "stock_received_28d", "stock_wastage_7d", "stock_wastage_28d", "days_since_last_restock",
    "stock_to_recent_sales_ratio", "reorder_point", "minimum_stock_level", "maximum_stock_level",
    "stock_expiring_next_7d", "stock_expiring_next_30d", "nearest_expiry_days", "expiring_batch_count",
    "inventory_capacity_sku", "has_refrigeration", "has_pos_system", "typical_shelf_life_days",
    "is_essential_item", "outlet_selling_price_bdt", "outlet_purchase_cost_bdt", "day_of_week",
    "day_of_month", "month", "week_of_year", "is_weekend", "is_month_start", "is_month_end",
    "is_ramadan", "is_eid_fitr", "is_eid_adha", "is_pohela_boishakh", "is_durga_puja",
    "promotion_active_at_origin", "promotion_days_last_7d", "promotion_days_last_28d"
]

CAT_COLS: List[str] = [
    "outlet_type", "business_size", "division", "district", "area_type",
    "category", "subcategory", "brand", "unit", "package_size",
    "perishable_status", "storage_type"
]

CONDITIONAL_FEATURES: List[str] = [
    "outlet_average_daily_demand",
    "average_selling_price_bdt",
    "average_cost_price_bdt",
    "average_restock_frequency_days",
    "days_until_next_festival"
]

FORBIDDEN_COLUMNS: List[str] = [
    "outlet_id", "product_id", "forecast_origin_date", "split_set",
    "target_7d", "target_30d",
    "physical_avail_days_7d", "accessible_avail_days_7d",
    "physical_avail_days_30d", "accessible_avail_days_30d",
    "is_eligible_phys_4of7", "is_eligible_phys_5of7", "is_eligible_phys_6of7", "is_eligible_phys_7of7",
    "is_eligible_acc_4of7", "is_eligible_acc_5of7", "is_eligible_acc_6of7", "is_eligible_acc_7of7",
    "is_eligible_phys_15of30", "is_eligible_phys_20of30", "is_eligible_phys_25of30", "is_eligible_phys_30of30",
    "is_eligible_acc_15of30", "is_eligible_acc_20of30", "is_eligible_acc_25of30", "is_eligible_acc_30of30"
]


class InferenceFeatureBuilder:
    """
    High-performance feature builder for real-time demand forecast inference.

    Pre-indexes catalog metadata and simulates batch inventory lifecycles
    across the entire historical panel to allow sub-millisecond feature extraction.
    """

    def __init__(self, data_dir: Optional[Union[str, Path]] = None):
        if data_dir is None:
            # Locate DataSets relative to project root
            base_dir = Path(__file__).resolve().parent.parent.parent
            self.data_dir = base_dir / "DataSets"
        else:
            self.data_dir = Path(data_dir)

        if not self.data_dir.exists():
            raise FileNotFoundError(f"DataSets directory not found: {self.data_dir}")

        self._load_and_build_panel()

    def _load_and_build_panel(self):
        """Loads source tables and prepares panel matrices in memory."""
        # 1. Load source tables with exact required columns
        df_sales = pd.read_csv(
            self.data_dir / "sales.csv",
            usecols=["outlet_id", "product_id", "sale_date", "quantity_sold", "batch_id"]
        )
        df_batches = pd.read_csv(
            self.data_dir / "inventory_batches.csv",
            usecols=["batch_id", "outlet_id", "product_id", "initial_quantity", "batch_received_date", "expiry_date"]
        )
        df_wastage = pd.read_csv(
            self.data_dir / "wastage_records.csv",
            usecols=["batch_id", "outlet_id", "product_id", "wastage_date", "wasted_quantity"]
        )
        df_op = pd.read_csv(
            self.data_dir / "outlet_products.csv",
            usecols=[
                "outlet_id", "product_id", "selling_price_bdt", "purchase_cost_bdt",
                "minimum_stock_level", "maximum_stock_level", "reorder_point"
            ]
        )
        df_outlets = pd.read_csv(
            self.data_dir / "outlets.csv",
            usecols=[
                "outlet_id", "outlet_type", "business_size", "division", "district",
                "area_type", "inventory_capacity_sku", "has_refrigeration", "has_pos_system"
            ]
        )
        df_products = pd.read_csv(
            self.data_dir / "products.csv",
            usecols=[
                "product_id", "category", "subcategory", "brand", "unit", "package_size",
                "perishable_status", "typical_shelf_life_days", "storage_type", "is_essential_item"
            ]
        )
        df_promotions = pd.read_csv(
            self.data_dir / "promotions_discounts.csv",
            usecols=["outlet_id", "product_id", "start_date"]
        )

        # 2. Known IDs and pair catalog mapping
        self.known_outlets = set(df_outlets["outlet_id"].unique())
        self.known_products = set(df_products["product_id"].unique())

        self.op_pairs = list(df_op[["outlet_id", "product_id"]].itertuples(index=False, name=None))
        self.pair_to_idx = {p: i for i, p in enumerate(self.op_pairs)}
        N = len(self.op_pairs)

        # 3. Calendar timeline mapping (365 days)
        start_d = date.fromisoformat("2025-11-16")
        self.canonical_dates = [(start_d + timedelta(days=i)).isoformat() for i in range(365)]
        self.d_to_idx = {d: i for i, d in enumerate(self.canonical_dates)}
        self.min_history_idx = 27  # Warmup period 0..26 (requires >= 28 days for lags/rolling)

        # 4. Fast lookup dictionaries for sales and wastage per batch
        b_sales = defaultdict(lambda: defaultdict(int))
        for s in df_sales.itertuples(index=False):
            if s.sale_date in self.d_to_idx:
                b_sales[s.batch_id][self.d_to_idx[s.sale_date]] += s.quantity_sold

        b_waste = defaultdict(lambda: defaultdict(int))
        for w in df_wastage.itertuples(index=False):
            if w.wastage_date in self.d_to_idx:
                b_waste[w.batch_id][self.d_to_idx[w.wastage_date]] += w.wasted_quantity

        # 5. Allocate flow and stock matrices
        batch_sum_open = np.zeros((N, 365), dtype=np.int64)
        batch_sum_recv = np.zeros((N, 365), dtype=np.int64)
        batch_sum_sale = np.zeros((N, 365), dtype=np.int64)
        batch_sum_waste = np.zeros((N, 365), dtype=np.int64)
        batch_sum_close = np.zeros((N, 365), dtype=np.int64)

        exp_7d = np.zeros((N, 365), dtype=np.int32)
        exp_30d = np.zeros((N, 365), dtype=np.int32)
        exp_count = np.zeros((N, 365), dtype=np.int16)
        nearest_exp = np.full((N, 365), 999, dtype=np.int16)

        # Batch lifecycle simulation matching Phase 1.6.3 / Phase 2 logic
        for b in df_batches.itertuples(index=False):
            pair_key = (b.outlet_id, b.product_id)
            if pair_key not in self.pair_to_idx:
                continue
            p_idx = self.pair_to_idx[pair_key]
            r_idx = self.d_to_idx[b.batch_received_date]
            e_idx = self.d_to_idx.get(b.expiry_date, 365)
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
                    cl_q = 0
                else:
                    cl_q = qty_before_exp

                cur_stock = cl_q

                batch_sum_open[p_idx, d] += op_q
                batch_sum_recv[p_idx, d] += rc_q
                batch_sum_sale[p_idx, d] += sq
                batch_sum_waste[p_idx, d] += wq
                batch_sum_close[p_idx, d] += cl_q

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
            pair_key = (p.outlet_id, p.product_id)
            if pair_key in self.pair_to_idx and p.start_date in self.d_to_idx:
                prom_mat[self.pair_to_idx[pair_key], self.d_to_idx[p.start_date]] = 1

        self.sales_mat = batch_sum_sale.astype(np.float32)
        self.recv_mat = batch_sum_recv.astype(np.int32)
        self.waste_mat = batch_sum_waste.astype(np.int32)
        self.close_mat = batch_sum_close.astype(np.int32)
        self.days_since_restock = days_since_restock
        self.exp_7d = exp_7d
        self.exp_30d = exp_30d
        self.exp_count = exp_count
        self.nearest_exp = nearest_exp
        self.prom_mat = prom_mat

        # 6. Static features dictionary indexed by pair_idx
        df_outlets_indexed = df_outlets.set_index("outlet_id")
        df_products_indexed = df_products.set_index("product_id")
        df_op_indexed = df_op.set_index(["outlet_id", "product_id"])

        self.static_pair_data = []
        for o_id, p_id in self.op_pairs:
            o_row = df_outlets_indexed.loc[o_id]
            p_row = df_products_indexed.loc[p_id]
            op_row = df_op_indexed.loc[(o_id, p_id)]
            self.static_pair_data.append({
                # Outlet attributes
                "outlet_type": str(o_row["outlet_type"]),
                "business_size": str(o_row["business_size"]),
                "division": str(o_row["division"]),
                "district": str(o_row["district"]),
                "area_type": str(o_row["area_type"]),
                "inventory_capacity_sku": int(o_row["inventory_capacity_sku"]),
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
                "is_essential_item": int(p_row["is_essential_item"]),
                # Outlet-product pair attributes
                "outlet_selling_price_bdt": float(op_row["selling_price_bdt"]),
                "outlet_purchase_cost_bdt": float(op_row["purchase_cost_bdt"]),
                "reorder_point": int(op_row["reorder_point"]),
                "minimum_stock_level": int(op_row["minimum_stock_level"]),
                "maximum_stock_level": int(op_row["maximum_stock_level"]),
            })

        # 7. Calendar lookup dictionary for all 365 dates
        self.cal_lookup = self._build_calendar_lookup()

    def _build_calendar_lookup(self) -> List[Dict[str, int]]:
        """Precomputes calendar and holiday attributes for each day in canonical timeline."""
        lookup = []
        for d_idx, d_str in enumerate(self.canonical_dates):
            cur_d = date.fromisoformat(d_str)
            dow = cur_d.weekday()
            dom = cur_d.day
            month = cur_d.month
            woy = cur_d.isocalendar()[1]

            is_wknd = 1 if dow in (4, 5) else 0  # Bangladesh weekend: Friday & Saturday
            is_m_start = 1 if dom <= 3 else 0
            is_m_end = 1 if dom >= 28 else 0

            # Festival windows
            is_ram = 1 if (self.d_to_idx["2026-02-18"] <= d_idx <= self.d_to_idx["2026-03-19"]) else 0
            is_eid1 = 1 if (self.d_to_idx["2026-03-19"] <= d_idx <= self.d_to_idx["2026-03-23"]) else 0
            is_pb = 1 if (d_idx == self.d_to_idx["2026-04-14"]) else 0
            is_eid2 = 1 if (self.d_to_idx["2026-05-26"] <= d_idx <= self.d_to_idx["2026-05-31"]) else 0
            is_dp = 1 if (self.d_to_idx["2026-10-20"] <= d_idx <= self.d_to_idx["2026-10-21"]) else 0

            lookup.append({
                "day_of_week": int(dow),
                "day_of_month": int(dom),
                "month": int(month),
                "week_of_year": int(woy),
                "is_weekend": int(is_wknd),
                "is_month_start": int(is_m_start),
                "is_month_end": int(is_m_end),
                "is_ramadan": int(is_ram),
                "is_eid_fitr": int(is_eid1),
                "is_eid_adha": int(is_eid2),
                "is_pohela_boishakh": int(is_pb),
                "is_durga_puja": int(is_dp)
            })
        return lookup

    def validate_request(self, outlet_id: str, product_id: str, forecast_date: str) -> Tuple[int, int]:
        """
        Validates the input parameters.
        Raises descriptive ValueError / KeyError on invalid or out-of-scope inputs.
        Returns (pair_idx, date_idx).
        """
        if not isinstance(outlet_id, str) or not outlet_id.strip():
            raise ValueError(f"outlet_id must be a non-empty string, got {outlet_id!r}")
        if not isinstance(product_id, str) or not product_id.strip():
            raise ValueError(f"product_id must be a non-empty string, got {product_id!r}")
        if not isinstance(forecast_date, str) or not forecast_date.strip():
            raise ValueError(f"forecast_date must be a non-empty string (YYYY-MM-DD), got {forecast_date!r}")

        outlet_id = outlet_id.strip()
        product_id = product_id.strip()
        forecast_date = forecast_date.strip()

        if outlet_id not in self.known_outlets:
            raise ValueError(f"Unknown outlet_id '{outlet_id}'. Must be a valid outlet in the catalog.")
        if product_id not in self.known_products:
            raise ValueError(f"Unknown product_id '{product_id}'. Must be a valid product in the catalog.")

        pair = (outlet_id, product_id)
        if pair not in self.pair_to_idx:
            raise ValueError(f"Outlet-product pair ('{outlet_id}', '{product_id}') not found in outlet_products catalog.")

        if forecast_date not in self.d_to_idx:
            raise ValueError(
                f"Forecast date '{forecast_date}' is outside the valid timeline range "
                f"[{self.canonical_dates[0]} to {self.canonical_dates[-1]}]."
            )

        t_idx = self.d_to_idx[forecast_date]
        if t_idx < self.min_history_idx:
            raise ValueError(
                f"Insufficient historical data: forecast date '{forecast_date}' (day index {t_idx}) "
                f"requires at least 28 days of history. Minimum origin date is {self.canonical_dates[self.min_history_idx]}."
            )

        p_idx = self.pair_to_idx[pair]
        return p_idx, t_idx

    def build_features(self, outlet_id: str, product_id: str, forecast_date: str) -> pd.DataFrame:
        """
        Constructs the 67 SAFE features for the specified outlet-product pair
        and forecast origin date.

        Parameters
        ----------
        outlet_id : str
            Identifier of the outlet (e.g. 'OUT001').
        product_id : str
            Identifier of the product (e.g. 'PRD047').
        forecast_date : str
            Forecast origin date in 'YYYY-MM-DD' format (e.g. '2026-08-01').

        Returns
        -------
        pd.DataFrame
            A 1-row DataFrame containing exactly the 67 SAFE features in required schema order.
        """
        p_idx, t_idx = self.validate_request(outlet_id, product_id, forecast_date)

        # 1. Historical sales features (19)
        lag_1d = float(self.sales_mat[p_idx, t_idx])
        lag_2d = float(self.sales_mat[p_idx, t_idx - 1])
        lag_3d = float(self.sales_mat[p_idx, t_idx - 2])
        lag_7d = float(self.sales_mat[p_idx, t_idx - 6])
        lag_14d = float(self.sales_mat[p_idx, t_idx - 13])
        lag_28d = float(self.sales_mat[p_idx, t_idx - 27])

        win_7 = self.sales_mat[p_idx, t_idx - 6 : t_idx + 1]
        win_14 = self.sales_mat[p_idx, t_idx - 13 : t_idx + 1]
        win_28 = self.sales_mat[p_idx, t_idx - 27 : t_idx + 1]

        sum_7d = float(np.sum(win_7))
        sum_14d = float(np.sum(win_14))
        sum_28d = float(np.sum(win_28))

        mean_7d = float(sum_7d / 7.0)
        mean_14d = float(sum_14d / 14.0)
        mean_28d = float(sum_28d / 28.0)

        std_7d = float(np.std(win_7))
        std_14d = float(np.std(win_14))
        std_28d = float(np.std(win_28))

        max_7d = float(np.max(win_7))
        max_28d = float(np.max(win_28))

        nonzero_7d = int(np.sum(win_7 > 0))
        nonzero_28d = int(np.sum(win_28 > 0))

        # 2. Inventory features (14)
        cur_stock = int(self.close_mat[p_idx, t_idx])
        recv_7d = int(np.sum(self.recv_mat[p_idx, t_idx - 6 : t_idx + 1]))
        recv_28d = int(np.sum(self.recv_mat[p_idx, t_idx - 27 : t_idx + 1]))
        waste_7d = int(np.sum(self.waste_mat[p_idx, t_idx - 6 : t_idx + 1]))
        waste_28d = int(np.sum(self.waste_mat[p_idx, t_idx - 27 : t_idx + 1]))
        since_restock = int(self.days_since_restock[p_idx, t_idx])
        stock_to_sales = float(cur_stock / (sum_7d + 1.0))

        exp_7d_val = int(self.exp_7d[p_idx, t_idx])
        exp_30d_val = int(self.exp_30d[p_idx, t_idx])
        nearest_exp_val = int(self.nearest_exp[p_idx, t_idx])
        exp_count_val = int(self.exp_count[p_idx, t_idx])

        # 3. Promotions features (3)
        prom_active = int(self.prom_mat[p_idx, t_idx])
        prom_7d = int(np.sum(self.prom_mat[p_idx, t_idx - 6 : t_idx + 1]))
        prom_28d = int(np.sum(self.prom_mat[p_idx, t_idx - 27 : t_idx + 1]))

        # 4. Static features (8 outlet + 9 product + 2 pricing)
        static = self.static_pair_data[p_idx]

        # 5. Calendar features (12)
        cal = self.cal_lookup[t_idx]

        # Assemble the record in strict SAFE_FEATURES order
        feature_dict = {
            # Historical sales (19)
            "sales_lag_1d": np.float32(lag_1d),
            "sales_lag_2d": np.float32(lag_2d),
            "sales_lag_3d": np.float32(lag_3d),
            "sales_lag_7d": np.float32(lag_7d),
            "sales_lag_14d": np.float32(lag_14d),
            "sales_lag_28d": np.float32(lag_28d),
            "sales_sum_7d": np.float32(sum_7d),
            "sales_mean_7d": np.float32(mean_7d),
            "sales_std_7d": np.float32(std_7d),
            "sales_sum_14d": np.float32(sum_14d),
            "sales_mean_14d": np.float32(mean_14d),
            "sales_std_14d": np.float32(std_14d),
            "sales_sum_28d": np.float32(sum_28d),
            "sales_mean_28d": np.float32(mean_28d),
            "sales_std_28d": np.float32(std_28d),
            "sales_max_7d": np.float32(max_7d),
            "sales_nonzero_days_7d": np.int64(nonzero_7d),
            "sales_max_28d": np.float32(max_28d),
            "sales_nonzero_days_28d": np.int64(nonzero_28d),
            # Inventory (14)
            "current_stock_quantity": np.int64(cur_stock),
            "stock_received_7d": np.int64(recv_7d),
            "stock_received_28d": np.int64(recv_28d),
            "stock_wastage_7d": np.int64(waste_7d),
            "stock_wastage_28d": np.int64(waste_28d),
            "days_since_last_restock": np.int64(since_restock),
            "stock_to_recent_sales_ratio": np.float32(stock_to_sales),
            "reorder_point": np.int64(static["reorder_point"]),
            "minimum_stock_level": np.int64(static["minimum_stock_level"]),
            "maximum_stock_level": np.int64(static["maximum_stock_level"]),
            "stock_expiring_next_7d": np.int64(exp_7d_val),
            "stock_expiring_next_30d": np.int64(exp_30d_val),
            "nearest_expiry_days": np.int64(nearest_exp_val),
            "expiring_batch_count": np.int64(exp_count_val),
            # Outlet (8)
            "outlet_type": static["outlet_type"],
            "business_size": static["business_size"],
            "division": static["division"],
            "district": static["district"],
            "area_type": static["area_type"],
            "inventory_capacity_sku": np.int64(static["inventory_capacity_sku"]),
            "has_refrigeration": np.int64(static["has_refrigeration"]),
            "has_pos_system": np.int64(static["has_pos_system"]),
            # Product (9)
            "category": static["category"],
            "subcategory": static["subcategory"],
            "brand": static["brand"],
            "unit": static["unit"],
            "package_size": static["package_size"],
            "perishable_status": static["perishable_status"],
            "typical_shelf_life_days": np.int64(static["typical_shelf_life_days"]),
            "storage_type": static["storage_type"],
            "is_essential_item": np.int64(static["is_essential_item"]),
            # Pair pricing (2)
            "outlet_selling_price_bdt": np.float64(static["outlet_selling_price_bdt"]),
            "outlet_purchase_cost_bdt": np.float64(static["outlet_purchase_cost_bdt"]),
            # Calendar (12)
            "day_of_week": np.int64(cal["day_of_week"]),
            "day_of_month": np.int64(cal["day_of_month"]),
            "month": np.int64(cal["month"]),
            "week_of_year": np.int64(cal["week_of_year"]),
            "is_weekend": np.int64(cal["is_weekend"]),
            "is_month_start": np.int64(cal["is_month_start"]),
            "is_month_end": np.int64(cal["is_month_end"]),
            "is_ramadan": np.int64(cal["is_ramadan"]),
            "is_eid_fitr": np.int64(cal["is_eid_fitr"]),
            "is_eid_adha": np.int64(cal["is_eid_adha"]),
            "is_pohela_boishakh": np.int64(cal["is_pohela_boishakh"]),
            "is_durga_puja": np.int64(cal["is_durga_puja"]),
            # Promotion (3)
            "promotion_active_at_origin": np.int64(prom_active),
            "promotion_days_last_7d": np.int64(prom_7d),
            "promotion_days_last_28d": np.int64(prom_28d),
        }

        # Create 1-row DataFrame preserving exact SAFE_FEATURES ordering
        df_row = pd.DataFrame([feature_dict], columns=SAFE_FEATURES)

        # Integrity assertions before return
        self._validate_output_dataframe(df_row)

        return df_row

    def _validate_output_dataframe(self, df: pd.DataFrame):
        """Verifies schema invariants on the generated feature DataFrame."""
        if len(df) != 1:
            raise ValueError(f"Expected 1-row DataFrame, got {len(df)} rows.")

        if list(df.columns) != SAFE_FEATURES:
            raise ValueError(
                f"Generated columns do not match expected SAFE_FEATURES order. "
                f"Difference: {set(df.columns) ^ set(SAFE_FEATURES)}"
            )

        # Check for forbidden columns or conditional features
        forbidden_present = set(df.columns) & (set(FORBIDDEN_COLUMNS) | set(CONDITIONAL_FEATURES))
        if forbidden_present:
            raise ValueError(f"Forbidden or conditional features detected in output: {forbidden_present}")

        # Check for missing values in numerical columns
        for c in NUM_COLS:
            val = df[c].iloc[0]
            if pd.isna(val) or not np.isfinite(val):
                raise ValueError(f"Numerical feature '{c}' contains invalid/non-finite value: {val}")

        # Check categorical columns
        for c in CAT_COLS:
            val = df[c].iloc[0]
            if pd.isna(val) or not isinstance(val, str):
                raise ValueError(f"Categorical feature '{c}' must be a non-null string, got {val!r}")


# -----------------------------------------------------------------------------
# Module Singleton and Convenience Function
# -----------------------------------------------------------------------------

_GLOBAL_BUILDER: Optional[InferenceFeatureBuilder] = None


def get_feature_builder(data_dir: Optional[Union[str, Path]] = None) -> InferenceFeatureBuilder:
    """Returns a cached singleton of InferenceFeatureBuilder."""
    global _GLOBAL_BUILDER
    if _GLOBAL_BUILDER is None:
        _GLOBAL_BUILDER = InferenceFeatureBuilder(data_dir=data_dir)
    elif data_dir is not None and Path(data_dir).resolve() != _GLOBAL_BUILDER.data_dir.resolve():
        _GLOBAL_BUILDER = InferenceFeatureBuilder(data_dir=data_dir)
    return _GLOBAL_BUILDER


def build_features(
    outlet_id: str,
    product_id: str,
    forecast_date: str,
    data_dir: Optional[Union[str, Path]] = None
) -> pd.DataFrame:
    """
    Constructs the 67 SAFE features for an outlet-product pair on a forecast date.

    Parameters
    ----------
    outlet_id : str
        Outlet code, e.g. 'OUT001'.
    product_id : str
        Product code, e.g. 'PRD047'.
    forecast_date : str
        Forecast origin date, e.g. '2026-08-01'.
    data_dir : Optional[Union[str, Path]]
        Path to DataSets directory. If None, resolves to project DataSets/.

    Returns
    -------
    pd.DataFrame
        1-row DataFrame containing exactly the 67 SAFE features in schema order.
    """
    builder = get_feature_builder(data_dir=data_dir)
    return builder.build_features(outlet_id, product_id, forecast_date)


if __name__ == "__main__":
    import time

    print("Initializing InferenceFeatureBuilder benchmark...")
    t0 = time.time()
    b = get_feature_builder()
    print(f"Initialized builder in {time.time() - t0:.2f} s")

    t1 = time.time()
    sample_df = b.build_features("OUT001", "PRD047", "2026-08-01")
    t_extract = (time.time() - t1) * 1000
    print(f"Extracted 67 SAFE features in {t_extract:.3f} ms")
    print(f"Shape: {sample_df.shape}")
    print(f"Columns (first 10): {sample_df.columns[:10].tolist()}")
    print("Verification completed successfully.")
