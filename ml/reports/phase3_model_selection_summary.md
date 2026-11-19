# BazarBondhu AI — Phase 3
# Model Selection Summary & Technical Specification

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer  
**Stage:** Phase 3.9: Model Selection, Technical Specification & Limitations  
**Date:** November 17, 2026  
**Repository Working Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  

---

## 1. Selected Model Architecture Overview

Following extensive empirical benchmarking across Phase 3 (Stage 3.2 Baseline, Stage 3.3 Ridge Regression, Stage 3.5 HGB EXP1 Full, Stage 3.6 HGB EXP2 Ablation, Stage 3.7 HGB EXP3 Loss Ablation, and Stage 3.8 30-Day HGB), the **HistGradientBoostingRegressor with Absolute Error Loss** (`loss='absolute_error'`) has been selected as the winning architecture for both forecasting horizons:

1. **Selected 7-Day Forecasting Model:**
   - **Artifact:** [`ml/models/7d/hgb_exp3_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp3_absolute_error_model.joblib) (140.37 KB)
   - **Validation Predictions:** [`ml/predictions/hgb_exp3_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp3_validation_predictions_7d.csv) (90.52 MB, 1,325,600 rows)
   - **Training Script:** [`ml/scripts/train_hgb_exp3.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb_exp3.py)
   - **Metrics JSON:** [`ml/reports/phase3_hgb_exp3_7d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp3_7d_metrics.json)

2. **Selected 30-Day Forecasting Model:**
   - **Artifact:** [`ml/models/30d/hgb_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/hgb_absolute_error_model.joblib) (168.60 KB)
   - **Validation Predictions:** [`ml/predictions/hgb_validation_predictions_30d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_validation_predictions_30d.csv) (60.60 MB, 1,020,712 rows)
   - **Training Script:** [`ml/scripts/train_hgb_30d.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb_30d.py)
   - **Metrics JSON:** [`ml/reports/phase3_hgb_30d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_30d_metrics.json)

---

## 2. Technical Specifications & Feature Schema

### 2.1 Model Hyperparameters
Both models utilize identical non-linear gradient-boosted tree configurations:
- **Estimator:** `sklearn.ensemble.HistGradientBoostingRegressor`
- **Loss Function:** `loss='absolute_error'` (L1 norm / conditional median estimation)
- **Learning Rate:** `learning_rate=0.08`
- **Max Iterations:** `max_iter=100` (100 boosting iterations; no early stopping)
- **Tree Topology:** `max_leaf_nodes=31`, `min_samples_leaf=50`
- **Regularization:** `l2_regularization=1.0`
- **Categorical Columns:** Indices `[55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66]`
- **Random State:** `42` (deterministic training)

### 2.2 Feature Schema (67 SAFE Features)
Both models take exactly the 67 SAFE features identified in the Phase 3 Feature Safety Audit. The design matrix layout places numerical features first (`0..54`) followed by ordinally encoded categorical features (`55..66`):

- **Numerical Features (55 columns; indices 0..54):**
  * *Sales Lags & Rolling Aggregates (18):* `sales_lag_1d`, `sales_lag_2d`, `sales_lag_3d`, `sales_lag_7d`, `sales_lag_14d`, `sales_lag_28d`, `sales_sum_7d`, `sales_sum_14d`, `sales_sum_28d`, `sales_mean_7d`, `sales_mean_14d`, `sales_mean_28d`, `sales_std_7d`, `sales_std_14d`, `sales_std_28d`, `sales_min_28d`, `sales_max_28d`, `zero_sales_days_28d`.
  * *Price & Promotion (6):* `selling_price_bdt`, `cost_price_bdt`, `gross_margin_bdt`, `gross_margin_rate`, `discount_rate`, `promotion_type_encoded`.
  * *Store & Macro (8):* `outlet_operating_hours`, `outlet_shelf_capacity_sqm`, `outlet_cold_storage_flag`, `regional_gdp_per_capita_bdt`, `division_population_millions`, `district_density_sqkm`, `urban_influence_index`, `transit_hub_distance_km`.
  * *Calendar & Seasonality (8):* `day_of_week`, `day_of_month`, `month_of_year`, `quarter_of_year`, `is_weekend`, `is_payday_window`, `is_hartal_general_strike`, `monsoon_season_flag`.
  * *Inventory & Supply Chain (15):* `current_stock_quantity`, `stock_received_7d`, `stock_received_28d`, `stock_wastage_7d`, `stock_wastage_28d`, `days_since_last_restock`, `stock_to_recent_sales_ratio`, `reorder_point`, `minimum_stock_level`, `maximum_stock_level`, `stock_expiring_next_7d`, `stock_expiring_next_30d`, `nearest_expiry_days`, `expiring_batch_count`, `inventory_capacity_sku`.

