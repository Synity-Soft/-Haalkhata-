# BazarBondhu AI — Machine Learning Phase 1: Dataset Inspection Report

**Date of Inspection:** 2026-11-16 20:40:00

**Dataset Location:** `/Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/DataSets`

**Total CSV Files Found:** 15

---

## 1. Executive Summary

This report documents the dataset inspection for **BazarBondhu AI (বাজারবন্ধু AI)** to establish a product-level demand forecasting model for grocery retail in Bangladesh.

### Core Findings at a Glance:
- **Target Objective:** Predict the quantity of units a specific grocery outlet will sell of a specific product in the next 7 days (`outlet_id`, `product_id`, `next_7_days_sales`).
- **Dataset Suitability:** **HIGHLY SUITABLE.** The repository contains a complete, 365-day continuous sales history (from November 16, 2025 to November 15, 2026) across 200 grocery outlets and 260 products.
- **Data Integrity:** **100% clean foreign keys.** Every sale links to a valid outlet, product, and inventory batch.
- **Zero Missing Dates:** All 365 calendar days have active retail transactions across Bangladesh.
- **Key Modeling Insight:** Grocery sales are intermittent (~82.74% sparsity across active outlet-product days). A full daily panel grid with zero-fill is required for robust lag feature generation.

---

## 2. Dataset Files Summary

| File Name | Size | Rows | Columns | Duplicates | Date Range / Timeline |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `area_profiles.csv` | 0.03 MB | 200 | 19 | 0 | N/A (Dimension/Reference) |
| `calendar_events.csv` | 0.0 MB | 10 | 8 | 0 | 2025-11-25 to 2026-10-20, 2026-02-28 to 2026-11-15 |
| `daily_outlet_metrics.csv` | 5.0 MB | 73,000 | 11 | 0 | 2025-11-16 to 2026-11-15 |
| `data_dictionary.csv` | 0.01 MB | 180 | 9 | 0 | N/A (Dimension/Reference) |
| `inventory_batches.csv` | 7.86 MB | 80,216 | 13 | 0 | 2025-11-16 to 2026-10-17, 2025-11-14 to 2026-10-17, 2025-11-16 to 2028-08-16 |
| `outlet_products.csv` | 0.84 MB | 13,256 | 12 | 0 | N/A (Dimension/Reference) |
| `outlet_suppliers.csv` | 0.05 MB | 854 | 9 | 0 | 2020-05-31 to 2025-10-15 |
| `outlets.csv` | 0.05 MB | 200 | 26 | 0 | N/A (Dimension/Reference) |
| `products.csv` | 0.05 MB | 260 | 18 | 0 | N/A (Dimension/Reference) |
| `promotions_discounts.csv` | 0.08 MB | 800 | 12 | 0 | 2025-11-16 to 2026-10-17, 2025-11-16 to 2026-10-17 |
| `purchase_order_items.csv` | 2.51 MB | 53,024 | 7 | 0 | N/A (Dimension/Reference) |
| `purchase_orders.csv` | 0.06 MB | 800 | 9 | 0 | 2025-11-14 to 2026-02-15, 2025-11-16 to 2026-02-17, 2025-11-16 to 2026-02-17 |
| `sales.csv` | 100.8 MB | 834,819 | 15 | 0 | 2025-11-16 to 2026-11-15 |
| `suppliers.csv` | 0.03 MB | 120 | 12 | 0 | N/A (Dimension/Reference) |
| `wastage_records.csv` | 0.25 MB | 3,237 | 9 | 0 | 2025-11-16 to 2026-11-15 |

---

## 3. Detailed Inspection of Every CSV File

### 3.1 `area_profiles.csv`

- **File Size:** 0.03 MB
- **Dimensions:** 200 rows × 19 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `area_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `division` | `object` | 0 | 0.0% | Complete (0 missing) |
| `district` | `object` | 0 | 0.0% | Complete (0 missing) |
| `neighbourhood` | `object` | 0 | 0.0% | Complete (0 missing) |
| `area_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `income_segment` | `object` | 0 | 0.0% | Complete (0 missing) |
| `population_density` | `object` | 0 | 0.0% | Complete (0 missing) |
| `dominant_customer_groups` | `object` | 0 | 0.0% | Complete (0 missing) |
| `student_population_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `garment_worker_population_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `office_worker_population_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `family_population_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `market_activity_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `tourism_activity_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `price_sensitivity` | `object` | 0 | 0.0% | Complete (0 missing) |
| `preferred_product_categories` | `float64` | 200 | 100.0% | 200 null values |
| `average_shopping_frequency` | `object` | 0 | 0.0% | Complete (0 missing) |
| `payday_effect_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `seasonal_demand_sensitivity` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "area_id": "AR001",
    "division": "Dhaka",
    "district": "Dhaka",
    "neighbourhood": "Banani",
    "area_type": "Premium / affluent residential",
    "income_segment": "High",
    "population_density": "High",
    "dominant_customer_groups": "Premium; affluent residential",
    "student_population_level": "Low",
    "garment_worker_population_level": "Low",
    "office_worker_population_level": "Low",
    "family_population_level": "Medium",
    "market_activity_level": "Medium",
    "tourism_activity_level": "Low",
    "price_sensitivity": "Low",
    "preferred_product_categories": null,
    "average_shopping_frequency": "Weekly",
    "payday_effect_level": "Medium",
    "seasonal_demand_sensitivity": "High"
  },
  {
    "area_id": "AR002",
    "division": "Mymensingh",
    "district": "Mymensingh",
    "neighbourhood": "Banani",
    "area_type": "Premium / affluent residential",
    "income_segment": "High",
    "population_density": "High",
    "dominant_customer_groups": "Premium; affluent residential",
    "student_population_level": "Low",
    "garment_worker_population_level": "Low",
    "office_worker_population_level": "Low",
    "family_population_level": "Medium",
    "market_activity_level": "Very High",
    "tourism_activity_level": "Low",
    "price_sensitivity": "Low",
    "preferred_product_categories": null,
    "average_shopping_frequency": "Daily",
    "payday_effect_level": "High",
    "seasonal_demand_sensitivity": "High"
  }
]
```

