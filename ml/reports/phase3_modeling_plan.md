# BazarBondhu AI — Phase 3: Reproducible Model Development Plan

**Author:** Senior Machine Learning Engineer & Data Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Execution Stage:** Phase 3, Stage 3.1 (Planning & Design)  
**Deliverable Document:** [ml/reports/phase3_modeling_plan.md](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_modeling_plan.md)  
**Associated Safety Audit:** [ml/reports/phase3_feature_safety_audit.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_feature_safety_audit.json)  

---

## 1. Executive Summary & Forecasting Objectives

BazarBondhu AI is a retail grocery demand forecasting and inventory replenishment decision-support system designed for Bangladesh outlets. The machine learning pipeline is designed to generate reliable, calibrated, and leak-free forecasts for two independent tasks:

- **Task A (7-Day Horizon):** Predict total observed sales quantity over the next 7 days ($t+1$ through $t+7$).
  $$\text{target\_7d} = \sum_{k=1}^7 \text{sales}_{t+k}$$
- **Task B (30-Day Horizon):** Predict total observed sales quantity over the next 30 days ($t+1$ through $t+30$).
  $$\text{target\_30d} = \sum_{k=1}^{30} \text{sales}_{t+k}$$

**Prediction Granularity:** Exactly one row per `outlet_id + product_id + forecast_origin_date`.

This modeling plan outlines the end-to-end strategy for Phase 3, encompassing feature safety governance, chronological validation protocols, baseline benchmarks, machine learning model specifications, evaluation slicing, memory management, and execution milestones.

---

## 2. Feature Safety Audit & Governance Policy

A line-by-line audit of the 72 features implemented in [build_features.py](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/build_features.py) and registered in [feature_metadata.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/features/feature_metadata.json) was conducted. The detailed feature-by-feature evaluation is cataloged in [phase3_feature_safety_audit.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_feature_safety_audit.json).

### Safety Classification Summary

```
+-----------------------------------+-------------------+---------------------------------------------------+
| Classification                    | Count             | Description                                       |
+-----------------------------------+-------------------+---------------------------------------------------+
| 1. SAFE                           | 67 features       | Strictly historical (<= t) or public calendar    |
| 2. CONDITIONAL                    | 5 features        | Safe under documented operational assumptions    |
| 3. UNSAFE                         | 0 features        | Potential future leakage (None present)           |
| 4. NEEDS INVESTIGATION            | 0 features        | Ambiguous provenance (None present)               |
+-----------------------------------+-------------------+---------------------------------------------------+
| Total Model Features              | 72 features       | Approved for Phase 3 modeling                     |
+-----------------------------------+-------------------+---------------------------------------------------+
```

### Audit Findings on Specific Feature Categories

#### A. Static Aggregate Features
1. `outlet_average_daily_demand` (**CONDITIONAL — HIGH MONITORING**):
   - *Analysis:* In the synthetic generator, this parameter represents the latent demand rate ($\rho = 0.919$ with annual observed sales). If interpreted as an empirical 365-day average, it would constitute full-history leakage. If treated as central retail merchandising planning priors (such as initial replenishment demand targets), it is defensible as a static baseline prior.
   - *Governance Action:* Approved as a static baseline prior, but **mandatory ablation testing** must be performed in tree models (evaluating performance with vs without this feature) to verify the model does not bypass learning temporal dynamics.
2. `average_selling_price_bdt` & `average_cost_price_bdt` (**CONDITIONAL — LOW RISK**):
   - *Analysis:* These represent master catalog reference/MSRP and vendor list prices, as documented in `methodology.md`. They are known in advance when products are cataloged.
   - *Governance Action:* Retained alongside outlet-specific shelf prices (`outlet_selling_price_bdt`, `outlet_purchase_cost_bdt`).
3. `average_restock_frequency_days` (**CONDITIONAL — LOW RISK**):
   - *Analysis:* Despite the word "average", this column takes only 4 discrete contractual values ($3, 5, 8, 12$ days), representing store delivery schedule policies.
   - *Governance Action:* Retained as an outlet operational descriptor.

#### B. Historical Sales Features (19 Features)
- All 19 sales features (`sales_lag_1d..28d`, `sales_sum_7d..28d`, `sales_mean_7d..28d`, `sales_std_7d..28d`, `sales_max_7d..28d`, `sales_nonzero_days_7d..28d`) are calculated using strictly historical windows on or before origin date $t$.
- Boundaries are strictly defined: rolling 7-day is $[t-6, t]$, rolling 14-day is $[t-13, t]$, rolling 28-day is $[t-27, t]$.
- Day $t$ is included under the standard Close-of-Business (COB) forecast origin assumption (forecasts for days $t+1..t+h$ are generated after store close on day $t$).
- *Classification:* **SAFE**.

