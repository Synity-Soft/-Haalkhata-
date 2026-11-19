# BazarBondhu AI — Phase 2: Feature Engineering & Dataset Preparation Report

**Author:** Senior Machine Learning Engineer & Data Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Dataset Directory:** [DataSets/](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets)  
**Output Directory:** [ml/data/](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/data)  
**Feature Metadata:** [ml/features/feature_metadata.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/features/feature_metadata.json)  
**Execution Script:** [ml/scripts/build_features.py](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/build_features.py)  
**Validation Script:** [ml/scripts/validate_features.py](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/scripts/validate_features.py)  
**Machine-Readable Audit:** [ml/reports/phase2_feature_audit.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase2_feature_audit.json)  
**Overall Status:** **ALL_CHECKS_PASSED**  
**Execution Time:** 64.76 s  

---

## 1. Executive Summary & Verification Highlights

Phase 2 (Feature Engineering & Dataset Preparation) has successfully constructed, validated, and exported the production forecasting datasets for BazarBondhu AI. All feature transformations strictly enforce historical availability as of each forecast origin date, preventing temporal data leakage.

### Key Dataset Dimensions

| Horizon Task | Output File | Format | Total Rows | Total Columns | Feature Count | Training Rows | Validation Rows | Audit Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **7-Day Demand** | `model_dataset_7d.csv` | `CSV` | **3,990,056** | **87** | **72** | **2,664,456** | **1,325,600** | **PASS** |
| **30-Day Demand** | `model_dataset_30d.csv` | `CSV` | **3,685,168** | **87** | **72** | **2,664,456** | **1,020,712** | **PASS** |

---

## 2. Feature Provenance & Feature Groups

All **72 engineered features** are registered in `feature_metadata.json` with documented source tables, source columns, transformations, and lead days ($<= 0$).

```
+-----------------------------------+-------------------+---------------------------------------------------+
| Feature Group                     | Count             | Example Features                                  |
+-----------------------------------+-------------------+---------------------------------------------------+
| 1. Historical Sales Features       | 19 features       | sales_lag_1d..28d, sales_sum_7d..28d, std, nonzero|
| 2. Reconstructed Inventory        | 14 features       | current_stock_quantity, stock_received, wastage   |
| 3. Outlet Attributes              | 9 features        | outlet_type, business_size, division, area_type   |
| 4. Product Attributes             | 14 features       | category, subcategory, brand, shelf_life, prices  |
| 5. Calendar & Festival Features   | 13 features       | day_of_week, month, is_ramadan, days_to_festival  |
| 6. Promotional History            | 3 features        | promotion_active_at_origin, promotion_days_last_7d|
+-----------------------------------+-------------------+---------------------------------------------------+
| Total Feature Matrix Columns      | 72 features       | Strictly historical or genuinely future-known     |
+-----------------------------------+-------------------+---------------------------------------------------+
```

### Strict Promotion & Future Information Safeguards
- In `promotions_discounts.csv`, promotions are recorded retrospectively with post-event sales metrics (`units_sold_during_promotion`, `estimated_revenue_bdt`) and lack advance announcement timestamps. Future promotion indicators (`planned_promotion_next_7d/30d`) were intentionally omitted to avoid forward-looking data leakage.
- Target variables (`target_7d`, `target_30d`) and future stock availability metrics (`physical_avail_days`, `accessible_avail_days`, `is_eligible_*`) are strictly segregated from the model feature matrix.

---

## 3. Temporal Split & Purge Architecture (Zero Target Overlap)

The temporal split maintains strict chronological integrity:
- **Warm-Up Window:** `2025-11-16` to `2025-12-12` (27 days): Provides the required 28 days of history for rolling features.
- **Training Origins:** `2025-12-13 to 2026-07-01 (201 origins)`.
- **Purge Window:** `2026-07-02 to 2026-07-31 (30 days)`.
- **Validation Origins (7-day):** `2026-08-01 to 2026-11-08 (100 origins)`.
- **Validation Origins (30-day):** `2026-08-01 to 2026-10-16 (77 origins)`.

### Mathematical Proof of Zero Target Overlap
```
Last Training Origin:               2026-07-01
Last Training 7-Day Target End:     2026-07-08 (Within Purge Window)
Last Training 30-Day Target End:    2026-07-31 (Matches Purge Window End Exactly)
First Validation Target Start:      2026-08-02 (Zero Train/Val Overlap)
Zero Overlap Asserted:              True [PASS]
```

---

## 4. Availability & Multi-Threshold Eligibility Analysis

Observed sales do not equal unconstrained customer demand during stockout or store closure periods. To preserve truth in modeling, observed sales are retained as the forecast target, while multi-threshold availability flags enable principled censoring analysis in Phase 3.

### 7-Day Horizon Censoring Eligibility

