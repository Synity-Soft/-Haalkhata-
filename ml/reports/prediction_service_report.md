# BazarBondhu AI — Phase 4, Stage 4.3: Standalone ML Prediction Service Report

**Role:** Senior Machine Learning Engineer  
**Project:** BazarBondhu AI (Demand Forecasting for Bangladesh Grocery Retail)  
**Component:** `ml/inference/prediction_service.py`  
**Status:** IMPLEMENTATION & VERIFICATION COMPLETE (13/13 Checks Passed)  
**Date:** 2026-11-17  

---

## 1. Executive Summary & Architectural Clarification

Stage 4.3 delivers a self-contained, standalone Python prediction service (`PredictionService`) that orchestrates the verified 7-day and 30-day HistGradientBoosting models with the verified 67 SAFE feature builder.

### Explicit Architecture Boundary
- **Zero Backend / Zero Database Dependencies:** The service operates strictly in Python memory using pre-existing CSV datasets (`DataSets/`) and serialized model artifacts (`ml/models/`). It does **not** introduce FastAPI endpoints, PostgreSQL tables, Supabase connections, or backend microservices.
- **Pure Demand Forecasting:** The service computes future sales volume forecasts only. It does **not** compute purchase order quantities, safety stock recommendations, pricing/discounts, revenue optimizations, or inventory rebalancing decisions (which belong to downstream business modules).
- **Censored Sales vs. True Demand:** As established in the problem formulation, historical sales records represent **censored observed transactions**, which may have been constrained by out-of-stock periods. Consequently, model predictions reflect **expected future observed sales**, not unconstrained economic demand.

---

## 2. Technical Architecture & Component Flow

```
                      +------------------------------------------+
                      |               Inference Call             |
                      |   predict(outlet_id, product_id, date)   |
                      +---------------------+--------------------+
                                            |
                                            v
                      +------------------------------------------+
                      |         Input Argument Validation        |
                      |   - Check string types & valid horizons  |
                      |   - Validates (o_id, p_id) in catalog    |
                      |   - Validates date >= 2025-12-13 (28d)   |
                      +---------------------+--------------------+
                                            |
                                            v
                      +------------------------------------------+
                      |         InferenceFeatureBuilder          |
                      |   Constructs exact 67 SAFE features:     |
                      |     - 19 Historical Sales (lags, roll)   |
                      |     - 14 Inventory (flows, expiry, stock)|
                      |     - 8 Outlet Attributes                |
                      |     - 9 Product Attributes               |
                      |     - 2 Pair Pricing Attributes          |
                      |     - 12 Calendar & Festival Indicators  |
                      |     - 3 Promotional Indicators           |
                      +---------------------+--------------------+
                                            |
                                            v
                      +------------------------------------------+
                      |       Feature Schema & Safety Guard      |
                      |   - Exact 67 column ordering             |
                      |   - Finiteness check (0 NaN, 0 Inf)      |
                      |   - Zero CONDITIONAL features (5 excl)   |
                      |   - Zero FORBIDDEN columns (targets/IDs) |
                      +---------------------+--------------------+
                                            |
                      +---------------------+--------------------+
                      |                                          |
                      v                                          v
      +-------------------------------+          +-------------------------------+
      |      7-Day Forecaster         |          |      30-Day Forecaster        |
      | EXP3_HGB_ABSOLUTE_ERROR_7D    |          |     HGB_ABSOLUTE_ERROR_30D    |
      |   - Ordinal Encoding          |          |   - Ordinal Encoding          |
      |   - Raw L1 Tree Prediction    |          |   - Raw L1 Tree Prediction    |
      +---------------+---------------+          +---------------+---------------+
                      |                                          |
                      +---------------------+--------------------+
                                            |
                                            v
                      +------------------------------------------+
                      |      Non-Negative Clipping & Output      |
                      |   - raw_forecast preserved (unrounded)   |
                      |   - forecast clipped to max(0.0, raw)    |
                      |   - daily_implied_demand calculated      |
                      |   - Structured PredictionResult returned |
                      +------------------------------------------+
```