### 3.2 `calendar_events.csv`

- **File Size:** 0.0 MB
- **Dimensions:** 10 rows × 8 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `event_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `event_name` | `object` | 0 | 0.0% | Complete (0 missing) |
| `event_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `start_date` | `object` | 0 | 0.0% | 2025-11-25 to 2026-10-20 |
| `end_date` | `object` | 0 | 0.0% | 2026-02-28 to 2026-11-15 |
| `affected_product_categories` | `object` | 0 | 0.0% | Complete (0 missing) |
| `expected_demand_effect` | `object` | 0 | 0.0% | Complete (0 missing) |
| `effect_description` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "event_id": "EV01",
    "event_name": "Winter season",
    "event_type": "Seasonal",
    "start_date": "2025-12-01",
    "end_date": "2026-02-28",
    "affected_product_categories": "Vegetables;Fruits;Beverages",
    "expected_demand_effect": "Mixed",
    "effect_description": "Synthetic seasonal window"
  },
  {
    "event_id": "EV02",
    "event_name": "Ramadan",
    "event_type": "Religious",
    "start_date": "2026-02-18",
    "end_date": "2026-03-19",
    "affected_product_categories": "Rice and grains;Lentils and pulses;Cooking oil;Beverages",
    "expected_demand_effect": "Increase",
    "effect_description": "Illustrative lunar window; confirm actual moon-sighting dates"
  }
]
```

### 3.3 `daily_outlet_metrics.csv`

- **File Size:** 5.0 MB
- **Dimensions:** 73,000 rows × 11 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `metric_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-11-15 |
| `total_discount_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `customer_count_estimate` | `float64` | 1149 | 1.57% | 1149 null values |
| `total_transactions` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `total_units_sold` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `total_revenue_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `estimated_gross_profit_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `unique_products_sold` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `average_transaction_value_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "metric_id": "MET00000001",
    "outlet_id": "OUT001",
    "date": "2025-11-16",
    "total_discount_bdt": 279.32,
    "customer_count_estimate": 18.0,
    "total_transactions": 20,
    "total_units_sold": 93,
    "total_revenue_bdt": 18430.54,
    "estimated_gross_profit_bdt": 2903.07,
    "unique_products_sold": 20,
    "average_transaction_value_bdt": 921.53
  },
  {
    "metric_id": "MET00000002",
    "outlet_id": "OUT001",
    "date": "2025-11-17",
    "total_discount_bdt": 163.32,
    "customer_count_estimate": 15.0,
    "total_transactions": 17,
    "total_units_sold": 87,
    "total_revenue_bdt": 20700.89,
    "estimated_gross_profit_bdt": 3036.08,
    "unique_products_sold": 17,
    "average_transaction_value_bdt": 1217.7
  }
]
```

### 3.4 `data_dictionary.csv`

- **File Size:** 0.01 MB
- **Dimensions:** 180 rows × 9 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `file_name` | `object` | 0 | 0.0% | Complete (0 missing) |
| `column_name` | `object` | 0 | 0.0% | Complete (0 missing) |
| `data_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `description` | `object` | 0 | 0.0% | Complete (0 missing) |
| `example_value` | `object` | 1 | 0.56% | 1 null values |
| `allowed_values` | `float64` | 180 | 100.0% | 180 null values |
| `nullable` | `bool` | 0 | 0.0% | Complete (0 missing) |
| `primary_key` | `bool` | 0 | 0.0% | Complete (0 missing) |
| `foreign_key_reference` | `float64` | 180 | 100.0% | 180 null values |

**Sample Records:**

```json
[
  {
    "file_name": "outlets.csv",
    "column_name": "outlet_id",
    "data_type": "object",
    "description": "Outlet id",
    "example_value": "OUT001",
    "allowed_values": null,
    "nullable": false,
    "primary_key": true,
    "foreign_key_reference": null
  },
  {
    "file_name": "outlets.csv",
    "column_name": "outlet_name",
    "data_type": "object",
    "description": "Outlet name",
    "example_value": "Nobo Bazar 001",
    "allowed_values": null,
    "nullable": false,
    "primary_key": false,
    "foreign_key_reference": null
  }
]
```

