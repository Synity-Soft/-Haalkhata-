# BazarBondhu AI — Phase 3, Stage 3.9
# Final Model Verification & Integrity Audit Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer & Independent ML Auditor  
**Stage:** Phase 3.9: Final Model Verification & Packaging Audit  
**Audit Execution Date:** November 17, 2026  
**Repository Working Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  
**Audit Script:** [`ml/scripts/verify_final_models.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/verify_final_models.py)  
**Machine-Readable Audit JSON:** [`ml/reports/phase3_final_model_verification.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_final_model_verification.json)  
**Overall Audit Verdict:** **PASSED (25 / 25 checks passed)**  
**Audit Runtime:** 37.38 seconds  

---

## 1. Executive Summary & Audit Scope

This document details the independent empirical integrity verification conducted on the two final selected demand forecasting models for BazarBondhu AI:
1. **7-Day Demand Forecasting:** [`ml/models/7d/hgb_exp3_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp3_absolute_error_model.joblib) (Stage 3.7 leading candidate)
2. **30-Day Demand Forecasting:** [`ml/models/30d/hgb_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/hgb_absolute_error_model.joblib) (Stage 3.8 leading candidate)

Both models were audited across five core dimensions: artifact integrity, feature safety and encoder provenance, inference reproducibility, prediction integrity, and independent recalculation of benchmark metrics.

```
+-------------------------------------------------------------------------------------------------------------+
| FINAL VERIFICATION AUDIT MATRIX (25 / 25 CHECKS PASSED)                                                     |
+--------+---------------------------------------+--------+---------------------------------------------------+
| TASK   | DESCRIPTION                           | CHECKS | AUDIT VERDICT & EVIDENCE                          |
+--------+---------------------------------------+--------+---------------------------------------------------+
| Task 1 | Artifact Integrity                    | 1 – 5  | PASSED: Valid joblib loading, 67 SAFE features,   |
|        |                                       |        | [55..66] cat indices, finite trees, correct schema|
| Task 2 | Feature Safety & Provenance           | 6 – 9  | PASSED: Exact SAFE registry match, zero leakage,  |
|        |                                       |        | 100% empirical training-only encoder provenance   |
| Task 3 | Inference Reproducibility             | 10 – 11| PASSED: 1,000 keyed validation sample test        |
|        |                                       |        | (Quantized Delta = 0.0, Raw Delta < 5e-5)         |
| Task 4 | Prediction Integrity                  | 12 – 20| PASSED: Exact row counts (1.32M / 1.02M), 0 dups, |
|        |                                       |        | finite values, 0.0 target diff vs references      |
| Task 5 | Benchmark Recalculation               | 21 – 25| PASSED: 100% independent metric replication,      |
|        |                                       |        | empty-pop guard, strict horizon decoupling        |
+--------+---------------------------------------+--------+---------------------------------------------------+
```

---

## 2. Task 1: Artifact Integrity Verification

### 2.1 File Existence and Deserialization (Check 1)
Both serialized model artifacts were verified to exist on disk and were deserialized successfully into memory using `joblib.load()`:
- **7-Day Model:** [`ml/models/7d/hgb_exp3_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp3_absolute_error_model.joblib) (140.37 KB)
- **30-Day Model:** [`ml/models/30d/hgb_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/hgb_absolute_error_model.joblib) (168.60 KB)

### 2.2 Feature Counts & Schema Partition (Check 2)
Both models encapsulate identical feature partitions forming a complete, disjoint partition of the approved SAFE feature set:
- **Total SAFE Features:** Exactly 67
- **Numerical Features (`num_cols`):** Exactly 55
- **Categorical Features (`cat_cols`):** Exactly 12
- **Disjoint Partition:** $\text{num\_cols} \cap \text{cat\_cols} = \emptyset$
- **Completeness:** $\text{num\_cols} \cup \text{cat\_cols} = \text{safe\_features}$

### 2.3 Categorical Preprocessor & Index Layout (Check 3)
- Both models contain a fitted `sklearn.preprocessing.OrdinalEncoder`.
- Configured with `handle_unknown='use_encoded_value'` and `unknown_value=-1`.
- Fitted category count: exactly 12 feature category lists.
- Transformed design matrix layout: numerical columns occupy columns `0..54`; categorical columns occupy columns `55..66` (`categorical_indices = [55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66]`).

### 2.4 Estimator Hyperparameters & Parameter Finiteness (Check 4)
- Both models wrap a fitted `sklearn.ensemble.HistGradientBoostingRegressor`.
- Hyperparameters verified:
  * `loss='absolute_error'`
  * `learning_rate=0.08`
  * `max_iter=100` (100 boosting iterations completed)
  * `max_leaf_nodes=31`
  * `min_samples_leaf=50`
  * `l2_regularization=1.0`
  * `early_stopping=False`
  * `random_state=42`
- All internal tree leaf predictor arrays inspected: **100% finite (0 NaN, 0 Inf)**.

### 2.5 Horizon & Target Schema (Check 5)
- **7-Day Model:** `model.horizon == "7d"`, `model.target_col == "target_7d"`.
- **30-Day Model:** `model.horizon == "30d"`, `model.target_col == "target_30d"`.