- **Categorical Features (12 columns; indices 55..66):**
  * `outlet_type` (3 categories), `business_size` (5 categories), `division` (12 categories), `district` (12 categories), `area_type` (9 categories), `category` (25 categories), `subcategory` (29 categories), `brand` (10 categories), `unit` (7 categories), `package_size` (49 categories), `perishable_status` (2 categories), `storage_type` (2 categories).
  * Encoded via `OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)` fitted exclusively on training observations.

- **Explicitly Excluded Columns:**
  * *5 CONDITIONAL Features (Forbidden):* `outlet_average_daily_demand`, `average_selling_price_bdt`, `average_cost_price_bdt`, `average_restock_frequency_days`, `days_until_next_festival`.
  * *Identifiers & Targets:* `outlet_id`, `product_id`, `forecast_origin_date`, `target_7d`, `target_30d`, `is_eligible_acc_5of7`, `is_eligible_acc_20of30`.

---

## 3. Partition Design & Temporal Windows

```
+-------------------------------------------------------------------------------------------------------------------------+
| TEMPORAL PARTITIONS ACROSS FORECASTING HORIZONS                                                                         |
+-------------+-----------------------------+-------------------+----------------------------+----------------------------+
| HORIZON     | TRAINING PARTITION (201 D)  | PURGE GAP (30 D)  | VALIDATION PARTITION       | VALIDATION OBSERVATIONS    |
+-------------+-----------------------------+-------------------+----------------------------+----------------------------+
| 7-Day Model | 2025-12-13 to 2026-07-01    | 2026-07-02 to     | 2026-08-01 to 2026-11-08   | 1,325,600 rows             |
|             | (2,664,456 rows)            | 2026-07-31 (0 r)  | (100 calendar dates)       | (1,102,601 eligible)       |
+-------------+-----------------------------+-------------------+----------------------------+----------------------------+
| 30-Day Model| 2025-12-13 to 2026-07-01    | 2026-07-02 to     | 2026-08-01 to 2026-10-16   | 1,020,712 rows             |
|             | (2,664,456 rows)            | 2026-07-31 (0 r)  | (77 calendar dates)        | (853,740 eligible)         |
+-------------+-----------------------------+-------------------+----------------------------+----------------------------+
```

*Note on Validation Window Truncation:* For the 30-day model, validation origins terminate on `2026-10-16` (77 origins) because the 30-day cumulative window requires 30 days of forward history, reaching `2026-11-15` (the final record in the dataset).

---

## 4. Benchmark Performance & Comparative Analysis

All benchmark metrics below were independently recalculated directly from the stored prediction files during the Stage 3.9 audit:

### 4.1 7-Day Demand Forecasting Benchmark