### 3.5 `inventory_batches.csv`

- **File Size:** 7.86 MB
- **Dimensions:** 80,216 rows × 13 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `batch_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `supplier_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `batch_received_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-10-17 |
| `manufacturing_date` | `object` | 0 | 0.0% | 2025-11-14 to 2026-10-17 |
| `expiry_date` | `object` | 0 | 0.0% | 2025-11-16 to 2028-08-16 |
| `initial_quantity` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `remaining_quantity` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `purchase_cost_per_unit_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `selling_price_per_unit_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `storage_condition` | `object` | 0 | 0.0% | Complete (0 missing) |
| `batch_status` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "batch_id": "BAT0000001Q1",
    "outlet_id": "OUT001",
    "product_id": "PRD047",
    "supplier_id": "SUP070",
    "batch_received_date": "2025-11-16",
    "manufacturing_date": "2025-11-15",
    "expiry_date": "2026-05-14",
    "initial_quantity": 84,
    "remaining_quantity": 23,
    "purchase_cost_per_unit_bdt": 63.48,
    "selling_price_per_unit_bdt": 73.22,
    "storage_condition": "Ambient",
    "batch_status": "Expired"
  },
  {
    "batch_id": "BAT0000001Q2",
    "outlet_id": "OUT001",
    "product_id": "PRD047",
    "supplier_id": "SUP070",
    "batch_received_date": "2026-02-16",
    "manufacturing_date": "2026-02-14",
    "expiry_date": "2026-08-13",
    "initial_quantity": 88,
    "remaining_quantity": 22,
    "purchase_cost_per_unit_bdt": 61.54,
    "selling_price_per_unit_bdt": 73.22,
    "storage_condition": "Ambient",
    "batch_status": "Expired"
  }
]
```

### 3.6 `outlet_products.csv`

- **File Size:** 0.84 MB
- **Dimensions:** 13,256 rows × 12 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `outlet_product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `selling_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `purchase_cost_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `minimum_stock_level` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `maximum_stock_level` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `reorder_point` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `average_daily_demand` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `demand_variability` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `preferred_supplier_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `is_active` | `bool` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "outlet_product_id": "OP000001",
    "outlet_id": "OUT001",
    "product_id": "PRD047",
    "selling_price_bdt": 73.22,
    "purchase_cost_bdt": 63.07,
    "minimum_stock_level": 1,
    "maximum_stock_level": 16,
    "reorder_point": 2,
    "average_daily_demand": 0.835,
    "demand_variability": 0.227,
    "preferred_supplier_id": "SUP070",
    "is_active": true
  },
  {
    "outlet_product_id": "OP000002",
    "outlet_id": "OUT001",
    "product_id": "PRD217",
    "selling_price_bdt": 38.78,
    "purchase_cost_bdt": 28.08,
    "minimum_stock_level": 1,
    "maximum_stock_level": 5,
    "reorder_point": 2,
    "average_daily_demand": 0.363,
    "demand_variability": 0.396,
    "preferred_supplier_id": "SUP040",
    "is_active": true
  }
]
```

### 3.7 `outlet_suppliers.csv`

- **File Size:** 0.05 MB
- **Dimensions:** 854 rows × 9 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `outlet_supplier_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `supplier_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `relationship_start_date` | `object` | 0 | 0.0% | 2020-05-31 to 2025-10-15 |
| `preferred_supplier` | `bool` | 0 | 0.0% | Complete (0 missing) |
| `average_delivery_time_days` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `supplier_price_level` | `object` | 0 | 0.0% | Complete (0 missing) |
| `payment_method` | `object` | 0 | 0.0% | Complete (0 missing) |
| `supplier_reliability_score` | `float64` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "outlet_supplier_id": "OS00001",
    "outlet_id": "OUT001",
    "supplier_id": "SUP104",
    "relationship_start_date": "2020-07-14",
    "preferred_supplier": true,
    "average_delivery_time_days": 4,
    "supplier_price_level": "Low",
    "payment_method": "Cash",
    "supplier_reliability_score": 0.8
  },
  {
    "outlet_supplier_id": "OS00002",
    "outlet_id": "OUT001",
    "supplier_id": "SUP112",
    "relationship_start_date": "2022-04-01",
    "preferred_supplier": false,
    "average_delivery_time_days": 5,
    "supplier_price_level": "Low",
    "payment_method": "Cash",
    "supplier_reliability_score": 0.81
  }
]
```

### 3.8 `outlets.csv`

