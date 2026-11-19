# BazarBondhu AI — Phase 3, Stage 3.5.1.3.1
# HGB Forecaster Compatibility and Inference Verification Report

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer  
**Stage:** Phase 3, Stage 3.5.1.3.1: HGB Forecaster Compatibility & Inference Verification  
**Audited Artifacts:**
- Forecaster Class Module: [`ml/models/forecaster.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/forecaster.py)
- Training Script: [`ml/scripts/train_hgb.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb.py)
- Serialized EXP1 Model: [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib)
- Validation Predictions Artifact: [`ml/predictions/hgb_exp1_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp1_validation_predictions_7d.csv)
- Primary Validation Dataset: [`ml/data/model_dataset_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/data/model_dataset_7d.csv)
- Baseline Ridge 7D Model: [`ml/models/7d/ridge_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/ridge_model.joblib)

**Execution Date:** November 17, 2026  
**Final Audit Verdict:** **`PASS`** (Empirically derived from all tests passing)

---

## 1. Executive Summary & Audit Conclusion

This audit report delivers an independent, empirical verification of the inference pipeline, serialized model components, schema compatibility, and input validation guards of the `EXP1_HGB_FULL_7D` demand forecaster.

All tests were executed on actual runtime objects, serialized model artifacts, and ground-truth validation data. The audit confirms that the serialized `HGBDemandForecaster` artifact faithfully reproduces the training pipeline, adheres to the 67 SAFE feature schema, accurately handles edge cases and invalid inputs, preserves Ridge inference safety, and replicates historical validation predictions with zero error after accounting for standard 4-decimal CSV serialization rounding.

```
+--------------------------------------------------------------------------------------------------------------------+
| COMPATIBILITY & INFERENCE VERIFICATION MATRIX                                                                      |
+----+----------------------------------+---------------+----------------+-------------------------------------------+
| #  | VERIFICATION AREA                | SPECIFICATION | AUDIT VERDICT  | EMPIRICAL EVIDENCE & SUMMARY              |
+----+----------------------------------+---------------+----------------+-------------------------------------------+
| 1  | Training Pipeline Parity         | Identical     | PASSED         | Both use OrdinalEncoder(-1) & num-first   |
|    |                                  | Preprocessing |                | matrix stacking (num 0..54, cat 55..66)   |
| 2  | Serialized Encoder Integrity     | Fitted, 12 in | PASSED         | hasattr(categories_) = True; 12 in/12 cat;|
|    |                                  | 165 levels    |                | Discovered levels correspond to cat_cols  |
| 3  | Serialized HGB Estimator         | Fitted, 67 in | PASSED         | check_is_fitted = True; 100 trees;        |
|    |                                  | Cat idx 55..66|                | categorical_features = [55..66] exact     |
| 4  | Feature Schema & Partition       | 67 SAFE,      | PASSED         | 55 num + 12 cat = 67 SAFE features;       |
|    |                                  | Disjoint      |                | Non-overlapping, complete partition; 0 dup|
| 5  | Actual 1,000-Row Reproducibility | <= 5e-5 diff  | PASSED         | Aligned keys; raw/clip diff <= 4.9979e-5; |
|    |                                  | Exact 0.0 rnd |                | Exact match after 4-dec rounding (0.0000) |
| 6  | Controlled Input Validation (11) | Clear errors, | PASSED         | All 11 test cases passed: NaNs, Infs,     |
|    |                                  | No imputation |                | non-numeric, overflow, unknown cat, order |
| 7  | Ridge Regression Safety          | Zero regression| PASSED        | Sparse CSR output, finiteness, reordering,|
|    |                                  | on Ridge      |                | and invalid input rejection verified      |
+----+----------------------------------+---------------+----------------+-------------------------------------------+
|    | FINAL AUDIT VERDICT              | ALL CRITERIA  | PASS           | ALL COMPATIBILITY & REPRODUCIBILITY PROVEN|
+----+----------------------------------+---------------+----------------+-------------------------------------------+
```

---

## 2. Inspection of the Training Pipeline (`ml/scripts/train_hgb.py`)

A rigorous review of [`ml/scripts/train_hgb.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/train_hgb.py) establishes:

1. **Selection of Numerical and Categorical Columns:**
   - Evaluates [`ml/reports/phase3_feature_safety_audit.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_feature_safety_audit.json) to extract exactly the 67 features classified as `SAFE`.
   - Cross-references [`ml/features/feature_metadata.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/features/feature_metadata.json): features with `data_type` in `["string", "object", "category"]` are designated as categorical (**12 features**); all other features are designated as numerical (**55 features**).
2. **Fitting the `OrdinalEncoder`:**
   - Instantiated as `OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)`.
   - Fitted strictly on the 2,664,456 training rows (`df_train[cat_cols].astype(str)`).
3. **Missing Categorical Values in Training:**
   - Empirical inspection of the 2,664,456 training rows confirmed **exactly 0 missing values** across all 12 categorical columns.
4. **Encoding of Unknown Categories:**
   - Configured with `unknown_value=-1`. Any unobserved category string encountered during inference is mapped to `-1.0`.
5. **Configuration of HGB Categorical Feature Indices:**
   - Configured dynamically as `cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))`, resulting in indices `[55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66]`.
   - Passed explicitly to `HistGradientBoostingRegressor(categorical_features=cat_indices)`.
6. **Feature Transformation Order:**
   - Numerical columns are extracted in `num_cols` order and cast to `np.float32` (indices `0..54`).
   - Categorical columns are encoded via `encoder.transform()` and cast to `np.float32` (indices `55..66`).
   - Combined via `np.column_stack([num_matrix, cat_encoded])`.
7. **Identity Between Training Pipeline and `HGBDemandForecaster.transform()`:**
   - Confirmed: `HGBDemandForecaster.transform()` mirrors the training script's feature extraction, encoding, float32 casting, and column concatenation identically.

---

## 3. Verification of the Serialized EXP1 Model

The serialized model artifact [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib) was deserialized via `joblib.load()` and inspected:

### 3.1 OrdinalEncoder Verification
- **Fitted State:** `hasattr(model.encoder, "categories_")` is **`True`**.
- **Input Dimension:** `model.encoder.n_features_in_ == 12`, exactly matching `len(model.cat_cols)`.
- **Expected Inputs:** Exactly 12 categorical features in matching order:
  `['outlet_type', 'business_size', 'division', 'district', 'area_type', 'category', 'subcategory', 'brand', 'unit', 'package_size', 'perishable_status', 'storage_type']`.
- **Discovered Vocabulary Size:** Exactly 165 total discrete categories across the 12 features (max per feature: 49 in `package_size`, min: 2 in `perishable_status`).
- **Unknown Category Handling:** `model.encoder.unknown_value == -1.0` and `model.encoder.handle_unknown == "use_encoded_value"`, matching training specifications.

### 3.2 HistGradientBoostingRegressor Verification
- **Fitted State:** Verified via `sklearn.utils.validation.check_is_fitted(model.hgb)`. Model contains 100 boosting iterations (`n_iter_ == 100`, 100 decision trees).
- **Total Input Width:** `model.hgb.n_features_in_ == 67`, matching `55 + 12 = 67`.
- **Categorical Feature Indices:** `list(model.hgb.categorical_features) == [55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66]`.
- **Metadata Agreement:** `model.metadata["categorical_indices"]` matches the estimator's actual `categorical_features` parameter with zero divergence.

### 3.3 Feature Schema Consistency
- **Total SAFE Features:** Exactly 67 unique features (`len(model.safe_features) == 67`, `len(set(model.safe_features)) == 67`).
- **Numerical vs. Categorical Split:** Exactly 55 numerical features and 12 categorical features.
- **Partition Completeness:** `set(model.num_cols).isdisjoint(set(model.cat_cols))` is **`True`**; `set(model.num_cols + model.cat_cols) == set(model.safe_features)` is **`True`**.
- **Transformation Order:** Columns `0..54` are numerical; columns `55..66` are categorical.

---

## 4. Actual Validation Inference Test (1,000 Actual Validation Rows)

