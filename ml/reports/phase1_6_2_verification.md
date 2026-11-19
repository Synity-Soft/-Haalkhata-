# BazarBondhu AI — Phase 1.6.2: Independent Audit Corrections & Final Data Validation Report

**Author:** Senior Data Engineer, ML Engineer & Independent Data Auditor  
**Date:** November 16, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Dataset Directory:** [DataSets/](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets)  
**Execution Script:** [ml/scripts/audit_phase1_6_2.py](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/audit_phase1_6_2.py)  
**Machine-Readable Summary:** [ml/reports/audit_summary_phase1_6_2.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/audit_summary_phase1_6_2.json)  
**Overall Audit Status:** **ALL_MODULES_PASSED**  
**Final Recommendation:** **APPROVED FOR PHASE 2**

---

## 1. Executive Summary & Audit Module Statuses

This audit report represents the final, independent verification of the BazarBondhu AI dataset, forecasting target construction, inventory accounting, availability semantics, and feature engineering safeguards before starting Phase 2 (Feature Engineering).

All statistics and tables in this report are programmatically rendered directly from the canonical audit summary object (`ml/reports/audit_summary_phase1_6_2.json`), guaranteeing 100% numerical reconciliation with zero manually typed discrepancies.

### Summary of Audit Module Statuses

| Module / Task | Scope | Primary Metric Verified | Audit Status |
| :--- | :--- | :--- | :---: |
| **1. Canonical Calendar** | 365 Days (`2025-11-16` to `2026-11-15`) | Consecutive ISO span matching sales & metrics | **PASS** |
| **2. Task A: Batch-Level Tracking** | 80,216 Batches | Daily sequential balance, zero negative stock | **PASS** |
| **3. Task B: Pair Reconciliation** | 13,256 Pairs $\times$ 365 Days (4,838,440 cells) | Batch-to-pair aggregation consistency check | **PASS** |
| **4. Task C: Forecasting Targets** | 4,745,648 (7d) & 4,440,760 (30d) Targets | Vectorized matrix vs direct df_sales spot-checks | **PASS** |
| **5. Task E: Availability Semantics** | 4,838,440 Catalog Cells | 4 mutually exclusive observation categories | **PASS** |
| **6. Task F: Leakage Validator** | Automated Python Validation Harness | 8/8 unit tests passing clean & rejecting leaks | **PASS** |
| **7. Task G: Environment Diagnostics**| Isolated Subprocess Tests | Documented date parsing crash & ISO workaround | **PASS** |
| **8. Task H: Temporal Validation** | Chronological Split & Purge Boundaries | 30-day purge window, 0 train/val target overlap | **PASS** |

---

## 2. What Was Corrected Since Phase 1.6.1

1. **Batch Snapshot Calculation & Lifecycle Violation Enforcement (Task A):**
   - Corrected post-expiry closing stock representation: on the expiry date, post-expiry closing inventory drops to $0$.
   - Explicitly distinguished `post_expiry_closing_stock` ($0$) from the raw CSV column `remaining_quantity` (which records the expired quantity at the point of expiry for expired batches).
   - Programmatically audited invalid dates (expiry < receipt: $0$), unknown batches ($0$), transaction ownership mismatches ($0$), and lifecycle depletions ($0$ sales/wastage before receipt or after expiry).
2. **Corrected Pair Reconciliation Description (Task B):**
   - Accurately qualified the check as a **Batch-to-Pair Aggregation Consistency Check** rather than claiming an independent source of truth.
   - Evaluated all 6 daily quantities: Receipts, Sales, Wastage, Expired quantity, Opening stock, and Closing stock ($\\max |\\Delta| = 0$ for all six).
3. **Independent Reference Target Verification (Task C):**
   - Replaced shared-matrix slicing with direct raw queries against `df_sales` DataFrame rows.
   - Verified boundary origins ($t=0$, $t=334$, $t=357$), intermediate origins, positive sales cases, and confirmed zero-sales cases.
4. **Resolution of Report/JSON Contradictions (Task D):**
   - Both `ml/reports/phase1_6_2_verification.md` and `ml/reports/audit_summary_phase1_6_2.json` are generated from one canonical result object.
   - Exact numerical alignment across target statistics, censoring windows, and thresholds.
5. **Availability Semantics & Four Observation Categories (Task E):**
   - Classified all 4,838,440 catalog days into four mutually exclusive categories. Zero sales with no stock are strictly categorized as "observed zero sales with no stock", not zero demand.
6. **Production-Grade Feature Leakage Validator (Task F):**
   - Enhanced `validate_feature_timestamps()` to enforce provenance metadata, validate ISO date format, reject future source dates and positive lead days, and distinguish hard errors from suspicious naming warnings across 8 automated unit tests.
