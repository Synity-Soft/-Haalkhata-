# BazarBondhu AI — Phase 3, Stage 3.5.1.3.2
# Final Audit Evidence & Schema Verification Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer and Independent ML Auditor  
**Stage:** Phase 3, Stage 3.5.1.3.2: Final Audit Evidence & Schema Verification  
**Audited Experiment:** `EXP1_HGB_FULL_7D`  
**Execution Date:** November 17, 2026  
**Audited Model Artifact:** [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib)  
**Audited Predictions CSV:** [`ml/predictions/hgb_exp1_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp1_validation_predictions_7d.csv)  
**Audited Original Metrics:** [`ml/reports/phase3_hgb_exp1_7d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp1_7d_metrics.json)  
**Audit Script:** [`ml/scripts/audit_hgb_exp1_integrity.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/audit_hgb_exp1_integrity.py)  
**Machine-Readable Audit JSON:** [`ml/reports/phase3_hgb_exp1_7d_integrity_correction.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp1_7d_integrity_correction.json)  

---

## 1. Executive Summary & Audit Conclusion

This audit report delivers an independent, empirical verification of the `EXP1_HGB_FULL_7D` experiment, completing the Stage 3.5.1.3.2 audit evidence and schema verification requirements:
1. **Genuine Forecaster Implementation Checks:** All hardcoded booleans have been removed from `inference_implementation_checks` and replaced with dynamic source inspection and runtime validation tests against [`ml/models/forecaster.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/forecaster.py).
2. **Actual Estimator Configuration Verification:** Verified directly on the deserialized estimator object: fitted status (`check_is_fitted(model.hgb)`), `hgb.n_features_in_ == 67`, `hgb.categorical_features == [55..66]`, and `model.encoder` containing exactly 12 fitted vocabularies matching the input order of `model.cat_cols`.
3. **Benchmark Prediction Value Alignment:** Compared embedded baseline predictions in the HGB CSV against the external baseline file's `rolling_average_baseline` (max difference $= 0.0$, 0 mismatches across 1,325,600 rows) and embedded Ridge predictions against the external Ridge file's `clipped_prediction` (max difference $= 0.0$, 0 mismatches across 1,325,600 rows), confirming 100% finiteness.
4. **Explicit Feature-Type Verification:** Compared against authoritative feature metadata ([`ml/features/feature_metadata.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/features/feature_metadata.json)) and the safety audit ([`ml/reports/phase3_feature_safety_audit.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_feature_safety_audit.json)), confirming exactly 55 numerical, 12 categorical, 67 SAFE features, zero overlap (`isdisjoint() == True`), zero missing or unexpected features, correct transformation order, and matching estimator indices `[55..66]`.
5. **Metric Input Validation & Output Sign:** Validated binary eligibility flags (`{0, 1}`), confirmed exactly 1,102,601 eligible rows, and corrected console output notation to distinguish percentage points (+10.53 pp) from relative percentage reduction (+14.24%).
6. **Preserved Resource Classifications:** Maintained honest classifications (`UNMONITORED_AND_UNAVAILABLE`, `UNKNOWN`, `NOT_VERIFIED`) for peak memory and swap telemetry.

No models were retrained, no model parameters were modified, and all historical baseline, Ridge, and dataset artifacts remain strictly preserved.

### Overall Conclusion
**EXP1 integrity checks passed for the verified scope, with explicitly documented limitations.**

```
+--------------------------------------------------------------------------------------------------------------------+
| AUDIT VERDICT MATRIX (STANDARDIZED AUDIT VOCABULARY)                                                               |
+------------------------------+--------------------+----------------+-----------------------------------------------+
| AUDIT TASK                   | FOCUS AREA         | AUDIT VERDICT  | EMPIRICAL EVIDENCE & AUDIT SUMMARY            |
+------------------------------+--------------------+----------------+-----------------------------------------------+
| Task A: Reproducibility &    | Reloaded Inference | PASSED         | 1,000 / 1,000 validation keys aligned;        |
| Forecaster Implementation    | & Code Validation  |                | Raw float diff <= 4.9979e-5 (half-error bound)|
|                              |                    |                | Exact match after 4-dec rounding (diff = 0.0);|
|                              |                    |                | All 8 forecaster checks dynamically verified; |
|                              |                    |                | Actual estimator: 67 in, 12 cat vocabs,       |
|                              |                    |                | categorical_features = [55..66].              |
| Task B: Prediction Artifact  | CSV Integrity,     | PASSED         | 1,325,600 rows across HGB, Base, Ridge;       |
| & Benchmark Alignment        | Finiteness & Align |                | Required cols verified (HGB: 9, Base: 5, R: 5)|
|                              |                    |                | 0 missing values; 0 non-finite (9/9 checks);  |
|                              |                    |                | Source key uniqueness verified (0 dups);      |
|                              |                    |                | Embedded baseline diff = 0.0 (0 mismatches);  |
|                              |                    |                | Embedded Ridge diff = 0.0 (0 mismatches);     |
|                              |                    |                | Targets identically equal to Baseline & Ridge |
| Task C: Recalculated Metrics | Benchmark Validity | PASSED         | Strict prerequisites verified (rows, keys,    |
| & Eligibility Validation     | & Prerequisites    |                | targets, finiteness) before comparative math; |
|                              |                    |                | Eligibility binary verified (1,102,601 rows); |
|                              |                    |                | Discrepancies within documented 5e-5 tolerance|
|                              |                    |                | of original JSON (4-dec rounding effect);     |
|                              |                    |                | WAPE = 63.43% (+10.53 pp vs. 73.96% Baseline, |
|                              |                    |                | +14.24% relative error reduction).            |
| Task D: Temporal & Explicit  | Partition Sequence | PASSED         | 201 consecutive training dates (2,664,456 r); |
| Feature-Type Verification    | & Feature Safety   |                | 0 purge rows; 100 consecutive val dates;      |
|                              |                    |                | Explicit feature-types: 55 num, 12 cat;       |
|                              |                    |                | Disjoint set equality: True; 0 missing/unexp; |
|                              |                    |                | Authoritative registry match: 67/67 (0 diffs);|
|                              |                    |                | Conditional & forbidden features excluded.    |
| Task E: Memory Correction    | Resource Reporting | PASSED         | Historical snapshots labeled; peak RSS marked |
|                              |                    |                | UNMONITORED_AND_UNAVAILABLE; claims corrected |
+------------------------------+--------------------+----------------+-----------------------------------------------+
| OVERALL AUDIT VERDICT        | ALL SCOPES         | PASSED         | VERIFIED SATISFACTORY FOR AUDITED SCOPE       |
+------------------------------+--------------------+----------------+-----------------------------------------------+
```

---

## 2. Task A — Strengthened Inference Reproducibility & Genuine Forecaster Implementation Verification

### 2.1 Audit Methodology & Prerequisites
1. Deserialized [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib) as an instance of `HGBDemandForecaster`.
2. Loaded exactly 1,000 actual chronological validation rows directly from [`ml/data/model_dataset_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/data/model_dataset_7d.csv) within the verified validation window (`2026-08-01` to `2026-11-08`).
3. Loaded exactly 1,000 rows from [`ml/predictions/hgb_exp1_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp1_validation_predictions_7d.csv).
4. Verified exact forecast key alignment across `outlet_id`, `product_id`, and `forecast_origin_date`.
5. Executed `predict_raw()` and `predict()` using the reloaded forecaster.
6. Compared unrounded 64-bit float reloaded outputs against 4-decimal rounded CSV predictions for both unclipped raw tree outputs and non-negative clipped forecasts.

### 2.2 Empirical Reproducibility Results
- **Validation Rows Loaded:** Exactly **1,000 / 1,000 rows**.
- **Prediction Rows Loaded:** Exactly **1,000 / 1,000 rows**.
- **Matched Forecast Keys:** Exactly **1,000 / 1,000 rows** (100.0% alignment).
- **Target Scope:** Evaluated on both unclipped raw tree outputs and non-negative clipped forecasts ($y \ge 0$).
- **Max Absolute Difference (Raw Float vs. 4-Decimal CSV):** `4.99786850e-05` units.
- **Max Absolute Difference (Clipped Float vs. 4-Decimal CSV):** `4.99786850e-05` units.
- **Rounding Half-Error Tolerance Bound:** $\frac{10^{-4}}{2} = 5.0 \times 10^{-5}$. The observed difference ($4.9978 \times 10^{-5}$) satisfies the documented tolerance $\le 5.0001 \times 10^{-5}$.
- **Max Absolute Difference After 4-Decimal Rounding (Raw):** **`0.00000000e+00`**.
- **Max Absolute Difference After 4-Decimal Rounding (Clipped):** **`0.00000000e+00`**.

### 2.3 Genuine Forecaster Implementation Verification
All hardcoded booleans have been removed. Every implementation check is dynamically verified via runtime execution and AST/source inspection of [`ml/models/forecaster.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/forecaster.py):

```
+----------------------------------------------------------------------------------------------------+
| FORECASTER IMPLEMENTATION CHECKS (RUNTIME & CODE VERIFICATION)                                     |
+-------------------------------------------------+----------------+---------------------------------+
| CHECK ITEM                                      | DYNAMIC STATUS | VERIFICATION METHOD             |
+-------------------------------------------------+----------------+---------------------------------+
| Required column validation (KeyError on missing)| PASSED (True)  | Runtime test with dropped col   |
| Numerical feature extraction in num_cols order  | PASSED (True)  | Source inspection & transform   |
| Categorical feature extraction in cat_cols order| PASSED (True)  | Source inspection & transform   |
| Stacking: num_cols first, cat_cols second       | PASSED (True)  | Source inspection (column_stack)|
| Matrix layout matches categorical_indices [55..]| PASSED (True)  | Runtime layout index check      |
| Inference uses saved fitted OrdinalEncoder      | PASSED (True)  | Deserialized model.encoder test |
| Unknown category handled as -1.0                | PASSED (True)  | Runtime test with unknown level |
| Matrix finiteness check present (np.isfinite)   | PASSED (True)  | Source inspection of transform  |
+-------------------------------------------------+----------------+---------------------------------+
```

### 2.4 Actual Estimator Configuration Verification
Direct inspection of the deserialized estimator and encoder objects confirms:
- **Estimator Fitted Status:** `check_is_fitted(model.hgb)` passed (100 boosting iterations).
- **Estimator Input Dimensions:** `model.hgb.n_features_in_ == 67` (exact match).
- **Estimator Categorical Features:** `model.hgb.categorical_features == [55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66]` (exact match with trailing 12 positions).
- **Encoder Fitted Vocabularies:** `len(model.encoder.categories_) == 12` (exact match with 12 categorical features and 165 total discrete levels).
- **Categorical Order Consistency:** `model.cat_cols` matches the input dimension and category sequence of `model.encoder`.
- **Transformed Matrix Consistency:** All feature mappings are consistent with the design matrix layout.

**Task A Verdict:** **PASSED.**

---

## 3. Task B — Strengthened Prediction Artifact Validation & Benchmark Value Alignment

### 3.1 Prediction Artifact Validation Results
The prediction file [`ml/predictions/hgb_exp1_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp1_validation_predictions_7d.csv) was audited row-by-row alongside baseline and Ridge artifacts:

```
+----------------------------------------------------------------------------------------------------+
| PREDICTION ARTIFACT VALIDATION RESULTS                                                             |
+------------------------------------+------------------+---------------------+----------------------+
| VALIDATION CRITERION               | SPECIFICATION    | AUDITED VALUE       | AUDIT STATUS         |
+------------------------------------+------------------+---------------------+----------------------+
| Total Row Count                    | 1,325,600        | 1,325,600           | PASSED               |
| Row Count Parity Across Artifacts  | Equal (1.3256M)  | Equal (1,325,600)   | PASSED               |
| Safe Length Check (Pre-Broadcast)  | len equality     | Verified            | PASSED               |
| HGB Required Columns Present (9)   | 9 cols present   | 9 / 9 verified      | PASSED               |
| Baseline Required Cols Present (5) | 5 cols present   | 5 / 5 verified      | PASSED               |
| Ridge Required Cols Present (5)    | 5 cols present   | 5 / 5 verified      | PASSED               |
| Missing Values across ALL 9 Cols   | 0 missing        | 0 missing (all cols)| PASSED               |
| Duplicate Triple Forecast Keys     | 0                | 0                   | PASSED               |
| Source Key Uniqueness Verified     | 0 dups in source | 0 dups (1,325,600 u)| PASSED               |
| Source Key Coverage (vs. Dataset)  | 100% Match       | 1,325,600 / 1.32M   | PASSED               |
| Extra Keys vs. Source Dataset      | 0                | 0                   | PASSED               |
| Missing Keys vs. Source Dataset    | 0                | 0                   | PASSED               |
| Non-Finite Actual Targets (HGB)    | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Raw Predictions (HGB)   | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Clipped Preds (HGB)     | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Baseline Preds (HGB)    | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Ridge Preds (HGB)       | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Actual Targets (Base)   | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Rolling Baseline (Base) | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Actual Targets (Ridge)  | 0                | 0 (all finite)      | PASSED               |
| Non-Finite Clipped Preds (Ridge)   | 0                | 0 (all finite)      | PASSED               |
| Negative Clipped Predictions       | 0                | 0 (Min = 0.0000)    | PASSED               |
| Negative Actual Targets            | 0                | 0 (Min = 0.0000)    | PASSED               |
| Raw vs. Clipped Inconsistency      | Max diff <= 1e-4 | Max diff = 0.0000   | PASSED               |
| Key Alignment vs. Baseline         | Exact Match      | 1,325,600 / 1.32M   | PASSED               |
| Key Alignment vs. Ridge            | Exact Match      | 1,325,600 / 1.32M   | PASSED               |
| Actual Target Equality vs. Baseline| Max diff = 0.0   | Max diff = 0.0000   | PASSED               |
| Actual Target Equality vs. Ridge   | Max diff = 0.0   | Max diff = 0.0000   | PASSED               |
+------------------------------------+------------------+---------------------+----------------------+
```

### 3.2 Benchmark Prediction Value Alignment
To verify that the embedded baseline and Ridge predictions inside `hgb_exp1_validation_predictions_7d.csv` are genuine copies of the authoritative benchmark outputs:
1. **Embedded Baseline Alignment:** Compared `df_hgb["baseline_prediction"]` against `df_base["rolling_average_baseline"]` from `ml/reports/phase3_baseline_predictions_7d.csv`:
   - Key alignment verified: **1,325,600 / 1,325,600 rows**.
   - Max absolute difference: **`0.00000000e+00`**.
   - Mismatch count: **0 mismatches**.
2. **Embedded Ridge Alignment:** Compared `df_hgb["ridge_prediction"]` against `df_ridge["clipped_prediction"]` from `ml/predictions/ridge_validation_predictions_7d.csv`:
   - Key alignment verified: **1,325,600 / 1,325,600 rows**.
   - Max absolute difference: **`0.00000000e+00`**.
   - Mismatch count: **0 mismatches**.
3. **Finiteness of Compared Series:** All compared values are **100% finite** (`all_compared_predictions_finite == True`).

**Task B Verdict:** **PASSED.**

---

## 4. Task C — Strengthened Metric Recalculation & Eligibility Input Validation

### 4.1 Strict Prerequisite Verification Before Metric Computation
In accordance with Stage 3.5.1.3 Task 3, comparative metrics against Baseline and Ridge were calculated **only after** verifying four strict prerequisites:
1. **Equal Row Counts:** Exactly 1,325,600 rows in HGB, Baseline, and Ridge artifacts (`len(hgb) == len(baseline) == len(ridge) == 1325600`).
2. **Exact Key Alignment:** Keys match row-for-row across all 1,325,600 observations (`base_key_align == True`, `ridge_key_align == True`).
3. **Identical Actual Targets:** Target values match identically row-for-row ($\max|\Delta_\text{base}| = 0.0000$, $\max|\Delta_\text{ridge}| = 0.0000$).
4. **Finite Values:** All actual targets and prediction series across all models are 100% finite.
5. **Eligibility Binary Verification:** `is_eligible_acc_5of7` contains only binary values in `{0, 1}`.
6. **Eligible Observation Count:** Exactly **1,102,601 rows** out of 1,325,600 (`eligible_observation_count_match == True`).

Because all prerequisites passed (`prerequisites_verified: true`), comparative metrics are confirmed valid.

### 4.2 Independent float64 Recalculation Results

```
+----------------------------------------------------------------------------------------------------+
| INDEPENDENTLY RECALCULATED BENCHMARK METRICS (POPULATION A: ALL-VALID, 1,325,600 ROWS)            |
+--------------------+-------------+-------------+-------------+-------------+-----------------------+
| MODEL ARCHITECTURE | MAE (Units) | RMSE (Units)| WAPE (%)    | MEAN BIAS   | DATA SOURCE           |
+--------------------+-------------+-------------+-------------+-------------+-----------------------+
| HGB EXP1 (Clipped) | 6.059811    | 10.952807   | 63.4300%    | +0.800496   | Independent Recalc    |
| HGB EXP1 (Reported)| 6.0598      | 10.9528     | 63.4300%    | +0.8005     | Original Metrics JSON |
| Baseline (Rolling) | 7.065843    | 12.654427   | 73.9605%    | +0.044303   | Stage 3.2 Benchmark   |
| Ridge (Stage 3.3)  | 7.390665    | 13.055424   | 77.3605%    | +3.192051   | Stage 3.3 Benchmark   |
+--------------------+-------------+-------------+-------------+-------------+-----------------------+
```

```
+----------------------------------------------------------------------------------------------------+
| INDEPENDENTLY RECALCULATED BENCHMARK METRICS (POPULATION B: ELIGIBLE, 1,102,601 ROWS)             |
+--------------------+-------------+-------------+-------------+-------------+-----------------------+
| MODEL ARCHITECTURE | MAE (Units) | RMSE (Units)| WAPE (%)    | MEAN BIAS   | DATA SOURCE           |
+--------------------+-------------+-------------+-------------+-------------+-----------------------+
| HGB EXP1 (Clipped) | 6.987033    | 11.872435   | 62.1510%    | +0.936401   | Independent Recalc    |
| HGB EXP1 (Reported)| 6.9870      | 11.8724     | 62.1510%    | +0.9364     | Original Metrics JSON |
| Baseline (Rolling) | 7.903208    | 13.590614   | 70.3005%    | -0.213434   | Stage 3.2 Benchmark   |
| Ridge (Stage 3.3)  | 8.318566    | 14.092801   | 73.9952%    | +3.554787   | Stage 3.3 Benchmark   |
+--------------------+-------------+-------------+-------------+-------------+-----------------------+
```

### 4.3 Discrepancy Accounting vs. Documented Tolerances
Discrepancies between CSV recalculations and reported metrics JSON values are bounded by $5.0 \times 10^{-5}$ (the theoretical half-error bound of four-decimal rounding on raw float model predictions):
- **All-Valid MAE Discrepancy:** $|6.059811 - 6.0598| = 1.10 \times 10^{-5} \le 5.0 \times 10^{-5}$ (**Within Tolerance**)
- **All-Valid RMSE Discrepancy:** $|10.952807 - 10.9528| = 6.65 \times 10^{-6} \le 5.0 \times 10^{-5}$ (**Within Tolerance**)
- **All-Valid WAPE Discrepancy:** $|0.6343004 - 0.6343| = 3.96 \times 10^{-7} \le 1.0 \times 10^{-5}$ (**Within Tolerance**)
- **All-Valid Bias Discrepancy:** $|0.8004956 - 0.8005| = 4.35 \times 10^{-6} \le 5.0 \times 10^{-5}$ (**Within Tolerance**)
- **Eligible MAE Discrepancy:** $|6.987033 - 6.9870| = 3.28 \times 10^{-5} \le 5.0 \times 10^{-5}$ (**Within Tolerance**)
- **Eligible RMSE Discrepancy:** $|11.872435 - 11.8724| = 3.51 \times 10^{-5} \le 5.0 \times 10^{-5}$ (**Within Tolerance**)
- **Eligible WAPE Discrepancy:** $|0.6215095 - 0.62151| = 4.87 \times 10^{-7} \le 1.0 \times 10^{-5}$ (**Within Tolerance**)
- **Eligible Bias Discrepancy:** $|0.9364009 - 0.9364| = 8.76 \times 10^{-7} \le 5.0 \times 10^{-5}$ (**Within Tolerance**)

### 4.4 Absolute Difference vs. Relative Percentage Error Reduction
- **Absolute WAPE Difference (Percentage Points):**
  - vs. Baseline: $73.96\% - 63.43\% = \mathbf{+10.53\text{ percentage points (pp)}}$
  - vs. Ridge: $77.36\% - 63.43\% = \mathbf{+13.93\text{ percentage points (pp)}}$
- **Relative Percentage Error Reduction:**
  - WAPE Reduction vs. Baseline: $\frac{73.9605 - 63.4300}{73.9605} \times 100\% = \mathbf{+14.24\%}$ relative error reduction
  - WAPE Reduction vs. Ridge: $\frac{77.3605 - 63.4300}{77.3605} \times 100\% = \mathbf{+18.01\%}$ relative error reduction
  - MAE Reduction vs. Baseline: $\frac{7.0658 - 6.0598}{7.0658} \times 100\% = \mathbf{+14.24\%}$ relative error reduction
  - MAE Reduction vs. Ridge: $\frac{7.3907 - 6.0598}{7.3907} \times 100\% = \mathbf{+18.01\%}$ relative error reduction

**Task C Verdict:** **PASSED.**

---

## 5. Task D — Strengthened Temporal Partition & Explicit Feature-Type Verification

### 5.1 Temporal Partition Sequence Audit
The full historical dataset [`ml/data/model_dataset_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/data/model_dataset_7d.csv) was inspected via chunked reading:

```
+----------------------------------------------------------------------------------------------------+
| TEMPORAL PARTITION SEQUENCE AUDIT                                                                  |
+------------------------------------+------------------+---------------------+----------------------+
| PARTITION INTERVAL                 | EXPECTED DATES   | OBSERVED DATES      | AUDIT STATUS         |
+------------------------------------+------------------+---------------------+----------------------+
| Training: 2025-12-13 to 2026-07-01 | 201 Consecutive  | 201 Consecutive     | PASSED (0 missing)   |
| Training Rows                      | 2,664,456        | 2,664,456           | PASSED (Exact Match) |
| Purge Interval: 2026-07-02..07-31  | 0 rows           | 0 rows              | PASSED (Clean Purge) |
| Validation: 2026-08-01 to 11-08    | 100 Consecutive  | 100 Consecutive     | PASSED (0 missing)   |
| Validation Rows                    | 1,325,600        | 1,325,600           | PASSED (Exact Match) |
| Unexpected / Unclassified Rows     | 0 rows           | 0 rows              | PASSED               |
+------------------------------------+------------------+---------------------+----------------------+
```

### 5.2 Explicit Feature-Type Verification Against Authoritative Metadata
Features were cross-verified against [`ml/features/feature_metadata.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/features/feature_metadata.json) and [`ml/reports/phase3_feature_safety_audit.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_feature_safety_audit.json):

```
+----------------------------------------------------------------------------------------------------+
| EXPLICIT FEATURE-TYPE AUDIT RESULTS                                                                |
+------------------------------------+------------------+---------------------+----------------------+
| FEATURE AUDIT CRITERION            | EXPECTED SPEC    | MODEL VALUE         | STATUS               |
+------------------------------------+------------------+---------------------+----------------------+
| Numerical Feature Count            | Exactly 55       | 55                  | PASSED (True)        |
| Categorical Feature Count          | Exactly 12       | 12                  | PASSED (True)        |
| Total Unique SAFE Features         | Exactly 67       | 67                  | PASSED (True)        |
| Numerical/Categorical Disjointness | isdisjoint()     | True (0 overlap)    | PASSED (True)        |
| Missing Features vs Metadata       | 0 missing        | [] (0 missing)      | PASSED (True)        |
| Unexpected Features vs Metadata    | 0 unexpected     | [] (0 unexpected)   | PASSED (True)        |
| Categorical Transformation Order   | Matches cat_cols | Exact Match         | PASSED (True)        |
| Categorical Indices in Estimator   | [55..66]         | [55..66]            | PASSED (True)        |
| Registry Order Match (safe_feat)   | Matches Registry | Exact Match (0 diff)| PASSED (True)        |
+------------------------------------+------------------+---------------------+----------------------+
```

### 5.3 Transformation Order Verification & Dual Convention Documentation
- `model.num_cols + model.cat_cols` contains exactly the same 67 features with no duplicates (`len == len(set) == 67`).
- Numerical and categorical feature counts are exactly 55 and 12.
- `categorical_indices == [55..66]` matches the design matrix layout.
- **Architectural Documentation:**
  - `model.safe_features` strictly preserves the authoritative Phase 3 registry order (where categorical features reside at indices `33..44`, matching `safe_feats_audit` with 0 diffs).
  - In contrast, the transform design matrix layout stacks `num_cols + cat_cols` (where categorical features reside at indices `55..66`, matching `categorical_indices=[55..66]`).
  - This dual convention accounts for the 34 positional differences between external registry order and internal matrix layout without affecting inference correctness or feature safety.

### 5.4 Exclusion of Conditional and Forbidden Features
- **Conditional Features:** All five conditional features (`outlet_average_daily_demand`, `average_selling_price_bdt`, `average_cost_price_bdt`, `average_restock_frequency_days`, `days_until_next_festival`) are verified absent from model predictors.
- **Forbidden Columns:** `outlet_id`, `product_id`, `forecast_origin_date`, `target_7d`, `target_30d`, and all eligibility flags are verified absent from model predictors.
- **Training Target:** Verified as `target_7d`.

### 5.5 Scope Limitation on Feature Leakage
> [!NOTE]
> Schema verification confirms that model predictors strictly match the 67 SAFE feature specification. However, schema audit alone does not prove that upstream feature engineering scripts (Phase 2) were entirely leak-free across all intermediate calculation steps.

**Task D Verdict:** **PASSED.**

---

## 6. Task E — Memory Measurement Correction

### 6.1 Removal of Unsupported Claims
The following statements from preliminary reports remain formally retracted:
- The claim that available system RAM remained above 4.2 GB throughout execution is **removed**.
- The claim that the post-preprocessing RSS increase was specifically caused by DataFrame chunks and string objects is **removed**.

### 6.2 Standardized Reporting of Historical Memory Measurements
```
+----------------------------------------------------------------------------------------------------+
| MEMORY MEASUREMENT CLASSIFICATION                                                                  |
+------------------------------------+-----------------------------+---------------------------------+
| METRIC NAME                        | AUDITED CLASSIFICATION      | RECORDED HISTORICAL VALUE       |
+------------------------------------+-----------------------------+---------------------------------+
| True Peak RSS During Fitting       | UNMONITORED_AND_UNAVAILABLE | Not measured by training script |
| Host Available RAM During Training | UNKNOWN                     | Not continuously polled         |
| Swap Activity During Training      | NOT VERIFIED                | Telemetry not captured          |
| Baseline Process RSS               | Historical Snapshot         | 156.50 MB                       |
| Post-Preprocessing Process RSS     | Historical Snapshot         | 4,445.41 MB                     |
| Post-Fitting Process RSS           | Historical Snapshot         | 1,750.64 MB                     |
| Final Process RSS                  | Historical Snapshot         | 3,482.72 MB                     |
| Initial Available RAM              | Snapshot at Start           | 5.68 GB                         |
+------------------------------------+-----------------------------+---------------------------------+
```

### 6.3 Technical Explanation of Measurements
- A process RSS snapshot captures resident heap memory at a single point in time. It does not measure the high-water mark (peak RSS) reached while background OpenMP threads were allocating Cython histogram bins.
- The 1,750.64 MB measurement recorded in `phase3_hgb_exp1_7d_metrics.json` was taken *after* `hgb.fit()` returned. It reflects residual process memory, not transient peak allocation.
- This post-hoc audit cannot reconstruct historical runtime memory telemetry. Original snapshot values are preserved as historical observations without modification to [`ml/reports/phase3_hgb_exp1_7d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp1_7d_metrics.json).

**Task E Verdict:** **PASSED** for memory reporting correction; **NOT VERIFIED** for historical peak memory.

---

## 7. Known Limitations & Documented Scope

1. **Synthetic Data Context:** Historical records originate from retail simulation models. Performance gains demonstrate algorithmic capability on this dataset but do not establish real-world commercial performance.
2. **Negative Prediction Clipping:** Unconstrained tree models generated 41,540 raw negative predictions (3.13% of validation rows, bounded between $[-7.94, 0.00]$). Non-negative clipping (`np.clip(p, 0, None)`) is required for planning.
3. **Serialization Rounding:** Predictions in CSV format are rounded to 4 decimal places, introducing a theoretical half-error bound of $\pm 0.00005$ units. All recalculations from CSV reflect this minor four-decimal rounding.
4. **Dual Ordering Convention:** The model preserves the authoritative Phase 3 Feature Safety Audit registry order on its `safe_features` attribute (matching `safe_feats_audit` with 0 differences), while constructing its internal design matrix with numerical columns first followed by categorical columns (`categorical_indices=[55..66]`).

---

## 8. Final Audit Recommendation & Strict Stopping Condition

### 8.1 Recommendation
The `EXP1_HGB_FULL_7D` experiment is **verified as computationally sound, reproducible, and compliant with all specified feature safety rules and estimator configurations**. It is authorized to serve as the nonlinear baseline for upcoming 7-day ablation experiments.

### 8.2 Strict Stopping Condition Adherence
- **EXP1 integrity audit is complete.**
- **NO further models have been trained.**
- **`EXP2_HGB_NO_INVENTORY`, `EXP3_HGB_ABSOLUTE_ERROR`, and all 30-day models remain unexecuted.**
- **Execution is stopped.** Standing by for explicit authorization before proceeding to the next stage.