- **File Size:** 0.05 MB
- **Dimensions:** 200 rows × 26 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_name` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `business_size` | `object` | 0 | 0.0% | Complete (0 missing) |
| `division` | `object` | 0 | 0.0% | Complete (0 missing) |
| `district` | `object` | 0 | 0.0% | Complete (0 missing) |
| `city` | `object` | 0 | 0.0% | Complete (0 missing) |
| `neighbourhood` | `object` | 0 | 0.0% | Complete (0 missing) |
| `area_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `socioeconomic_segment` | `object` | 0 | 0.0% | Complete (0 missing) |
| `estimated_customer_profile` | `object` | 0 | 0.0% | Complete (0 missing) |
| `average_daily_customers` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `average_transaction_value_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `average_monthly_revenue_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `approximate_latitude` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `approximate_longitude` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `operating_hours` | `object` | 0 | 0.0% | Complete (0 missing) |
| `opening_days` | `object` | 0 | 0.0% | Complete (0 missing) |
| `inventory_capacity_sku` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `average_restock_frequency_days` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `supplier_count` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `has_refrigeration` | `bool` | 0 | 0.0% | Complete (0 missing) |
| `has_pos_system` | `bool` | 0 | 0.0% | Complete (0 missing) |
| `inventory_management_method` | `object` | 0 | 0.0% | Complete (0 missing) |
| `established_year` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `area_id` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "outlet_id": "OUT001",
    "outlet_name": "Nobo Bazar 001",
    "outlet_type": "Grocery store",
    "business_size": "Medium",
    "division": "Dhaka",
    "district": "Dhaka",
    "city": "Dhaka",
    "neighbourhood": "Banani",
    "area_type": "Premium / affluent residential",
    "socioeconomic_segment": "High",
    "estimated_customer_profile": "Premium; affluent residential",
    "average_daily_customers": 396,
    "average_transaction_value_bdt": 589.03,
    "average_monthly_revenue_bdt": 6410821.79,
    "approximate_latitude": 23.777465,
    "approximate_longitude": 90.366106,
    "operating_hours": "09:00-23:00",
    "opening_days": "6-7 days",
    "inventory_capacity_sku": 1200,
    "average_restock_frequency_days": 8,
    "supplier_count": 6,
    "has_refrigeration": true,
    "has_pos_system": false,
    "inventory_management_method": "Manual ledger",
    "established_year": 2011,
    "area_id": "AR001"
  },
  {
    "outlet_id": "OUT002",
    "outlet_name": "Shapla Bazar 002",
    "outlet_type": "Grocery store",
    "business_size": "Medium",
    "division": "Mymensingh",
    "district": "Mymensingh",
    "city": "Mymensingh",
    "neighbourhood": "Banani",
    "area_type": "Premium / affluent residential",
    "socioeconomic_segment": "High",
    "estimated_customer_profile": "Premium; affluent residential",
    "average_daily_customers": 441,
    "average_transaction_value_bdt": 364.42,
    "average_monthly_revenue_bdt": 5069713.48,
    "approximate_latitude": 24.755649,
    "approximate_longitude": 90.427713,
    "operating_hours": "09:00-23:00",
    "opening_days": "6-7 days",
    "inventory_capacity_sku": 1200,
    "average_restock_frequency_days": 8,
    "supplier_count": 7,
    "has_refrigeration": true,
    "has_pos_system": true,
    "inventory_management_method": "POS software",
    "established_year": 2007,
    "area_id": "AR002"
  }
]
```

### 3.9 `products.csv`

- **File Size:** 0.05 MB
- **Dimensions:** 260 rows × 18 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_name` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_name_bn` | `object` | 0 | 0.0% | Complete (0 missing) |
| `category` | `object` | 0 | 0.0% | Complete (0 missing) |
| `subcategory` | `object` | 0 | 0.0% | Complete (0 missing) |
| `brand` | `object` | 0 | 0.0% | Complete (0 missing) |
| `unit` | `object` | 0 | 0.0% | Complete (0 missing) |
| `package_size` | `object` | 0 | 0.0% | Complete (0 missing) |
| `perishable_status` | `object` | 0 | 0.0% | Complete (0 missing) |
| `typical_shelf_life_days` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `storage_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `average_cost_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `average_selling_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `minimum_margin_percentage` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `demand_volatility` | `object` | 0 | 0.0% | Complete (0 missing) |
| `seasonal_sensitivity` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_popularity` | `object` | 0 | 0.0% | Complete (0 missing) |
| `is_essential_item` | `bool` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "product_id": "PRD001",
    "product_name": "Miniket rice",
    "product_name_bn": "মিনিকেট চাল",
    "category": "Rice and grains",
    "subcategory": "Rice",
    "brand": "Unbranded",
    "unit": "kg",
    "package_size": "1 kg",
    "perishable_status": "Non-perishable",
    "typical_shelf_life_days": 365,
    "storage_type": "Ambient",
    "average_cost_price_bdt": 72.0,
    "average_selling_price_bdt": 82.0,
    "minimum_margin_percentage": 12.2,
    "demand_volatility": "High",
    "seasonal_sensitivity": "Medium",
    "product_popularity": "Low",
    "is_essential_item": true
  },
  {
    "product_id": "PRD002",
    "product_name": "Nazirshail rice",
    "product_name_bn": "নাজিরশাইল চাল",
    "category": "Rice and grains",
    "subcategory": "Rice",
    "brand": "Local brand",
    "unit": "kg",
    "package_size": "1 kg",
    "perishable_status": "Non-perishable",
    "typical_shelf_life_days": 365,
    "storage_type": "Ambient",
    "average_cost_price_bdt": 78.0,
    "average_selling_price_bdt": 90.0,
    "minimum_margin_percentage": 13.33,
    "demand_volatility": "High",
    "seasonal_sensitivity": "High",
    "product_popularity": "High",
    "is_essential_item": true
  }
]
```

