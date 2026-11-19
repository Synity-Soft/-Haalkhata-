# BazarBondhu AI — Phase 1.6: Audit Reconciliation & Forecasting Label Finalization

**Author / Lead Auditor:** Senior Data Engineer & Machine Learning Engineer  
**Date of Audit:** 2026-11-16  
**Repository:** `Hat-Bazar/BazarBondhu-AI`  
**Dataset Directory:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets`  
**Audit Artifacts:**
- Comprehensive Script: [`ml/scripts/audit_phase1_6.py`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/audit_phase1_6.py)
- Machine-Readable Summary: [`ml/reports/audit_summary_phase1_6.json`](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/audit_summary_phase1_6.json)
**Final Determination:** **APPROVED FOR PHASE 2 (FEATURE ENGINEERING)**

---

## 1. Executive Summary

This Phase 1.6 audit reconciles discrepancies identified in Phase 1.5, resolves inventory stock timing definitions, separates physical stock availability from store operational status, evaluates multi-threshold target censoring, and provides a formal engineering specification for the forecasting labels.

### Key Audit Reconciliations:
1. **Inventory Stock Timing Corrected [Verified]:**
   - Corrected the opening vs closing stock calculation.
   - Formula: $\text{Closing Stock}_d = \text{Opening Stock}_d + \text{Receipts}_d - \text{Sales}_d - \text{Wastage}_d - \text{Expired Stock}_d$.
   - **Physical Stock Available ($> 0$ units intraday or sales occurred):** **4,110,165 product-days (84.9482%)**.
   - **Physical Stockout (0 units throughout day):** **728,275 product-days (15.0518%)**.
2. **Batch Accounting Fully Reconciled [Verified]:**
   - All **80,216 batches** in `inventory_batches.csv` reconcile with 100.0% exactness:
     $$\text{initial\_quantity} = \text{total\_sold} + \text{total\_wasted} + \text{remaining\_quantity}$$
   - Zero negative stock occurrences; zero sales or wastage outside batch lifecycle dates.
3. **Physical Stock vs Store Operating Status Decoupled [Verified]:**
   - **Customer-Accessible Available:** **4,109,438 product-days (84.9331%)** (Physical stock present AND store operating).
   - **Stock on Closed Shelves:** **727 product-days (0.0150%)** (Physical stock present, but store recorded zero transactions).
   - **Operating Stockout:** **728,100 product-days (15.0482%)** (Store operating, but product had zero stock).
   - **Double-Negative:** **175 product-days (0.0036%)** (Store had zero transactions AND product was out of stock).
4. **Target Censoring Evaluated across Multi-Thresholds [Verified]:**
   - For `target_7d`: Evaluated at $\ge 4/7, \ge 5/7, \ge 6/7, 7/7$ days available. Retains 84.68% down to 81.12% of total windows.
   - For `target_30d`: Evaluated at $\ge 15/30, \ge 20/30, \ge 25/30, 30/30$ days available. Retains 84.49% down to 76.23% of total windows.
5. **Future Availability Leakage Strictly Prohibited [Rule Established]:**
   - Future target availability ratios ($t+1$ to $t+H$) must **NEVER** be used as input features $X_t$ at forecast origin $t$. They are strictly restricted to training sample weighting, evaluation filtering, and censoring diagnostics.
6. **Perishable Product Forensic Clarification [Verified]:**
   - All 56 products verified as `perishable_status == 'Perishable'` in `products.csv`.
   - Across all 2,762 store-SKU assignments, restocking ceased on or before `2026-10-17`, and batches expired on or before `2026-11-07`. Zero sales occurred after batch expiry.

---

## 2. Correct Inventory Stock Reconstruction

### 2.1 Distinction Between Stock Metrics
In `audit_phase1_5.py`, pre-depletion stock was tracked, which reflected opening stock rather than closing stock. We now formally distinguish and track five sequential inventory quantities for every store-product pair $(i, j)$ on calendar day $d \in [0, 364]$:

1. **$\text{Opening Stock}_d$:** Unexpired sellable stock carried over from day $d-1$:
   $$\text{Opening Stock}_d = \text{Closing Stock}_{d-1} \quad (\text{Opening Stock}_0 = 0)$$
2. **$\text{Daily Receipts}_d$:** Inflow of fresh inventory from batches with `batch_received_date` $= d$:
   $$\text{Receipts}_d = \sum_{b \text{ received on } d} \text{initial\_quantity}_b$$
3. **$\text{Intraday Available Stock}_d$:** Maximum physical volume available for sale during day $d$:
   $$\text{Intraday Available Stock}_d = \text{Opening Stock}_d + \text{Receipts}_d$$
4. **$\text{Daily Outflows}_d$:** Total units removed during day $d$:
   $$\text{Sales}_d = \sum_{b} \text{quantity\_sold}_{b, d}, \quad \text{Wastage}_d = \sum_{b} \text{wasted\_quantity}_{b, d}$$
5. **$\text{Expired Stock}_d$:** Unsold units in batches whose `expiry_date` is day $d$. These units expire at close of business and cannot be carried into day $d+1$:
   $$\text{Expired Stock}_d = \sum_{b \text{ expiring on } d} \text{Unsold Batch Stock}_b(d)$$
6. **$\text{Closing Stock}_d$:** Unexpired stock remaining at the end of day $d$:
   $$\text{Closing Stock}_d = \text{Intraday Available Stock}_d - \text{Sales}_d - \text{Wastage}_d - \text{Expired Stock}_d$$

### 2.2 Availability Timing Definition for Forecasting
- **Timing Standard Adopted:** **Intraday Availability.**
- **Definition:** A product is defined as physically available on day $d$ if:
  $$\text{physical\_stock\_available}_d = (\text{Intraday Available Stock}_d > 0) \lor (\text{Sales}_d > 0)$$
- **Justification:** If an outlet opens with 5 units, sells all 5 units during the day, and has Closing Stock = 0, stock was physically present and accessible to customers. Defining availability solely by Closing Stock would misclassify 39,516 active sales days as "unavailable."
- **Limitation:** Intraday stockout timing (e.g. stock depleted at 11:00 AM vs 9:00 PM) cannot be measured because transactions do not record continuous stock levels between receipts.

---

## 3. Batch Reconciliation & Accounting Integrity

### 3.1 Reconciliation Across All 80,216 Batches
Every single batch in `inventory_batches.csv` was audited against line-item sales (`sales.csv`) and wastage write-offs (`wastage_records.csv`):

$$\text{initial\_quantity} = \sum \text{quantity\_sold} + \sum \text{wasted\_quantity} + \text{remaining\_quantity}$$

| Audit Check | Expected Value | Verified Value | Compliance % | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Exact Accounting Matches** | 80,216 | **80,216** | **100.00%** | **Verified** |
| **Negative Stock Occurrences** | 0 | **0** | **100.00%** | **Verified** |
| **Sales Outside Lifecycle** | 0 | **0** | **100.00%** | **Verified** |
| **Wastage Outside Lifecycle**| 0 | **0** | **100.00%** | **Verified** |
| **Batches Exhausted Before Expiry** | N/A | **236** | 0.29% | **Accounted For** |

### 3.2 Semantics of `remaining_quantity` and `batch_status`
- **`In stock` (30,613 batches):** Expiry dates are after `2026-11-15`. `remaining_quantity` is the exact closing inventory snapshot as of day 364 (`2026-11-15`).
- **`Expired` (49,406 batches):** Reached expiry on or before `2026-11-15`. `remaining_quantity` is the exact quantity remaining unsold at expiry.
- **`Sold out` (197 batches):** `remaining_quantity == 0`. All units depleted before or on expiry.

---

## 4. Separation of Physical Stock from Store Operational Status

To avoid conflating empty shelves with closed store doors, we created two independent indicators:

### 4.1 Independent Dimensions
1. **`physical_stock_available`:** Binary indicator based strictly on intraday inventory ($> 0$).
2. **`store_operational_status`:** Categorical indicator derived from store transaction activity:
   - `Normal Operating (Confirmed with Transactions)`: $\ge 1$ sale recorded in store (72,973 outlet-days).
   - `Possible Closure / Zero-Transaction Day`: 0 sales and 0 revenue across all store SKUs (27 outlet-days).
   - `Confirmed Closed`: 0 days (no explicit closure calendar exists in raw data).

### 4.2 Cross-Tabulation Matrix (Total Catalog Grid: 4,838,440 Product-Days)

| Store Operational Status | Physical Stock Available | Physical Stockout (Unavailable) | Total Product-Days |
| :--- | :---: | :---: | :---: |
| **Normal Operating Store** | **4,109,438 (84.9331%)**<br>*Accessible Available* | **728,100 (15.0482%)**<br>*Stockout in Open Store* | **4,837,538 (99.9814%)** |
| **Possible Closure Day** | **727 (0.0150%)**<br>*Stock on Closed Shelves* | **175 (0.0036%)**<br>*Double Negative* | **902 (0.0186%)** |
| **Total Product-Days** | **4,110,165 (84.9482%)** | **728,275 (15.0518%)** | **4,838,440 (100.00%)** |

---

## 5. Correct Target-Window Censoring Calculations

### 5.1 7-Day Target Window Censoring ($t+1$ to $t+7$)
- **Total Windows Evaluated:** $13,256 \text{ pairs} \times 358 \text{ eligible origins} = \mathbf{4,745,648}$ windows.
- **Latest Allowable Origin:** `2026-11-08`.

| Threshold Criteria | Eligible Windows (Physical) | % of Total | Eligible Windows (Accessible) | % of Total | Engineering Trade-Off |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **$\ge$ 4 / 7 Days Available** | 4,018,526 | 84.68% | 4,018,517 | 84.68% | Maximum sample size; tolerates up to 3 stockout days. |
| **$\ge$ 5 / 7 Days Available** | 3,957,113 | 83.38% | 3,957,102 | 83.38% | **Recommended Balanced Baseline:** High coverage, low bias. |
| **$\ge$ 6 / 7 Days Available** | 3,905,675 | 82.30% | 3,905,518 | 82.30% | High fidelity; tolerates at most 1 stockout day. |
| **7 / 7 Days Available (100%)**| 3,854,524 | 81.22% | 3,849,632 | 81.12% | Pure unconstrained demand; excludes 18.88% of windows. |
| **Fully Censored (0 / 7 Days)**| 523,209 | 11.03% | 523,214 | 11.03% | **Mandatory Exclusion:** 0 stock for entire week. |

---

### 5.2 30-Day Target Window Censoring ($t+1$ to $t+30$)
- **Total Windows Evaluated:** $13,256 \text{ pairs} \times 335 \text{ eligible origins} = \mathbf{4,440,760}$ windows.
- **Latest Allowable Origin:** `2026-10-16`.

| Threshold Criteria | Eligible Windows (Physical) | % of Total | Eligible Windows (Accessible) | % of Total | Engineering Trade-Off |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **$\ge$ 15 / 30 Days Available** | 3,752,033 | 84.49% | 3,752,028 | 84.49% | High coverage, but includes half-month stockouts. |
| **$\ge$ 20 / 30 Days Available** | 3,687,823 | 83.04% | 3,687,593 | 83.04% | **Recommended Standard:** Product available $\ge 2/3$ of month. |
| **$\ge$ 25 / 30 Days Available** | 3,507,146 | 78.98% | 3,507,139 | 78.98% | High fidelity; tolerates $\le 5$ delivery delay days. |
| **30 / 30 Days Available (100%)**| 3,403,911 | 76.65% | 3,385,335 | 76.23% | Zero stockouts; 23.77% of windows excluded. |
| **Fully Censored (0 / 30 Days)**| 973 | 0.02% | 973 | 0.02% | Zero stock across all 30 days. |

---

## 6. Prevention of Future Availability Leakage

To prevent lookahead bias, we establish a strict firewall between model input features $X_t$ and target metadata $M_t$:

```text
At Forecast Origin t:
┌─────────────────────────────────────────────────┐
│ ALLOWED AS INPUT FEATURES (X_t):                │
│ • Historical sales lags (sales_lag_7, lag_14)   │
│ • Historical rolling statistics (mean, std)     │
│ • Historical in-stock ratio (e.g. [t-27, t])    │
│ • Historical wastage & promotions up to t       │
│ • Static outlet & product attributes            │
└─────────────────────────────────────────────────┘
                        ▲
                 STRICT FIREWALL
                        ▼
