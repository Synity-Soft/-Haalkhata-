# BazarBondhu AI — Phase 3, Stage 3.8
# 30-Day Demand Forecasting (HGB Absolute Error): Technical Benchmark Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer  
**Stage:** Phase 3, Stage 3.8: 30-Day Demand Forecasting Model Development  
**Experiment ID:** `HGB_ABSOLUTE_ERROR_30D`  
**Execution Date:** November 17, 2026  
**Repository Working Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  
**Training Script:** [`ml/scripts/train_hgb_30d.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb_30d.py)  
**Model Artifact:** [`ml/models/30d/hgb_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/hgb_absolute_error_model.joblib) (0.16 MB)  
**Prediction Artifact:** [`ml/predictions/hgb_validation_predictions_30d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_validation_predictions_30d.csv) (60.60 MB, 1,020,712 rows, 9 columns)  
**Metrics JSON:** [`ml/reports/phase3_hgb_30d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_30d_metrics.json)  

---

## 1. Executive Summary & Core Results

The first non-linear 30-day demand forecasting model for BazarBondhu AI (**`HGB_ABSOLUTE_ERROR_30D`**) has been trained, evaluated, packaged, and verified. Following the empirical success of Stage 3.7 (`EXP3_HGB_ABSOLUTE_ERROR_7D`), the `HistGradientBoostingRegressor` with `loss='absolute_error'` (L1 / conditional median regression) was scaled to the 30-day sales forecasting task (`target_30d`).

The model was trained on the full **67 SAFE features** (55 numerical, 12 categorical) using the complete 2,664,456 chronological training rows, evaluated on all 1,020,712 30-day validation rows across 77 forecast origins (`2026-08-01` to `2026-10-16`), and compared strictly against the 30-day Rolling Average Baseline and 30-day Ridge Regression model.

### 1.1 Core Experimental Findings
1. **Decisive Accuracy Lead Over All 30-Day Reference Models:**
   - **Primary Population (All 1,020,712 Valid Observations):**
     * HGB 30D achieved **26.53% WAPE** and **10.9066 units MAE**.
     * Outperformed the Stage 3.2 30-day Rolling Average Baseline (**43.19% WAPE**, 17.7550 MAE) by **-16.66 percentage points** (a **38.57% relative MAE reduction**).
     * Outperformed the Stage 3.3 30-day Ridge Regression model (**32.21% WAPE**, 13.2412 MAE) by **-5.68 percentage points** (a **17.63% relative MAE reduction**).
     * RMSE dropped from **32.0077** (Baseline) and **22.2746** (Ridge) down to **19.1755** (HGB 30D).
   - **Secondary Population (853,740 Availability-Eligible Observations, `is_eligible_acc_20of30 == 1`):**
     * HGB 30D achieved **25.30% WAPE** and **12.0624 units MAE**.
     * Outperformed the Baseline (**41.69% WAPE**) by **-16.39 percentage points** (-39.31% relative MAE).
     * Outperformed Ridge (**30.11% WAPE**) by **-4.81 percentage points** (-15.96% relative MAE).

2. **Dramatically Suppressed Model Bias:**
   - 30-day Ridge Regression suffered from severe positive bias (**+5.0930 units** overall; **+5.6541 units** on eligible rows; and **+34.04 units** on high-demand items).
   - HGB 30D reduced overall mean bias to **+0.6293 units** (an **87.6% reduction in bias** relative to Ridge), and maintained a negligible **+1.96 units bias** on high-demand items.

3. **Minimal Negative Raw Predictions (0.42%):**
   - Raw tree predictions generated only **4,292 negative rows (0.42%)** out of 1,020,712 validation rows.
   - The minimum raw tree prediction was bounded at **-1.3110 units** (compared to -15.42 units in Ridge).

4. **Breakthrough Accuracy on Zero & Intermittent Demand:**
   - On intermittent items (<2 units/week rate; 206,476 rows), HGB 30D achieved **47.59% WAPE** (3.31 MAE).
   - In contrast, Ridge scored **78.61% WAPE** (5.47 MAE) and Baseline scored **70.68% WAPE** (4.92 MAE). HGB reduced WAPE on low-volume items by **31.02 percentage points vs Ridge** and **23.09 percentage points vs Baseline**.