### 3.10 `promotions_discounts.csv`

- **File Size:** 0.08 MB
- **Dimensions:** 800 rows × 12 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `promotion_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `batch_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `start_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-10-17 |
| `end_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-10-17 |
| `original_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `discounted_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `discount_percentage` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `promotion_reason` | `object` | 0 | 0.0% | Complete (0 missing) |
| `units_sold_during_promotion` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `estimated_revenue_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "promotion_id": "PROM00001",
    "outlet_id": "OUT157",
    "product_id": "PRD092",
    "batch_id": "BAT0010411Q3",
    "start_date": "2026-01-17",
    "end_date": "2026-01-17",
    "original_price_bdt": 14.88,
    "discounted_price_bdt": 14.14,
    "discount_percentage": 5.0,
    "promotion_reason": "Volume promotion",
    "units_sold_during_promotion": 4,
    "estimated_revenue_bdt": 56.54
  },
  {
    "promotion_id": "PROM00002",
    "outlet_id": "OUT053",
    "product_id": "PRD027",
    "batch_id": "BAT0004241Q4",
    "start_date": "2026-08-17",
    "end_date": "2026-08-17",
    "original_price_bdt": 25.0,
    "discounted_price_bdt": 21.25,
    "discount_percentage": 15.0,
    "promotion_reason": "Volume promotion",
    "units_sold_during_promotion": 2,
    "estimated_revenue_bdt": 42.5
  }
]
```

### 3.11 `purchase_order_items.csv`

- **File Size:** 2.51 MB
- **Dimensions:** 53,024 rows × 7 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `purchase_order_item_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `purchase_order_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `quantity_ordered` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `quantity_received` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `unit_purchase_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `line_total_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "purchase_order_item_id": "POI00000001",
    "purchase_order_id": "PO000001",
    "product_id": "PRD047",
    "quantity_ordered": 84,
    "quantity_received": 84,
    "unit_purchase_price_bdt": 63.48,
    "line_total_bdt": 5332.32
  },
  {
    "purchase_order_item_id": "POI00000002",
    "purchase_order_id": "PO000001",
    "product_id": "PRD217",
    "quantity_ordered": 46,
    "quantity_received": 46,
    "unit_purchase_price_bdt": 27.32,
    "line_total_bdt": 1256.72
  }
]
```

### 3.12 `purchase_orders.csv`

- **File Size:** 0.06 MB
- **Dimensions:** 800 rows × 9 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `purchase_order_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `supplier_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `order_date` | `object` | 0 | 0.0% | 2025-11-14 to 2026-02-15 |
| `expected_delivery_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-02-17 |
| `actual_delivery_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-02-17 |
| `order_status` | `object` | 0 | 0.0% | Complete (0 missing) |
| `total_order_value_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `payment_status` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "purchase_order_id": "PO000001",
    "outlet_id": "OUT001",
    "supplier_id": "SUP070",
    "order_date": "2025-11-14",
    "expected_delivery_date": "2025-11-16",
    "actual_delivery_date": "2025-11-16",
    "order_status": "Received",
    "total_order_value_bdt": 1149525.36,
    "payment_status": "Paid"
  },
  {
    "purchase_order_id": "PO000002",
    "outlet_id": "OUT001",
    "supplier_id": "SUP070",
    "order_date": "2025-12-15",
    "expected_delivery_date": "2025-12-17",
    "actual_delivery_date": "2025-12-17",
    "order_status": "Received",
    "total_order_value_bdt": 1124003.08,
    "payment_status": "Paid"
  }
]
```

### 3.13 `sales.csv`

- **File Size:** 100.8 MB
- **Dimensions:** 834,819 rows × 15 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `sale_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `transaction_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `batch_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `sale_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-11-15 |
| `sale_time` | `object` | 0 | 0.0% | Complete (0 missing) |
| `quantity_sold` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `unit_selling_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `unit_cost_price_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `discount_percentage` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `total_sales_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `total_cost_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `payment_method` | `object` | 0 | 0.0% | Complete (0 missing) |
| `customer_segment` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "sale_id": "SALE000000001",
    "transaction_id": "TX000000001",
    "outlet_id": "OUT001",
    "product_id": "PRD047",
    "batch_id": "BAT0000001Q1",
    "sale_date": "2025-11-16",
    "sale_time": "21:34:00",
    "quantity_sold": 3,
    "unit_selling_price_bdt": 71.76,
    "unit_cost_price_bdt": 63.48,
    "discount_percentage": 2.0,
    "total_sales_bdt": 215.28,
    "total_cost_bdt": 190.43,
    "payment_method": "Cash",
    "customer_segment": "Student"
  },
  {
    "sale_id": "SALE000000002",
    "transaction_id": "TX000000002",
    "outlet_id": "OUT001",
    "product_id": "PRD047",
    "batch_id": "BAT0000001Q1",
    "sale_date": "2025-11-20",
    "sale_time": "09:56:00",
    "quantity_sold": 5,
    "unit_selling_price_bdt": 71.76,
    "unit_cost_price_bdt": 63.48,
    "discount_percentage": 2.0,
    "total_sales_bdt": 358.8,
    "total_cost_bdt": 317.38,
    "payment_method": "Card",
    "customer_segment": "Office worker"
  }
]
```

