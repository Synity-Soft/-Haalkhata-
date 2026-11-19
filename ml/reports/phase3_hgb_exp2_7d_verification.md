# BazarBondhu AI — Phase 3, Stage 3.6.1
# EXP2 Technical Integrity & Final Audit Closure Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer & Independent ML Auditor  
**Stage:** Phase 3, Stage 3.6.1: EXP2 Final Audit Closure  
**Audited Experiment:** `EXP2_HGB_NO_INVENTORY_7D`  
**Execution Date:** November 17, 2026  
**Audited Model Artifact:** [`ml/models/7d/hgb_exp2_no_inventory_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp2_no_inventory_model.joblib) (0.17 MB)  
**Audited Predictions CSV:** [`ml/predictions/hgb_exp2_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp2_validation_predictions_7d.csv) (81.73 MB, 1,325,600 rows, 10 columns)  
**Audited Metrics JSON:** [`ml/reports/phase3_hgb_exp2_7d_metrics.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp2_7d_metrics.json)  
**Audit Verification JSON:** [`ml/reports/phase3_hgb_exp2_7d_verification.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp2_7d_verification.json)  
**Independent Audit Script:** [`ml/scripts/verify_hgb_exp2.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/verify_hgb_exp2.py)  

---

## 1. Executive Summary & Final Audit Verdict

This audit report delivers the final empirical verification and audit closure for the `EXP2_HGB_NO_INVENTORY_7D` experiment, resolving all tasks mandated in Stage 3.6.1:
1. **Empirical Encoder Training Provenance (Task 1):** Reconstructed expected category vocabularies directly and exclusively from the 2,664,456 training rows of [`ml/data/model_dataset_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/data/model_dataset_7d.csv), applying the identical missing-value normalization (`fillna("missing").astype(str)`). Across all 12 categorical features, reconstructed training vocabularies match the serialized model's `encoder.categories_` with **100% identity in elements, counts, and lexicographical sequence** (0 missing categories, 0 unexpected categories).
2. **Exact Source Partition Row Counts (Task 2):** Scanned all 3,990,056 rows of `model_dataset_7d.csv` to independently verify:
   - Training Rows (`2025-12-13` to `2026-07-01`): **2,664,456 rows** across 201 consecutive dates.
   - Purge Rows (`2026-07-02` to `2026-07-31`): **0 rows** (empirically scanned, zero hardcoding).
   - Validation Rows (`2026-08-01` to `2026-11-08`): **1,325,600 rows** across 100 consecutive dates.
3. **Eligibility Data Validation (Task 3):** Verified `is_eligible_acc_5of7` exists with 0 nulls, contains strictly binary values in `{0, 1}`, and partitions the validation data into exactly **1,102,601 eligible rows** and **1,325,600 total valid rows**.
4. **Empty-Population Metric Guard (Task 4):** Evaluated `independent_compute_metrics()` on empty datasets, confirming that it returns `count = 0` and `MAE = "UNDEFINED"`, `RMSE = "UNDEFINED"`, `WAPE = "UNDEFINED"`, `bias = "UNDEFINED"` without false zero-error reporting.

No models were retrained, no historical EXP1 artifacts were overwritten, and all Phase 1/Phase 2 baselines remain strictly preserved.

### Overall Audit Verdict
**FINAL AUDIT VERDICT: PASSED (20 / 20 INDEPENDENT CHECKS VERIFIED)**

