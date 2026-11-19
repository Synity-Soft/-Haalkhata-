# BazarBondhu AI — Phase 1.6.3: Final Audit Corrections Report

**Author:** Senior Data Engineer, ML Engineer & Independent Audit Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Dataset Directory:** [DataSets/](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets)  
**Execution Script:** [ml/scripts/audit_phase1_6_3.py](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/audit_phase1_6_3.py)  
**Machine-Readable Summary:** [ml/reports/audit_summary_phase1_6_3.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/audit_summary_phase1_6_3.json)  
**Overall Audit Status:** **ALL_CRITICAL_MODULES_PASSED_WITH_DOCUMENTED_ENVIRONMENT_LIMITATION**  
**Final Recommendation:** **APPROVED FOR PHASE 2**

---

## 1. Executive Summary & Audit Module Statuses

This audit report represents the definitive, technically defensible audit of the BazarBondhu AI dataset, forecasting target construction, inventory accounting, availability semantics, and feature engineering safeguards before starting Phase 2 (Feature Engineering).

All statistics and tables in this report are programmatically rendered directly from the canonical audit summary object (`ml/reports/audit_summary_phase1_6_3.json`), guaranteeing 100% numerical reconciliation with zero manually typed discrepancies.

### Summary of Audit Module Statuses

| # | Audit Module | Verification Scope | Primary Metric Verified | Audit Status |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **Date Validation (Task 4)** | 1,143 unique dates | True Gregorian date parsing; metadata-derived calendar span | **PASS** |
| **2** | **Batch-to-Pair Integrity (Task 3)** | 13,256 Catalog Pairs | 0 duplicates; 100% active; 0 unmapped batches/sales/wastage | **PASS** |
| **3** | **Expiry Accounting (Task 1)** | 80,216 Batches | Day-boundary write-off; post-expiry closing=0; boundary fixtures | **PASS** |
| **4** | **Pair Aggregation (Task B)** | 4,838,440 cells (13,256 pairs $\times$ 365d) | Batch-to-pair aggregation consistency across all 6 quantities | **PASS** |
| **5** | **Full-Grid Targets (Task 2)** | 9,186,408 Target Labels | Full-grid independent reference target check (0 mismatches) | **PASS** |
| **6** | **Availability Semantics** | 4,838,440 Catalog Cells | 4 mutually exclusive observation categories; multi-threshold censoring | **PASS** |
| **7** | **Feature Provenance (Task 5)** | Automated Governance Suite | 3-layer governance model; 12/12 automated unit tests passed | **PASS** |
| **8** | **Environment Diagnostics (Task 6)**| Isolated Subprocess Tests | Unresolved `pd.to_datetime` crash documented honestly; ISO operational | **KNOWN_LIMITATION** |
| **9** | **Temporal Split (Task 7)** | Dynamically Derived Boundaries | 30-day purge window; 0 train/val target overlap | **PASS** |

---

## 2. Concise Change Log: Phase 1.6.2 to Phase 1.6.3 Corrections

1. **Final-Day Expiry Accounting (Task 1):**
   - Corrected the expiry write-off boundary condition from `d == e_idx and e_idx < 364` to `d == e_idx`.
   - Applied expiry-day transactions before write-off, ensuring post-expiry closing stock is strictly zero.
   - Added explicit boundary tests for batches expiring on the first day (`2025-11-16`), middle day (`2026-05-15`), and final day (`2026-11-15`), confirming zero mismatches.
2. **Full-Grid Independent Target Verification (Task 2):**
   - Replaced sample spot-checks with full-grid element-wise verification of all **9,186,408 target labels** ($4,745,648$ 7-day labels and $4,440,760$ 30-day labels).
   - Reference targets were computed directly from raw `sales.csv` rows via independent pandas `groupby(['outlet_id', 'product_id', 'sale_date'])['quantity_sold'].sum().unstack().reindex()`.
   - Result: **0 mismatches, 0 maximum difference** across the entire grid.
3. **Batch-to-Active-Pair Integrity (Task 3):**
   - Verified that all $13,256$ pairs in `outlet_products.csv` have zero duplicate definitions and are 100% active (`is_active = True`).
   - Verified that all $80,216$ batches, $834,819$ sales rows, and $3,237$ wastage rows belong to valid catalog pairs with zero unmapped records.