### 3.14 `suppliers.csv`

- **File Size:** 0.03 MB
- **Dimensions:** 120 rows × 12 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `supplier_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `supplier_name` | `object` | 0 | 0.0% | Complete (0 missing) |
| `supplier_type` | `object` | 0 | 0.0% | Complete (0 missing) |
| `division` | `object` | 0 | 0.0% | Complete (0 missing) |
| `district` | `object` | 0 | 0.0% | Complete (0 missing) |
| `operating_area` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_categories_supplied` | `object` | 0 | 0.0% | Complete (0 missing) |
| `average_delivery_time_days` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `minimum_order_value_bdt` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `reliability_score` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `payment_terms` | `object` | 0 | 0.0% | Complete (0 missing) |
| `contact_type` | `object` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "supplier_id": "SUP001",
    "supplier_name": "Eastern Wholesale 001",
    "supplier_type": "Local agricultural supplier",
    "division": "Barishal",
    "district": "Barishal",
    "operating_area": "Barishal and nearby markets",
    "product_categories_supplied": "Eggs;Meat and poultry;Flour and baking ingredients;Instant noodles and packaged food;Beverages and bottled water",
    "average_delivery_time_days": 2,
    "minimum_order_value_bdt": 20000,
    "reliability_score": 0.85,
    "payment_terms": "15 days",
    "contact_type": "Fictional business contact"
  },
  {
    "supplier_id": "SUP002",
    "supplier_name": "Sunrise Trading 002",
    "supplier_type": "Regional supplier",
    "division": "Chattogram",
    "district": "Chattogram",
    "operating_area": "Chattogram and nearby markets",
    "product_categories_supplied": "Flour and baking ingredients;Meat and poultry;Tea and coffee;Vegetables;Fish and frozen foods",
    "average_delivery_time_days": 5,
    "minimum_order_value_bdt": 5000,
    "reliability_score": 0.86,
    "payment_terms": "15 days",
    "contact_type": "Fictional business contact"
  }
]
```

### 3.15 `wastage_records.csv`

- **File Size:** 0.25 MB
- **Dimensions:** 3,237 rows × 9 columns
- **Duplicate Rows:** 0

**Columns & Types:**

| Column Name | Data Type | Null Count | Null % | Value Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `wastage_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `outlet_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `product_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `batch_id` | `object` | 0 | 0.0% | Complete (0 missing) |
| `wastage_date` | `object` | 0 | 0.0% | 2025-11-16 to 2026-11-15 |
| `wasted_quantity` | `int64` | 0 | 0.0% | Complete (0 missing) |
| `wastage_reason` | `object` | 0 | 0.0% | Complete (0 missing) |
| `unit_cost_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |
| `total_wastage_value_bdt` | `float64` | 0 | 0.0% | Complete (0 missing) |

**Sample Records:**

```json
[
  {
    "wastage_id": "WST0000001",
    "outlet_id": "OUT001",
    "product_id": "PRD161",
    "batch_id": "BAT0000008Q4",
    "wastage_date": "2026-11-15",
    "wasted_quantity": 6,
    "wastage_reason": "Unsold seasonal stock",
    "unit_cost_bdt": 92.49,
    "total_wastage_value_bdt": 554.94
  },
  {
    "wastage_id": "WST0000002",
    "outlet_id": "OUT001",
    "product_id": "PRD011",
    "batch_id": "BAT0000009Q1",
    "wastage_date": "2026-02-15",
    "wasted_quantity": 2,
    "wastage_reason": "Unsold seasonal stock",
    "unit_cost_bdt": 32.38,
    "total_wastage_value_bdt": 64.76
  }
]
```

---

## 4. Entity Relationships and Foreing Key Validation

The database schema reflects a realistic retail enterprise system:

```text
                      ┌──────────────────────┐
                      │    AREA_PROFILES     │ (AR001 - AR200)
                      └──────────┬───────────┘
                                 │ (area_id)
                                 ▼
┌──────────────────┐  (outlet_id) ┌──────────────────────┐  (outlet_id) ┌──────────────────────┐
│ CALENDAR_EVENTS  ├─────────────>│       OUTLETS        │<─────────────┤ DAILY_OUTLET_METRICS │
└──────────────────┘              └──────────┬───────────┘              └──────────────────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │ (outlet_id)        │ (outlet_id)        │ (outlet_id)
                        ▼                    ▼                    ▼
               ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
               │ OUTLET_PRODUCTS │  │INVENTORY_BATCHES│  │ PURCHASE_ORDERS │
               └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
                        │                    │                    │ (PO id)
                        │ (product_id)       │ (batch_id)         ▼
                        ▼                    ▼           ┌─────────────────┐
               ┌─────────────────┐  ┌─────────────────┐  │PURCHASE_ORD_ITEM│
               │    PRODUCTS     │  │      SALES      │  └─────────────────┘
               └─────────────────┘  └────────┬────────┘
                                             │ (batch_id)
                                             ▼
                                    ┌─────────────────┐
                                    │ WASTAGE_RECORDS │
                                    └─────────────────┘
