# BazarBondhu AI — Phase 3, Stage 3.7
# EXP3 Absolute Error Loss 7-Day HistGradientBoosting Model: Technical Benchmark Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer  
**Stage:** Phase 3, Stage 3.7: EXP3_HGB_ABSOLUTE_ERROR_7D Model Development & Loss Ablation  
**Experiment ID:** `EXP3_HGB_ABSOLUTE_ERROR_7D`  
**Execution Date:** November 17, 2026  
**Repository Working Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  
**Training Script:** [`ml/scripts/train_hgb_exp3.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb_exp3.py)  
**Model Artifact:** [`ml/models/7d/hgb_exp3_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp3_absolute_error_model.joblib) (0.14 MB)  
**Prediction Artifact:** [`ml/predictions/hgb_exp3_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp3_validation_predictions_7d.csv) (90.52 MB, 1,325,600 rows, 11 columns)  
**Metrics JSON:** [`ml/reports/phase3_hgb_exp3_7d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp3_7d_metrics.json)  

---

## 1. Executive Summary & Core Results

The third nonlinear demand forecasting model for BazarBondhu AI (**EXP3_HGB_ABSOLUTE_ERROR_7D**) has been trained, evaluated, packaged, and verified. This experiment executed a controlled loss-function ablation by transitioning the optimization objective of the `HistGradientBoostingRegressor` from mean squared error (`squared_error`) to mean absolute error (`absolute_error`, L1 / conditional median regression). 

EXP3 trained on all **67 SAFE features** (55 numerical, 12 categorical) using the complete 2,664,456 chronological training rows, identical temporal partitions, identical forecast keys, and identical validation protocols as EXP1 and EXP2, with learning rate adjusted to 0.08 as specified.

### 1.1 Core Experimental Findings
The central research objective of EXP3 was to test whether optimizing for `absolute_error` improves 7-day sales demand forecasting on skewed, intermittent retail data:

1. **Substantial Overall Accuracy Improvement (New Benchmark Leader):**
   - On the primary population (all 1,325,600 valid validation observations), EXP3 achieved a **WAPE of 61.22%** and **MAE of 5.8486 units**.
   - This represents a **-2.21 percentage point WAPE improvement** (-3.49% relative MAE reduction) over EXP1 (63.43%), a **-2.99 percentage point WAPE improvement** over EXP2 (64.21%), a **-12.74 percentage point lead** over the Rolling Baseline (73.96%), and a **-16.14 percentage point lead** over Ridge (77.36%).
   - On the secondary population (1,102,601 availability-eligible observations), EXP3 achieved a **WAPE of 60.44%** and **MAE of 6.7950 units**, improving by **-1.71 percentage points** over EXP1 (62.15%) and **-9.86 percentage points** over Baseline (70.30%).

2. **Dramatically Reduced Negative Raw Predictions (86.0% Reduction):**
   - Raw negative excursions dropped from **41,540 rows (3.13%)** in EXP1 and **23,554 rows (1.78%)** in EXP2 down to **5,812 rows (0.44%)** in EXP3.
   - The minimum raw tree prediction recovered from **-7.9405 units** in EXP1 and **-3.8632 units** in EXP2 to **-2.0111 units** in EXP3.

3. **Breakthrough Accuracy on Zero & Intermittent Demand Items:**
   - On the intermittent demand tier (<2 units/week; 267,139 validation observations), EXP3 reduced WAPE from **78.49% (EXP1)** and **87.11% (EXP2)** down to **69.39% (EXP3)**—a **9.10 pp improvement over EXP1** and **17.72 pp improvement over EXP2**.
   - Because L1 loss targets the conditional median, the model does not artificially inflate forecasts on zero-dominated items to minimize quadratic penalties on rare spikes.

4. **Universal Outperformance Across All 25 Product Categories:**
   - EXP3 outperformed EXP1 and EXP2 across **all 25 product categories**.
   - The largest gains occurred in volatile and perishable categories where squared error previously caused large variance:
     * **Fish and frozen foods:** WAPE dropped from 138.94% (EXP1) to **103.95% (EXP3)** (-34.99 pp).
     * **Meat and poultry:** WAPE dropped from 113.76% (EXP1) to **100.35% (EXP3)** (-13.41 pp).
     * **Bread and bakery products:** WAPE dropped from 97.72% (EXP1) to **86.94% (EXP3)** (-10.78 pp).