5. **Substantial Gains in Perishable & Volatile Categories:**
   - **Fish and frozen foods:** WAPE dropped from 221.11% (Ridge) and 143.33% (Baseline) to **107.01%** (HGB).
   - **Meat and poultry:** WAPE dropped from 155.09% (Ridge) and 119.36% (Baseline) to **98.26%** (HGB).
   - **Bread and bakery products:** WAPE dropped from 108.67% (Ridge) and 104.69% (Baseline) to **74.15%** (HGB).

---

## 2. 30-Day Benchmark Comparisons

### 2.1 Primary Population: All Valid Validation Observations (1,020,712 rows)

```
+--------------------------------------------------------------------------------------------------------------------------+
| 30-DAY BENCHMARK COMPARISON (PRIMARY POPULATION: ALL VALID VALIDATION ROWS: 1,020,712 ROWS)                              |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| MODEL ARCHITECTURE            | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | COMPARISON VS. HGB 30D (CLIPPED) |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| Stage 3.2 Rolling Baseline    | 43.19%      | 17.7550     | 32.0077     | +0.0623     | +16.66 pp WAPE (+38.57% MAE)     |
| Stage 3.3 Corrected Ridge     | 32.21%      | 13.2412     | 22.2746     | +5.0930     | +5.68 pp WAPE (+17.63% MAE)      |
| Stage 3.8 HGB 30D (Raw, AE)   | 26.53%      | 10.9069     | 19.1755     | +0.6290     | Unclipped baseline reference     |
| Stage 3.8 HGB 30D (Clipped, AE| 26.53%      | 10.9066     | 19.1755     | +0.6293     | Benchmark Leader                 |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
```

### 2.2 Secondary Population: Availability-Eligible Observations (853,740 rows)

```
+--------------------------------------------------------------------------------------------------------------------------+
| 30-DAY BENCHMARK COMPARISON (SECONDARY POPULATION: AVAILABILITY-ELIGIBLE ROWS: 853,740 ROWS)                             |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| MODEL ARCHITECTURE            | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | COMPARISON VS. HGB 30D (CLIPPED) |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| Stage 3.2 Rolling Baseline    | 41.69%      | 19.8771     | 34.5539     | +0.0771     | +16.39 pp WAPE (+39.31% MAE)     |
| Stage 3.3 Corrected Ridge     | 30.11%      | 14.3533     | 23.5934     | +5.6541     | +4.81 pp WAPE (+15.96% MAE)      |
| Stage 3.8 HGB 30D (Clipped, AE| 25.30%      | 12.0624     | 20.5955     | +0.9752     | Benchmark Leader                 |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
```

### 2.3 Head-to-Head Progression on 30-Day Forecasts

| Evaluation Metric | Stage 3.2 Rolling Baseline | Stage 3.3 Ridge Regression | Stage 3.8 HGB Absolute Error | HGB Lift vs. Baseline | HGB Lift vs. Ridge |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **All-Valid WAPE** | 43.19% | 32.21% | **26.53%** | **-16.66 pp** | **-5.68 pp** |
| **All-Valid MAE** | 17.7550 | 13.2412 | **10.9066** | **-6.8484 (-38.57%)** | **-2.3346 (-17.63%)** |
| **All-Valid RMSE** | 32.0077 | 22.2746 | **19.1755** | **-12.8322** | **-3.0991** |
| **All-Valid Mean Bias** | +0.0623 | +5.0930 | **+0.6293** | +0.5670 | **-4.4637 (-87.6%)** |
| **Eligible WAPE** | 41.69% | 30.11% | **25.30%** | **-16.39 pp** | **-4.81 pp** |
| **Eligible MAE** | 19.8771 | 14.3533 | **12.0624** | **-7.8147 (-39.31%)** | **-2.2909 (-15.96%)** |
| **Eligible RMSE** | 34.5539 | 23.5934 | **20.5955** | **-13.9584** | **-2.9979** |
| **Eligible Mean Bias** | +0.0771 | +5.6541 | **+0.9752** | +0.8981 | **-4.6789 (-82.8%)** |
| **Raw Negative Rows** | 0 | 58,197 (5.70%) | **4,292 (0.42%)** | N/A | **-53,905 (-92.6%)** |
| **Min Raw Prediction** | 0.0000 | -15.42 | **-1.3110** | N/A | **+14.11 u** |

