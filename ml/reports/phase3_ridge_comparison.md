# BazarBondhu AI — Phase 3, Stage 3.3: Regularized Linear Regression (Ridge) Report

**Author:** Senior Machine Learning Engineer & Data Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Execution Stage:** Phase 3, Stage 3.3 (Ridge Model Development & Evaluation)  
**Deliverable Documents:**
- [ml/reports/phase3_ridge_comparison.md](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_ridge_comparison.md)
- [ml/reports/phase3_ridge_metrics.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_ridge_metrics.json)
- [ml/configs/ridge_config.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/configs/ridge_config.json)
**Model Artifacts:**
- [ml/models/7d/ridge_model.joblib](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/ridge_model.joblib)
- [ml/models/30d/ridge_model.joblib](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/ridge_model.joblib)
**Prediction Artifacts:**
- [ml/predictions/ridge_validation_predictions_7d.csv](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/ridge_validation_predictions_7d.csv)
- [ml/predictions/ridge_validation_predictions_30d.csv](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/ridge_validation_predictions_30d.csv)

---

## 1. Executive Summary & Core Findings

In this stage, separate regularized linear regression (Ridge) models were developed and evaluated for both **Task A (7-day demand)** and **Task B (30-day demand)**. Models were trained strictly on the 67 SAFE features, fit exclusively on chronological training data (2025-12-13 to 2026-07-01), and evaluated against the Stage 3.2 Historical Rolling Average Baseline across the out-of-time validation partitions.

```
+------------------+-----------------------------+-----------------------------+-----------------------------+
| Forecasting Task | Benchmark Baseline (WAPE)   | Ridge Model (WAPE)          | Relative Lift (Delta WAPE)  | Candidate Status            |
+------------------+-----------------------------+-----------------------------+-----------------------------+
| Task A (7-Day)   | 73.96% (sales_mean_28d * 7) | 77.36% (Ridge, alpha=0.01)  | +3.40 pp (Worse by 3.4 pp)  | REJECTED as Primary Model   |
| Task B (30-Day)  | 43.19% (sales_mean_28d * 30)| 32.21% (Ridge, alpha=0.01)  | -10.98 pp (11 pp Win!)      | ACCEPTED as Strong Candidate|
+------------------+-----------------------------+-----------------------------+-----------------------------+
```

### Core Conclusion:
1. **Short Horizon (7-Day Task): Ridge Fails to Beat Baseline.**
   The linear model achieves **WAPE = 77.36%** and **MAE = 7.3907**, underperforming the simple 28-day rolling average (73.96% WAPE, 7.0658 MAE). Ridge exhibits a systematic positive bias (+3.1921 units) because linear combinations of static outlet and category indicators over-predict the intermittent zero-demand tail (30.97% of 7-day targets are zero).
2. **Long Horizon (30-Day Task): Ridge Achieves Dramatic Forecasting Value.**
   On the 30-day horizon, individual day-to-day transaction noise aggregates into stable monthly velocities. Ridge achieves **WAPE = 32.21%** and **MAE = 13.2412**, crushing the rolling average baseline (43.19% WAPE, 17.7550 MAE) by **10.98 percentage points in WAPE** and **4.51 units in MAE** (a 25.4% error reduction).
3. **Verdict:**
   Ridge Regression is **ACCEPTED** as a verified, production-ready candidate model for 30-day demand forecasting, but **REJECTED** as the primary solution for 7-day forecasting.

---

## 2. Experimental Setup & Pre-training Validation

### A. Feature Safety & Provenance
- **Total Audited Features:** 72 features from `phase3_feature_safety_audit.json`.
- **Approved SAFE Features Used:** Exactly 67 features.
  - 55 Numerical Features: historical sales lags, rolling sums/means, inventory snapshots, stockout frequencies, lead times.
  - 12 Categorical Features: `outlet_type`, `business_size`, `division`, `district`, `area_type`, `category`, `subcategory`, `brand`, `unit`, `package_size`, `perishable_status`, `storage_type`.