---

## 3. Task 2: Feature Safety & Preprocessing Provenance

### 3.1 Authoritative Registry Order Matching (Check 6)
Both models' `safe_features` attributes were compared element-by-element against the authoritative SAFE feature list in [`ml/reports/phase3_feature_safety_audit.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_feature_safety_audit.json). All 67 features match in identical order.

### 3.2 Exclusion of Unsafe, Conditional, and Leakage Columns (Check 7)
Verified that no forbidden column entered either model's predictor set:
- **Excluded Conditional Features (5):** `outlet_average_daily_demand`, `average_selling_price_bdt`, `average_cost_price_bdt`, `average_restock_frequency_days`, `days_until_next_festival`.
- **Excluded Identifiers & Metadata:** `outlet_id`, `product_id`, `forecast_origin_date`.
- **Excluded Targets & Flags:** `target_7d`, `target_30d`, `is_eligible_acc_5of7`, `is_eligible_acc_20of30`.

### 3.3 Empirical Categorical Encoder Training Provenance (Checks 8 & 9)
To ensure zero data leakage from validation partitions, the auditor independently streamed the 12 categorical features from the training partition only (`2025-12-13` to `2026-07-01`) for both raw datasets (`model_dataset_7d.csv` and `model_dataset_30d.csv`). Missing values were normalized with `"missing"`, strings were extracted, and vocabularies were reconstructed.

| Categorical Feature | Saved Categories Count | Reconstructed Training Count | Membership & Order Match | Provenance Verdict |
| :--- | :---: | :---: | :---: | :---: |
| `outlet_type` | 3 | 3 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `business_size` | 5 | 5 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `division` | 12 | 12 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `district` | 12 | 12 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `area_type` | 9 | 9 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `category` | 25 | 25 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `subcategory` | 29 | 29 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `brand` | 10 | 10 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `unit` | 7 | 7 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `package_size` | 49 | 49 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `perishable_status` | 2 | 2 | Exact (100%) | **TRAINING-ONLY VERIFIED** |
| `storage_type` | 2 | 2 | Exact (100%) | **TRAINING-ONLY VERIFIED** |

Both 7-day (Check 8) and 30-day (Check 9) encoders exhibit 100% category equality and order match against training observations exclusively. Zero validation categories leaked into the encoder.

---

## 4. Task 3: Inference Reproducibility Verification

For both horizons, 1,000 validation observations were deterministically sampled from the source raw datasets (`model_dataset_7d.csv` and `model_dataset_30d.csv`) starting from the validation origin date `2026-08-01`.

Fresh predictions were generated using `model.predict()` and compared with the stored validation prediction files:

| Horizon | Sample Size | Forecast Origins Tested | Max Quantized Discrepancy | Max Float64 Discrepancy | Reproducibility Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **7-Day Model** | 1,000 rows | `2026-08-01` | **0.00000000e+00** | $4.99288257\times 10^{-5}$ | **PASSED (EXACT)** |
| **30-Day Model** | 1,000 rows | `2026-08-01` | **0.00000000e+00** | $4.99905759\times 10^{-5}$ | **PASSED (EXACT)** |

*Note on Quantization:* Prediction CSV artifacts were serialized with 4-decimal precision (`np.round(..., 4)`). The raw float64 difference is mathematically bounded by the rounding bound ($0.5 \times 10^{-4} = 5.0 \times 10^{-5}$). When quantized to the CSV's 4-decimal serialization precision, the discrepancy is identically **0.00000000e+00**.

---

## 5. Task 4: Prediction Integrity Verification

### 5.1 Validation Row Counts & Date Bounds (Checks 12, 13, 16, 17)
- **7-Day Model:**
  * Rows: Exactly **1,325,600**
  * Dates: Exactly **100 consecutive calendar dates** (`2026-08-01` through `2026-11-08`)
  * Duplicate Keys: **0 duplicate keys** across `(outlet_id, product_id, forecast_origin_date)`
- **30-Day Model:**
  * Rows: Exactly **1,020,712**
  * Dates: Exactly **77 consecutive calendar dates** (`2026-08-01` through `2026-10-16`)
  * Duplicate Keys: **0 duplicate keys** across `(outlet_id, product_id, forecast_origin_date)`

### 5.2 Finiteness & Zero-Clipping Consistency (Checks 14 & 18)
- **Finiteness:** 0 non-finite values (NaN, Inf, or -Inf) across targets, raw predictions, clipped predictions, baseline predictions, and Ridge predictions for both horizons.
- **Negative Excursions:**
  * 7-day raw predictions: 5,811 rows (0.44%) were negative (min: -2.0111 units).
  * 30-day raw predictions: 4,292 rows (0.42%) were negative (min: -1.3110 units).
- **Clipping Consistency:** $\max |\text{predicted\_clipped} - \max(\text{predicted\_raw}, 0)| = \mathbf{0.0}$ across all rows in both horizons.

### 5.3 Target Alignment Across Models (Checks 15 & 19)
- **7-day:** Ground-truth targets match the 7-day Baseline and Ridge prediction files with **0.0 discrepancy** across all 1,325,600 rows.
- **30-day:** Ground-truth targets match the 30-day Baseline and Ridge prediction files with **0.0 discrepancy** across all 1,020,712 rows.

