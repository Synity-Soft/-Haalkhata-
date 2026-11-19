# BazarBondhu AI — Phase 3, Stage 3.5
# EXP1 Full-Dataset 7-Day HistGradientBoosting Model: Technical Audit & Benchmark Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer  
**Stage:** Phase 3, Stage 3.5: EXP1_HGB_FULL_7D Model Development & Benchmark  
**Experiment ID:** `EXP1_HGB_FULL_7D`  
**Execution Date:** November 17, 2026  
**Repository Working Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  
**Model Artifact:** [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib) (0.17 MB)  
**Prediction Artifact:** [`ml/predictions/hgb_exp1_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp1_validation_predictions_7d.csv) (72.74 MB, 1,325,600 rows)  
**Metrics JSON:** [`ml/reports/phase3_hgb_exp1_7d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp1_7d_metrics.json)  

---

## 1. Executive Summary & Core Results

The first full-scale nonlinear demand forecasting model for BazarBondhu AI (**EXP1_HGB_FULL_7D**) has been successfully trained and evaluated. Training executed across the complete 2,664,456 chronological training rows using all 67 SAFE features without subsampling, random splitting, or feature leakage.

### 1.1 The Breakthrough on 7-Day Demand
In Stage 3.3, regularized linear regression (Ridge) failed on the 7-day forecasting task (**77.36% WAPE** vs. **73.96% baseline**, a +3.40 percentage point degradation) because a continuous linear hyperplane cannot accommodate zero-inflated demand (30.97% exact zeroes) without severe bias.

`HistGradientBoostingRegressor` has decisively overcome this limitation:
- **Baseline (Rolling 28d):** WAPE = **73.96%** | MAE = **7.0658** | RMSE = **12.6544** | Bias = **+0.0443**
- **Ridge (Stage 3.3):** WAPE = **77.36%** | MAE = **7.3907** | RMSE = **13.0554** | Bias = **+3.1921**
- **HGB EXP1 (Raw):** WAPE = **63.48%** | MAE = **6.0643** | RMSE = **10.9529** | Bias = **+0.7960**
- **HGB EXP1 (Clipped):** WAPE = **63.43%** | MAE = **6.0598** | RMSE = **10.9528** | Bias = **+0.8005**

```
+--------------------------------------------------------------------------------------------------------------------+
| 7-DAY BENCHMARK COMPARISON (ALL VALID VALIDATION OBSERVATIONS: 1,325,600 ROWS)                                     |
+------------------------------+-------------+-------------+-------------+-------------+-----------------------------+
| MODEL ARCHITECTURE           | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | LIFT VS. ROLLING BASELINE   |
+------------------------------+-------------+-------------+-------------+-------------+-----------------------------+
| Stage 3.2 Rolling Baseline   | 73.96%      | 7.0658      | 12.6544     | +0.0443     | Benchmark Reference (0.00)  |
| Stage 3.3 Corrected Ridge    | 77.36%      | 7.3907      | 13.0554     | +3.1921     | -3.40 pp Degradation        |
| Stage 3.5 HGB EXP1 (Raw)     | 63.48%      | 6.0643      | 10.9529     | +0.7960     | +10.48 pp Win (-14.2% MAE)  |
| Stage 3.5 HGB EXP1 (Clipped) | 63.43%      | 6.0598      | 10.9528     | +0.8005     | +10.53 pp Win (-14.2% MAE)  |
+------------------------------+-------------+-------------+-------------+-------------+-----------------------------+
```

**Key Performance Milestones:**
1. **Net Baseline Win:** HGB delivers a **+10.53 percentage point improvement in WAPE** over the historical rolling average baseline (reducing relative error from 73.96% to 63.43%).
2. **Net Linear Model Win:** HGB outperforms Ridge by **+13.93 percentage points in WAPE** (77.36% $\to$ 63.43%) and reduces MAE by **18.01%** (7.3907 $\to$ 6.0598).
3. **Bias Compression:** Positive bias was reduced from **+3.1921 units** (Ridge) down to **+0.8005 units** (HGB), demonstrating that tree partitioning stops inventory and scale features from spuriously inflating customer demand.
4. **Availability-Eligible Population:** On the 1,102,601 in-stock observations, HGB achieved **62.15% WAPE** and **6.9870 MAE**, beating the rolling baseline (70.30% WAPE) by **+8.15 percentage points**.