```
+--------------------------------------------------------------------------------------------------------------------+
| EXP2 TECHNICAL INTEGRITY AUDIT MATRIX (20 INDEPENDENT CHECKS)                                                      |
+----+---------------------------------------+---------------+----------------+--------------------------------------+
| #  | AUDIT CHECK                           | SPECIFICATION | AUDIT VERDICT  | EMPIRICAL EVIDENCE & SUMMARY         |
+----+---------------------------------------+---------------+----------------+--------------------------------------+
| 1  | Exact 52-Feature Membership & Order   | 52 unique     | PASSED         | Matches authoritative registry order |
| 2  | Exact Num (40) & Cat (12) Partition   | Disjoint sets | PASSED         | 40 numerical, 12 categorical         |
| 3  | Estimator Input Count = 52            | n_in == 52    | PASSED         | hgb.n_features_in_ = 52              |
| 4  | Actual Categorical Indices [40..51]   | Exact match   | PASSED         | hgb.categorical_features = [40..51]  |
| 5  | Encoder Fitted State & Unknown Config | Train-fitted  | PASSED         | 12 vocabs; unk=-1, use_encoded_value |
| 6  | Empirical Encoder Training Provenance | Train-only    | PASSED         | 12/12 features match training exactly|
| 7  | Exact 15 Inventory Features Excluded  | 0 present     | PASSED         | 0 excluded features found in model   |
| 8  | Conditional & Forbidden Features      | 0 present     | PASSED         | 0 conditional, 0 forbidden columns   |
| 9  | Full Date Sequences from Source Data  | Consecutive   | PASSED         | 201 train dates, 100 val dates       |
| 10 | Exact Source Partition Row Counts     | Exact match   | PASSED         | Train=2.66M, Purge=0, Val=1.32M      |
| 11 | Forecast Key Uniqueness               | 0 duplicates  | PASSED         | Pred dups = 0; Source val dups = 0   |
| 12 | 100% Validation Key Coverage          | 1.3256M keys  | PASSED         | Exact 1:1 match with source dataset  |
| 13 | Target Equality After Key Alignment   | Max diff = 0.0| PASSED         | diff_base = 0.0; diff_ridge = 0.0    |
| 14 | Embedded Benchmark Prediction Match   | Max diff = 0.0| PASSED         | Base = 0.0, Ridge = 0.0, EXP1 = 0.0  |
| 15 | Prediction Column Finiteness          | 0 non-finite  | PASSED         | 0 NaN, 0 Inf across all 6 num cols   |
| 16 | Clipping Consistency Across Rows      | Max diff <=1e-4| PASSED        | diff = 0.0000; clipped min >= 0.0    |
| 17 | Keyed Reproducibility (1,000 rows)    | Diff <= 5e-5  | PASSED         | Raw diff <= 4.993e-5; 4-dec diff =0.0|
| 18 | Eligibility Data Validation           | Binary {0,1}  | PASSED         | 1,102,601 eligible / 1,325,600 total |
| 19 | Independent Metric Recalculation      | Float64 recalc| PASSED         | Recalculated metrics match JSON <=5e-5|
| 20 | Honest Memory Reporting Classifications| Standardized | PASSED         | Peak RSS marked UNMONITORED_...      |
+----+---------------------------------------+---------------+----------------+--------------------------------------+
|    | OVERALL INTEGRITY VERDICT             | ALL 20 CHECKS | PASSED         | FULLY VERIFIED & METHODOLOGICALLY SOUND|
+----+---------------------------------------+---------------+----------------+--------------------------------------+
```

---

## 2. Task 1: Empirical Encoder Training Provenance Verification