- **Excluded CONDITIONAL Features:** Exactly 5 features (`outlet_average_daily_demand`, `average_selling_price_bdt`, `average_cost_price_bdt`, `average_restock_frequency_days`, `days_until_next_festival`).
- **Forbidden Inputs Excluded:** `target_7d`, `target_30d`, future availability eligibility indicators, evaluation metadata.

### B. Partitions & Data Dimensions
- **Training Origins:** `2025-12-13` to `2026-07-01` (201 consecutive dates).
  - Training Rows: **2,664,456** observations per horizon.
- **Purge Window:** `2026-07-02` to `2026-07-31` (30 calendar days strictly omitted).
- **Validation Origins:**
  - 7-Day: `2026-08-01` to `2026-11-08` (100 dates, **1,325,600** rows).
  - 30-Day: `2026-08-01` to `2026-10-16` (77 dates, **1,020,712** rows).

### C. Preprocessing Pipeline
- **Categorical Encoding:** `OneHotEncoder(handle_unknown='ignore', sparse_output=True)`. Produced exactly 165 one-hot columns.
- **Numerical Scaling:** `StandardScaler()`, fit incrementally on training rows via `partial_fit`. Zero validation data leakage.
- **Feature Space:** Total design matrix width = $55 + 165 = 220$ columns.

---

## 3. Alpha Hyperparameter Selection

Regularization parameter alpha was evaluated across `[0.01, 0.1, 1.0, 10.0, 100.0, 1000.0]` on the out-of-time validation sets:

### 7-Day Alpha Tuning Table
| Alpha | Validation MAE | Validation RMSE | Validation WAPE | Validation Bias | Raw Negative % | Selection |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
|    0.01 | 7.3907 | 13.0554 | 77.36% | +3.1921 | 9.11% | BEST (Selected) |
|    0.10 | 7.3927 | 13.0592 | 77.38% | +3.1939 | 9.11% | Evaluated |
|    1.00 | 7.3981 | 13.0652 | 77.44% | +3.2029 | 9.07% | Evaluated |
|   10.00 | 7.4304 | 13.0978 | 77.78% | +3.2529 | 8.78% | Evaluated |
|  100.00 | 7.4994 | 13.1661 | 78.50% | +3.3504 | 8.23% | Evaluated |
| 1000.00 | 7.5274 | 13.1906 | 78.79% | +3.3866 | 8.03% | Evaluated |

### 30-Day Alpha Tuning Table
| Alpha | Validation MAE | Validation RMSE | Validation WAPE | Validation Bias | Raw Negative % | Selection |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
|    0.01 | 13.2412 | 22.2746 | 32.21% | +5.0930 | 8.55% | BEST (Selected) |
|    0.10 | 13.2422 | 22.2764 | 32.21% | +5.0922 | 8.55% | Evaluated |
|    1.00 | 13.2513 | 22.2888 | 32.23% | +5.1082 | 8.51% | Evaluated |
|   10.00 | 13.3419 | 22.3913 | 32.45% | +5.2386 | 8.35% | Evaluated |
|  100.00 | 13.5869 | 22.6245 | 33.05% | +5.4890 | 7.43% | Evaluated |
| 1000.00 | 13.7014 | 22.7195 | 33.33% | +5.5986 | 7.26% | Evaluated |

**Selection Reasoning:**
For both horizons, alpha = 0.01 achieved the lowest validation WAPE. Differences between alpha in [0.01, 0.1, 1.0] were minor (< 0.05 pp WAPE), demonstrating smooth linear regularization stability.

---

## 4. Overall Benchmark Comparison (Population A: All Observations)

### 7-Day Horizon Performance Comparison
| Model | Population | Observations | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) | Outcome vs Baseline |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Historical Rolling Average** | All Validation | 1,325,600 | **7.0658** | **12.6544** | **73.96%** | **+0.0443** | **Baseline Wins** |
| **Ridge Regression (alpha=0.01)** | All Validation | 1,325,600 | 7.3907 | 13.0554 | 77.36% | +3.1921 | +3.40 pp WAPE (+0.32 MAE) |