---

## 2. Training & Preprocessing Architecture

### 2.1 Chronological Partitions & Data Isolation
The experimental setup strictly enforced temporal data boundaries:
- **Training Partition:** `2025-12-13` to `2026-07-01` (201 calendar dates).
  - Actual Training Rows: **2,664,456**.
  - Target: `target_7d` (forward 7-day cumulative sales).
- **Purge Window:** `2026-07-02` to `2026-07-31` (30 calendar days, 0 rows). Guarantees zero label overlap.
- **Validation Partition:** `2026-08-01` to `2026-11-08` (100 calendar dates).
  - Actual Validation Rows: **1,325,600**.

### 2.2 Feature Policy & Strict Admission
Exactly 67 SAFE features (55 numerical, 12 categorical) were ingested into the model:
- **Zero Conditional Features:** All 5 CONDITIONAL features (`outlet_average_daily_demand`, `average_selling_price_bdt`, `average_cost_price_bdt`, `average_restock_frequency_days`, `days_until_next_festival`) were verified absent.
- **Zero Leakage:** Entity IDs (`outlet_id`, `product_id`), target columns (`target_7d`, `target_30d`), future availability flags, and validation statistics were strictly excluded from model predictors.

### 2.3 Categorical Preprocessing Execution
- **Encoder:** `OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)` fitted exclusively on the 2,664,456 training rows.
- **Vocabularies Discovered:** Exactly 165 unique categorical levels across the 12 columns:
  - `outlet_type`: 3 unique
  - `business_size`: 5 unique
  - `division`: 12 unique
  - `district`: 12 unique
  - `area_type`: 9 unique
  - `category`: 25 unique
  - `subcategory`: 29 unique
  - `brand`: 10 unique
  - `unit`: 7 unique
  - `package_size`: 49 unique
  - `perishable_status`: 2 unique
  - `storage_type`: 2 unique
- **Feature Ordering:** Numerical columns occupy array indices `0..54`; encoded categorical columns occupy indices `55..66`.
- **HGB Categorical Registration:** Indices `list(range(55, 67))` were explicitly passed to `categorical_features`, activating scikit-learn's discrete histogram subset partitioning.

---

## 3. Model Hyperparameters & Operational Execution

### 3.1 Model Hyperparameter Configuration
In strict alignment with the approved Stage 3.4 configuration:
```json
{
  "loss": "squared_error",
  "learning_rate": 0.1,
  "max_iter": 100,
  "max_leaf_nodes": 31,
  "min_samples_leaf": 50,
  "l2_regularization": 1.0,
  "early_stopping": false,
  "random_state": 42
}
```
No hyperparameter grid tuning or trial-and-error search was conducted. All 100 boosting iterations were executed sequentially.

### 3.2 Computational Timing Profile
```
+----------------------------------------------------------------------------------------------------+
| COMPUTATIONAL EXECUTION TIMING                                                                     |
+------------------------------------+------------------+-------------------+------------------------+
| PHASE                              | WALL CLOCK TIME  | DATASET SCALE     | THROUGHPUT / RATE      |
+------------------------------------+------------------+-------------------+------------------------+
| Training CSV Loading (Chunked)     | 8.16 s           | 2,664,456 rows    | 326,526 rows / s       |
| Categorical Preprocessing (Fit+Tx) | 4.61 s           | 2,664,456 rows    | 577,973 rows / s       |
| Feature Matrix Assembly (Float32)  | In-place         | 680.99 MB matrix  | Zero-copy array build  |
| HGB Model Fitting (100 Trees)      | 87.41 s          | 100 iterations    | 874.11 ms / iteration  |
| Validation CSV Loading             | 11.46 s          | 1,325,600 rows    | 115,671 rows / s       |
| Validation Feature Transform       | 2.18 s           | 1,325,600 rows    | 608,073 rows / s       |
| Validation Inference (Predict)     | 6.84 s           | 1,325,600 rows    | 193,930 rows / s       |
| Verification & Metric Slicing      | 4.35 s           | 1,325,600 rows    | Full slice matrix      |
| Prediction CSV Serialization       | 3.92 s           | 72.74 MB on disk  | 1,325,600 rows         |
+------------------------------------+------------------+-------------------+------------------------+
| TOTAL END-TO-END PIPELINE RUNTIME  | ~128.9 s         | 3.99M Total Rows  | < 2.2 minutes total    |
+------------------------------------+------------------+-------------------+------------------------+
```

