# BazarBondhu AI — Phase 4.1
# Inference Pipeline Risk Register & Safeguards Matrix

**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Role:** Senior Machine Learning Engineer  
**Stage:** Phase 4.1: Inference Architecture Design & Technical Inspection  
**Date:** November 17, 2026  
**Repository Working Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  

---

## 1. Executive Summary & Classification Methodology

This Risk Register identifies, analyzes, and categorizes technical, statistical, operational, and data risks associated with transitioning the selected BazarBondhu AI demand forecasting models (`HGB_EXP3_ABSOLUTE_ERROR_7D` and `HGB_ABSOLUTE_ERROR_30D`) from offline training artifacts into an online inference pipeline.

Risks are categorized into three distinct operational tiers:
- **Category A — Resolved Risks:** Risks already mitigated and mathematically verified in Phase 3.
- **Category B — Risks Requiring Implementation Safeguards:** Risks manageable through engineering safeguards within the upcoming FastAPI / inference pipeline implementation.
- **Category C — Risks Requiring Additional Data or Business Policy Decisions:** Risks that cannot be solved purely through code and require product, domain, or data governance decisions.

```
+-------------------------------------------------------------------------------------------------------------------+
| RISK SEVERITY & STATUS SUMMARY MATRIX                                                                             |
+----------+-------------------------------------------------------+---------------+--------------------------------+
| RISK ID  | RISK DESCRIPTION                                      | RISK TIER     | CURRENT STATUS / SAFEGUARD     |
+----------+-------------------------------------------------------+---------------+--------------------------------+
| RISK-A1  | Feature ordering divergence during inference          | Category A    | RESOLVED (Wrapper enforcement) |
| RISK-A2  | Accidental leakage of conditional or future features  | Category A    | RESOLVED (Strict 67 SAFE list) |
| RISK-A3  | Cross-horizon model/prediction contamination          | Category A    | RESOLVED (Decoupled slots)     |
| RISK-A4  | Negative raw prediction excursions                    | Category A    | RESOLVED (Embedded clipping)   |
| RISK-A5  | Corrupted or missing model artifact loading           | Category A    | RESOLVED (Startup validation)  |
| RISK-B1  | Training-serving skew in rolling sales aggregations   | Category B    | SAFEGUARD SPECIFIED            |
| RISK-B2  | Novel / unknown categorical values at runtime         | Category B    | SAFEGUARD SPECIFIED            |
| RISK-B3  | Missing / null numerical predictors at runtime        | Category B    | SAFEGUARD SPECIFIED            |
| RISK-B4  | Calendar & festival boundary shifts (Lunar calendar)  | Category B    | SAFEGUARD SPECIFIED            |
| RISK-B5  | Database query latency during single-item inference   | Category B    | SAFEGUARD SPECIFIED            |
| RISK-C1  | Cold-start outlets & new product introductions        | Category C    | REQUIRES BUSINESS DECISION     |
| RISK-C2  | Demand censoring caused by historical stockouts       | Category C    | REQUIRES BUSINESS DECISION     |
| RISK-C3  | Asymmetric retail inventory costs (Spike vs Wastage)  | Category C    | REQUIRES BUSINESS DECISION     |
| RISK-C4  | Unrecorded store closures (Hartals / Renovations)     | Category C    | REQUIRES DATA FEED             |
+----------+-------------------------------------------------------+---------------+--------------------------------+
```

---

## 2. Category A: Resolved Risks (Verified in Phase 3)