```
+-------------------------------------------------------------------------------------------------------------------------+
| 7-DAY BENCHMARK COMPARISON (PRIMARY: ALL VALID: 1,325,600 ROWS | SECONDARY: ELIGIBLE: 1,102,601 ROWS)                   |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
| MODEL ARCHITECTURE            | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | LIFT VS. SELECTED HGB EXP3      |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
| [Primary: All Valid Rows]     |             |             |             |             |                                 |
| Stage 3.2 Rolling Baseline    | 73.96%      | 7.0658      | 12.6544     | +0.0443     | +12.74 pp WAPE (+17.23% MAE)    |
| Stage 3.3 Corrected Ridge     | 77.36%      | 7.3907      | 13.0554     | +3.1921     | +16.14 pp WAPE (+20.87% MAE)    |
| Stage 3.5 HGB EXP1 (Full, SE) | 63.43%      | 6.0598      | 10.9528     | +0.8005     | +2.21 pp WAPE (+3.49% MAE)      |
| Stage 3.6 HGB EXP2 (No-Inv,SE)| 64.21%      | 6.1340      | 11.0472     | +0.0185     | +2.99 pp WAPE (+4.65% MAE)      |
| Stage 3.7 HGB EXP3 (Clipped)  | 61.22%      | 5.8486      | 10.8431     | -0.4567     | SELECTED MODEL (Leader)         |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
| [Secondary: Eligible Rows]    |             |             |             |             |                                 |
| Stage 3.2 Rolling Baseline    | 70.30%      | 7.9032      | 13.5906     | -0.2134     | +9.86 pp WAPE (+14.02% MAE)     |
| Stage 3.3 Corrected Ridge     | 74.00%      | 8.3186      | 14.0928     | +3.5548     | +13.55 pp WAPE (+18.32% MAE)    |
| Stage 3.5 HGB EXP1 (Full, SE) | 62.15%      | 6.9870      | 11.8724     | +0.9364     | +1.71 pp WAPE (+2.75% MAE)      |
| Stage 3.6 HGB EXP2 (No-Inv,SE)| 62.18%      | 6.9902      | 11.9449     | -0.0789     | +1.74 pp WAPE (+2.79% MAE)      |
| Stage 3.7 HGB EXP3 (Clipped)  | 60.44%      | 6.7950      | 11.7336     | -0.4318     | SELECTED MODEL (Leader)         |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
```

### 4.2 30-Day Demand Forecasting Benchmark

```
+-------------------------------------------------------------------------------------------------------------------------+
| 30-DAY BENCHMARK COMPARISON (PRIMARY: ALL VALID: 1,020,712 ROWS | SECONDARY: ELIGIBLE: 853,740 ROWS)                    |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
| MODEL ARCHITECTURE            | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | LIFT VS. SELECTED HGB 30D       |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
| [Primary: All Valid Rows]     |             |             |             |             |                                 |
| Stage 3.2 Rolling Baseline    | 43.19%      | 17.7550     | 32.0077     | +0.0623     | +16.66 pp WAPE (+38.57% MAE)    |
| Stage 3.3 Corrected Ridge     | 32.21%      | 13.2412     | 22.2746     | +5.0930     | +5.68 pp WAPE (+17.63% MAE)     |
| Stage 3.8 HGB 30D (Raw, AE)   | 26.53%      | 10.9069     | 19.1755     | +0.6290     | Unclipped baseline reference    |
| Stage 3.8 HGB 30D (Clipped)   | 26.53%      | 10.9066     | 19.1755     | +0.6293     | SELECTED MODEL (Leader)         |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
| [Secondary: Eligible Rows]    |             |             |             |             |                                 |
| Stage 3.2 Rolling Baseline    | 41.69%      | 19.8771     | 34.5539     | +0.0771     | +16.39 pp WAPE (+39.31% MAE)    |
| Stage 3.3 Corrected Ridge     | 30.11%      | 14.3533     | 23.5934     | +5.6541     | +4.81 pp WAPE (+15.96% MAE)     |
| Stage 3.8 HGB 30D (Clipped)   | 25.30%      | 12.0624     | 20.5955     | +0.9752     | SELECTED MODEL (Leader)         |
+-------------------------------+-------------+-------------+-------------+-------------+---------------------------------+
```

---

## 5. Inference Reproducibility Audit Results

The Stage 3.9 audit tested both serialized models on 1,000 keyed validation observations sampled directly from the source datasets starting from `2026-08-01`:

- **7-Day Model:**
  * Sample: First 1,000 validation observations from `ml/data/model_dataset_7d.csv`.
  * Quantized Discrepancy vs. Stored Predictions: **0.00000000e+00**
  * Maximum Raw Float64 Discrepancy: $4.99288257 \times 10^{-5}$ (within 4-decimal serialization half-LSB bound).
  * Status: **VERIFIED EXACT**.
- **30-Day Model:**
  * Sample: First 1,000 validation observations from `ml/data/model_dataset_30d.csv`.
  * Quantized Discrepancy vs. Stored Predictions: **0.00000000e+00**
  * Maximum Raw Float64 Discrepancy: $4.99905759 \times 10^{-5}$ (within 4-decimal serialization half-LSB bound).
  * Status: **VERIFIED EXACT**.

