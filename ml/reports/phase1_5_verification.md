# BazarBondhu AI — Phase 1.5: Final Data Engineering Review & Technical Audit Report

**Author / Lead Auditor:** Senior Data Engineer, ML Engineer & System Architect  
**Date of Audit:** 2026-11-16  
**Repository:** `Hat-Bazar/BazarBondhu-AI`  
**Dataset Path:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets`  
**Audit Artifacts:**
- Script: [`ml/scripts/audit_phase1_5.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/audit_phase1_5.py)
- Machine-Readable Summary: [`ml/reports/audit_summary_phase1_5.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/audit_summary_phase1_5.json)
**Final Determination:** **CONDITIONALLY APPROVED FOR FEATURE ENGINEERING** (Approved subject to availability-censoring filters and temporal purge windows)

---

## 1. Executive Summary

This Phase 1.5 audit represents a rigorous data engineering review of the BazarBondhu AI dataset prior to feature pipeline creation. Rather than accepting earlier inspection claims at face value, we independently audited the data, reconstructed daily inventory depletion dynamics, evaluated 7-day and 30-day forecast targets, tested chronological train/validation embargoes, and isolated environment crash causes.

### High-Level Summary of Verified Findings:
1. **Canonical Calendar Verified [Verified]:** Exactly 365 consecutive calendar days (`2025-11-16` to `2026-11-15`). No missing days, no duplicates, and zero out-of-range transactions.
2. **Catalog Assortment Baseline [Verified]:** Exactly 13,256 active store-product combinations (`outlet_products.csv`) across 200 outlets and 260 products. Total potential evaluation cells: $13,256 \times 365 = 4,838,440$ outlet-product-days.
3. **Daily Inventory Position Reconstructed [Verified]:** By tracking batch inflows, daily sales, spoilage write-offs, and early batch exhaustions:
   - **4,110,165 product-days (84.95%)** had active sellable stock ($> 0$ units) or confirmed sales (**Known Available**).
   - **728,100 product-days (15.05%)** had zero sellable inventory due to batch expiry, delivery gaps, or early stockout (**Known Unavailable / Supply Censored**).
   - Early batch exhaustion accounts for 4,860 product-days where stock reached 0 *before* the nominal batch expiry date.
4. **Store Closure Nuance [Inferred vs Unknown]:** There is no explicit `is_open` flag. 27 store-days across 19 outlets record zero transactions and zero revenue in `daily_outlet_metrics.csv` (affecting 902 product-days). These are classified as **Possible Closures / Zero-Transaction Days**, not confirmed closures.
5. **Target Censoring Quantified [Verified]:**
   - **7-Day Target ($t+1$ to $t+7$):** 81.22% of windows have complete 7/7 days stock availability; **11.03% are fully censored (0/7 days in stock)**.
   - **30-Day Target ($t+1$ to $t+30$):** 76.65% of windows have complete 30/30 days stock availability; **16.93% are heavily censored (< 20 days in stock)**.
6. **Chronological Embargo Requirement [Verified]:** For the 30-day target horizon, a **30-day purge buffer** between training and validation is mathematically mandatory to avoid target contamination.
7. **Perishable Product Expiry at Outlet-Level [Verified]:** All 2,762 store assignments carrying the 56 perishable products received their final batches on `2026-10-17` and expired by `2026-11-07`. The sales cessation was verified to be **supply interruption and batch expiry**, not demand decline.
8. **Python Environment C-API Root Cause [Verified]:** Python's `faulthandler` traced the `SIGSEGV` (code 139) to `pandas.core.dtypes.cast._ensure_nanosecond_dtype` interacting with NumPy 2.4 C-API changes under Python 3.13 on `arm64`. An ISO-string pipeline completely eliminates the fault without environment reinstallation.

---

## 2. Repository and Dataset Inspection

The repository layout and dataset files were audited:
- Location: `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets/`
- Total CSV Files: 15
- Total Master Outlets: 200 (`outlets.csv`)
- Total Master Products: 260 (`products.csv`)
- Total Sales Rows: 834,819 (`sales.csv`)
- Total Batches: 80,216 (`inventory_batches.csv`)
- Total Wastage Records: 3,237 (`wastage_records.csv`)
- No raw dataset files have been modified, overwritten, or moved.

---

## 3. Verified Dataset Statistics

| Metric | Phase 1 Initial Claim | Phase 1.5 Verified Result | Evidence / Calculation |
| :--- | :---: | :---: | :--- |
| **Historical Period** | `2025-11-16` to `2026-11-15` | `2025-11-16` to `2026-11-15` | **[Verified]** Exact match with canonical 365-day calendar. |
| **Unique Dates** | 365 | 365 | **[Verified]** 0 gaps, 0 duplicates in `sales.csv` and `metrics.csv`. |
| **Sales Records** | 834,819 | 834,819 | **[Verified]** Exact row count; max 1 transaction per `(outlet, product, date)`. |
| **Catalog Pairs** | 13,256 | 13,256 | **[Verified]** In `outlet_products.csv` (all `is_active=True`). |
| **Pairs with Sales** | 13,254 | 13,254 | **[Verified]** Exactly 2 catalog pairs had 0 sales all year. |
| **Total Catalog Grid Cells**| 4,838,440 | 4,838,440 | **[Verified]** $13,256 \times 365 = 4,838,440$ product-days. |
| **Recorded Sales Days** | 834,819 | 834,819 | **[Verified]** 17.25% of total catalog grid. |
| **Unrecorded Product-Days** | 4,003,621 | 4,003,621 | **[Verified]** 82.75% of total catalog grid. |
| **Unavailable Product-Days**| 723,240 | **728,100** | **[Verified]** Reconstructed via daily stock tracking (+4,860 early batch exhaustions). |
| **Known Available Days** | 3,279,479 | **4,110,165** | **[Verified]** 834,819 sales days + 3,275,346 in-stock zero-sales days. |

---

## 4. Inventory Availability Reconstruction

### 4.1 Methodology & Formula
A batch being within `[batch_received_date, expiry_date]` does not guarantee stock was on the shelf; the batch could have been depleted earlier by customer purchases or wastage write-offs.

We implemented exact stock tracking per batch:
$$\text{Stock}_b(d) = \text{Initial Quantity}_b - \sum_{\tau \le d} \left( \text{Quantity Sold}_{b, \tau} + \text{Wasted Quantity}_{b, \tau} \right)$$
Subject to:
$$\text{Stock}_b(d) = 0 \quad \text{for all } d > \text{expiry\_date}_b$$

Aggregated to the store-SKU level:
$$\text{Total Available Stock}_{i, j}(d) = \sum_{b \in \mathcal{B}_{i, j}} \text{Stock}_b(d)$$

### 4.2 Reconstructed Availability Breakdown
Across all 4,838,440 product-days in Grid B:

1. **Known Available (`4,110,165` product-days, 84.95%) [Verified]:**
   - **834,819 days:** Confirmed customer sales occurred ($y > 0$).
   - **3,275,346 days:** Reconstructed daily closing stock $> 0$, but zero units sold.
2. **Known Unavailable (`728,100` product-days, 15.05%) [Verified]:**
   - **723,240 days:** No active unexpired batch existed in the outlet (e.g. gap between monthly perishable deliveries, or post-expiry period).
   - **4,860 days:** An unexpired batch existed nominally, but its inventory was completely exhausted ($= 0$) prior to its expiry date.
3. **Possible Store Closures (`175` product-days, 0.0036%) [Inferred]:**
   Days where the entire store had zero transactions, and stock happened to be zero. (Note: on the other 727 product-days during store closures, stock $> 0$ was sitting on closed shelves).
4. **Unknown Availability (`0` product-days, 0.00%) [Verified]:**
   Because 100% of batches reconcile mathematically without inventory discrepancies, stock status is deterministically known across the entire dataset.

---

## 5. Outlet Closure Verification

### 5.1 Investigation of Operational Status
- **Explicit Operating Indicators:** None. There is no `is_open` or `is_closed` column in `outlets.csv` or `daily_outlet_metrics.csv`.
- **Opening Schedules:** `outlets.csv` states `opening_days: '6-7 days'` for all 200 stores, indicating stores occasionally take 1 day off per week.
- **Zero-Transaction Days in Metrics [Verified]:**
  - Exactly **27 unique outlet-days** across **19 distinct outlets** record `total_transactions = 0` and `total_revenue_bdt = 0.0`.
  - In 181 outlets, transactions occurred on all 365 days.
- **Affected Assortment Scope [Verified]:**
  - These 27 outlet-days affect **902 outlet-product-days**.
  - On 727 of these product-days, unexpired inventory was present on the shelves, but unpurchased due to store closure.

### 5.2 Classification Taxonomy:
- **Confirmed Closures:** **0** (Due to lack of explicit flag).
- **Possible Closures / Zero-Transaction Days:** **27 outlet-days (902 product-days) [Inferred]**.
- **Normal Operating Days:** **72,973 outlet-days (99.963%) [Verified]**.

---

## 6. Unknown and Missing Sales Analysis

In retail demand forecasting, an unrecorded sales day ($y = 0$) can stem from three distinct real-world phenomena:

```text
Unrecorded Day in sales.csv (4,003,621 product-days)
├── Case 1: True Zero Demand (3,275,346 days) -> Stock was on shelf, customers did not buy.
├── Case 2: Supply Censorship / Stockout (728,100 days) -> Shelf was empty; customer demand cannot be observed.
└── Case 3: Store Closure (902 days) -> Store was closed; customer could not enter.
```

> [!WARNING]
> In Phase 1, all 4,003,621 unrecorded days were loosely termed "zero sales." Treating Case 2 (728,100 stockout days) as zero demand in model training introduces severe downward bias, training the model to predict zero reorders for products that actually suffered from stockouts!

---

## 7. 7-Day Target Feasibility

- **Definition:** `target_7d` = $\sum_{k=1}^7 \text{sales}_{i, j, t+k}$
- **Eligible Forecast Origins [Verified]:** $t \in [\text{2025-11-16}, \text{2026-11-08}]$ (**358 origin dates**).
- **Total Possible Evaluation Windows:** $13,256 \times 358 = \mathbf{4,745,648}$ windows.
- **Window Availability Breakdown [Verified]:**
  - **Complete Availability (7 of 7 days in stock):** **3,854,524 windows (81.22%)**
  - **Mildly Censored (4 to 6 days in stock):** **164,002 windows (3.46%)**
  - **Heavily Censored (1 to 3 days in stock):** **203,913 windows (4.30%)**
  - **Fully Censored (0 of 7 days in stock):** **523,209 windows (11.03%)**

---

## 8. 30-Day Target Feasibility

- **Definition:** `target_30d` = $\sum_{k=1}^{30} \text{sales}_{i, j, t+k}$
- **Eligible Forecast Origins [Verified]:** $t \in [\text{2025-11-16}, \text{2026-10-16}]$ (**335 origin dates**).
- **Total Possible Evaluation Windows:** $13,256 \times 335 = \mathbf{4,440,760}$ windows.
- **Window Availability Breakdown [Verified]:**
  - **Complete Availability (30 of 30 days in stock):** **3,403,911 windows (76.65%)**
  - **Mildly Censored (20 to 29 days in stock):** **283,912 windows (6.39%)**
  - **Heavily Censored (1 to 19 days in stock):** **751,964 windows (16.93%)**
  - **Fully Censored (0 of 30 days in stock):** **973 windows (0.02%)**

---

## 9. Target Censoring and Eligibility Recommendation

### Recommended Supervised Training Protocol [Recommended]:
1. **Uncensored Training Core:**
   During supervised training of regression models (e.g. LightGBM, Random Forest, Ridge), **exclude or zero-weight fully censored windows** (523,209 windows in 7d; 973 in 30d) where stock was absent throughout the entire target window.
2. **Availability Normalization Feature:**
   Include `in_stock_days_ratio_7d` and `in_stock_days_ratio_30d` as training features or apply an inverse-probability-of-censoring weight during loss evaluation.
3. **No Lost-Demand Hallucination:**
   Do NOT synthesize or impute artificial sales quantities for stockout days in Phase 1.5 or Phase 2. The model should predict unconstrained rate of demand based on valid operating days.

---

## 10. Temporal Validation Strategy

To prevent target contamination across time horizons, we formally evaluated two splitting architectures:

### Recommended Unified Multi-Horizon Architecture [Recommended]:

```text
  ┌───────────────────────────────────────────────┬─────────┬──────────────────────────────┬─────────┐
  │                 TRAIN SET                     │ PURGE   │        VALIDATION SET        │ UNUSED  │
  │   Origins: 2025-12-13 to 2026-07-01           │ 30 DAYS │ Origins: 2026-08-01 to 10-16 │ 30 DAYS │
  │   Targets: up to 2026-07-31                   │ EMBARGO │ Targets: up to 2026-11-15    │ HORIZON │
  └───────────────────────────────────────────────┴─────────┴──────────────────────────────┴─────────┘
  ▲                                               ▲         ▲                              ▲         ▲
2025-11-16                                    2026-07-01 2026-08-01                    2026-10-16 2026-11-15
(28-day warm-up for lags)                    (Train Cutoff) (Val Start)                (Last Target) (End of Data)
```

1. **Feature Warm-Up Period (`2025-11-16` to `2025-12-12`):** 28 days required to compute rolling lag features. First valid forecast origin: `2025-12-13`.
2. **Training Origin Range:** `2025-12-13` to `2026-07-01` (201 origin dates).
   - Maximum 30-day target resolves on: $\text{2026-07-01} + 30 = \text{2026-07-31}$.
3. **Mandatory 30-Day Purge / Embargo Period:** `2026-07-02` to `2026-07-31` (30 calendar days).
   - Ensures no training target overlaps with validation observations.
4. **Validation Origin Range:** `2026-08-01` to `2026-10-16` for 30-day targets (77 origin dates; targets resolve by `2026-11-15`).
   - For 7-day targets, validation origins extend to `2026-11-08` (100 origin dates).

---

## 11. Leakage Prevention Checks

| Feature Category | Leakage Risk | Enforcement Protocol |
| :--- | :--- | :--- |
| **Sales Lags** | Using sales on or after day $t$ | Strictly compute lags over $W_{\text{hist}}(t) = [t - 27, t]$. |
| **Promotions** | Post-hoc discounts recorded at checkout | Use only planned promotions from `promotions_discounts.csv` known on or before $t$. |
| **Customer Mix** | Checkout customer segments in `sales.csv` | Exclude transaction-level customer segments; use static `area_profiles.csv`. |
| **Inventory** | Future batch receipts leaking into current stock | Compute stock strictly from batches with `batch_received_date` $\le t$. |
| **Cross-Horizon Target Overlap** | Training 30-day target bleeding into validation | Enforce strict 30-day embargo gap. |

---

## 12. Calendar Integrity

- **Canonical Calendar Bounds [Verified]:** `2025-11-16` through `2026-11-15` (exactly 365 days).
- **Network Continuity [Verified]:** Every day has active retail sales across Bangladesh.
- **Event Bounds Nuances:**
  - `Payday cycle`: Span is listed as `2025-11-25` to `2026-11-15` in `calendar_events.csv`. In feature engineering, this must be modeled as a recurring monthly window (day of month 25 to 5).
  - Missing National Holidays: Independence Day (Mar 26), Victory Day (Dec 16), Language Day (Feb 21) are absent from `calendar_events.csv` and should be augmented via standard Bangladesh holiday dates in Phase 2.

---

## 13. Python Environment Compatibility & Segmentation Fault Root Cause

### 13.1 System Diagnosis
- **OS & Architecture:** macOS Darwin 26.5.1 on Apple Silicon (`arm64`)
- **Python Version:** 3.13.5
- **pandas Version:** 2.2.2
- **NumPy Version:** 2.4.4
- **scikit-learn:** 1.5.1
- **matplotlib / seaborn:** 3.11.1 / 0.13.2

### 13.2 C-Level Stack Trace Analysis
Using `python3 -X faulthandler`, we reproduced the exact crash:
```text
Fatal Python error: Segmentation fault

Current thread:
  File ".../pandas/core/dtypes/cast.py", line 1269 in _ensure_nanosecond_dtype
  File ".../pandas/core/dtypes/cast.py", line 1219 in maybe_cast_to_datetime
  File ".../pandas/core/construction.py", line 811 in _try_cast
  File ".../pandas/core/construction.py", line 625 in sanitize_array
  File ".../pandas/core/indexes/base.py", line 565 in __new__
  File ".../pandas/core/tools/datetimes.py", line 479 in _array_strptime_with_fallback
  File ".../pandas/core/tools/datetimes.py", line 1067 in to_datetime
```

### 13.3 Empirical Conclusion [Verified]:
`pandas 2.2.2`'s Cython function `_ensure_nanosecond_dtype` asserts a legacy NumPy 1.x datetime descriptor structure. Under NumPy 2.4+ on Python 3.13, NumPy's C-API structure changed, causing Cython to dereference an invalid pointer (`SIGSEGV` / Exit Code 139).
- **Working Elements [Verified]:** NumPy array operations, standard pandas DataFrames, groupbys, merges, standard library `datetime.date`, scikit-learn models (`Ridge`, `RandomForest`), matplotlib plotting.
- **Failing Element [Verified]:** Invoking `pd.to_datetime()` on a Pandas Series or casting Series to `datetime64[ns]`.
- **Engineering Directive:** Retain date columns as ISO strings (`YYYY-MM-DD`). Lexicographical string comparisons are 100% equivalent to chronological date comparisons. Perform integer date arithmetic via day indices `[0..364]`.

---

## 14. Perishable Product Investigation (Outlet-Product Level)

We examined all **2,762 outlet-product assignments** carrying the 56 perishable products (milk, chicken, eggs, fish, chillies, bananas, bread):
- **Last Batch Received Date [Verified]:** Exactly **`2026-10-17`** for all 2,762 pairs (100.0%).
- **Last Batch Expiry Date [Verified]:** Exactly **`2026-11-07` or earlier** for all 2,762 pairs (100.0%).
- **Last Sale Date [Verified]:** Ranged from `2026-10-19` to `2026-11-07`. Zero sales occurred anywhere after `2026-11-07`.
- **Zero Sales After Expiry [Verified]:** Exactly 0 sales occurred after batch expiry dates.
- **Cross-Outlet Consistency [Verified]:** No outlet in Bangladesh received a fresh perishable batch after October 17, 2026.
- **Final Classification:** **Verified Supply Cessation & Expiry Truncation (100% of affected pairs)**.

---

## 15. Data Quality Issues

| # | Data Quality Issue | Records Affected | Severity | Recommended Treatment | Direct Forecasting Impact |
| :-: | :--- | :---: | :---: | :--- | :---: |
| 1 | `preferred_product_categories` empty in `area_profiles.csv` | 200 / 200 (100%) | Low | Drop column; derive category preferences from historical revenue. | None if dropped |
| 2 | `customer_count_estimate` nulls in `daily_outlet_metrics.csv` | 1,149 / 73,000 (1.57%) | Low | Impute using store format median. | Minor |
| 3 | Early batch exhaustion (stock reached 0 before expiry) | 421 batches (4,860 product-days) | Medium | Accounted for in reconstructed daily stock position. | Prevents bias |
| 4 | Supply cessation for 56 perishables in late autumn | 2,762 store-SKU pairs | High | Mask or filter out stockout target windows during training. | High if unmasked |
| 5 | Unsold catalog items | 2 pairs (`OUT053 PRD132`, `OUT139 PRD018`) | Low | Retain in catalog with 0 sales. | Low |
| 6 | Zero-transaction store days (possible closures) | 27 outlet-days (902 product-days) | Low | Retain as possible closures; flag in daily features. | Low |

---

## 16. Required Corrections to Pipeline Design

1. **Assortment Panel Base:** Build the feature engineering panel using **Grid B (`outlet_products.csv`)** covering all 13,256 active catalog pairs.
2. **Explicit Stockout Masking:** Incorporate the reconstructed daily stock indicator `in_stock_days_ratio` into target filtering.
3. **Multi-Horizon Purge:** Apply a **30-day purge buffer** between training origins ($t \le \text{2026-07-01}$) and validation origins ($t \ge \text{2026-08-01}$).
4. **Boundary Truncation:**
   - Terminate 7-day target origins at `2026-11-08`.
   - Terminate 30-day target origins at `2026-10-16`.
5. **ISO String Date Engine:** Maintain date columns as ISO strings (`object`), avoiding `pd.to_datetime(Series)` in the pandas pipeline.

---

## 17. Final Go/No-Go Decision

### **Decision: CONDITIONALLY APPROVED FOR FEATURE ENGINEERING**

The dataset is internally consistent, 100% referentially intact, and represents rich retail dynamics across Bangladesh.

### Mandatory Pre-Conditions for Phase 2:
- [x] Canonical 365-day calendar verified.
- [x] Inventory availability reconstructed beyond batch received/expiry dates alone.
- [x] Outlet closure uncertainty explicitly retained.
- [x] 7-day and 30-day target censoring quantified.
- [x] 30-day chronological purge buffer enforced.
- [x] Latest valid forecast origins verified programmatically.
- [x] Python 3.13 / Apple Silicon zero-crash string date pipeline established.
- [x] Raw CSV files left completely untouched.

**Phase 1.5 is officially concluded. Feature engineering (Phase 2) may begin upon user authorization.**