---

## 4. Resource Consumption & System Memory Behavior

Process Resident Set Size (RSS) was measured continuously via `psutil`:
- **Initial Process Baseline RSS:** `156.50 MB`
- **Peak RSS during Raw CSV Load & Assembly:** `4,445.41 MB` (~4.45 GB).
  - *Engineering Note:* While the consolidated `float32` matrix is only 680.99 MB, reading the 67 columns from raw text CSV created temporary pandas object overhead.
  - *Safeguard Action:* The script immediately disposed of `df_train`, intermediate arrays, and invoked `gc.collect()`.
- **Process RSS during Model Fit:** `1,750.64 MB` (~1.75 GB).
  - The model fitting phase operated inside **1.75 GB RAM**, fully corroborating the 1.8 GB memory estimate established in the Stage 3.4 readiness benchmark.
- **System Memory Health:** Available system RAM remained above **4.2 GB** throughout execution. Zero memory pressure alerts, zero process swapping, and zero OOM events occurred on the 16 GB Apple Silicon host.
- **Free Disk Space:** Remained stable at **17.16 GB** (consumed < 80 MB across model and prediction files).

---

## 5. Prediction Characteristics & Distributional Integrity

### 5.1 Finiteness and Extremes
- **Non-Finite Count:** Exactly **0 non-finite values** (0 NaN, 0 Inf across 1,325,600 validation predictions).
- **Raw Prediction Minimum:** `-7.9434` units.
- **Raw Prediction Maximum:** `129.2355` units.
- **Raw Prediction Mean:** `10.3495` units.
- **Negative Raw Predictions:** `41,540` rows (**3.13%** of validation set).
  - *Cause:* Unconstrained tree leaves evaluated on low-velocity SKUs with negative trend residuals can output slightly negative values.
- **Clipped Prediction Minimum:** `0.0000` units (`np.clip(y, 0, None)`).
- **Clipped Prediction Maximum:** `129.2355` units.
- **Clipped Prediction Mean:** `10.3540` units.
  - Clipping non-negative values improved WAPE marginally from 63.48% to 63.43% and MAE from 6.0643 to 6.0598, confirming that raw negative predictions were small in magnitude ($[-7.9, 0.0]$).

### 5.2 Inference Reproducibility Audit
- The fitted model was serialized to disk as an instance of `HGBDemandForecaster` inside [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib).
- The file was immediately deserialized in a separate memory space, and a 1,000-row validation sample was passed through the inference pipeline.
- **Max Absolute Difference:** Exactly **0.00000000e+00**. The reloaded model reproduces predictions with bitwise floating-point equality.

---

## 6. Granular Stratified Slices & Diagnostic Analysis

### 6.1 Performance by Demand Velocity Tier
The validation population was segmented into 4 demand velocity tiers based on annualized weekly sales velocity ($sales\_mean\_28d \times 7$):

```
+--------------------------------------------------------------------------------------------------------------------+
| STRATIFIED BREAKDOWN BY DEMAND TIER (7-DAY TASK)                                                                   |
+------------------------------+-----------+----------------------+----------------------+---------------------------+
| DEMAND TIER (UNITS / WEEK)   | SAMPLES   | HGB EXP1 WAPE (MAE)  | RIDGE WAPE (MAE)     | ROLLING BASELINE WAPE(MAE)|
+------------------------------+-----------+----------------------+----------------------+---------------------------+
| Zero / Intermittent (<2/wk)  | 267,139   | 78.49% (1.31)        | 112.05% (1.87)       | 94.65% (1.58)             |
| Low (2 to <10/wk)            | 642,001   | 62.40% (3.83)        | 75.97% (4.67)        | 73.58% (4.52)             |
| Medium (10 to 50/wk)         | 396,485   | 62.62% (11.77)       | 75.36% (14.17)       | 71.56% (13.45)            |
| High (>50/wk)                | 19,975    | 67.58% (27.72)       | 83.38% (34.20)       | 86.36% (35.42)            |
+------------------------------+-----------+----------------------+----------------------+---------------------------+
```