4. **Gregorian Calendar Date Validation (Task 4):**
   - Audited all unique date strings using true Gregorian date parsing (`date.fromisoformat()`), confirming zero invalid dates.
   - Verified rejection of impossible dates (e.g. `2026-02-30`).
   - Dynamically derived calendar boundaries from dataset metadata: `2025-11-16` to `2026-11-15` (365 days).
5. **3-Layer Feature Provenance and Leakage Governance (Task 5):**
   - Explicitly distinguished: (1) Metadata Validation, (2) Actual Feature Provenance, and (3) Temporal Leakage Validation.
   - Expanded the feature validator to 12 automated unit tests enforcing required schema, date formats, known datasets, and lead/prediction availability.
6. **Honest Environment Diagnostic Status Reporting (Task 6):**
   - Corrected status reporting: the environment diagnostic module reports **KNOWN_LIMITATION** rather than PASS due to the unresolved `pd.to_datetime` SIGSEGV (code -11).
   - Documented the verified reversible ISO-string workaround separately as operational.
7. **Dynamically Derived Temporal Split Boundaries (Task 7):**
   - Removed manual date strings; derived warmup, training, purge, and validation boundaries dynamically.
   - Programmatically asserted that the last training 30-day target resolves on `2026-07-31` (matching purge end), with zero overlap with the first validation target start (`2026-08-02`).
8. **Report Integrity & Verified Diff (Task 8):**
   - Both JSON and Markdown reports are generated from the single canonical summary object.
   - Byte-for-byte diff between consecutive runs was verified programmatically with zero differences.

---

## 3. Task 1: Final-Day Expiry Accounting & Test Fixtures

```
========================================================================================
TASK 1: BATCH EXPIRY ACCOUNTING & LIFECYCLE RECONCILIATION SUMMARY
========================================================================================
Total Batches Audited:                                           80,216
Batches Expiring Within Historical Calendar (e_idx <= 364):      51,204
Batches Active Through Calendar End (e_idx > 364):               29,012
----------------------------------------------------------------------------------------
Post-Expiry Active Closing Inventory == 0 Matches:               51,204 / 51,204 (100.00%)
Expired Quantity Reconciled Against CSV Snapshot:                51,204 / 51,204 (100.00%)
Active Calendar-End Batches Reconciled Against CSV Snapshot:     29,012 / 29,012 (100.00%)
----------------------------------------------------------------------------------------
EXPLICIT EXPIRY BOUNDARY TEST FIXTURES:
1. First Calendar Day (2025-11-16, Day 0):                       106 Batches | Mismatches: 0 [PASS]
2. Middle Calendar Day (2026-05-15, Day 180):                    602 Batches | Mismatches: 0 [PASS]
3. Final Calendar Day (2026-11-15, Day 364):                     1,798 Batches | Mismatches: 0 [PASS]
----------------------------------------------------------------------------------------
Sales Recorded Before Receipt Date:                             0 [Verified]
Sales Recorded After Expiry Date:                               0 [Verified]
Wastage Recorded Before Receipt Date:                           0 [Verified]
Wastage Recorded After Expiry Date:                             0 [Verified]
Sales Transactions Exceeding Available Stock:                   0 [Verified]
Wastage Records Exceeding Remaining Stock:                      0 [Verified]
Negative-Stock Batch-Days:                                      0 [Verified]
Total Negative Quantity:                                        0 [Verified]
Batches Exhausted Legally Before Nominal Expiry:                236 [Verified: Remained 0]
----------------------------------------------------------------------------------------
Module Status: PASS
========================================================================================
```

---

## 4. Task 2: Full-Grid Independent Target Verification

Every eligible outlet-product-origin target label was independently constructed directly from raw `sales.csv` rows and compared element-by-element against the production target matrix:

| Forecasting Target Grid | Eligible Origins | Total Labels Verified | Mismatches Found | Max Absolute Difference | First Mismatch Details | Verification Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **7-Day Target (`target_7d`)** | 358 (`2025-11-16` to `2026-11-08`) | **4,745,648** | **0** | **0** | None | **PASS** |
| **30-Day Target (`target_30d`)**| 335 (`2025-11-16` to `2026-10-16`) | **4,440,760** | **0** | **0** | None | **PASS** |
| **Full Combined Panel Grid** | **358 (7d) / 335 (30d)** | **9,186,408** | **0** | **0** | None | **PASS** |