> [!NOTE]
> **Methodological Horizon Boundary:** 30-day demand metrics must **not** be compared numerically against 7-day metrics as though they represent the same task. The 30-day target accumulates 30 days of sales (mean: 41.11 units) compared to 7 days (mean: 9.55 units). Due to the Law of Large Numbers, multi-day aggregate sales exhibit lower variance relative to the mean, naturally yielding lower WAPE percentages (~26% vs ~61%) despite higher absolute MAE (~10.9 units vs ~5.8 units).

---

## 3. Stratified Breakdown & Slice Analysis

### 3.1 Breakdown by Demand Tier
Demand rate is calculated as `sales_mean_28d * 7` (units per week):

| Demand Tier | Samples | HGB 30D WAPE | HGB 30D MAE | HGB 30D Bias | Ridge WAPE | Ridge MAE | Baseline WAPE | Baseline MAE | HGB Lift vs. Ridge |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Zero / Intermittent (<2/wk)** | 206,476 | **47.59%** | **3.31** | **-0.58** | 78.61% | 5.47 | 70.68% | 4.92 | **-31.02 pp** |
| **Low (2 to <10/wk)** | 493,702 | **27.02%** | **7.11** | **+0.88** | 33.06% | 8.70 | 43.12% | 11.35 | **-6.04 pp** |
| **Medium (10 to 50/wk)** | 304,943 | **24.96%** | **20.23** | **+0.97** | 28.90% | 23.43 | 40.19% | 32.58 | **-3.94 pp** |
| **High (>50/wk)** | 15,591 | **27.31%** | **49.22** | **+1.96** | 33.64% | 60.63 | 55.81% | 100.57 | **-6.33 pp** |

**Key Takeaways:**
1. **Low-Demand Robustness:** On intermittent items, Ridge struggled severely (78.61% WAPE) because linear least-squares tried to fit right-skewed spikes. HGB with absolute error loss achieved 47.59% WAPE.
2. **High-Demand Stability:** In the high-demand tier (>50 units/week), Baseline bias exploded to +86.21 units and Ridge bias reached +34.04 units. HGB held mean bias to just **+1.96 units**, with MAE dropping from 60.63 (Ridge) to 49.22 units.

### 3.2 Breakdown by Outlet Type

| Outlet Type | Samples | HGB 30D WAPE | HGB 30D MAE | HGB 30D RMSE | HGB 30D Bias | Ridge WAPE | Baseline WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Grocery shop** | 433,202 | **27.13%** | 6.29 | 10.02 | +0.85 | 34.31% | 43.15% |
| **Grocery store** | 311,696 | **27.11%** | 7.26 | 11.00 | +0.85 | 32.93% | 43.51% |
| **Supermarket** | 275,814 | **26.07%** | 22.28 | 33.56 | +0.03 | 31.06% | 43.09% |

In large supermarkets where monthly volumes are high, HGB achieved near-zero bias (**+0.03 units**) and reduced MAE by 4.26 units vs Ridge (22.28 vs 26.54) and 14.54 units vs Baseline (22.28 vs 36.82).

### 3.3 Breakdown by Product Category (Top & Perishable Categories)

| Product Category | Samples | HGB 30D WAPE | HGB 30D MAE | HGB 30D Bias | Ridge WAPE | Baseline WAPE | HGB Lift vs. Ridge |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Rice and grains** | 55,055 | **25.65%** | 15.25 | +2.13 | 31.22% | 42.07% | **-5.57 pp** |
| **Cooking oil** | 55,209 | **25.39%** | 16.17 | +1.41 | 31.11% | 42.36% | **-5.72 pp** |
| **Sugar and salt** | 54,670 | **25.76%** | 16.65 | +2.00 | 31.26% | 41.77% | **-5.50 pp** |
| **Flour and baking ingredients** | 54,978 | **24.67%** | 16.34 | -0.84 | 26.34% | 42.54% | **-1.67 pp** |
| **Household cleaning products** | 63,217 | **24.23%** | 9.83 | +1.47 | 30.07% | 40.39% | **-5.84 pp** |
| **Vegetables** | 74,536 | **27.51%** | 6.98 | -1.00 | 35.72% | 43.11% | **-8.21 pp** |
| **Dairy products** | 54,359 | **32.43%** | 8.05 | +0.23 | 42.48% | 50.42% | **-10.05 pp** |
| **Eggs** | 48,664 | **26.83%** | 12.59 | -0.98 | 28.04% | 40.32% | **-1.21 pp** |
| **Bread and bakery products** | 47,817 | **74.15%** | 4.93 | -0.78 | 108.67% | 104.69% | **-34.52 pp** |
| **Meat and poultry** | 47,432 | **98.26%** | 4.66 | -2.70 | 155.09% | 119.36% | **-56.83 pp** |
| **Fish and frozen foods** | 47,894 | **107.01%** | 2.90 | -2.04 | 221.11% | 143.33% | **-114.10 pp** |