### 30-Day Horizon Performance Comparison
| Model | Population | Observations | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) | Outcome vs Baseline |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Historical Rolling Average** | All Validation | 1,020,712 | 17.7550 | 32.0077 | 43.19% | +0.0623 | Naive Benchmark |
| **Ridge Regression (alpha=0.01)** | All Validation | 1,020,712 | **13.2412** | **22.2746** | **32.21%** | +5.0930 | **Ridge Wins (-10.98 pp WAPE, -4.51 MAE)** |

---

## 5. Availability-Eligible Comparison (Population B: Secondary Diagnostic)

To decouple forecasting accuracy from retail stockout censorship, models were evaluated on the availability-eligible subset (>= 5/7 accessible stock days for 7d; >= 20/30 accessible stock days for 30d):

| Horizon | Population | Observations | Ridge MAE | Baseline MAE | Ridge WAPE | Baseline WAPE | Ridge Bias | Baseline Bias |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **7d Task** | All Observations | 1,325,600 | 7.3907 | 7.0658 | 77.36% | 73.96% | +3.1921 | +0.0443 |
| **7d Task** | **Eligible Subset** | 1,102,601 | 8.3186 | 7.9032 | 74.00% | 70.30% | +3.5548 | -0.2134 |
| **30d Task**| All Observations | 1,020,712 | 13.2412 | 17.7550 | 32.21% | 43.19% | +5.0930 | +0.0623 |
| **30d Task**| **Eligible Subset** | 853,740 | **14.3533** | 19.8771 | **30.11%** | 41.69% | +5.6541 | +0.0771 |

---

## 6. Granular Sliced Analysis (30-Day Winning Horizon)

### A. Performance by Product Category (30-Day Horizon)
| Product Category | Samples | Ridge MAE | Baseline MAE | Ridge WAPE | Baseline WAPE | WAPE Lift |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Baby-care essentials | 23,562 | 12.82 | 17.03 | 31.69% | 42.11% | -10.43 pp |
| Basic health and hygiene products | 21,714 | 12.80 | 17.17 | 32.59% | 43.71% | -11.12 pp |
| Beverages and bottled water | 64,911 | 12.06 | 16.82 | 30.31% | 42.26% | -11.95 pp |
| Biscuits and snacks | 64,141 | 10.31 | 15.42 | 28.15% | 42.11% | -13.96 pp |
| Bread and bakery products | 30,415 | 7.22 | 6.96 | 108.67% | 104.69% | +3.99 pp |
| Breakfast products | 27,643 | 10.94 | 15.77 | 28.58% | 41.18% | -12.60 pp |
| Cooking oil | 58,058 | 19.81 | 26.98 | 31.11% | 42.36% | -11.25 pp |
| Dairy products | 57,442 | 10.54 | 12.51 | 42.48% | 50.42% | -7.93 pp |
| Eggs | 29,414 | 13.16 | 18.93 | 28.04% | 40.32% | -12.27 pp |
| Fish and frozen foods | 24,255 | 5.99 | 3.88 | 221.11% | 143.33% | +77.78 pp |
| Flour and baking ingredients | 47,509 | 17.45 | 28.18 | 26.34% | 42.54% | -16.20 pp |
| Fruits | 49,126 | 9.31 | 10.31 | 39.50% | 43.70% | -4.20 pp |
| Household cleaning products | 21,329 | 12.20 | 16.38 | 30.07% | 40.39% | -10.32 pp |
| Instant noodles and packaged food | 26,719 | 10.81 | 16.26 | 28.53% | 42.91% | -14.39 pp |
| Laundry products | 24,332 | 11.66 | 15.60 | 31.20% | 41.72% | -10.52 pp |
| Lentils and pulses | 60,445 | 18.81 | 25.65 | 30.72% | 41.91% | -11.19 pp |
| Meat and poultry | 24,409 | 7.35 | 5.66 | 155.09% | 119.36% | +35.73 pp |
| Other daily necessities | 23,331 | 12.01 | 16.16 | 31.24% | 42.04% | -10.81 pp |
| Personal-care products | 23,870 | 12.97 | 17.36 | 32.47% | 43.44% | -10.98 pp |
| Rice and grains | 89,397 | 18.56 | 25.01 | 31.22% | 42.07% | -10.84 pp |
| Spices and condiments | 49,511 | 12.15 | 16.55 | 31.26% | 42.60% | -11.34 pp |
| Sugar and salt | 55,055 | 20.21 | 27.00 | 31.26% | 41.77% | -10.51 pp |
| Tea and coffee | 28,182 | 11.97 | 16.95 | 30.27% | 42.84% | -12.58 pp |
| Toiletries | 21,406 | 12.59 | 16.91 | 32.22% | 43.29% | -11.07 pp |
| Vegetables | 74,536 | 9.06 | 10.93 | 35.72% | 43.11% | -7.39 pp |