| Threshold Policy | Physical Stock (Total) | Physical Stock (Train) | Physical Stock (Val) | Customer Accessible (Total) | Accessible (Train) | Accessible (Val) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **4 / 7 Days** | 3,384,100 (84.81%) | 2,264,502 (84.99%) | 1,119,598 (84.46%) | 3,384,092 (84.81%) | 2,264,496 (84.99%) | 1,119,596 (84.46%) |
| **5 / 7 Days** *(Recommended)* | 3,329,867 (83.45%) | 2,227,264 (83.59%) | 1,102,603 (83.18%) | **3,329,857 (83.45%)** | **2,227,256 (83.59%)** | **1,102,601 (83.18%)** |
| **6 / 7 Days** | 3,284,673 (82.32%) | 2,194,756 (82.37%) | 1,089,917 (82.22%) | 3,284,518 (82.32%) | 2,194,733 (82.37%) | 1,089,785 (82.21%) |
| **7 / 7 Days** | 3,239,916 (81.2%) | 2,163,593 (81.2%) | 1,076,323 (81.2%) | 3,236,404 (81.11%) | 2,160,655 (81.09%) | 1,075,749 (81.15%) |

### 30-Day Horizon Censoring Eligibility

| Threshold Policy | Physical Stock (Total) | Physical Stock (Train) | Physical Stock (Val) | Customer Accessible (Total) | Accessible (Train) | Accessible (Val) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **15 / 30 Days** | 3,113,691 (84.49%) | 2,250,871 (84.48%) | 862,820 (84.53%) | 3,113,686 (84.49%) | 2,250,866 (84.48%) | 862,820 (84.53%) |
| **20 / 30 Days** *(Recommended)* | 3,061,159 (83.07%) | 2,207,389 (82.85%) | 853,770 (83.64%) | **3,060,977 (83.06%)** | **2,207,237 (82.84%)** | **853,740 (83.64%)** |
| **25 / 30 Days** | 2,910,312 (78.97%) | 2,103,683 (78.95%) | 806,629 (79.03%) | 2,910,305 (78.97%) | 2,103,676 (78.95%) | 806,629 (79.03%) |
| **30 / 30 Days** | 2,824,476 (76.64%) | 2,033,749 (76.33%) | 790,727 (77.47%) | 2,810,317 (76.26%) | 2,021,277 (75.86%) | 789,040 (77.3%) |

### Primary Policy Recommendation & Trade-Offs
- **Recommended Primary 7-Day Policy:** `is_eligible_acc_5of7 == 1` (Accessible stock $\ge$ 5 out of 7 days).  
  *Justification:* Retains realistic minor stock fluctuations while eliminating severely censored windows where customers could not purchase the product.
- **Recommended Primary 30-Day Policy:** `is_eligible_acc_20of30 == 1` (Accessible stock $\ge$ 20 out of 30 days).  
  *Justification:* Provides $\approx 67\%$ active shelf coverage, retaining 82.84% of training observations while preventing models from learning artificial zero-demand artifacts caused by chronic stockouts.

---

## 5. Target Distribution & Value-Level Reconciliation

```
+-----------------------------------+-------------------------------+-------------------------------+
| Target Summary Metric             | 7-Day Target (target_7d)      | 30-Day Target (target_30d)    |
+-----------------------------------+-------------------------------+-------------------------------+
| Total Evaluated Rows              | 3,990,056                     | 3,685,168                     |
| Minimum Observed Quantity         | 0 units                         | 0 units                         |
| Maximum Observed Quantity         | 280 units                       | 569 units                       |
| Mean Observed Quantity            | 9.5851 units                      | 41.0686 units                     |
| Numerical Zero Targets            | 1,226,107 (30.73%)            | 221,587 (6.01%)             |
| Invalid Negative Targets          | 0 [PASS]                     | 0 [PASS]                     |
| Spot-Check Fixture Mismatches     | 0 mismatches [PASS]          | 0 mismatches [PASS]          |
+-----------------------------------+-------------------------------+-------------------------------+
```

---

## 6. Environment Diagnostics & Execution Protocol

1. **Python Environment:** Python 3.13.5 (macOS arm64), pandas 2.2.2, numpy 2.4.4.
2. **Parquet vs CSV Format:**
   - In accordance with Section 9 of the Phase 2 specification, because `pyarrow` and `fastparquet` dependencies are not installed in the isolated environment, datasets are generated and exported in high-performance, fully verified CSV format (`model_dataset_7d.csv` and `model_dataset_30d.csv`).
   - If `pyarrow` is installed subsequently, the pipeline automatically detects the engine and produces `.parquet` files.

---

## 7. Commands to Reproduce Pipeline and Audits

```bash
# 1. Generate feature datasets for both 7-day and 30-day forecasting horizons
python3 ml/scripts/build_features.py --horizon all

# 2. Run independent leakage audit and verification suite
python3 ml/scripts/validate_features.py
```

### Final Sign-Off: **PHASE 2 COMPLETE & VERIFIED**
The datasets are immediately ready for **Phase 3: Model Development**.