5. **Shift from Over-Prediction to Mild Conservative Under-Prediction:**
   - Model bias shifted from positive over-prediction (**+0.8005 units** in EXP1) to slight conservative under-prediction (**-0.4567 units** in EXP3 overall; **-0.4318 units** eligible).
   - In retail inventory planning, median forecasts naturally sit slightly below mean forecasts due to right-skewed demand distributions, providing a stable baseline for safety-stock calculations.

---

## 2. Benchmark Comparisons

### 2.1 Primary Population: All Valid Validation Rows (1,325,600 observations)

```
+--------------------------------------------------------------------------------------------------------------------------+
| 7-DAY BENCHMARK COMPARISON (PRIMARY POPULATION: ALL VALID VALIDATION ROWS: 1,325,600 ROWS)                               |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| MODEL ARCHITECTURE            | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | COMPARISON VS. EXP1 (FULL)       |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| Stage 3.2 Rolling Baseline    | 73.96%      | 7.0658      | 12.6544     | +0.0443     | -10.53 pp vs. EXP1               |
| Stage 3.3 Corrected Ridge     | 77.36%      | 7.3907      | 13.0554     | +3.1921     | -13.93 pp vs. EXP1               |
| Stage 3.5 HGB EXP1 (Full, SE) | 63.43%      | 6.0598      | 10.9528     | +0.8005     | Reference Full Model (L2 Loss)   |
| Stage 3.6 HGB EXP2 (No-Inv, SE| 64.21%      | 6.1340      | 11.0472     | +0.0185     | -0.78 pp vs. EXP1                |
| Stage 3.7 HGB EXP3 (Raw, AE)  | 61.23%      | 5.8494      | 10.8432     | -0.4575     | +2.20 pp (+3.47% MAE reduction)  |
| Stage 3.7 HGB EXP3 (Clipped)  | 61.22%      | 5.8486      | 10.8431     | -0.4567     | +2.21 pp (+3.49% MAE reduction)  |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
```

### 2.2 Secondary Population: Availability-Eligible Rows (1,102,601 observations)

```
+--------------------------------------------------------------------------------------------------------------------------+
| 7-DAY BENCHMARK COMPARISON (SECONDARY POPULATION: AVAILABILITY-ELIGIBLE ROWS: 1,102,601 ROWS)                            |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| MODEL ARCHITECTURE            | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | COMPARISON VS. EXP1 (FULL)       |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
| Stage 3.2 Rolling Baseline    | 70.30%      | 7.9032      | 13.5906     | -0.2134     | -8.15 pp vs. EXP1                |
| Stage 3.3 Corrected Ridge     | 74.00%      | 8.3186      | 14.0928     | +3.5548     | -11.85 pp vs. EXP1               |
| Stage 3.5 HGB EXP1 (Full, SE) | 62.15%      | 6.9870      | 11.8724     | +0.9364     | Reference Full Model (L2 Loss)   |
| Stage 3.6 HGB EXP2 (No-Inv, SE| 62.18%      | 6.9902      | 11.9449     | -0.0789     | -0.03 pp vs. EXP1                |
| Stage 3.7 HGB EXP3 (Clipped)  | 60.44%      | 6.7950      | 11.7336     | -0.4318     | +1.71 pp (+2.75% MAE reduction)  |
+-------------------------------+-------------+-------------+-------------+-------------+----------------------------------+
```

### 2.3 Head-to-Head Model Progression

| Evaluation Metric | Baseline | Ridge | HGB EXP1 (Full) | HGB EXP2 (No-Inv) | HGB EXP3 (Abs Error) | EXP3 Delta vs. EXP1 | EXP3 Delta vs. Baseline |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **All-Valid WAPE** | 73.96% | 77.36% | 63.43% | 64.21% | **61.22%** | **-2.21 pp** | **-12.74 pp** |
| **All-Valid MAE** | 7.0658 | 7.3907 | 6.0598 | 6.1340 | **5.8486** | **-0.2112 (-3.49%)**| **-1.2172 (-17.23%)**|
| **All-Valid RMSE** | 12.6544 | 13.0554 | 10.9528 | 11.0472 | **10.8431** | **-0.1097** | **-1.8113** |
| **All-Valid Mean Bias**| +0.0443 | +3.1921 | +0.8005 | +0.0185 | **-0.4567** | **-1.2572** | -0.5010 |
| **Eligible WAPE** | 70.30% | 74.00% | 62.15% | 62.18% | **60.44%** | **-1.71 pp** | **-9.86 pp** |
| **Eligible MAE** | 7.9032 | 8.3186 | 6.9870 | 6.9902 | **6.7950** | **-0.1920 (-2.75%)**| **-1.1082 (-14.02%)**|
| **Eligible RMSE** | 13.5906 | 14.0928 | 11.8724 | 11.9449 | **11.7336** | **-0.1388** | **-1.8570** |
| **Eligible Mean Bias** | -0.2134 | +3.5548 | +0.9364 | -0.0789 | **-0.4318** | **-1.3682** | -0.2184 |
| **Raw Negative Count** | 0 | 123,044 | 41,540 (3.13%)| 23,554 (1.78%)| **5,812 (0.44%)** | **-35,728 (-86.0%)** | N/A |
| **Min Raw Prediction** | 0.0000 | -15.42 | -7.9405 | -3.8632 | **-2.0111** | **+5.9294 u** | N/A |