#### C. Inventory & Expiry Features (14 Features)
- Chronological stock reconstruction tracks opening inventory, receipts, sales, wastage, and day-boundary expiry write-offs. Post-expiry closing inventory is strictly zero.
- `stock_expiring_next_7d` and `stock_expiring_next_30d` inspect only batches received on or before origin date $t$ ($r_b \le t$) with remaining stock $>0$ at origin day close. No future batch receipts or future wastage are accessed.
- *Classification:* **SAFE**.

#### D. Promotional Features (3 Features)
- The pipeline utilizes strictly backward-looking promotional features (`promotion_active_at_origin`, `promotion_days_last_7d`, `promotion_days_last_28d`).
- Future promotional indicators (`planned_promotion_next_7d/30d`) were intentionally omitted during Phase 2 because `promotions_discounts.csv` contains single-day promotional records with post-hoc outcome variables (`units_sold_during_promotion`, `estimated_revenue_bdt`) and no advance announcement timestamps.
- *Classification:* **SAFE**.

#### E. Strict Isolation of Target and Censoring Columns
The following 15 columns present in `model_dataset_7d.csv` and `model_dataset_30d.csv` must **NEVER** enter model input matrices:
- Targets: `target_7d`, `target_30d`
- Continuous Availability: `physical_avail_days_7d`, `accessible_avail_days_7d`, `physical_avail_days_30d`, `accessible_avail_days_30d`
- Binary Eligibility Flags: `is_eligible_phys_*`, `is_eligible_acc_*`
- Entity Keys (evaluation/grouping only): `outlet_id`, `product_id`, `forecast_origin_date`, `split_set`

---

## 3. Temporal Split & Purge Protocol

To prevent temporal leakage and realistic validation, observations are partitioned strictly by forecast origin date:

```
+---------------------------+-----------------------------------+-----------------------------------+
| Window / Split            | Calendar Date Span                | Duration / Origin Count           |
+---------------------------+-----------------------------------+-----------------------------------+
| Warm-Up Window            | 2025-11-16 to 2025-12-12          | 27 days (Day 0 to Day 26)         |
| Training Origins          | 2025-12-13 to 2026-07-01          | 201 origin dates (Day 27 to 227)  |
| Purge Window              | 2026-07-02 to 2026-07-31          | 30 calendar days (Day 228 to 257) |
| Validation Origins (7d)   | 2026-08-01 to 2026-11-08          | 100 origin dates (Day 258 to 357) |
| Validation Origins (30d)  | 2026-08-01 to 2026-10-16          | 77 origin dates (Day 258 to 334)  |
+---------------------------+-----------------------------------+-----------------------------------+
```

### Mathematical Proof of Zero Target Overlap
- **Last Training Origin:** $t = 227$ (`2026-07-01`).
  - 7-day training target resolves on $t+7 = \text{Day } 234$ (`2026-07-08`).
  - 30-day training target resolves on $t+30 = \text{Day } 257$ (`2026-07-31`).
- **Purge Window:** Days 228 through 257 (`2026-07-02` to `2026-07-31`).
  - The 30-day purge window exactly matches the horizon of the final training origin.
- **First Validation Origin:** $t = 258$ (`2026-08-01`).
  - First validation target begins on $t+1 = \text{Day } 259$ (`2026-08-02`).
- **Conclusion:** There is strictly **zero overlap** between any training target interval and any validation target interval ($\text{Day } 257 < \text{Day } 259$).

---

## 4. Model Architecture & Selection Hierarchy

We recommend a structured model hierarchy progressing from domain-specific heuristic baselines to regularized linear models and non-linear gradient-boosted decision trees.

### Tier 1: Domain-Specific Retail Baselines (Mandatory Benchmarks)
No machine learning model should be deployed unless it demonstrates superior accuracy over these simple benchmarks:

1. **Baseline 1 — Recent History Sum (Naive Persistence):**
   - For 7-day task: $\hat{y}_{\text{persist}} = \text{sales\_sum\_7d}$ (observed sales over $[t-6, t]$).
   - For 30-day task: $\hat{y}_{\text{persist}} = \text{sales\_sum\_28d} \times \frac{30}{28}$.
   - *Strengths:* Captures recent demand level without parameter estimation.
   - *Weaknesses:* Vulnerable to recent stockouts and transient demand spikes.
2. **Baseline 2 — Historical Rolling Mean:**
   - For 7-day task: $\hat{y}_{\text{mean}} = \text{sales\_mean\_28d} \times 7$.
   - For 30-day task: $\hat{y}_{\text{mean}} = \text{sales\_mean\_28d} \times 30$.
   - *Strengths:* Smoothes transient daily fluctuations; robust for steady staple items.
