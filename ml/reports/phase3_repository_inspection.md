# BazarBondhu AI — Phase 3, Stage 3.1: Repository Inspection & Architectural Audit

**Author:** Senior Machine Learning Engineer & Data Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Repository Root:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar`  
**Execution Stage:** Phase 3, Stage 3.1 (Inspection, Verification & Planning)  

---

## 1. Executive Overview

This inspection establishes the technical baseline for Phase 3 (Model Development) of the BazarBondhu AI demand forecasting system. Prior phases have delivered verified data foundations and feature datasets. In this stage, we inspect the repository architecture, verify feature safety and temporal boundaries, evaluate system execution constraints, and define a reproducible, leak-free modeling roadmap.

**Strict Stage Protocol:** No models have been trained, no existing Phase 1/Phase 2 artifacts have been modified, and the integrity of existing files has been preserved.

---

## 2. Repository Structure & Artifact Inventory

The repository is organized into two primary roots:
- `DataSets/`: Canonical historical relational datasets, dictionary, methodology documentation, and standalone QA scripts.
- `ml/`: Complete machine learning workspace including audit scripts, reports, feature metadata, and processed model-ready datasets.

### Directory Layout

```
/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/
├── DataSets/
│   ├── area_profiles.csv             # 200 outlet-specific socio-economic profiles
│   ├── calendar_events.csv           # 10 official & seasonal Bangladesh calendar events
│   ├── daily_outlet_metrics.csv      # 73,000 outlet-day aggregates (transactions, revenue)
│   ├── data_dictionary.csv           # Master schema and column documentation
│   ├── example_records.md            # Sample records per table
│   ├── inventory_batches.csv         # 80,216 purchase batch records with expiry dates
│   ├── methodology.md                # Synthetic generation assumptions & constraints
│   ├── outlet_products.csv           # 13,256 catalog pairs with pricing and demand parameters
│   ├── outlet_suppliers.csv          # 854 relationship contracts
│   ├── outlets.csv                   # 200 retail outlet records (store types, size, location)
│   ├── products.csv                  # 260 product master catalog records (category, shelf-life)
│   ├── promotions_discounts.csv      # 800 single-day promotion outcome records
│   ├── purchase_order_items.csv      # 53,024 purchase order line items
│   ├── purchase_orders.csv           # 800 purchase order headers
│   ├── sales.csv                     # 834,819 daily outlet-product-batch transaction lines
│   ├── suppliers.csv                 # 120 supplier profiles
│   ├── validate_dataset.py           # Standalone source QA script
│   └── wastage_records.csv           # 3,237 recorded batch wastage events
└── ml/
    ├── configs/                      # [Planned for Stage 3.2] Master model configurations
    ├── data/
    │   ├── model_dataset_7d.csv      # 3,990,056 rows x 87 cols (1,565.8 MB)
    │   └── model_dataset_30d.csv     # 3,685,168 rows x 87 cols (1,453.6 MB)
    ├── features/
    │   └── feature_metadata.json     # Formal provenance registry for all 72 features
    ├── models/                       # [Planned for Stage 3.2] Serialized model artifacts
    │   ├── 7d/
    │   └── 30d/
    ├── predictions/                  # [Planned for Stage 3.2] Out-of-fold & test predictions
    ├── reports/
    │   ├── audit_summary_phase1_6_3.json           # Canonical Phase 1 audit summary
    │   ├── phase1_6_3_verification.md              # Phase 1 verification report
    │   ├── phase2_feature_audit.json               # Canonical Phase 2 feature audit summary
    │   ├── phase2_feature_engineering_report.md    # Phase 2 feature engineering report
    │   ├── phase3_feature_safety_audit.json        # Stage 3.1 72-feature safety audit
    │   ├── phase3_modeling_plan.md                 # Stage 3.1 reproducible modeling plan
    │   └── phase3_repository_inspection.md         # This document
    ├── requirements.txt              # Production dependency specifications
    └── scripts/
        ├── audit_phase1_6_3.py       # Phase 1 verification pipeline
        ├── build_features.py         # Phase 2 chunk-streamed feature generator
        └── validate_features.py      # Phase 2 feature validator & leakage suite