---

## 3. Stratified Breakdown & Slice Analysis

### 3.1 Breakdown by Demand Tier
Demand rate is calculated as `sales_mean_28d * 7` (units per week):

| Demand Tier | Validation Rows | EXP3 WAPE | EXP3 MAE | EXP3 Bias | EXP1 WAPE | EXP2 WAPE | Baseline WAPE | EXP3 vs. EXP1 Delta |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Zero / Intermittent (<2/wk)** | 267,139 | **69.39%** | **1.16** | **-0.28** | 78.49% | 87.11% | 78.50% | **-9.10 pp** |
| **Low (2 to <10/wk)** | 642,001 | **60.52%** | **3.72** | **-0.12** | 62.40% | 63.69% | 69.17% | **-1.88 pp** |
| **Medium (10 to 50/wk)** | 396,485 | **60.65%** | **11.40** | **-1.06** | 62.62% | 62.86% | 75.29% | **-1.97 pp** |
| **High (>50/wk)** | 19,975 | **65.27%** | **26.77** | **-1.93** | 67.58% | 66.43% | 81.39% | **-2.31 pp** |

**Key Insight:** EXP3 delivers its largest margin of superiority on **Zero / Intermittent items** (-9.10 pp vs EXP1, -17.72 pp vs EXP2). Under squared error loss, outliers and occasional spike sales exert quadratic leverage on leaf estimates, forcing predictions upward and causing severe over-prediction on low-volume items. Absolute error loss targets the median, making it robust to intermittency and low-volume noise.

### 3.2 Breakdown by Outlet Type

| Outlet Type | Samples | EXP3 WAPE | EXP3 MAE | EXP3 RMSE | EXP3 Bias | EXP1 WAPE | EXP2 WAPE | Baseline WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Grocery shop** | 562,600 | **61.71%** | 3.33 | 5.29 | -0.04 | 64.10% | 64.47% | 73.76% |
| **Grocery store** | 404,800 | **61.73%** | 3.85 | 5.97 | -0.10 | 63.86% | 64.53% | 74.15% |
| **Supermarket** | 358,200 | **60.83%** | 12.07 | 18.73 | -1.51 | 62.99% | 63.98% | 73.98% |

Across all store formats, EXP3 improves WAPE by **~2.1 to 2.4 percentage points** relative to EXP1 and maintains near-zero bias in small grocery shops (-0.04 units) and grocery stores (-0.10 units).

### 3.3 Breakdown by Product Category (Selected Categories)

| Product Category | Samples | EXP3 WAPE | EXP1 WAPE | EXP2 WAPE | EXP3 vs. EXP1 Delta |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Fish and frozen foods** | 48,200 | **103.95%** | 138.94% | 172.78% | **-34.99 pp** |
| **Meat and poultry** | 47,800 | **100.35%** | 113.76% | 138.20% | **-13.41 pp** |
| **Bread and bakery products**| 48,100 | **86.94%** | 97.72% | 119.48% | **-10.78 pp** |
| **Vegetables** | 55,200 | **62.26%** | 65.31% | 71.34% | **-3.05 pp** |
| **Dairy products** | 54,600 | **64.53%** | 68.40% | 72.89% | **-3.87 pp** |
| **Eggs** | 48,900 | **65.14%** | 68.64% | 76.48% | **-3.50 pp** |
| **Rice and grains** | 55,100 | **61.07%** | 63.76% | 62.73% | **-2.69 pp** |
| **Cooking oil** | 55,300 | **60.08%** | 62.48% | 61.77% | **-2.40 pp** |
| **Sugar and salt** | 54,800 | **60.42%** | 62.76% | 61.94% | **-2.34 pp** |
| **Biscuits and snacks** | 55,400 | **59.42%** | 60.00% | 61.44% | **-0.58 pp** |