3. **Baseline 3 — Corporate Planning Prior Benchmark:**
   - For 7-day task: $\hat{y}_{\text{plan}} = \text{outlet\_average\_daily\_demand} \times 7$.
   - For 30-day task: $\hat{y}_{\text{plan}} = \text{outlet\_average\_daily\_demand} \times 30$.
   - *Strengths:* Evaluates how well store assortment planning parameters predict forward demand.
4. **Baseline 4 — Day-of-Week Seasonality Adjusted Baseline:**
   - Scales the recent mean by the ratio of historical weekend vs weekday volume.

### Tier 2: Regularized Linear Model (`Ridge` Regression)
- **Algorithm:** `sklearn.linear_model.Ridge(alpha=10.0)`.
- **Preprocessing Pipeline:**
  - Standard scaling (`StandardScaler`) for continuous numerical features.
  - One-hot encoding for low-cardinality nominals (`outlet_type`, `business_size`, `division`, `area_type`, `storage_type`).
  - Target encoding or high-cardinality ordinal encoding for `category`, `subcategory`, `brand`.
- **Strengths:** Globally convex, extremely fast to train (< 30 seconds), highly interpretable coefficient weights, stable out-of-sample predictions.
- **Limitations:** Cannot capture nonlinear saturation, stockout thresholds, or festival spikes without explicit feature cross-products.

### Tier 3: Non-Linear Gradient Boosted Trees (`HistGradientBoostingRegressor`)
- **Algorithm:** `sklearn.ensemble.HistGradientBoostingRegressor` (native in scikit-learn 1.5.1, LightGBM-inspired architecture).
- **Key Hyperparameters:**
  - `max_iter`: 150
  - `learning_rate`: 0.08
  - `max_leaf_nodes`: 63
  - `min_samples_leaf`: 50
  - `l2_regularization`: 1.0
  - `categorical_features`: Native categorical binning on categorical columns.
  - `loss`: `'squared_error'` (for RMSE/WAPE optimization) and `'absolute_error'` (for MAE optimization).
- **Strengths:**
  - Automatically captures complex nonlinear interactions (e.g. stock level vs days to expiry, price sensitivity by category, holiday multipliers).
  - Fast 256-bin histogram aggregation handles millions of rows with minimal memory overhead.
  - Natively handles categorical features without high-cardinality dimensionality expansion.
  - Robust to unscaled features and outliers.
- **Computational Cost:** Moderate (~3–5 minutes per horizon on 8 CPU cores).

### Tier 4: Optional Tree Ensembles (Ablation / Future Stage)
- `RandomForestRegressor`: High memory and CPU cost on 2.6M rows; recommend evaluating only on a sampled origin subset if needed.
- `LightGBM` / `CatBoost`: Not pre-installed in the current environment; `HistGradientBoostingRegressor` serves as the primary GBDT algorithm.

---

## 5. Comprehensive Evaluation & Slicing Design

### Primary Evaluation Metrics

1. **Mean Absolute Error (MAE):**
   $$\text{MAE} = \frac{1}{M} \sum_{i=1}^M |y_i - \hat{y}_i|$$
   Measures average absolute magnitude of forecast error in physical units.
2. **Root Mean Squared Error (RMSE):**
   $$\text{RMSE} = \sqrt{\frac{1}{M} \sum_{i=1}^M (y_i - \hat{y}_i)^2}$$
   Penalizes large outlier forecast errors.
3. **Weighted Absolute Percentage Error (WAPE):**
   $$\text{WAPE} = \frac{\sum_{i=1}^M |y_i - \hat{y}_i|}{\sum_{i=1}^M y_i}$$
   Volume-weighted relative error. Essential for retail forecasting because standard MAPE divides by $y_i$, which is mathematically undefined on zero-sales days ($30.73\%$ of 7d targets are zero).
   - *Zero Denominator Rule:* If $\sum y_i == 0$, return `0.0` if $\sum |\hat{y}_i| == 0$, else return `np.nan` with a logged diagnostic note.
4. **Mean Error / Forecast Bias:**
   $$\text{Bias} = \frac{1}{M} \sum_{i=1}^M (\hat{y}_i - y_i)$$
   Measures systematic over-prediction (excess holding/wastage risk) or under-prediction (stockout risk).

### Evaluation Slices