---

## 3. Input & Output Contract

### 3.1 Input Interface
```python
result = predictor.predict(
    outlet_id="OUT001",
    product_id="PRD047",
    forecast_origin_date="2026-08-01",
    horizon="both"  # Optional: "7d", "30d", or "both" (default)
)
```

### 3.2 Output Dataclass (`PredictionResult`)
| Field | Type | Description |
|---|---|---|
| `outlet_id` | `str` | Outlet code (e.g. `'OUT001'`) |
| `product_id` | `str` | Product code (e.g. `'PRD047'`) |
| `forecast_origin_date` | `str` | Origin date (e.g. `'2026-08-01'`) |
| `horizon` | `str` | Requested horizon (`'7d'`, `'30d'`, or `'both'`) |
| `forecast_7d` | `Optional[float]` | 7-day non-negative forecast (unrounded float) |
| `forecast_30d` | `Optional[float]` | 30-day non-negative forecast (unrounded float) |
| `raw_forecast_7d` | `Optional[float]` | Unclipped raw linear/tree prediction |
| `raw_forecast_30d` | `Optional[float]` | Unclipped raw linear/tree prediction |
| `daily_implied_demand_7d` | `Optional[float]` | `forecast_7d / 7.0` |
| `daily_implied_demand_30d` | `Optional[float]` | `forecast_30d / 30.0` |
| `status` | `str` | Execution status (`'SUCCESS'`) |
| `models` | `Dict[str, str]` | Metadata identifiers for executed estimators |
| `feature_count` | `int` | Exactly `67` |
| `execution_time_ms` | `Optional[float]` | End-to-end request latency in milliseconds |

---

## 4. Model Loading & Feature Schema Verification

### 4.1 Loaded Model Artifacts
1. **7-Day Model**: [`ml/models/7d/hgb_exp3_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/7d/hgb_exp3_absolute_error_model.joblib)
   - Experiment ID: `EXP3_HGB_ABSOLUTE_ERROR_7D`
   - Loss Function: `absolute_error` (L1)
   - Verified Validation WAPE: $61.22\%$ ($5.8486$ MAE)
2. **30-Day Model**: [`ml/models/30d/hgb_absolute_error_model.joblib`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/models/30d/hgb_absolute_error_model.joblib)
   - Experiment ID: `HGB_ABSOLUTE_ERROR_30D`
   - Loss Function: `absolute_error` (L1)
   - Verified Validation WAPE: $26.53\%$ ($10.9066$ MAE)

### 4.2 Feature Schema Enforcement
The service rigorously enforces that incoming inputs from `feature_builder.py` adhere to the 67 SAFE features:
- **Exact Schema Order:** `[sales_lag_1d, ..., promotion_days_last_28d]`.
- **Exclusion of 5 CONDITIONAL Features:** `outlet_average_daily_demand`, `average_selling_price_bdt`, `average_cost_price_bdt`, `average_restock_frequency_days`, `days_until_next_festival`.
- **Exclusion of Non-Predictors:** `target_7d`, `target_30d`, `is_eligible_*`, `split_set`, `physical_avail_days_*`.
- **Finiteness:** Any NaN, Inf, or empty categorical string raises an immediate `ValueError` before model inference.

---

## 5. Comprehensive Test Suite Results

The automated test suite in [`ml/inference/test_prediction_service.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/inference/test_prediction_service.py) evaluated all 13 mandatory functional, boundary, and error scenarios.