---

## 4. Experimental Setup & Preflight Verification

### 4.1 Fixed Experimental Configuration
- **Model Family:** `sklearn.ensemble.HistGradientBoostingRegressor`
- **Loss Function:** `loss='absolute_error'` (L1 loss / conditional median)
- **Learning Rate:** `learning_rate=0.08`
- **Max Iterations:** `max_iter=100` (100 trees fitted, no early stopping)
- **Tree Depth & Leaf Constraints:** `max_leaf_nodes=31`, `min_samples_leaf=50`
- **Regularization:** `l2_regularization=1.0`
- **Categorical Handling:** Internal native histogram binning across 12 categorical columns (indices 55..66).
- **Random State:** `42` (deterministic fit)

### 4.2 Data & Feature Partitions
- **Training Partition:** 2025-12-13 through 2026-07-01 (201 dates, exactly 2,664,456 rows).
- **Purge Partition:** 2026-07-02 through 2026-07-31 (0 rows).
- **Validation Partition:** 2026-08-01 through 2026-11-08 (100 dates, exactly 1,325,600 rows).
- **Predictor Set:** Exactly 67 SAFE features (55 numerical, 12 categorical).
- **Excluded Features:** All 5 CONDITIONAL features, identifiers (`outlet_id`, `product_id`), dates, targets (`target_7d`, `target_30d`), eligibility flag (`is_eligible_acc_5of7`), and future information.

### 4.3 Preflight Audit Status
All 7 mandatory preflight checks passed prior to training initiation:
1. EXP1 and EXP2 verification audit JSON files checked and verified (`overall_verdict: PASSED`).
2. Model artifacts, scripts, and forecaster module validated.
3. Feature registry validated: exactly 67 SAFE features matching EXP1 schema and ordering.
4. Exclusion of conditional (5) and forbidden columns verified.
5. Forecaster architecture compatibility verified.
6. Host resource snapshot: 5.38 GB RAM available, 16.58 GB free disk.
7. Source dataset file verified (`model_dataset_7d.csv`).

---

## 5. Execution Performance & Resource Profiling

### 5.1 Runtime Performance
- **Training Data Loading:** 9.98 seconds (2,664,456 rows loaded via chunked streaming).
- **Preprocessing (Training):** 6.83 seconds (`OrdinalEncoder` fitted on training partition only).
- **Model Fitting:** 115.35 seconds (100 boosting iterations; ~1,153.5 ms/tree).
  * *Note on L1 Runtime:* `absolute_error` fitting takes ~115s compared to ~10s for `squared_error`. This 10x difference is expected in gradient boosting because L1 loss computes median-based leaf values and sign-based gradients, which require partial sorting/partitioning of binned samples per leaf.
- **Validation Data Loading:** 12.25 seconds (1,325,600 rows).
- **Validation Inference:** 11.70 seconds (**113,345 rows/second**).
- **Total Pipeline Execution:** 176.27 seconds (~2.94 minutes).

### 5.2 Memory Footprint (Measured Snapshots)
- **Baseline Process RSS:** 160.44 MB
- **Post-Preprocessing Process RSS:** 3,314.33 MB
- **Process RSS Post-Fit:** 2,197.80 MB
- **Final Process RSS:** 3,204.89 MB
- **Serialized Model File Size:** 0.14 MB (`hgb_exp3_absolute_error_model.joblib`)
- **Validation Predictions File Size:** 90.52 MB (`hgb_exp3_validation_predictions_7d.csv`)

### 5.3 Inference Reproducibility
The reloaded model artifact was tested against 1,000 keyed validation observations from `model_dataset_7d.csv`:
- Maximum absolute difference between in-memory and reloaded predictions: **0.00000000e+00**.
- Reproducibility status: **VERIFIED EXACT**.

---

## 6. Methodological Analysis: Why Absolute Error Outperforms Squared Error

In retail grocery and FMCG sales forecasting, daily demand distributions exhibit three dominant properties:
1. **Zero-Inflation:** A substantial fraction of SKU-outlet days have zero sales (stockout, low demand, or intermittent shopping).
2. **Heavy Right Skewness:** Most active days have modest sales (1–5 units), while occasional promotions or bulk purchases cause large spikes (20–100 units).
3. **Overlapping Multi-Day Horizon:** The 7-day target sums non-negative daily sales over a 7-day rolling window.