### Verified Target Label Distribution

```
+---------------------------------------------------+-------------------------------+-------------------------------+
| Target Metric                                     | 7-Day Target (target_7d)      | 30-Day Target (target_30d)    |
+---------------------------------------------------+-------------------------------+-------------------------------+
| Total Target Labels Constructed                   | 4,745,648                     | 4,440,760                     |
| Numerical Zero Targets (= 0)                      | 1,460,750 (30.78%)            | 266,768 (6.01%)              |
| Positive Targets (> 0)                            | 3,284,898 (69.22%)            | 4,173,992 (93.99%)            |
| Minimum Target Value                              | 0 units                         | 0 units                         |
| Maximum Target Value                              | 280 units                       | 569 units                       |
| Mean Target Value                                 | 9.5795 units                      | 41.0801 units                     |
+---------------------------------------------------+-------------------------------+-------------------------------+
```

---

## 5. Task 3: Batch-to-Active-Pair Integrity

```
========================================================================================
TASK 3: BATCH-TO-ACTIVE-PAIR INTEGRITY AUDIT
========================================================================================
Total Outlet-Product Pairs in outlet_products.csv:               13,256
Duplicate (outlet_id, product_id) Definitions:                       0 [Verified]
Active Pairs (is_active == True):                                13,256 (100.00%)
Inactive Pairs (is_active == False):                                 0
----------------------------------------------------------------------------------------
Batch Records with Unmapped (outlet_id, product_id):                  0 [Verified]
Sales Records with Unmapped (outlet_id, product_id):                  0 [Verified]
Wastage Records with Unmapped (outlet_id, product_id):                0 [Verified]
Inactive Pairs with Historical Batches:                               0 [Verified]
Inactive Pairs with Historical Sales:                                 0 [Verified]
Inactive Pairs with Historical Wastage:                               0 [Verified]
----------------------------------------------------------------------------------------
Module Status: PASS
========================================================================================
```

---

## 6. Task 4: Gregorian Calendar Date Validation

```
========================================================================================
TASK 4: GREGORIAN DATE VALIDATION & METADATA CALENDAR
========================================================================================
Metadata-Derived Calendar Start Date:            2025-11-16
Metadata-Derived Calendar End Date:              2026-11-15
Derived Historical Days Span:                    365 Consecutive Days
Total Unique Dates Audited Across 5 Tables:      1,143
Invalid Gregorian Calendar Dates:                0 [Verified]
Impossible Date Rejection Test (2026-02-30):     True [Verified: ValueError Raised]
Daily Calendar Continuity Verified:              True [Verified: Step == 1 Day]
Reversible Index Mapping [0..364] Verified:      True [Verified: idx_to_d[d_to_idx[d]] == d]
----------------------------------------------------------------------------------------
Module Status: PASS
========================================================================================
```

---

## 7. Task 5: Feature Provenance & Leakage Governance Suite

Phase 2 feature engineering is governed by a formal 3-layer architecture:
1. **Layer 1 — Metadata Specification Validation:** Every feature column must declare full provenance metadata (source dataset, source columns, transformation, max source date, forecast origin, lead days, prediction availability).
2. **Layer 2 — Temporal Leakage Validation:** Enforces T_max_source <= T_origin and lead days <= 0.
3. **Layer 3 — Feature-Generation Provenance:** Metadata documents declared lineage; generation scripts must verify runtime computation against the declared source.

### Automated Unit Test Results (12/12 Passed)

| Test Case | Condition Audited | Expected Governance Behavior | Observed Outcome | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Test 1** | Clean historical feature | `is_valid = True`, 0 violations | Clean Pass | **PASS** |
| **Test 2** | `feature_metadata is None` | Reject missing metadata | Caught & Rejected | **PASS** |
| **Test 3** | Untracked column in dataframe | Reject column lacking metadata | Caught & Rejected | **PASS** |
| **Test 4** | Ghost column in metadata | Reject metadata for unknown column | Caught & Rejected | **PASS** |
| **Test 5** | Impossible date (`2026-02-30`) | Reject invalid calendar date | Caught & Rejected | **PASS** |
| **Test 6** | Incorrect origin date mismatch | Reject origin date inconsistency | Caught & Rejected | **PASS** |
| **Test 7** | Unknown source dataset | Reject unregistered dataset | Caught & Rejected | **PASS** |
| **Test 8** | Missing source column in dataset | Reject invalid source column | Caught & Rejected | **PASS** |
| **Test 9** | Future source date ($> t$) | Reject temporal leakage | Caught & Rejected | **PASS** |
| **Test 10**| Positive lead days ($> 0$) | Reject forward-looking lead index | Caught & Rejected | **PASS** |
| **Test 11**| `available_at_prediction=False`| Reject feature unavailable at inference | Caught & Rejected | **PASS** |
| **Test 12**| Suspicious naming pattern | Flag warning while passing validation | Warning Logged | **PASS** |