```

---

## 3. Existing Pipeline Architecture & Component Verification

### Phase 1: Data Integrity & Ground Truth Accounting
- **Gregorian Date Span:** Verified spanning `2025-11-16` to `2026-11-15` ($365$ consecutive days) with zero calendar discontinuities and reversible day indexing $[0..364]$.
- **Catalog Integrity:** Exactly $13,256$ outlet-product catalog pairs, $100\%$ active (`is_active = True`), $0$ duplicate pairs, and $0$ unmapped batches, transactions, or wastage records.
- **Batch Lifecycle Accounting:** Batch receipt, sales deductions, wastage deductions, and expiry day write-offs algebraically reconcile across all $80,216$ batches with post-expiry closing stock strictly zero.
- **Target Matrix Reconciliation:** All $9,186,408$ target labels ($4,745,648$ 7-day and $4,440,760$ 30-day labels) match raw transaction sums in `sales.csv` with zero mismatches.
- **Store-Closure Semantics:** Exactly $27$ outlet-days in `daily_outlet_metrics.csv` had zero transactions across $19$ outlets. Mapped across active products, this constitutes exactly $902$ outlet-product-day cells.

### Phase 2: Feature Engineering & Dataset Generation
- **Grain:** One row per `outlet_id + product_id + forecast_origin_date`.
- **Feature Set:** Exactly $72$ model features across 6 functional groups (Historical Sales, Inventory, Outlet, Product, Calendar, Promotions).
- **Target Separation:** Target variables (`target_7d`, `target_30d`) and future stock availability indicators (`physical_avail_days`, `accessible_avail_days`, and 8 binary eligibility threshold flags) are maintained as evaluation-only columns and strictly segregated from the feature matrix.
- **Datasets Produced:**
  - `model_dataset_7d.csv`: $3,990,056$ rows $\times 87$ columns ($2,664,456$ train rows across 201 origins, $1,325,600$ validation rows across 100 origins).
  - `model_dataset_30d.csv`: $3,685,168$ rows $\times 87$ columns ($2,664,456$ train rows across 201 origins, $1,020,712$ validation rows across 77 origins).
- **Leakage Safeguards:** Runtime checks in `validate_features.py` verified that for every historical feature, $\text{max\_source\_timestamp} \le \text{forecast\_origin\_date}$.

---

## 4. Dependencies & Runtime Environment Assessment

A diagnostic probe was executed on the live runtime environment:

```
Python:         3.13.5 (macOS arm64)
numpy:          2.4.4 (INSTALLED)
pandas:         2.2.2 (INSTALLED)
scipy:          1.18.0 (INSTALLED)
scikit-learn:   1.5.1 (INSTALLED)
joblib:         1.4.2 (INSTALLED)
matplotlib:     3.11.1 (INSTALLED)
seaborn:        0.13.2 (INSTALLED)
lightgbm:       NOT INSTALLED
xgboost:        NOT INSTALLED
catboost:       NOT INSTALLED
pyarrow:        NOT INSTALLED
fastparquet:    NOT INSTALLED
```

### Hardware Resource Constraints
- **Logical CPU Cores:** 8 cores (Apple Silicon).
- **Total Physical RAM:** 16.00 GB.
- **Available System RAM:** ~3.64 GB (at inspection time).
- **Free Disk Space:** 16.50 GB.

### Critical Memory Management Implication
The uncompressed on-disk size of `model_dataset_7d.csv` is 1.57 GB, and `model_dataset_30d.csv` is 1.45 GB. In pandas, loading a 1.5 GB CSV with 87 mixed-type columns expands in memory to approximately 4.5–5.5 GB due to object allocations and DataFrame indexing.

**Conclusion:** Attempting to load both complete datasets into memory simultaneously will immediately exceed available RAM (~3.64 GB) and cause an operating system Out-Of-Memory (OOM) termination.

**Mandatory Operational Rule for Phase 3:**
1. Process each forecasting horizon independently (Task A: 7-day first, complete evaluation and save artifacts; then Task B: 30-day).
2. Use selective column loading (`usecols`) to load only the 72 features, entity keys, target, and the primary eligibility flag.
3. Apply dtype downcasting: `float32` for numerical continuous features, `int16`/`int8` for integer features, and `category` for string descriptors.
4. Filter training data to the recommended eligibility subset (`is_eligible_acc_5of7 == 1` for 7d, `is_eligible_acc_20of30 == 1` for 30d). This reduces in-memory training rows by ~17% (down to ~2.23M rows), fitting comfortably within 450–600 MB RAM.

---

## 5. Architectural Reuse Decision

To maintain engineering discipline and adhere to the project timeline:
- **Reuse Existing Datasets:** Do not rebuild `model_dataset_7d.csv` or `model_dataset_30d.csv`. Their schema, content, and targets have been independently verified against raw CSV rows with 0 mismatches.
- **Reuse Feature Metadata:** Use [feature_metadata.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/features/feature_metadata.json) as the canonical feature specification.
- **Reuse Validation Protocols:** Reuse the metrics and slicing definitions established in Phase 2 for consistency across phases.
- **Maintain Clear Separation:** Store model artifacts in `ml/models/` and evaluation outputs in `ml/reports/`, leaving historical datasets untouched.