---

## 6. Known Limitations & Methodological Constraints

To ensure rigorous interpretation and prevent misapplication, the following limitations must be formally recognized:

### 6.1 Synthetic Data Context
The dataset was synthetically generated to model retail FMCG grocery networks in Bangladesh across three store formats and nine regional market archetypes. While temporal consistency, seasonal patterns, and pricing dynamics were strictly modeled, findings reflect the synthetic data generating process. Statistical distributions may differ from physical retail point-of-sale telemetries.

### 6.2 Validation-Set Model Selection (No Pristine Test Set)
Model architectures, loss functions, and feature sets were selected and iterated upon using performance on the validation partition (`2026-08-01` to `2026-11-08`). **This evaluation does not represent an untouched, pristine test set evaluation.** Reported metrics may slightly overestimate prospective performance due to selection optimization across experiments. A true forward test on prospective calendar dates is recommended prior to commercial commitment.

### 6.3 Observed Sales vs. Unconstrained Demand
The forecasting targets (`target_7d` and `target_30d`) represent recorded sales transactions. When an item was out of stock, recorded sales were zero or capped at on-hand inventory. The models forecast **expected observed sales under past stocking patterns**, not true latent unconstrained customer demand. Applying these forecasts directly to replenishment without accounting for historical stockouts will reinforce historical under-stocking.

### 6.4 Serial Correlation Across Overlapping Forecast Horizons
Validation observations span consecutive calendar origins (100 days for 7-day; 77 days for 30-day). Because a 7-day window initiated on Day $t$ shares 6 days of sales with Day $t+1$, and a 30-day window shares 29 days, forecast errors are serially autocorrelated. Observations cannot be treated as independent statistical trials for standard hypothesis testing.

### 6.5 Median Regression Bias Characteristics
Because `loss='absolute_error'` optimizes the conditional median, and retail demand distributions are heavily right-skewed, conditional medians are systematically lower than conditional means ($\text{Median}[Y] \le \mathbb{E}[Y]$). As a result:
- The 7-day model exhibits a slight conservative negative bias (**-0.4567 units** overall).
- In automated inventory replenishment, median forecasts must be combined with safety stock buffers or quantile forecasts (e.g. P75/P90) to prevent stockouts on high-variance items.

### 6.6 No Claim of Production Readiness
**Neither model is claimed or authorized as "production-ready".** Real-world deployment requires pipeline hardening, continuous data drift monitoring, automated retraining pipelines, out-of-stock truncation handling, and integration with supply chain ERP/WMS systems.

---

## 7. Package Deliverables & Repository Layout

```
ml/
├── models/
│   ├── 7d/
│   │   ├── hgb_exp1_full_model.joblib          # Stage 3.5 (Preserved)
│   │   ├── hgb_exp2_no_inventory_model.joblib  # Stage 3.6 (Preserved)
│   │   └── hgb_exp3_absolute_error_model.joblib # Stage 3.7 Selected Model (140 KB)
│   ├── 30d/
│   │   ├── ridge_model.joblib                  # Stage 3.3 (Preserved)
│   │   └── hgb_absolute_error_model.joblib     # Stage 3.8 Selected Model (169 KB)
│   └── forecaster.py                           # Universal HGBDemandForecaster wrapper
├── predictions/
│   ├── hgb_exp3_validation_predictions_7d.csv  # 7-day validation predictions (90.5 MB)
│   └── hgb_validation_predictions_30d.csv      # 30-day validation predictions (60.6 MB)
├── scripts/
│   ├── train_hgb_exp3.py                       # 7-day training script
│   ├── train_hgb_30d.py                        # 30-day training script
│   └── verify_final_models.py                  # Final 25-check verification audit script
└── reports/
    ├── phase3_hgb_exp3_7d_report.md            # Stage 3.7 technical report
    ├── phase3_hgb_30d_report.md                # Stage 3.8 technical report
    ├── phase3_final_model_verification.json    # Machine-readable audit trail (25/25 PASSED)
    ├── phase3_final_model_verification.md      # Detailed audit report
    └── phase3_model_selection_summary.md       # Technical specification & limitations (This document)
```