### 5.4 Cross-Horizon Artifact Isolation (Check 20)
- Confirmed no column mixing (7d file contains no 30d predictions; 30d file contains no 7d predictions).
- Target distribution scale check: 7-day target mean is **9.55 units**; 30-day target mean is **41.11 units**. No cross-horizon contamination detected.

---

## 6. Task 5: Final Benchmark Recalculation

All benchmark metrics were independently recomputed by the audit script directly from the raw validation prediction files:

### 6.1 7-Day Forecasting Horizon Benchmark (Primary & Secondary)

```
+-------------------------------------------------------------------------------------------------------------------+
| 7-DAY BENCHMARK AUDIT RECALCULATION (PRIMARY: ALL VALID: 1,325,600 ROWS | SECONDARY: ELIGIBLE: 1,102,601 ROWS)     |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
| MODEL ARCHITECTURE           | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | AUDIT STATUS               |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
| [Primary: All Valid Rows]    |             |             |             |             |                            |
| Stage 3.2 Rolling Baseline   | 73.96%      | 7.0658      | 12.6544     | +0.0443     | Recalculated & Verified    |
| Stage 3.3 Corrected Ridge    | 77.36%      | 7.3907      | 13.0554     | +3.1921     | Recalculated & Verified    |
| Stage 3.7 HGB EXP3 (Raw)     | 61.23%      | 5.8494      | 10.8432     | -0.4575     | Recalculated & Verified    |
| Stage 3.7 HGB EXP3 (Clipped) | 61.22%      | 5.8486      | 10.8431     | -0.4567     | EXACT MATCH TO REFERENCE   |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
| [Secondary: Eligible Rows]   |             |             |             |             |                            |
| Stage 3.2 Rolling Baseline   | 70.30%      | 7.9032      | 13.5906     | -0.2134     | Recalculated & Verified    |
| Stage 3.3 Corrected Ridge    | 74.00%      | 8.3186      | 14.0928     | +3.5548     | Recalculated & Verified    |
| Stage 3.7 HGB EXP3 (Clipped) | 60.44%      | 6.7950      | 11.7336     | -0.4318     | Recalculated & Verified    |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
```

### 6.2 30-Day Forecasting Horizon Benchmark (Primary & Secondary)

```
+-------------------------------------------------------------------------------------------------------------------+
| 30-DAY BENCHMARK AUDIT RECALCULATION (PRIMARY: ALL VALID: 1,020,712 ROWS | SECONDARY: ELIGIBLE: 853,740 ROWS)      |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
| MODEL ARCHITECTURE           | WAPE (%)    | MAE (Units) | RMSE        | MEAN BIAS   | AUDIT STATUS               |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
| [Primary: All Valid Rows]    |             |             |             |             |                            |
| Stage 3.2 Rolling Baseline   | 43.19%      | 17.7550     | 32.0077     | +0.0623     | Recalculated & Verified    |
| Stage 3.3 Corrected Ridge    | 32.21%      | 13.2412     | 22.2746     | +5.0930     | Recalculated & Verified    |
| Stage 3.8 HGB 30D (Raw)      | 26.53%      | 10.9069     | 19.1755     | +0.6290     | Recalculated & Verified    |
| Stage 3.8 HGB 30D (Clipped)  | 26.53%      | 10.9066     | 19.1755     | +0.6293     | EXACT MATCH TO REFERENCE   |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
| [Secondary: Eligible Rows]   |             |             |             |             |                            |
| Stage 3.2 Rolling Baseline   | 41.69%      | 19.8771     | 34.5539     | +0.0771     | Recalculated & Verified    |
| Stage 3.3 Corrected Ridge    | 30.11%      | 14.3533     | 23.5934     | +5.6541     | Recalculated & Verified    |
| Stage 3.8 HGB 30D (Clipped)  | 25.30%      | 12.0624     | 20.5955     | +0.9752     | Recalculated & Verified    |
+------------------------------+-------------+-------------+-------------+-------------+----------------------------+
```

### 6.3 Empty Population Guard (Check 21) & Prior Artifact Preservation (Check 25)
- Empty-population edge case tested: returns `count: 0`, and `"UNDEFINED"` for MAE, RMSE, WAPE, and Bias.
- All historical model files (`hgb_exp1_full_model.joblib`, `hgb_exp2_no_inventory_model.joblib`) and validation prediction files were verified intact and unmodified.

---

## 7. Audit Verdict & Sign-Off

The final integrity audit has completed with all **25 out of 25 checks passed**:
- **Artifact Integrity:** PASSED
- **Feature Safety & Provenance:** PASSED
- **Inference Reproducibility:** PASSED
- **Prediction Integrity:** PASSED
- **Benchmark Recalculation:** PASSED

Both selected forecasting models (`ml/models/7d/hgb_exp3_absolute_error_model.joblib` and `ml/models/30d/hgb_absolute_error_model.joblib`) are verified as reproducible, consistent, leak-free, and mathematically aligned with their reported metrics.