The first 1,000 actual chronological validation observations (`2026-08-01` to `2026-11-08`) were loaded directly from [`ml/data/model_dataset_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/data/model_dataset_7d.csv).

### 4.1 Key Alignment Verification
- Aligned against the first 1,000 rows of [`ml/predictions/hgb_exp1_validation_predictions_7d.csv`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/hgb_exp1_validation_predictions_7d.csv) using `outlet_id`, `product_id`, and `forecast_origin_date`.
- **Key Alignment Status:** **100% Exact Match** (`key_align == True`, 0 mismatched keys across all 1,000 rows).

### 4.2 Transformed Matrix Audit
- **Transformed Shape:** Exactly `(1000, 67)`.
- **Data Type:** `float32`.
- **Matrix Finiteness:** `np.all(np.isfinite(X)) == True` (0 non-finite values).

### 4.3 Prediction Comparison vs. Original Prediction Artifact
Predictions generated from the reloaded model were compared against the original CSV values:

```
+----------------------------------------------------------------------------------------------------+
| INFERENCE REPRODUCIBILITY RESULTS (1,000 VALIDATION ROWS)                                          |
+------------------------------------+------------------+---------------------+----------------------+
| METRIC                             | THEORETICAL BOUND| OBSERVED VALUE      | AUDIT STATUS         |
+------------------------------------+------------------+---------------------+----------------------+
| Raw Forecast Max Absolute Diff     | <= 5.0001e-05    | 4.99786850e-05      | PASSED               |
| Raw Forecast Mean Absolute Diff    | —                | 2.59582249e-05      | PASSED               |
| Clipped Forecast Max Absolute Diff | <= 5.0001e-05    | 4.99786850e-05      | PASSED               |
| Clipped Forecast Mean Absolute Diff| —                | 2.47773930e-05      | PASSED               |
| Max Diff After 4-Decimal Rounding  | Exactly 0.0      | 0.00000000e+00      | PASSED (Exact Match) |
+------------------------------------+------------------+---------------------+----------------------+
```

The maximum observed difference ($4.99786850 \times 10^{-5}$) is strictly bounded by the theoretical half-error of 4-decimal serialization ($\frac{10^{-4}}{2} = 5.0 \times 10^{-5}$). Rounding the reloaded float64 predictions to 4 decimal places results in **exact equality (0.00000000e+00)** across all 1,000 rows.

---

## 5. Input Validation Controlled Test Suite

The inference engine was evaluated against 11 controlled test scenarios:

```
+----------------------------------------------------------------------------------------------------+
| CONTROLLED INPUT VALIDATION SUITE RESULTS                                                          |
+----+--------------------------------+----------------------------+---------------+-----------------+
| #  | TEST SCENARIO                  | EXPECTED BEHAVIOR          | AUDIT VERDICT | DETAILS         |
+----+--------------------------------+----------------------------+---------------+-----------------+
| 1  | Valid 67-Feature Input         | Successful transformation  | PASSED        | Shape (5, 67)   |
| 2  | Missing Numerical Feature      | Clear KeyError             | PASSED        | Missing col ID  |
| 3  | Missing Categorical Feature    | Clear KeyError             | PASSED        | Missing col ID  |
| 4  | Numerical NaN Value            | ValueError rejection       | PASSED        | Identifies col  |
| 5  | Numerical Inf / -Inf Value     | ValueError rejection       | PASSED        | Finiteness guard|
| 6  | Non-Numeric String in Num Col  | Clear ValueError with col  | PASSED        | Isolates col ID |
| 7  | Float32 Overflow Value (1e39)  | ValueError rejection       | PASSED        | Overflow to Inf |
| 8  | Missing Categorical Value      | Handled as 'missing' -> -1 | PASSED        | Encodes to -1.0 |
| 9  | Unknown Categorical Value      | Handled as unknown -> -1   | PASSED        | Encodes to -1.0 |
| 10 | Extra ID/Date/Target Columns   | Safely ignored             | PASSED        | Max diff = 0.0  |
| 11 | Reordered DataFrame Columns    | Identical predictions      | PASSED        | Max diff = 0.0  |
+----+--------------------------------+----------------------------+---------------+-----------------+
```

### Key Validation Findings
- **Column-Specific Diagnostics (Test 6):** Passing a string to `sales_lag_7d` produced:
  `ValueError: Numerical features contain invalid non-numeric values in column(s) ['sales_lag_7d']: could not convert string to float: 'corrupt_string_val'. All numerical predictors must be finite and convertible to float32 without imputation.`
- **Float32 Overflow Protection (Test 7):** Values exceeding $3.4 \times 10^{38}$ overflow to `inf` during float32 casting, which is immediately intercepted by the finiteness validation check.
- **Categorical Missing/Unknown Parity (Tests 8 & 9):** Missing and unobserved categorical entries are consistently mapped to `-1.0`, matching the native missing-value routing of `HistGradientBoostingRegressor`.
- **Column Order Invariance (Test 11):** Permuting the input DataFrame columns produced identical predictions with **0.0000 maximum difference**.

---

## 6. Ridge Regression Regression-Safety Verification

The shared [`ml/models/forecaster.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/forecaster.py) module houses both `HGBDemandForecaster` and `RidgeDemandForecaster`. To confirm that forecaster updates introduced zero regression into linear model inference, `RidgeDemandForecaster` was audited:

```
+----------------------------------------------------------------------------------------------------+
| RIDGE REGRESSION INFERENCE COMPATIBILITY & SAFETY AUDIT                                            |
+----+--------------------------------+----------------------------+---------------+-----------------+
| #  | VERIFICATION ITEM              | EXPECTED BEHAVIOR          | AUDIT VERDICT | DETAILS         |
+----+--------------------------------+----------------------------+---------------+-----------------+
| 1  | Valid Input Transformation     | Sparse CSR matrix output   | PASSED        | Shape (5, 220)  |
| 2  | Missing Numerical Feature      | Clear KeyError             | PASSED        | Rejected cleanly|
| 3  | Non-Finite Numerical Input     | Clear ValueError           | PASSED        | Rejected cleanly|
| 4  | Prediction Finiteness          | All finite outputs         | PASSED        | 0 non-finite    |
| 5  | Extra Columns Ignored          | Max diff = 0.0 vs baseline | PASSED        | Max diff = 0.0  |
| 6  | Reordered Input Columns        | Max diff = 0.0 vs baseline | PASSED        | Max diff = 0.0  |
+----+--------------------------------+----------------------------+---------------+-----------------+
```

Linear Ridge inference remains completely operational and unaffected.

---

## 7. Source Code Changes & Justifications

In [`ml/models/forecaster.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/forecaster.py), three justified improvements were implemented:

1. **Explicit Transformed-Matrix Finiteness Validation:**
   In `HGBDemandForecaster.transform()`, added:
   ```python
   if not np.all(np.isfinite(X)):
       raise ValueError(
           "Transformed feature matrix contains non-finite values (NaN or Inf). "
           "All features must be finite before estimator prediction."
       )
   ```
   *Justification:* Directly satisfies Section 5's requirement that the transformed matrix is formally verified finite before being passed to `self.hgb.predict(X)`.

2. **Column-Specific Non-Numeric Error Reporting:**
   In `validate_inputs()` of both `RidgeDemandForecaster` and `HGBDemandForecaster`, wrapped `df_num.to_numpy(dtype=np.float32)` in a try/except that iterates over `num_cols` to identify the specific corrupted column(s).
   *Justification:* Prevents unhelpful, opaque conversion exceptions by giving callers immediate clarity on which column contains corrupted data, while preserving zero-imputation guarantees and fast C-level conversion for valid inputs.

3. **Explicit Documentation of Extra Columns Behavior:**
   Documented in class docstrings that extra columns beyond required predictors (such as `outlet_id`, `product_id`, `forecast_origin_date`, target columns) are explicitly ignored.
   *Justification:* Clarifies pipeline compatibility contracts and confirms why rejecting extra columns would break existing evaluation scripts.

---

## 8. Artifact Protection & Non-Production Readiness Disclaimer

1. **Artifact Protection Verified:**
   - No models were retrained (`EXP1`, `EXP2`, `EXP3`, and 30-day models remain untouched).
   - Saved model weights and parameters in [`ml/models/7d/hgb_exp1_full_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp1_full_model.joblib) were preserved without modification.
   - Prediction CSVs, metrics JSON files, and historical datasets remain byte-for-byte intact.
2. **Non-Production Readiness Disclaimer:**
   This forecaster implementation has been validated for experimental integrity, schema consistency, and research reproducibility within the BazarBondhu AI evaluation pipeline. It is not certified as production-ready. Further production hardening is deferred to deployment phases.

---

## 9. Final Audit Verdict

Based on 100% passing results across all encoder checks, estimator checks, 1,000-row validation inference reproducibility, 11 controlled input validation tests, and Ridge regression safety tests:

**FINAL VERDICT: `PASS`**