| Check # | Test Description | Target Invariant | Actual Result | Status |
|---|---|---|---|---|
| **01** | Valid 7-day prediction | Non-negative forecast, daily rate ($fcst / 7$), correct metadata | `forecast_7d = 4.7424`, `daily = 0.6775` | **PASSED** |
| **02** | Valid 30-day prediction | Non-negative forecast, daily rate ($fcst / 30$), correct metadata | `forecast_30d = 21.2805`, `daily = 0.7093` | **PASSED** |
| **03** | Dual-horizon prediction | Both horizons populated in a single call, dictionary export | `7d = 4.7424`, `30d = 21.2805` | **PASSED** |
| **04** | Multiple valid pairs | 5 diverse pairs across Grocery, Convenience, Supermarket, Megastore | All 5 pairs succeeded ($\approx 6.4\text{ ms}$ avg latency) | **PASSED** |
| **05** | Invalid outlet ID | Reject unknown outlet code (`'OUT999'`) | Raised `ValueError: Unknown outlet_id 'OUT999'` | **PASSED** |
| **06** | Invalid product ID | Reject unknown product code (`'PRD999'`) | Raised `ValueError: Unknown product_id 'PRD999'` | **PASSED** |
| **07** | Unregistered pair | Reject valid outlet paired with unstocked SKU (`'OUT001'`, `'PRD133'`) | Raised `ValueError: Pair not found in outlet_products` | **PASSED** |
| **08** | Invalid date format | Reject malformed date strings (`'2026/08/01'`, `'bad-date'`) | Raised `ValueError` on all invalid formats | **PASSED** |
| **09** | Unsupported date boundary | Reject warmup origins ($t < 27$) and future dates past calendar end | Raised `ValueError: requires at least 28 days of history` | **PASSED** |
| **10** | Model loading failure | Catch missing or corrupt `.joblib` model paths | Raised `FileNotFoundError` | **PASSED** |
| **11** | Feature schema mismatch | Detect missing columns, extra forbidden columns, or conditional leakage | Raised `KeyError: Feature schema mismatch` | **PASSED** |
| **12** | Non-finite prediction | Catch mock model outputs containing NaN or Inf | Raised `ValueError: generated non-finite raw forecast` | **PASSED** |
| **13** | Negative prediction handling | Preserve negative raw excursion while clipping final demand to $\ge 0.0$ | Raw preserved (`-3.7542`), clipped `forecast_7d = 0.0` | **PASSED** |

**Total Suite Result:** 13/13 Checks Passed (100% Success Rate).

---

## 6. End-to-End Demonstration Output

Execution of [`ml/inference/demo_prediction_service.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/inference/demo_prediction_service.py) on representative validation records (origin date: `2026-09-01`):

```
----------------------------------------------------------------------------------------
Outlet   Product  Outlet Type        Product Description  7d Fcst    30d Fcst   Latency 
----------------------------------------------------------------------------------------
OUT001   PRD047   Grocery Store      Fresh Flour          4.21       19.53      6.83 ms 
OUT001   PRD217   Grocery Store      Deshi Sugar          2.15       9.37       6.68 ms 
OUT002   PRD010   Convenience Store  Olympic Biscuits     13.34      61.43      6.38 ms 
OUT005   PRD150   Supermarket        Miniket Rice         6.88       30.58      6.41 ms 
OUT010   PRD211   Megastore          Dano Milk Powder     0.00       21.42      6.90 ms 
----------------------------------------------------------------------------------------
```

### Performance & Latency Metrics
- **Initial Cold Start (Data Ingestion & Matrix Build):** $\approx 11.5\text{ seconds}$ (incurred once per process).
- **Subsequent Inference Latency:** $6.4\text{ to } 7.0\text{ ms}$ per dual-horizon forecast request.
- **Memory Footprint:** $\approx 150\text{ MB}$ in RAM for full historical panel lookup.

---

## 7. Limitations & Operational Guidelines

1. **Observed Sales vs. True Demand:** As noted, historical sales may be censored by stock-outs. A forecast of $0.0$ units may reflect persistent out-of-stock history rather than zero consumer interest.
2. **Calendar Boundary Constraints:** The historical data timeline spans 365 days (`2025-11-16` to `2026-11-15`). Prediction origin dates must be on or after `2025-12-13` (to allow a 28-day historical lag window) and on or before `2026-11-15`.
3. **No Retraining or Parameter Mutation:** The service operates purely in evaluation/inference mode. It never writes to model artifacts or modifies training datasets.

---

## 8. Verification & Review Readiness

Stage 4.3 is **complete, independently verified, and ready for review**. All code and artifacts adhere strictly to the project rules and standalone architectural boundary.