7. **Removal of Hardcoded Audit Numbers (Task H):**
   - Replaced all hardcoded values (e.g. 73000) with dynamically computed values from raw data ($200$ outlets $\times$ $365$ days $= 73,000$).

---

## 3. Task A: Batch-Level Inventory Reconciliation & Snapshot Audit

```
========================================================================================
TASK A: BATCH SEQUENTIAL RECONCILIATION & SNAPSHOT AUDIT
========================================================================================
Total Batches Audited:                                           80,216
Batches with Expiry Strictly Before Receipt Date:                    0 [Verified]
Batches with Same-Day Expiry (Expiry == Receipt Date):            1,290 [Verified: Ultra-Perishables]
Batches Received Before Calendar Start (2025-11-16):                  0 [Verified]
Batches Received After Calendar End (2026-11-15):                     0 [Verified]
----------------------------------------------------------------------------------------
Unknown Batches Referenced in Sales:                                  0 [Verified]
Unknown Batches Referenced in Wastage:                                0 [Verified]
Sales Outlet ID Mismatches with Assigned Batch:                       0 [Verified]
Sales Product ID Mismatches with Assigned Batch:                      0 [Verified]
Wastage Outlet ID Mismatches with Assigned Batch:                    0 [Verified]
Wastage Product ID Mismatches with Assigned Batch:                   0 [Verified]
----------------------------------------------------------------------------------------
Sales Recorded Before Batch Receipt Date:                             0 [Verified]
Sales Recorded After Batch Expiry Date:                               0 [Verified]
Wastage Recorded Before Batch Receipt Date:                           0 [Verified]
Wastage Recorded After Batch Expiry Date:                             0 [Verified]
Sales Transactions Exceeding Available Stock:                         0 [Verified]
Wastage Records Exceeding Remaining Stock:                            0 [Verified]
Negative-Stock Batch-Days:                                            0 [Verified]
Total Negative Quantity:                                              0 [Verified]
Batches Exhausted Before Nominal Expiry:                            236 [Verified]
----------------------------------------------------------------------------------------
Sales on Expiry Date:                                            7,580 (58,064 units)
Wastage on Expiry Date:                                          1,581 (3,341 units)
Post-Expiry Active Closing Inventory Matches:                    80,216 / 80,216 (100.0%)
Expired Quantity at Expiry Matches:                              49,406 (100.0%)
----------------------------------------------------------------------------------------
Module Status: PASS
========================================================================================
```

> [!NOTE]
> **Dataset Expiry Business Rule:** On a batch's expiry date, sales and wastage occur normally during the operating hours. At the end of the day, any remaining unsold and un-wasted quantity is written off as expired (`Expired = quantity_before_expiry`), and the post-expiry closing stock is set to `0`. In `inventory_batches.csv`, the column `remaining_quantity` records this expired balance for expired batches, while active in-stock batches record current shelf inventory.

---

## 4. Task B: Batch-to-Pair Aggregation Consistency Check

To ensure complete algebraic consistency between individual batch balances and aggregated store-product ledger balances, all six daily quantities were compared across all 4,838,440 cells (13,256 pairs $\times$ 365 days):

| Daily Quantity Checked | Total Grid Cells Evaluated | Maximum Absolute Difference ($\\max |\\Delta|$) | Consistency Status |
| :--- | :---: | :---: | :---: |
| **Daily Receipts** | 4,838,440 | **0** | **PASS** |
| **Daily Sales** | 4,838,440 | **0** | **PASS** |
| **Daily Wastage** | 4,838,440 | **0** | **PASS** |
| **Daily Expired Quantity** | 4,838,440 | **0** | **PASS** |
| **Opening Stock** | 4,838,440 | **0** | **PASS** |
| **Closing Stock** | 4,838,440 | **0** | **PASS** |

> [!IMPORTANT]
> **Methodology Qualification:** This check confirms that the pair-level ledger is 100% algebraically consistent with the bottom-up sum of its constituent batches. It is an internal aggregation consistency check, not an external source-of-truth validation.

---

## 5. Task C: Independent Forecasting Target Verification

Target values were verified on the complete catalog grid, with missing transaction days explicitly treated as numerical zeros ($0$):
- **7-Day Target (`target_7d`):** $\sum_{k=1}^7 \text{sales}_{p, t+k}$ for origins $t \in [0, 357]$ (dates `2025-11-16` to `2026-11-08`).
- **30-Day Target (`target_30d`):** $\sum_{k=1}^{30} \text{sales}_{p, t+k}$ for origins $t \in [0, 334]$ (dates `2025-11-16` to `2026-10-16`).

### Target Label Statistics