---

## 4. Execution Performance & Resource Profiling

### 4.1 Runtime Performance
- **Training Data Loading:** 7.91 seconds (2,664,456 rows streamed from `model_dataset_30d.csv`).
- **Preprocessing (Training):** 5.48 seconds (`OrdinalEncoder` fitted on training partition only).
- **Model Fitting:** 124.22 seconds (100 boosting iterations; ~1,242.2 ms/tree).
- **Validation Data Loading:** 10.49 seconds (1,020,712 rows).
- **Validation Inference:** 7.43 seconds (**137,311 rows/second throughput**).
- **Total Pipeline Execution:** 171.05 seconds (~2.85 minutes).

### 4.2 Measured Memory Snapshots
- **Baseline Process RSS:** 160.84 MB
- **Post-Preprocessing Process RSS:** 4,339.25 MB
- **Process RSS Post-Fit:** 1,859.08 MB
- **Final Process RSS:** 2,795.58 MB
- **Serialized Model File Size:** 0.16 MB (`hgb_absolute_error_model.joblib`)
- **Validation Predictions File Size:** 60.60 MB (`hgb_validation_predictions_30d.csv`)

### 4.3 Inference Reproducibility
The reloaded 30-day model artifact was evaluated against 1,000 keyed validation observations from `model_dataset_30d.csv`:
- Maximum absolute difference between in-memory and reloaded predictions: **0.00000000e+00**.
- Reproducibility status: **VERIFIED EXACT**.

---

## 5. Methodological Limitations & Integrity Safeguards

1. **Observed Sales vs. Unconstrained Demand:**
   The target `target_30d` reflects cumulative recorded sales over 30 days. When stockouts occurred during that window, observed sales ceased. The model predicts observed sales under past store stocking behaviors, not latent customer demand.

2. **Serial Dependence from Overlapping 30-Day Horizons:**
   Validation origins span 77 consecutive daily points (`2026-08-01` to `2026-10-16`). Because adjacent forecast origins have 29 days of overlapping horizon, validation errors are serially correlated. Metrics reflect aggregate empirical performance, but observations are not independent trials.

3. **Validation Window Truncation (77 Days vs 100 Days):**
   In the 7-day model, the validation window spans 100 origins (`2026-08-01` to `2026-11-08`). In the 30-day model, validation origins end on `2026-10-16` (77 origins) to ensure that the 30-day forward-looking window remains within the dataset boundary (`2026-11-15`).

4. **Resource Reporting Transparency:**
   Resource figures are point-in-time process RSS snapshots and initial system snapshots (RAM: 5.12 GB available, Free Disk: 16.44 GB). Peak continuous memory during internal C++ OpenMP routines was not instrumented; no speculative claims regarding continuous RAM margins or swap activity are made.

5. **Artifact Preservation:**
   All prior 7-day artifacts (`hgb_exp1_full_model.joblib`, `hgb_exp2_no_inventory_model.joblib`, `hgb_exp3_absolute_error_model.joblib`, and corresponding prediction files) remain untouched and protected.

---

## 6. Summary Deliverables

1. **Training Script:** [`ml/scripts/train_hgb_30d.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb_30d.py)
2. **Packaged Model Artifact:** [`ml/models/30d/hgb_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/hgb_absolute_error_model.joblib) (0.16 MB)
3. **Validation Predictions Artifact:** [`ml/predictions/hgb_validation_predictions_30d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_validation_predictions_30d.csv) (60.60 MB, 1,020,712 rows, 9 aligned columns)
4. **Machine-Readable Metrics:** [`ml/reports/phase3_hgb_30d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_30d_metrics.json)
5. **Technical Benchmark Report:** [`ml/reports/phase3_hgb_30d_report.md`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_30d_report.md)