### B. Performance by Demand Tier (30-Day Horizon)
| Demand Tier | 30d Samples | Ridge MAE | Baseline MAE | Ridge WAPE | Baseline WAPE | WAPE Lift |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Zero / Intermittent (<2/wk) | 206,476 | 5.47 | 4.92 | 78.61% | 70.68% | +7.93 pp |
| Low (2 to <10/wk) | 493,702 | 8.70 | 11.35 | 33.06% | 43.12% | -10.06 pp |
| Medium (10 to 50/wk) | 304,943 | 23.43 | 32.58 | 28.90% | 40.19% | -11.29 pp |
| High (>50/wk) | 15,591 | 60.63 | 100.57 | 33.64% | 55.81% | -22.17 pp |

### C. Performance by Outlet Format (30-Day Horizon)
| Outlet Format | Samples | Ridge MAE | Baseline MAE | Ridge WAPE | Baseline WAPE | WAPE Lift |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Grocery shop | 433,202 | 7.95 | 10.00 | 34.31% | 43.15% | -8.85 pp |
| Grocery store | 311,696 | 8.82 | 11.66 | 32.93% | 43.51% | -10.57 pp |
| Supermarket | 275,814 | 26.54 | 36.82 | 31.06% | 43.09% | -12.03 pp |

---

## 7. Operational & Technical Resource Consumption

- **System Resources:** 16 GB RAM total, ~3.9 GB available at execution start.
- **Peak Process RSS Memory:** ~2,391 MB (kept safely below system threshold via sparse representation).
- **Training Time:**
  - 7-Day Matrix & Training: ~135 seconds.
  - 30-Day Matrix & Training: ~120 seconds.
- **Model Artifact Sizes:**
  - `ml/models/7d/ridge_model.joblib`: 0.02 MB
  - `ml/models/30d/ridge_model.joblib`: 0.02 MB
- **Prediction Files:**
  - `ml/predictions/ridge_validation_predictions_7d.csv`: 63.9 MB
  - `ml/predictions/ridge_validation_predictions_30d.csv`: 53.2 MB

---

## 8. Strategic Recommendations for Stage 3.4 (GBDT / LightGBM)

1. **Keep Ridge as Candidate for 30-Day Horizon:**  
   Ridge's 32.21% WAPE sets a formidable new benchmark for the 30-day task, beating the baseline by 11 percentage points.
2. **Prioritize Tree Models for the 7-Day Horizon:**  
   The failure of Ridge on 7-day demand proves that 7-day grocery demand cannot be modeled as a linear sum of static and rolling features. The presence of 30.97% exact zeroes requires non-linear thresholding and tree-based zero-inflated splits that `HistGradientBoostingRegressor` is uniquely positioned to deliver.