### Risk A1: Feature Ordering Divergence Between Training and Serving
- **Failure Mode:** In pandas and scikit-learn, passing a DataFrame with columns in a different order from the training design matrix results in silent misattribution of features to tree splits, causing catastrophic prediction errors without raising exceptions.
- **Resolution in Artifact:** The custom `HGBDemandForecaster` class in [`ml/models/forecaster.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/forecaster.py) intercepts all inference calls. Its `validate_inputs()` method explicitly re-indexes input columns using `self.num_cols` (0..54) and `self.cat_cols` (55..66), guaranteeing identical matrix layout regardless of raw DataFrame column ordering.
- **Audit Verification:** Verified in Stage 3.9 Check 2 and Check 10. Max discrepancy across 1,000 randomized columns was $0.0$.

### Risk A2: Accidental Inclusion of CONDITIONAL or Future Leakage Features
- **Failure Mode:** Pre-aggregations in operational databases frequently compute current-day averages (`outlet_average_daily_demand`) or use current-day pricing (`average_selling_price_bdt`) that violate strict temporal boundaries.
- **Resolution in Artifact:** The 67 SAFE feature schema strictly excludes all 5 CONDITIONAL features and all target/eligibility/future telemetry. The model wrapper raises a `KeyError` if any required feature is missing and silently drops non-SAFE features without passing them to the tree.
- **Audit Verification:** Verified in Stage 3.9 Check 6 and Check 7.

### Risk A3: Cross-Horizon Model or Prediction Contamination
- **Failure Mode:** Serving a 7-day model output for a 30-day forecast request (or vice versa), leading to severe stockouts or overstocking due to a $4\times$ volume mismatch ($9.55$ vs $41.11$ units).
- **Resolution in Artifact:** `model.horizon` and `model.target_col` are hardcoded inside the serialized artifact metadata. The inference engine verifies `request.horizon == model.horizon` before execution.
- **Audit Verification:** Verified in Stage 3.9 Check 5 and Check 20.

### Risk A4: Negative Raw Prediction Excursions
- **Failure Mode:** Gradient boosting trees operating on real-valued residuals can output negative predictions during low-sales periods ($0.44\%$ in 7d; $0.42\%$ in 30d). Negative demand cannot be executed by procurement or warehouse systems.
- **Resolution in Artifact:** `HGBDemandForecaster.predict()` automatically executes `np.clip(raw_preds, 0, None)`. Predictions returned to callers are guaranteed non-negative.
- **Audit Verification:** Verified in Stage 3.9 Check 14 and Check 18 (0 negative clipped values across 2.34M validation rows).

### Risk A5: Model Deserialization Failure or Memory Corruption
- **Failure Mode:** Corrupted artifact files or unpickling errors on worker processes.
- **Resolution in Artifact:** Models use standard `joblib` compression (`compress=3`) and vanilla scikit-learn primitives (`OrdinalEncoder`, `HistGradientBoostingRegressor`). Artifacts take only $140\text{ KB}$ and $169\text{ KB}$ on disk and $<10\text{ MB}$ in RAM.
- **Audit Verification:** Tested across all Phase 3 audits; 100% reproducible with zero memory leaks.

---

## 3. Category B: Risks Requiring Implementation Safeguards

### Risk B1: Training-Serving Skew in Rolling Sales Aggregations
- **Description:** During Phase 2, historical sales features (`sales_lag_1d` to `sales_lag_28d`, `sales_sum_7d`, `sales_mean_14d`, `sales_std_28d`, `sales_nonzero_days_28d`) were computed over a pre-indexed NumPy array. If the production inference pipeline calculates rolling statistics using slightly different window definitions (e.g., excluding the origin date $t$, or using an un-padded rolling mean), features will experience distribution shift.
- **Impact:** High. Subconscious error inflation of $5\%$ to $25\%$ WAPE.
- **Engineering Safeguard:**
  1. Author a dedicated, standalone `FeatureEngineeringEngine` class containing the exact mathematical formulas from `build_features.py`.
  2. The window definition must be strictly verified: $[t-27, t]$ (28 historical days ending on and including day $t$).
  3. Include unit regression tests in the CI pipeline that execute the inference feature extractor on a fixed historical slice and assert exact float32 equality against `model_dataset_7d.csv`.

### Risk B2: Novel or Unknown Categorical Values at Runtime
- **Description:** A new store format (`outlet_type`), brand, packaging size, or subcategory may appear in the catalog that was not present in the training partition (`2025-12-13` to `2026-07-01`).
- **Impact:** Moderate. In naive pipelines, unknown categories crash `OrdinalEncoder`.
- **Engineering Safeguard:**
  1. The fitted encoder was serialized with `handle_unknown='use_encoded_value'` and `unknown_value=-1`. Unknown categories are encoded as `-1`.
  2. `HistGradientBoostingRegressor` natively reserves missing/negative categories into a dedicated internal histogram bin. The model will not crash.
  3. **Monitoring Safeguard:** The inference service must detect when input categories are unmapped and populate an `unseen_categories` array in the response metadata for telemetry and drift detection.

### Risk B3: Missing or Null Numerical Predictors at Runtime
- **Description:** If a store POS terminal loses network connection, yesterday's sales ($s(t)$) or inventory updates may be missing. If numerical predictors contain `NaN`, scikit-learn's input validator will raise a runtime exception.
- **Impact:** High. Service crashes or unhandled 500 errors.
- **Engineering Safeguard:**
  1. **Strict Prohibition:** Do NOT silently impute missing numerical features with `0.0` or column means. Silent zero imputation will cause catastrophic forecast collapse (the model will interpret zero sales as genuine zero demand).
  2. **Validation Rule:** Implement Pydantic and NumPy finiteness checks in `FeatureValidator`. If any numerical feature in `0..54` is missing, raise a domain-specific `MissingTelemetryException` resulting in a structured HTTP `422 Unprocessable Entity` response stating which dates or metrics are missing.

### Risk B4: Calendar & Festival Boundary Shifts (Lunar Calendar)
- **Description:** Islamic festivals in Bangladesh (Ramadan, Eid-ul-Fitr, Eid-ul-Adha) follow the Hijri lunar calendar, which shifts approximately 10 to 11 days earlier each solar Gregorian year. The training data captured events for 2026:
  * Ramadan: `2026-02-18` to `2026-03-19`
  * Eid-ul-Fitr: `2026-03-19` to `2026-03-23`
  * Eid-ul-Adha: `2026-05-26` to `2026-05-31`
- **Impact:** Critical for future calendar years (2027 and beyond). Hardcoding 2026 dates will misalign holiday demand surges by weeks.
- **Engineering Safeguard:**
  1. Separate Gregorian date arithmetic (`day_of_week`, `day_of_month`, `month`, `is_weekend`) from religious festival calendars.
  2. Decouple holiday lookups into an external configuration or database table (`calendar_festivals_table`) parameterized by year and confirmed lunar sightings.

### Risk B5: Database Query Latency During Single-Item Inference
- **Description:** To forecast a single outlet-product pair, the system requires 28 days of daily sales, 28 days of inventory receipts, active batch records, promotions, and static catalog rows. Executing 5 separate SQL queries per single-item inference will introduce $50\text{–}150\text{ ms}$ of latency per call.
- **Impact:** Moderate. Degrades user experience for interactive merchant dashboards.
- **Engineering Safeguard:**
  1. **Master Cache:** Cache static outlet (8 cols), product (9 cols), and pair attributes (5 cols) in an in-memory Redis or LRU cache (13,256 pairs occupy $<5\text{ MB}$ of RAM).
  2. **Batch Query Endpoint:** Provide a bulk endpoint (`POST /api/v1/forecast/batch`) that fetches history for multiple items in a single indexed query.
  3. Target inference execution budget: $<10\text{ ms}$ for in-memory model compute; $<30\text{ ms}$ total roundtrip with cached data.

---

## 4. Category C: Risks Requiring Additional Data or Business Policy Decisions

### Risk C1: Cold-Start Outlets & New Product Introductions
- **Problem Statement:** If an outlet is newly opened, or a new SKU is introduced, it has less than 28 days of transaction history. Without 28 days of data, `sales_lag_28d`, `sales_sum_28d`, and `sales_std_28d` cannot be calculated without imputation.
- **Data Gap:** The current HGB model requires all 55 numerical features to be populated and finite.
- **Required Business Policy Decision:**
  * *Option 1 (Hard Rejection):* Return an explicit error (`InsufficientHistoricalDataException`) indicating that the item must accrue at least 28 days of sales before statistical machine learning forecasts can be generated.
  * *Option 2 (Fallback Heuristic):* Fall back to the Stage 3.2 Planning Prior Benchmark or category-average sales rate, explicitly flagging the response: `model_used: "fallback_heuristic_cold_start"`.
  * **Recommendation:** Implement Option 2 as a transparent fallback service rather than corrupting the HGB feature vector with fake zeros.

### Risk C2: Demand Censoring Caused by Historical Stockouts
- **Problem Statement:** Historical targets (`target_7d` and `target_30d`) represent recorded sales, not true customer demand. If an outlet had zero inventory for 5 days of a 7-day period, sales were capped at 0 or available stock. The model will learn to predict suppressed sales during periods following stockouts.
- **Data Gap:** The dataset contains customer-accessible availability flags (`is_eligible_acc_5of7`), but at forecast origin $t$, future stockouts cannot be known without replenishment scheduling.
- **Required Business Policy Decision:**
  * The business must recognize that these models predict **expected sales under past inventory practices**.
  * For automated purchase order generation, merchandising teams must combine the baseline sales forecast with a stockout compensation factor or reorder up to `maximum_stock_level`.

### Risk C3: Asymmetric Inventory Loss Costs (Stockout vs. Wastage)
- **Problem Statement:** The selected models optimize `absolute_error` (L1 loss), estimating the **conditional median** ($\text{Median}[Y|X]$).
  * For symmetrical error penalties, the median is optimal.
  * In grocery retail, penalties are highly asymmetric:
    * Under-forecasting staple goods (Rice, Oil) leads to customer loss and stockouts.
    * Over-forecasting perishable goods (Fish, Meat, Milk) leads to physical spoilage and financial wastage.
- **Required Business Policy Decision:**
  * Merchandising must specify whether procurement should target safety-stock buffers (e.g., $\hat{y} + k \cdot \sigma$) or whether future stages should train quantile regression models (`loss='quantile'`, P10 for perishables risk, P90 for service-level guarantees).

### Risk C4: Unrecorded Store Closures (Hartals, Eid Breaks, Renovations)
- **Problem Statement:** If an outlet closes unexpectedly due to a regional strike (Hartal), emergency, or renovation, sales drop to zero. The model does not know of unexpected future closures.
- **Required Data Feed:**
  * The retail operations platform must maintain an active `store_operating_calendar` feed. If a store is scheduled to close, the application layer must suppress or zero-out the forecast downstream of the ML model.

---

## 5. Risk Monitoring & Action Matrix

| Risk ID | Category | Preventive Action | Detection Mechanism | Responsible Role |
| :--- | :---: | :--- | :--- | :--- |
| **B1** | Implementation | Shared feature extraction code | Golden dataset regression unit tests | ML Engineer |
| **B2** | Implementation | OrdinalEncoder fallback to -1 | API response `unseen_categories` logger | Backend Engineer |
| **B3** | Implementation | Hard HTTP 422 on missing inputs | Pre-inference Pydantic schema validation | Backend Engineer |
| **B4** | Implementation | Database-backed festival lookup table | Calendar config validation script | Data Engineer |
| **B5** | Implementation | Redis/In-memory static catalog caching | Endpoint latency APM monitoring (p95 < 50ms) | DevOps / SRE |
| **C1** | Data/Policy | Heuristic fallback for $<28$ day items | `InsufficientHistory` policy sign-off | Product Manager |
| **C2** | Data/Policy | Disclose observed sales limitation | Supply chain safety-stock rules | Merchandising Lead |
| **C3** | Data/Policy | Define service-level buffer policies | Quantile loss exploration in Phase 5 | ML Lead / Merchant |
| **C4** | Data Feed | Operational store calendar integration | Store status API pre-check | Operations Lead |