#### Diagnostic Insights:
1. **The Intermittent Breakthrough:** In the zero/intermittent tier (<2 units/week), Ridge experienced complete breakdown (**112.05% WAPE**), projecting continuous baseline sales onto dormant products. HGB slashed WAPE to **78.49%** (-33.56 pp vs. Ridge; -16.16 pp vs. Baseline) and cut MAE from 1.87 to 1.31.
2. **High-Velocity Scale Capture:** On high-velocity lines (>50 units/week), HGB outperformed the rolling baseline by **+18.78 percentage points** in WAPE (67.58% vs. 86.36%) and reduced MAE by 7.7 units (27.72 vs. 35.42), proving that non-linear boosting models scale across high-volume supermarket spikes without saturating.

### 6.2 Performance by Outlet Format

```
+--------------------------------------------------------------------------------------------------------------------+
| STRATIFIED BREAKDOWN BY OUTLET FORMAT                                                                              |
+------------------------------+-----------+----------------------+----------------------+---------------------------+
| OUTLET TYPE                  | SAMPLES   | HGB EXP1 WAPE (MAE)  | RIDGE WAPE (MAE)     | ROLLING BASELINE WAPE(MAE)|
+------------------------------+-----------+----------------------+----------------------+---------------------------+
| Grocery shop (Mudir Dokan)   | 562,600   | 64.10% (3.46)        | 77.37% (4.17)        | 73.76% (3.98)             |
| Grocery store (Minimart)     | 404,800   | 63.86% (3.98)        | 76.40% (4.76)        | 74.15% (4.62)             |
| Supermarket                  | 358,200   | 62.99% (12.50)       | 77.70% (15.42)       | 73.98% (14.68)            |
+------------------------------+-----------+----------------------+----------------------+---------------------------+
```
- Improvement is uniform across all retail formats: HGB beats the rolling baseline by **9.66 pp** in traditional Mudir Dokans, **10.29 pp** in minimarts, and **10.99 pp** in modern supermarkets.

### 6.3 Performance Across Representative Product Categories

```
+--------------------------------------------------------------------------------------------------------------------+
| REPRESENTATIVE PRODUCT CATEGORY SLICES                                                                             |
+------------------------------+-----------+----------------------+----------------------+---------------------------+
| PRODUCT CATEGORY             | SAMPLES   | HGB EXP1 WAPE (MAE)  | RIDGE WAPE (MAE)     | ROLLING BASELINE WAPE(MAE)|
+------------------------------+-----------+----------------------+----------------------+---------------------------+
| Cooking ingredients & Spices | 179,800   | 63.88% (6.13)        | 77.58% (7.45)        | 73.77% (7.08)             |
| Packaged & dry food          | 167,400   | 64.16% (6.17)        | 78.43% (7.54)        | 74.45% (7.16)             |
| Fresh produce (Perishable)   | 152,800   | 62.61% (5.93)        | 76.24% (7.22)        | 73.97% (7.01)             |
| Personal care                | 141,100   | 62.59% (6.00)        | 76.53% (7.34)        | 73.53% (7.05)             |
| Dairy & eggs (Chilled)       | 114,400   | 63.46% (6.06)        | 77.40% (7.39)        | 73.91% (7.06)             |
| Beverages                    | 92,600    | 63.40% (6.05)        | 77.01% (7.35)        | 73.84% (7.05)             |
| Frozen food                  | 61,000    | 63.70% (6.08)        | 77.34% (7.38)        | 74.07% (7.07)             |
+------------------------------+-----------+----------------------+----------------------+---------------------------+
```
- Across every category, HGB achieves consistent WAPE between **62.5% and 64.2%**, beating both Ridge and the Baseline by 10 to 14 percentage points.