When trained under **`squared_error` (L2 loss)**:
$$\mathcal{L}_{L2}(y, \hat{y}) = \frac{1}{2}(y - \hat{y})^2, \quad \frac{\partial \mathcal{L}}{\partial \hat{y}} = \hat{y} - y$$
The optimal prediction at each leaf node is the conditional **mean** $\mathbb{E}[Y|X]$. Because squared error penalizes large errors quadratically, the optimizer is heavily influenced by right-tail outliers. To minimize quadratic penalties on occasional large sales spikes, the model inflates leaf estimates across all similar items. This produces positive overall bias (+0.8005 units in EXP1) and high error on zero/intermittent items (78.49% WAPE). Furthermore, gradient steps on the unconstrained real line produce large negative tree predictions (41,540 negative rows in EXP1).

When trained under **`absolute_error` (L1 loss)**:
$$\mathcal{L}_{L1}(y, \hat{y}) = |y - \hat{y}|, \quad \frac{\partial \mathcal{L}}{\partial \hat{y}} = \text{sign}(\hat{y} - y)$$
The optimal prediction at each leaf node is the conditional **median** $\text{Median}[Y|X]$. The gradient is bounded in $\{-1, +1\}$ regardless of how large the target spike is. As a consequence:
1. Outliers no longer pull leaf predictions upward.
2. Predictions for zero/intermittent items stay anchored near the low median (WAPE falls by 9.10 pp).
3. Negative excursions are suppressed because gradient steps are bounded (negative rows fall by 86%).
4. Since WAPE is proportional to MAE ($\text{WAPE} = \frac{\sum |y - \hat{y}|}{\sum y}$), directly optimizing L1 loss directly minimizes WAPE!

---

## 7. Methodological Limitations & Integrity Safeguards

1. **Observed Sales vs. Unconstrained Demand:**
   The training and validation targets represent historical observed transactions recorded by store point-of-sale systems. When an item was out of stock, observed sales were zero or truncated. The model predicts observed sales under historical inventory practices, not true unconstrained consumer demand.

2. **Overlapping Forecast Horizons & Statistical Dependence:**
   Validation observations span 100 consecutive calendar days (2026-08-01 through 2026-11-08) across 13,256 active SKU-outlet pairs. Because 7-day forecast windows overlap across adjacent daily origins, validation errors are serially correlated. Metrics are valid empirical benchmarks across the test set, but observations cannot be treated as independent statistical trials for classical hypothesis testing.

3. **Conservative Median Bias:**
   Because demand distributions are right-skewed, conditional medians are systematically lower than conditional means ($\text{Median}[Y] \le \mathbb{E}[Y]$). Consequently, EXP3 exhibits a slight negative bias (-0.4567 units overall). For downstream supply-chain applications, this median forecast should be paired with quantile estimation or safety-stock buffers to prevent stockouts.

4. **Synthetic Data Context:**
   The dataset was generated synthetically to reflect retail dynamics in Bangladesh. While temporal and spatial splits were strictly maintained, findings reflect the synthetic data generation process and should be validated against live enterprise data before production deployment.

5. **Resource Reporting Honesty:**
   Host RAM availability (5.38 GB) and free disk (16.58 GB) represent point-in-time system snapshots taken prior to training. Peak memory during boosting iterations was unmonitored continuously; no unmeasured claims regarding swap space or continuous RAM margins are made.

---

## 8. Conclusion & Recommended Next Steps

`EXP3_HGB_ABSOLUTE_ERROR_7D` establishes the new performance benchmark for 7-day demand forecasting in BazarBondhu AI:
- **WAPE:** 61.22% (All-Valid) / 60.44% (Eligible)
- **MAE:** 5.8486 units (All-Valid) / 6.7950 units (Eligible)
- **Negative Excursions:** 0.44% (down from 3.13% in EXP1)
- **Margin over Rolling Baseline:** +12.74 percentage points
- **Margin over Ridge Regression:** +16.14 percentage points

### Recommended Next Steps (Awaiting Authorization):
1. **Independent Verification of EXP3 (Stage 3.7.1):** Execute an independent empirical verification script validating all 20 audit checks for EXP3 (encoder provenance, key alignment, row counts, empty population guards, and exact metrics replication).
2. **Quantile Loss / Prediction Intervals (Stage 3.8):** Investigate pinball loss (`loss='quantile'`) at P10, P50, and P90 to provide probabilistic confidence intervals and asymmetrical inventory safety buffers.
3. **Horizon Expansion (Stage 3.9):** Transition from the 7-day forecast task to the 30-day forecast task (`target_30d`) once 7-day model selection is finalized.