| Metric | 7-Day Target (`target_7d`) | 30-Day Target (`target_30d`) |
| :--- | :---: | :---: |
| **Eligible Forecast Origins** | 358 origins (`2025-11-16` to `2026-11-08`) | 335 origins (`2025-11-16` to `2026-10-16`) |
| **Total Target Labels** | **4,745,648** | **4,440,760** |
| **Numerical Zero Targets ($= 0$)** | **1,460,750 (30.78%)** | **266,768 (6.01%)** |
| **Positive Targets ($> 0$)** | **3,284,898 (69.22%)** | **4,173,992 (93.99%)** |
| **Minimum Target Value** | 0 units | 0 units |
| **Maximum Target Value** | 280 units | 569 units |
| **Mean Target Value** | 9.5795 units | 41.0801 units |

### Independent Reference Query Spot-Checks (Direct `df_sales` Rows)

The vectorized target arrays were verified against direct queries on raw `df_sales` rows using Boolean filtering:

| Outlet ID | Product ID | Origin $t$ | Origin Date | 7d Window | 7d Direct | 7d Vec | 30d Window | 30d Direct | 30d Vec | Match |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `OUT001` | `PRD047` | 0 | `2025-11-16` | 2025-11-17 to 2025-11-23 | 5 | 5 | 2025-11-17 to 2025-12-16 | 31 | 31 | **MATCH** |
| `OUT002` | `PRD240` | 100 | `2026-02-24` | 2026-02-25 to 2026-03-03 | 0 | 0 | 2026-02-25 to 2026-03-26 | 37 | 37 | **MATCH** |
| `OUT005` | `PRD238` | 200 | `2026-06-04` | 2026-06-05 to 2026-06-11 | 33 | 33 | 2026-06-05 to 2026-07-04 | 234 | 234 | **MATCH** |
| `OUT001` | `PRD047` | 334 | `2026-10-16` | 2026-10-17 to 2026-10-23 | 3 | 3 | 2026-10-17 to 2026-11-15 | 12 | 12 | **MATCH** |
| `OUT001` | `PRD047` | 357 | `2026-11-08` | 2026-11-09 to 2026-11-15 | 6 | 6 | N/A | N/A | N/A | **MATCH** |
| `OUT200` | `PRD155` | 357 | `2026-11-08` | 2026-11-09 to 2026-11-15 | 1 | 1 | N/A | N/A | N/A | **MATCH** |

---

## 6. Task E: Availability Semantics & Observation Categorization

### Four Mutually Exclusive Observation Categories

Across all 4,838,440 catalog cells, observation days are partitioned into four mutually exclusive categories:

```
+-------------------------------------------------------------------------------------------------------------------+
| FOUR MUTUALLY EXCLUSIVE CATALOG OBSERVATION CATEGORIES                                                            |
+---------------------------------------------------+-------------------------------+-------------------------------+
| Category Description                              | Total Catalog Product-Days    | Percentage of Grid            |
+---------------------------------------------------+-------------------------------+-------------------------------+
| 1. Observed Zero Sales with Stock Available       | 3,274,619                     | 67.68%                        |
| 2. Observed Zero Sales with No Stock              | 728,100                       | 15.05%                        |
| 3. Positive Sales with Stock Available            | 834,819                       | 17.25%                        |
| 4. Possible Closure / Zero-Transaction Store-Days | 902                           | 0.02%                         |
+---------------------------------------------------+-------------------------------+-------------------------------+
| Total Catalog Cells (Grid Sum)                    | 4,838,440                     | 100.00%                       |
+---------------------------------------------------+-------------------------------+-------------------------------+
```

> [!CAUTION]
> **Demand Censoring Governance:** Category 2 (728,100 product-days) represents observed zero sales in the presence of an out-of-stock condition. This must **never** be interpreted as confirmed zero customer demand.

### Store Operational Status
- Total Outlets: 200 | Expected Outlet-Days: 73,000
- Operating with Recorded Transactions: 72,973 outlet-days
- Zero-Transaction Days (Possible Store Closure): 27 outlet-days across 19 outlets
  - Stock on Closed Shelves: 727 product-days
  - Stockout on Closed Days: 175 product-days
- Confirmed Closed Days: 0 (Never inferred without explicit records)

### Multi-Threshold Censoring Windows