---

## 7. Artifact Verification & Provenance

```
+----------------------------------------------------------------------------------------------------+
| SERIALIZED ARTIFACT REGISTRY                                                                       |
+-------------------+-------------------------------------------------------------+------------------+
| ARTIFACT TYPE     | REPOSITORY PATH                                             | SIZE / ROWS      |
+-------------------+-------------------------------------------------------------+------------------+
| Trained Model     | ml/models/7d/hgb_exp1_full_model.joblib                     | 0.17 MB (170 KB) |
| Predictions CSV   | ml/predictions/hgb_exp1_validation_predictions_7d.csv       | 72.74 MB / 1.32M |
| Metrics JSON      | ml/reports/phase3_hgb_exp1_7d_metrics.json                  | 32.5 KB          |
| Evaluation Report | ml/reports/phase3_hgb_exp1_7d_report.md                     | Current Document |
+-------------------+-------------------------------------------------------------+------------------+
```

### 7.1 Triple Forecast Key Verification
Before computing metrics, the triple forecast keys `(outlet_id, product_id, forecast_origin_date)` from `hgb_exp1_validation_predictions_7d.csv` were verified row-by-row against:
1. `ml/predictions/validation_predictions_7d.csv` (Stage 3.2 Baseline)
2. `ml/predictions/ridge_validation_predictions_7d.csv` (Stage 3.3 Ridge)

**Audit Results:**
- Duplicate keys in validation predictions: **0**
- Duplicate keys in baseline predictions: **0**
- Duplicate keys in Ridge predictions: **0**
- Key mismatches across 1,325,600 rows: **0**
- **Match Rate:** Exactly **100.000%**. Every reported comparison evaluates identical physical outlet-product-date events.

---

## 8. Summary Checklist of Reporting Requirements

1. **Actual Training Row Count:** Exactly `2,664,456` rows.
2. **Actual Feature Count:** Exactly `67` SAFE features (55 numerical, 12 categorical).
3. **Preprocessing Time:** `4.61` seconds.
4. **Training Time:** `87.41` seconds (100 boosting iterations, 31 leaves).
5. **Prediction Time:** `6.84` seconds on 1,325,600 validation rows (`193,930` rows/s).
6. **Peak Process Memory:** `1,750.64 MB` during model fitting; `4,445.41 MB` peak during CSV reading.
7. **System Memory Behavior:** Unswapped execution; available RAM remained above 4.2 GB throughout.
8. **Model Artifact Size:** `0.17 MB` (`170 KB`).
9. **Prediction Artifact Size:** `72.74 MB` (`1,325,600` rows).
10. **Inference Reproducibility:** Verified exact bitwise equality ($\Delta = 0.00000000e+00$).
11. **Baseline Comparison:** WAPE **63.43%** vs. **73.96%** baseline (**+10.53 pp win**; -14.2% MAE).
12. **Ridge Comparison:** WAPE **63.43%** vs. **77.36%** Ridge (**+13.93 pp win**; -18.0% MAE).
13. **All-Valid vs. Eligible:** All-valid WAPE is **63.43%**; Availability-eligible WAPE is **62.15%**.
14. **Errors, Warnings, Deviations:** An initial `ModuleNotFoundError` for `ml` was resolved by inserting the dynamically discovered repository root into `sys.path`. Zero warnings, zero numerical exceptions, and zero non-finite predictions occurred thereafter.

---

## 9. Strict Stopping Condition & Next Steps

In strict compliance with user instructions:
- **`EXP1_HGB_FULL_7D` is complete.**
- **NO further models have been trained.** Specifically:
  - `EXP2_HGB_NO_INVENTORY` has **NOT** been trained.
  - `EXP3_HGB_ABSOLUTE_ERROR` has **NOT** been trained.
  - No 30-day HGB models have been trained.
- **Status:** Execution is paused. Standing by for user technical review and explicit authorization before proceeding to the next stage.