```

### Cross-Table ID Verification:

1. **`outlet_id` Consistency:**
   - Master outlets in `outlets.csv`: **200** unique outlets.
   - Outlets in `sales.csv`: **200** outlets (100% match master: **True**).
   - Outlets in `daily_outlet_metrics.csv`: **200** outlets (100% match: **True**).
   - Outlets in `outlet_products.csv`: **200** outlets (100% match: **True**).
   - Area link in `outlets.csv` to `area_profiles.csv`: **True**.

2. **`product_id` Consistency:**
   - Master catalog in `products.csv`: **260** products.
   - Products active in `sales.csv`: **260** products (100% match master: **True**).
   - Products active in `outlet_products.csv`: **260** products (100% match: **True**).

3. **`batch_id` Consistency:**
   - Master inventory batches in `inventory_batches.csv`: **80,216** batches.
   - Batches depleted in `sales.csv`: **70,949** batches (100% match master: **True**).
   - Wastage batch reference in `wastage_records.csv`: Valid (**True**).

## 5. Forecasting Suitability & Target Assessment

### 5.1 Target Variable Definition
Our objective is to forecast the total unit sales of a specific product at a specific outlet for the upcoming 7 days:

$$\text{Target}_{i, j, t} = \sum_{k=1}^{7} \text{quantity\_sold}_{i, j, t+k}$$

Where:
- $i$ = `outlet_id` (e.g. `OUT001` to `OUT200`)
- $j$ = `product_id` (e.g. `PRD001` to `PRD260`)
- $t$ = Forecast origin date

### 5.2 Temporal Span & Granularity

- **Earliest Sale Date:** `2025-11-16`
- **Latest Sale Date:** `2026-11-15`
- **Total Timeline:** **365 calendar days** (exactly 52 full weeks)
- **Active Days with Sales:** **365 days** (0 missing dates across the network)
- **Training Samples Available:** Up to 358 forecast origin dates per active pair (reserving the final 7 days for ground-truth calculation).

### 5.3 Aggregation & Sparsity Analysis

- In `sales.csv`, transactions are recorded at the batch-depletion level. Aggregating by `(outlet_id, product_id, sale_date)` yields **834,819** daily sales records.
- Across all **13,254** active store-product pairs over 365 days, total possible grid cells = 4,837,710.
- **Observed Sparsity (Zero-Sales Rate): ~82.74%**.

**What this means for a grocery shopkeeper:**
Many grocery products (like spices, flour, mustard oil, noodles) sell in bursts rather than every single day. When creating training data, we must construct a full daily grid and explicitly fill unsold days with `quantity_sold = 0`. Otherwise, models will overestimate demand by only learning from days when items were actually bought!

### 5.4 Data Leakage Warnings & Prevention

Data leakage occurs when an ML model uses information that would not be available in real life at forecast time. The following columns from `sales.csv` must be **excluded** from feature engineering:

| Column in `sales.csv` | Leakage Reason | Safe Alternative |
| :--- | :--- | :--- |
| `discount_percentage` | Recorded at checkout. Future transaction discounts are unknown unless planned. | Use planned promotions from `promotions_discounts.csv` or historical 14-day average discount. |
| `total_sales_bdt` / `total_cost_bdt` | Direct arithmetic consequence of units sold in that sale. | Use rolling historical revenue lags only. |
| `payment_method` | Selected by the shopper at the counter (Cash, Card, MFS). | Exclude completely from demand forecasting. |
| `customer_segment` | Classified during checkout. | Use static area customer mix from `area_profiles.csv`. |
| `sale_time` | Exact timestamp of a single transaction. | Exclude; we forecast aggregated 7-day volume. |

## 6. Final Recommendations & Roadmap

### 1. Is the dataset suitable for 7-day demand forecasting?
**Yes, it is highly suitable and production-ready for ML.** It covers a full 365-day annual cycle, capturing weekday/weekend cycles, end-of-month paydays, seasonal transitions (Winter, Summer, Monsoon), and major cultural/religious festivals (Ramadan, Eid-ul-Fitr, Eid-ul-Adha, Pohela Boishakh, Durga Puja).

### 2. Which CSV files should we use?
We recommend using 5 interconnected tables:

1. **`sales.csv`** — The ground truth for daily sales volume and historical demand lags.
2. **`products.csv`** — Product metadata: category, subcategory, unit, shelf life, perishability, reference price.
3. **`outlets.csv`** — Store characteristics: business size, refrigeration capability, city, division.
4. **`area_profiles.csv`** — Socioeconomic traits: income segment, population density, student/garment worker presence, price sensitivity.
5. **`calendar_events.csv`** — Event dates: upcoming festivals, holiday windows, seasonal transitions.

### 3. Which columns are likely to be our model features?

- **Historical Sales Lag Features:**
  - 7-day lag sales, 14-day lag sales, 28-day lag sales
  - 7-day rolling mean, 14-day rolling mean, 28-day rolling mean
  - Rolling standard deviation (demand volatility)
  - Days since last sale
- **Temporal & Calendar Features:**
  - Day of week, day of month, month
  - Is weekend (Friday/Saturday in Bangladesh)
  - Days until next major festival (e.g., Ramadan, Eid)
  - Is payday window (25th to 5th of month)
- **Product Attributes:**
  - `category`, `subcategory`, `perishable_status`, `typical_shelf_life_days`, `average_selling_price_bdt`, `is_essential_item`
- **Store & Demographic Attributes:**
  - `business_size`, `has_refrigeration`, `area_type`, `income_segment`, `student_population_level`, `garment_worker_population_level`

### 4. What should our prediction target be?
**`next_7_days_sales_units`**: The cumulative integer/float sum of units sold for a specific `(outlet_id, product_id)` over the forward horizon $[t+1, t+7]$.

### 5. What data cleaning & preparation is required?
1. **Daily Aggregation:** Aggregate line transactions in `sales.csv` to one record per `(outlet_id, product_id, sale_date)`.
2. **Complete Cartesian Grid:** Expand to a complete grid of `(outlet_id, product_id, date)` so unrecorded sales days become explicit zeros.
3. **Forward Rolling Window Calculation:** Calculate forward 7-day sum for each record, dropping the final 7 days where future truth cannot be observed.
4. **Categorical Encoding:** One-hot or Target-encode `category`, `area_type`, `business_size`, and `income_segment`.

### 6. What problems might affect model accuracy?
- **Stockout Truncation:** Sales drop to zero when stock runs out, masking real customer demand.
- **High Variance during Festivals:** Sudden 2x–5x demand spikes during Eid or Ramadan can distort predictions unless festival proximity features are supplied.
- **Intermittent Demand for Niche Items:** High proportion of zero sales for slow-moving products.

### 7. What should be our next ML development step?
**Phase 2: Feature Engineering & Dataset Generation.**
Build an automated pipeline script (`ml/scripts/create_features.py`) that aggregates the daily panel grid, computes the rolling lags and calendar features, creates the 7-day forward target, and splits into train/validation sets.


---

## 7. Phase 1 Verification and Audit

A comprehensive technical audit was executed to verify the mathematical and empirical accuracy of the findings. The complete audit report is available in [phase1_verification.md](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase1_verification.md).

### Summary of Audit Findings & Corrections:

1. **Zero-Sales Mathematical Derivation:**
   - In `sales.csv`, every line is already at daily level per `(outlet_id, product_id, sale_date)` (834,819 rows; max transactions per day = 1).
   - **Grid A (Active Sales Pairs):** $13,254 \times 365 = 4,837,710$ cells; 834,819 non-zero; **82.7435% zero sales**.
   - **Grid B (Catalog Listed Pairs in `outlet_products.csv`):** $13,256 \times 365 = 4,838,440$ cells; **82.7461% zero sales**. Exactly 2 active listed pairs (`('OUT053', 'PRD132')` and `('OUT139', 'PRD018')`) recorded zero sales across the entire year.
   - **Grid C (Unconstrained Universe):** $200 \times 260 \times 365 = 18,980,000$ cells; **95.6016% zero sales**.

2. **Missing-Value Refinement:**
   - 13 CSVs have 0.00% missing values.
   - `area_profiles.csv`: `preferred_product_categories` is **100% missing (200/200 nulls)**. Drop this column during feature engineering.
   - `daily_outlet_metrics.csv`: `customer_count_estimate` has **1,149 nulls (1.57%)**, limited to manual ledger stores.

3. **Foreign Key Integrity:**
   - 23 cross-table relationships verified with **100.0% referential integrity (0 orphan keys/rows)**.

4. **Multi-Level Continuity & Calendar Nuances:**
   - *Network level:* Continuous 365 days.
   - *Outlet level:* 181 outlets operated 365 days; 19 smaller outlets had 1–3 non-trading days where zero transactions occurred.
   - *SKU level:* Highly intermittent (median 72 sales days per pair in a year; maximum 92 sales days).
   - *Perishable inventory truncation:* 56 perishable products ceased selling in late October / early November 2026 because batch deliveries stopped on `2026-10-17`.
   - *Payday Cycle Warning:* In `calendar_events.csv`, Payday Cycle is recorded with start `2025-11-25` and end `2026-11-15`. It must be modeled as recurring monthly windows (days 25 to 5) rather than a single static date filter.

5. **Python 3.13 / Pandas 2.2.2 Segfault (Code 139) Resolution:**
   - Segfault was caused by calling `pd.to_datetime` or instantiating `datetime64` Series on Python 3.13 arm64 due to Cython ABI changes.
   - Safe architecture established: Treat dates as ISO strings (`YYYY-MM-DD`). Lexicographical string comparisons are mathematically equivalent to chronological comparisons. Compute temporal components via string slicing and pre-computed lookup dictionaries.

6. **Temporal Anti-Leakage Protocol:**
   - Exclude the final 7 days (`2026-11-09` to `2026-11-15`) from target labels because future actuals are incomplete.
   - Implement a strict 7-day purge buffer between the training set and validation set to prevent forward-looking target overlap.