```
+-------------------------------------------------------------------------------------------------------------------+
| 7-DAY FORECASTING HORIZON (Total Target Windows: 4,745,648)                                                       |
+-------------------+-----------------------------------------------+-----------------------------------------------+
| Availability      | Physical Intraday Stock Availability          | Customer-Accessible Availability              |
| Threshold         | Eligible Windows              Eligible Pct    | Eligible Windows              Eligible Pct    |
+-------------------+-----------------------------------------------+-----------------------------------------------+
| >= 4 of 7 Days    | 4,018,526                     84.68%          | 4,018,517                     84.68%          |
| >= 5 of 7 Days    | 3,957,113                     83.38%          | 3,957,102                     83.38%          |
| >= 6 of 7 Days    | 3,905,675                     82.3%          | 3,905,518                     82.3%          |
| == 7 of 7 Days    | 3,854,524                     81.22%          | 3,849,632                     81.12%          |
| Fully Censored (0)| 523,209                       11.03%          | 523,214                       11.03%          |
+-------------------+-----------------------------------------------+-----------------------------------------------+

+-------------------------------------------------------------------------------------------------------------------+
| 30-DAY FORECASTING HORIZON (Total Target Windows: 4,440,760)                                                      |
+-------------------+-----------------------------------------------+-----------------------------------------------+
| Availability      | Physical Intraday Stock Availability          | Customer-Accessible Availability              |
| Threshold         | Eligible Windows              Eligible Pct    | Eligible Windows              Eligible Pct    |
+-------------------+-----------------------------------------------+-----------------------------------------------+
| >= 15 of 30 Days  | 3,752,033                     84.49%          | 3,752,028                     84.49%          |
| >= 20 of 30 Days  | 3,687,823                     83.04%          | 3,687,593                     83.04%          |
| >= 25 of 30 Days  | 3,507,146                     78.98%          | 3,507,139                     78.98%          |
| == 30 of 30 Days  | 3,403,911                     76.65%          | 3,385,335                     76.23%          |
| Fully Censored (0)| 973                           0.02%           | 973                           0.02%           |
+-------------------+-----------------------------------------------+-----------------------------------------------+
```

---

## 7. Task F: Feature Leakage Validator Suite

The validation function `validate_feature_timestamps()` was verified across 8 automated unit tests:

| Test Case | Condition Audited | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Test 1** | Clean historical features | `is_valid = True`, 0 violations | Clean Pass | **PASS** |
| **Test 2** | `feature_metadata is None` | Reject missing metadata | Caught & Rejected | **PASS** |
| **Test 3** | Untracked feature column | Reject column without metadata | Caught & Rejected | **PASS** |
| **Test 4** | Ghost column in metadata | Reject metadata for unknown column | Caught & Rejected | **PASS** |
| **Test 5** | Malformed date format | Reject non-ISO date string | Caught & Rejected | **PASS** |
| **Test 6** | Future source date ($> t$) | Reject temporal leak | Caught & Rejected | **PASS** |
| **Test 7** | Positive lead days ($> 0$) | Reject future lead index | Caught & Rejected | **PASS** |
| **Test 8** | Suspicious naming pattern | Flag warning while passing validation | Warning Logged | **PASS** |

---

## 8. Task G: Environment Diagnostics & Reversible Indexing

- **`pd.to_datetime` Status:** Unresolved environment issue (SIGSEGV Exit Code -11). Documented honestly without claiming a fix.
- **Production Workaround:** Reversible integer day-indexing $[0..364]$ using stdlib `datetime.fromisoformat` and `timedelta`.
- **Reversibility Assertion:** Verified that `idx_to_d[d_to_idx[d]] == d` holds for all 365 calendar dates with consecutive step differences of exactly 1 day.

---

## 9. Task H: Chronological Temporal Validation Boundaries

```
========================================================================================
TASK H: TEMPORAL SPLIT & PURGE WINDOW AUDIT
========================================================================================
Warm-Up Window:                    2025-11-16 to 2025-12-12 (27 days)
Training Origins:                  2025-12-13 to 2026-07-01 (201 origin dates)
Purge Window:                      2026-07-02 to 2026-07-31 (30 days)
Validation Origins:                2026-08-01 onward
Last Training 7-Day Target End:    2026-07-08 (Within Purge Window)
Last Training 30-Day Target End:   2026-07-31 (Matches Purge Window End Exactly)
First Validation Target Start:     2026-08-02 (Zero Overlap with Training Targets)
Maximum Validation Origin (30-day):2026-10-16 (Target ends 2026-11-15 <= Calendar End)
Maximum Validation Origin (7-day): 2026-11-08 (Target ends 2026-11-15 <= Calendar End)
----------------------------------------------------------------------------------------
Target Leakage Across Split:       0 Overlapping Observations [Verified]
Validation Targets Outside Calendar: 0 Out-of-Bounds Observations [Verified]
Module Status: PASS
========================================================================================
```

---

## 10. Final Decision & Readiness for Phase 2

### Final Status: **APPROVED FOR PHASE 2**

All audit modules have completed with explicit **PASS** statuses based on executable assertions. All report numbers match `audit_summary_phase1_6_2.json` byte-for-byte. The dataset, calendar grid, sequential inventory balances, store operational statuses, and forward forecasting targets are mathematically reconciled and ready for Phase 2 (Feature Engineering).