┌─────────────────────────────────────────────────┐
│ STRICTLY PROHIBITED AS INPUT FEATURES:          │
│ × Future stock availability in [t+1, t+H]       │
│ × Future sales, wastage, or deliveries          │
│ × Future target-window censoring ratios         │
│                                                 │
│ NOTE: Future availability ratios are restricted │
│ solely to TARGET METADATA (M_t) for sample      │
│ filtering, loss weighting, and evaluation.      │
└─────────────────────────────────────────────────┘
```

---

## 7. Strengthened Perishable-Product Investigation

We audited the 56 suspected products across all 200 outlets carrying them:

### 7.1 Verified Findings:
1. **Product Categorization [Verified]:** In `products.csv`, **all 56 products are explicitly marked `perishable_status == 'Perishable'`** (shelf lives 2 to 21 days across vegetables, dairy, eggs, meat, fish, bread).
2. **Assortment Scope [Verified]:** Carried across exactly **2,762 active store-SKU assignments**.
3. **Restocking Cessation [Verified]:** For all 2,762 pairs, the final batch arrived on or before **`2026-10-17`**. Zero new batches were delivered after October 17, 2026.
4. **Batch Expiry [Verified]:** For all 2,762 pairs, all batches expired on or before **`2026-11-07`**.
5. **Zero Sales After Expiry [Verified]:** Exactly **0 sales** occurred after batch expiry dates.
6. **Purchase Order Limitation [Verified]:** `purchase_orders.csv` covers only Q1 (`2025-11-14` to `2026-02-15`). It cannot be used to prove why restocking ceased in October.

### 7.2 Scientifically Conservative Conclusion:
> **"Observed restocking ceased in the available dataset after October 17, 2026, followed by batch expiry by November 07, 2026."**  
> We separate this verified observation from causal claims regarding real-world supplier strikes or synthetic generator cutoff limits.

---

## 8. Python Environment Compatibility & Stack Trace

### 8.1 System Configuration
- **Python Version:** 3.13.5 (Clang 16.0.0)
- **pandas:** 2.2.2 | **NumPy:** 2.4.4
- **OS / Architecture:** macOS Darwin 26.5.1 on Apple Silicon (`arm64`)

### 8.2 Isolated C-Level Stack Trace
Using `python3 -X faulthandler`, the exact crash was captured:
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

### 8.3 Verified Engineering Workaround:
- Rather than mutating the global Python environment, maintain date columns as **ISO strings (`YYYY-MM-DD`, `object` dtype)**.
- String comparisons (`"2025-11-16" <= "2026-03-01"`) are mathematically identical to datetime comparisons.
- Perform vector operations using day indices `[0..364]`. This pipeline is 100% stable and executes with zero C-API faults.

---

## 9. Temporal Validation Architecture

We preserve the conservative chronological validation design:

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

- **Warm-Up Period:** `2025-11-16` to `2025-12-12` (28 days required to populate 28-day lag features).
- **Training Origins:** `2025-12-13` to `2026-07-01` (201 origin dates). Target for origin `2026-07-01` resolves on `2026-07-31`.
- **Mandatory 30-Day Purge Window:** `2026-07-02` to `2026-07-31` (30 days). Prevents 30-day training targets from bleeding into the validation window starting `2026-08-01`.
- **Validation Origins:** `2026-08-01` to `2026-10-16` for 30d targets (77 origins); extends to `2026-11-08` for 7d targets (100 origins).

---

## 10. Final Forecasting-Label Specification for Phase 2

1. **Panel Structure:** Exactly 13,256 store-product pairs listed in `outlet_products.csv`.
2. **Canonical Calendar:** Exactly 365 days (`2025-11-16` to `2026-11-15`).
3. **Daily Sales Target Source:** `sales.csv` aggregated by `(outlet_id, product_id, sale_date)`.
4. **Physical Stock Availability:** `physical_stock_available = (intraday_mat > 0) | (sales_mat > 0)`.
5. **Store Operating Status:** `store_operational_status = ('Operating' if tx > 0 else 'Possible Closure')`.
6. **Treatment of Possible Closures:** Flagged as metadata; zero sales retained as observed sales.
7. **Target Window Censoring:** Fully censored windows (0 days stock) excluded from training.
8. **Target Definitions:**
   - `target_7d`: Sum of sales from origin $t+1$ through $t+7$.
   - `target_30d`: Sum of sales from origin $t+1$ through $t+30$.
9. **Temporal Boundaries:**
   - Max 7-day origin: `2026-11-08`.
   - Max 30-day origin: `2026-10-16`.
10. **Leakage Prohibition:** Future availability ratios strictly barred from input feature matrices.

---

## 11. Final Decision

### **APPROVED FOR PHASE 2 (FEATURE ENGINEERING)**

All discrepancies from Phase 1.5 have been reconciled with reproducible code. The inventory timing is resolved, stock is decoupled from store operating status, multi-threshold target censoring is quantified, and anti-leakage rules are enforced.