Performance must be evaluated across both the **Overall Validation Panel** and granular slices:
1. **Product Category Slices:** High-volume staples (Rice and grains, Cooking oil) vs perishables (Dairy, Vegetables, Meat) vs non-perishables (Household, Spices).
2. **Outlet Format Slices:** Grocery stores, Supermarkets, Mini marts.
3. **Area Profile Slices:** Affluent residential, High-density residential, Commercial/Office hubs, Semi-urban.
4. **Demand Volume Tiers:**
   - Zero/Intermittent Demand: $< 2$ units per week
   - Low Demand: $2 - 10$ units per week
   - Medium Demand: $10 - 50$ units per week
   - High Demand: $> 50$ units per week
5. **Censoring & Availability Slices:**
   - **Full Validation Panel:** Evaluates raw forecast error on all observations.
   - **Availability-Eligible Subset:** Evaluates performance on periods where stock was genuinely accessible to customers ($\ge 5/7$ accessible days for 7d; $\ge 20/30$ accessible days for 30d).

### Post-Processing & Non-Negativity
- All raw demand forecasts must be clipped to non-negative values: $\hat{y}_{\text{final}} = \max(0.0, \hat{y}_{\text{raw}})$.
- Point forecasts remain continuous float values for evaluation. Business replenishment order rounding (e.g., minimum order pack sizes) is strictly decoupled from demand forecasting evaluation.

---

## 6. Memory Management & Execution Architecture

Given the system constraint of **~3.64 GB available RAM**, the training pipeline will follow strict resource governance:

1. **Sequential Horizon Execution:**
   - Run 7-day modeling end-to-end (load 7d dataset $\to$ fit models $\to$ evaluate $\to$ serialize artifacts $\to$ free memory).
   - Garbage collect and run 30-day modeling end-to-end.
2. **Selective Column Loading & Downcasting:**
   - Load only the 72 features + `split_set` + `target_*` + `is_eligible_acc_*` + entity keys.
   - Downcast numerical columns to `float32`, integer features to `int16`/`int8`, and string columns to pandas `category`.
3. **Eligible Training Filter:**
   - Train on the recommended eligibility subset (`is_eligible_acc_5of7 == 1` for 7d; `is_eligible_acc_20of30 == 1` for 30d). This removes acute stockout windows, reducing training rows from 2.66M to 2.23M rows and memory footprint to ~450 MB.
4. **Validation Evaluation:**
   - Predict on the full validation set (1.33M rows for 7d; 1.02M rows for 30d), and evaluate metrics across both the overall validation set and the eligible subset.

---

## 7. Phase 3 Staged Implementation Roadmap

```
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage         | Objective                                     | Primary Deliverables                      |
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage 3.1     | Repository Inspection & Modeling Plan         | phase3_repository_inspection.md           |
| (Current)     | Feature Safety Audit                          | phase3_feature_safety_audit.json          |
|               | Environment Assessment                        | phase3_modeling_plan.md                   |
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage 3.2     | Baseline Model Implementation & Benchmarking  | ml/scripts/train_baselines.py             |
|               | (Persistence, Mean, Planning Prior)           | ml/reports/phase3_baseline_benchmark.md   |
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage 3.3     | Regularized Linear Modeling                   | ml/scripts/train_linear.py                |
|               | (Ridge Regression + Preprocessing Pipeline)   | ml/models/7d/ridge_model.joblib           |
|               |                                               | ml/models/30d/ridge_model.joblib          |
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage 3.4     | Non-Linear Gradient Boosted Decision Trees   | ml/scripts/train_trees.py                 |
|               | (HistGradientBoostingRegressor + Tuning)      | ml/models/7d/hgb_model.joblib             |
|               |                                               | ml/models/30d/hgb_model.joblib            |
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage 3.5     | Comprehensive Sliced Evaluation               | ml/scripts/evaluate_models.py             |
|               | (Overall, Categories, Formats, Eligibility)   | ml/reports/phase3_evaluation_report.md    |
+---------------+-----------------------------------------------+-------------------------------------------+
| Stage 3.6     | Unified Prediction Pipeline & Packaging       | ml/scripts/predict.py                     |
|               | (Inference CLI, Schema Validation)            | ml/reports/phase3_final_signoff.md        |
+---------------+-----------------------------------------------+-------------------------------------------+
```

---

## 8. Summary of Created Artifacts & Integrity Confirmation

- **Files Created:**
  1. `ml/reports/phase3_repository_inspection.md`: Full architectural and environment inspection report.
  2. `ml/reports/phase3_feature_safety_audit.json`: Feature-level provenance, risk, and safety classification registry.
  3. `ml/reports/phase3_modeling_plan.md`: Comprehensive, reproducible Phase 3 modeling strategy.
- **Integrity Statement:** Zero Phase 1 files, zero Phase 2 feature scripts, and zero dataset rows were modified, overwritten, or recomputed. The stage objectives have been executed with full reproducibility.