To independently prove that `forecaster.encoder` was fitted strictly on training observations without validation contamination:
1. The 12 categorical features were scanned exclusively from the training window (`2025-12-13` to `2026-07-01`) of `model_dataset_7d.csv`.
2. The exact missing-value normalization (`fillna("missing").astype(str)`) was applied.
3. Unique categories per feature were collected and sorted lexicographically (matching scikit-learn's deterministic `OrdinalEncoder` ordering).
4. Each reconstructed category list was compared against `forecaster.encoder.categories_`:

```
+--------------------------------------------------------------------------------------------------------------------+
| EMPIRICAL CATEGORICAL VOCABULARY PROVENANCE AUDIT                                                                  |
+----------------------+--------------------+-------------------+--------------------+------------------+------------+
| FEATURE NAME         | RECONSTRUCTED SIZE | SAVED ENCODER SIZE| MISSING CATEGORIES | EXTRA CATEGORIES | ORDER MATCH|
+----------------------+--------------------+-------------------+--------------------+------------------+------------+
| outlet_type          | 3 categories       | 3 categories      | None               | None             | Exact (Yes)|
| business_size        | 5 categories       | 5 categories      | None               | None             | Exact (Yes)|
| division             | 12 categories      | 12 categories     | None               | None             | Exact (Yes)|
| district             | 12 categories      | 12 categories     | None               | None             | Exact (Yes)|
| area_type            | 9 categories       | 9 categories      | None               | None             | Exact (Yes)|
| category             | 25 categories      | 25 categories     | None               | None             | Exact (Yes)|
| subcategory          | 29 categories      | 29 categories     | None               | None             | Exact (Yes)|
| brand                | 10 categories      | 10 categories     | None               | None             | Exact (Yes)|
| unit                 | 7 categories       | 7 categories      | None               | None             | Exact (Yes)|
| package_size         | 49 categories      | 49 categories     | None               | None             | Exact (Yes)|
| perishable_status    | 2 categories       | 2 categories      | None               | None             | Exact (Yes)|
| storage_type         | 2 categories       | 2 categories      | None               | None             | Exact (Yes)|
+----------------------+--------------------+-------------------+--------------------+------------------+------------+
```

**Provenance Finding:** Across all 12 categorical features (165 total discrete levels), the reconstructed training-partition vocabularies match the serialized model's encoder **identically**. No validation categories entered the encoder vocabulary. Training-only provenance is **empirically proven**.

---

## 3. Task 2: Exact Source Partition Row Counts & Sequence Verification

During the chunked dataset scan across all 3,990,056 rows of `model_dataset_7d.csv`, chronological partition bounds and row counts were verified:

```
+----------------------------------------------------------------------------------------------------+
| SOURCE DATASET PARTITION SCAN RESULTS                                                              |
+------------------------------------+------------------+---------------------+----------------------+
| PARTITION INTERVAL                 | EXPECTED SPEC    | EMPIRICAL MEASURED  | AUDIT VERDICT        |
+------------------------------------+------------------+---------------------+----------------------+
| Training: 2025-12-13 to 2026-07-01 | 2,664,456 rows   | 2,664,456 rows      | PASSED (Exact Match) |
| Training Consecutive Dates         | 201 dates        | 201 dates           | PASSED (0 missing)   |
| Purge Interval: 2026-07-02..07-31  | 0 rows           | 0 rows              | PASSED (Clean Purge) |
| Validation: 2026-08-01 to 11-08    | 1,325,600 rows   | 1,325,600 rows      | PASSED (Exact Match) |
| Validation Consecutive Dates       | 100 dates        | 100 dates           | PASSED (0 missing)   |
| Total Source Dataset Rows          | 3,990,056 rows   | 3,990,056 rows      | PASSED (Exact Match) |
+------------------------------------+------------------+---------------------+----------------------+
```

Zero purge rows were verified empirically from raw records, completely eliminating any hardcoded assertions.

---

## 4. Task 3 & Task 4: Eligibility Data Validation & Metric Computation Safeguards

### 4.1 Eligibility Data Validation
- **Column Presence:** `is_eligible_acc_5of7` confirmed present in `hgb_exp2_validation_predictions_7d.csv`.
- **Missing Value Audit:** Exactly **0 missing values** (`isna().sum() == 0`).
- **Binary Value Set:** `unique()` values strictly belong to `{0, 1}`.
- **Population Partitioning:**
  - Eligible Observations (`is_eligible_acc_5of7 == 1`): Exactly **1,102,601 rows** (83.18% of validation set).
  - Ineligible Observations (`is_eligible_acc_5of7 == 0`): Exactly **222,999 rows** (16.82% of validation set).
  - Total Valid Observations: Exactly **1,325,600 rows**.

### 4.2 Empty-Population & Zero-Target Guards
The independent metric calculator [`ml/scripts/verify_hgb_exp2.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/verify_hgb_exp2.py) was enhanced to guard against empty slices:
- Empty population input (`n == 0`) returns:
  `{"count": 0, "mae": "UNDEFINED", "rmse": "UNDEFINED", "wape": "UNDEFINED", "bias": "UNDEFINED"}`.
- Zero actual target sum ($\sum y_\text{true} = 0$) returns `wape: "UNDEFINED"` to prevent numerical division by zero.

### 4.3 Float64 Recalculation Results
```
+----------------------------------------------------------------------------------------------------+
| INDEPENDENT RECALCULATION VS. REPORTED METRICS                                                     |
+------------------------------------+---------------------+--------------------+--------------------+
| METRIC                             | INDEPENDENT RECALC  | REPORTED IN JSON   | DISCREPANCY        |
+------------------------------------+---------------------+--------------------+--------------------+
| All-Valid MAE (Units)              | 6.13397058          | 6.13397060         | 1.73e-08 (Passed)  |
| All-Valid RMSE (Units)             | 11.04723843         | 11.04723840        | 3.10e-08 (Passed)  |
| All-Valid WAPE (%)                 | 64.206292%          | 64.206292%         | 1.81e-09 (Passed)  |
| All-Valid Mean Bias                | +0.01854402         | +0.01854396        | 5.32e-08 (Passed)  |
| Eligible MAE (Units)               | 6.99022698          | 6.99022693         | 4.97e-08 (Passed)  |
| Eligible RMSE (Units)              | 11.94487598         | 11.94487594        | 3.96e-08 (Passed)  |
| Eligible WAPE (%)                  | 62.179364%          | 62.179364%         | 4.42e-09 (Passed)  |
| Eligible Mean Bias                 | -0.07890056         | -0.07890066        | 1.03e-07 (Passed)  |
+------------------------------------+---------------------+--------------------+--------------------+
```

---

## 5. Methodological Distinctions, Assumptions & Limitations

1. **Synthetic Data Context:** Historical data originate from retail simulation models. Performance gains demonstrate algorithmic capability on this dataset but do not establish real-world commercial performance.
2. **Observed Sales vs. Unconstrained Demand:** The training and evaluation target (`target_7d`) represents **observed recorded sales**, which can be censored by historical stockouts. It does not represent verified, unconstrained true customer demand.
3. **Overlapping Forecast Windows:** **Validation records feature overlapping 7-day forecast windows across consecutive daily forecast origin dates and do not constitute independent statistical trials.** Standard statistical significance tests that assume independent and identically distributed (i.i.d.) observations must not be applied.
4. **No Causal Claims:** This ablation experiment demonstrates predictive association within this specific feature set and dataset. It does not prove that inventory features are universally irrelevant in live commercial retail environments.
5. **Memory Telemetry Honesty:** Memory telemetry adheres to honest audit standards:
   - True peak RSS during fit: `UNMONITORED_AND_UNAVAILABLE`
   - Host available RAM throughout training: `UNKNOWN`
   - Swap activity during training: `NOT VERIFIED`

---

## 6. Deliverable Artifact Links & Final Audit Conclusion

- **Independent Verification Script:** [`ml/scripts/verify_hgb_exp2.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/verify_hgb_exp2.py)
- **Machine-Readable Verification JSON:** [`ml/reports/phase3_hgb_exp2_7d_verification.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp2_7d_verification.json)
- **Comprehensive Markdown Audit Report:** [`ml/reports/phase3_hgb_exp2_7d_verification.md`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp2_7d_verification.md)
- **Technical Benchmark Report:** [`ml/reports/phase3_hgb_exp2_7d_report.md`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_hgb_exp2_7d_report.md)
- **Model Artifact:** [`ml/models/7d/hgb_exp2_no_inventory_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp2_no_inventory_model.joblib)
- **Validation Predictions Artifact:** [`ml/predictions/hgb_exp2_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp2_validation_predictions_7d.csv)

### Final Audit Conclusion
**The `EXP2_HGB_NO_INVENTORY_7D` experiment is fully verified, reproducible, computationally sound, and compliant with all experimental design constraints and feature safety rules.** All audit checks have passed.

### Adherence to Strict Stopping Condition
- **EXP2 audit closure is 100% complete.**
- **NO further models have been trained.**
- **`EXP3_HGB_ABSOLUTE_ERROR` and all 30-day models remain unexecuted.**
- **Execution is stopped.** Standing by for explicit authorization before proceeding to the next stage.