---

## 8. Task 6: Environment Diagnostics & Operational Workaround

```
========================================================================================
TASK 6: ENVIRONMENT DIAGNOSTICS & HONEST LIMITATION REPORTING
========================================================================================
Python Version:                  3.13.5 (macOS arm64)
Pandas Version:                  2.2.2
NumPy Version:                   2.4.4
Successful Diagnostics:          5 / 6 Tests Passed
----------------------------------------------------------------------------------------
DIAGNOSTIC TEST BREAKDOWN:
1. Import pandas:                                                PASS (Exit Code 0)
2. Read small CSV (calendar_events.csv):                         PASS (Exit Code 0)
3. Read sales.csv chunk (100 rows):                              PASS (Exit Code 0)
4. Basic groupby operation:                                      PASS (Exit Code 0)
5. Stdlib datetime operations:                                   PASS (Exit Code 0)
6. Parse date Series pd.to_datetime:                             FAILED_DIAGNOSTIC (SIGSEGV Exit Code -11)
----------------------------------------------------------------------------------------
Diagnostic Status:               KNOWN_LIMITATION (Diagnostic Failed; Not Marked PASS)
Production Workaround:           Reversible ISO-string + integer indexing [0..364] OPERATIONAL
Workaround Verified:             True (Zero reliance on pd.to_datetime in pipeline)
Module Status:                   KNOWN_LIMITATION
========================================================================================
```

---

## 9. Task 7: Dynamically Derived Temporal Split Validation

```
========================================================================================
TASK 7: DYNAMICALLY DERIVED TEMPORAL SPLIT VALIDATION
========================================================================================
Warm-Up Window:                    2025-11-16 to 2025-12-12 (27 days)
Training Origins:                  2025-12-13 to 2026-07-01 (201 origin dates)
Purge Window:                      2026-07-02 to 2026-07-31 (30 days)
Validation Origins:                2026-08-01 onward
----------------------------------------------------------------------------------------
Last Training 7-Day Target End:    2026-07-08 (Within Purge Window)
Last Training 30-Day Target End:   2026-07-31 (Matches Purge Window End Exactly)
First Validation Target Start:     2026-08-02 (Zero Train/Val Overlap)
Maximum Validation Origin (30-day):2026-10-16 (Target ends 2026-11-15 <= Calendar End)
Maximum Validation Origin (7-day): 2026-11-08 (Target ends 2026-11-15 <= Calendar End)
----------------------------------------------------------------------------------------
Zero Target Overlap Verified:      True [Verified: 0 Overlapping Targets]
Validation Within Historical Span: True [Verified: All Targets Resolve <= 2026-11-15]
Module Status: PASS
========================================================================================
```

---

## 10. Availability Semantics & Observation Categorization

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

---

## 11. Final Independent Assessment & Decision

### Final Status: **APPROVED FOR PHASE 2**

### Assessment Justification:
1. **Mathematical Completeness:** All 9,186,408 forward target labels have been independently verified against raw `sales.csv` rows with **0 mismatches**.
2. **Defensible Accounting:** Expiry accounting writes off remaining inventory on the expiry date, post-expiry closing stock is strictly zero, and snapshot reconciliation is 100.00% across all 80,216 batches.
3. **Honest Environment Disclosure:** The `pd.to_datetime` SIGSEGV is honestly documented as a **KNOWN_LIMITATION**, while the production reversible ISO-string workaround is verified operational.
4. **Reproducibility:** Byte-for-byte identity between runs was verified with zero diff.

The dataset, target arrays, and governance protocols are verified and ready for Phase 2 Feature Engineering.
