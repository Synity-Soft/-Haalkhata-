# BazarBondhu AI — Phase 3, Stage 3.2: Baseline Forecasting & Benchmark Evaluation Report

**Author:** Senior Machine Learning Engineer & Data Engineer  
**Date:** November 17, 2026  
**Project:** BazarBondhu AI (বাজারবন্ধু AI)  
**Execution Stage:** Phase 3, Stage 3.2 (Baseline Benchmarking)  
**Deliverable Documents:**
- [ml/reports/phase3_baseline_benchmark.md](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_baseline_benchmark.md)
- [ml/reports/phase3_baseline_metrics.json](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/reports/phase3_baseline_metrics.json)
**Prediction Artifacts:**
- [ml/predictions/validation_predictions_7d.csv](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/validation_predictions_7d.csv)
- [ml/predictions/validation_predictions_30d.csv](file:///Users/mdshahriarrahman/Hat-Bazar/Hat-Bazar/ml/predictions/validation_predictions_30d.csv)

---

## 1. Methodology & Baseline Definitions

To establish rigorous benchmark performance before introducing machine learning models, three leak-free forecasting baselines were implemented and evaluated across both the 7-day and 30-day forecasting horizons.

### Baseline Specifications

```
+-----------------------------------+-----------------------------------+-----------------------------------+
| Baseline Method                   | 7-Day Forecasting Horizon (7d)    | 30-Day Forecasting Horizon (30d)  |
+-----------------------------------+-----------------------------------+-----------------------------------+
| 1. Recent-Period Persistence      | y_hat = sales_sum_7d              | y_hat = sales_sum_28d * (30 / 28) |
| 2. Historical Rolling Average     | y_hat = sales_mean_28d * 7        | y_hat = sales_mean_28d * 30       |
| 3. Planning Prior (Diagnostic)    | y_hat = avg_daily_demand * 7      | y_hat = avg_daily_demand * 30     |
+-----------------------------------+-----------------------------------+-----------------------------------+
```

- **Baseline 1 — Recent-Period Persistence:**
  Assumes that forward sales volume in the next horizon will replicate recent historical sales. For 7d, it projects the previous 7 days of sales ([t-6, t]). For 30d, it scales the previous 28 days ([t-27, t]) by 30/28.
- **Baseline 2 — Historical Rolling Average Forecast:**
  Projects the 28-day historical daily sales velocity (sales_mean_28d) forward across the entire forecasting window (7 or 30 days). Smoothes transient daily fluctuations and weekend volatility.
- **Baseline 3 — Planning-Prior Benchmark (Diagnostic Comparison):**
  Uses the static assortment baseline demand parameter (outlet_average_daily_demand from outlet_products.csv). As established in Stage 3.1, this feature is classified as **CONDITIONAL**; it is evaluated strictly as an assortment benchmark to evaluate whether central corporate planning estimates track actual observed sales.
- **Baseline 4 (Weekday-Adjusted Heuristic) — Formal Deferral:**
  Evaluated for feasibility. In the 72-feature matrix, day-of-week sales breakdowns are not available per pair without accessing full-history weekday transaction lines or inventing ad-hoc multipliers that risk unverified assumptions. As directed by Section 4, Baseline 4 is formally deferred to the ML modeling stage where GBDT algorithms (HistGradientBoostingRegressor) natively learn day-of-week and weekend interaction effects without hand-crafted heuristic shortcuts.

### Evaluation Metrics
- **MAE:** Mean Absolute Error in physical units.
- **RMSE:** Root Mean Squared Error, penalizing large forecasting errors.
- **WAPE:** Weighted Absolute Percentage Error (sum(|y - y_hat|) / sum(y)). Avoids division-by-zero on zero-sales days (30.73% of 7d targets are zero).
- **Mean Error / Bias:** Mean signed error (mean(y_hat - y)). Positive values indicate systematic over-forecasting (holding/wastage risk); negative values indicate under-forecasting (stockout risk).

---

## 2. Validation Dataset Summary

Both datasets were evaluated strictly on their out-of-time validation partitions:

| Horizon Task | Validation Origins Span | Origins Count | Total Validation Rows | Availability-Eligible Rows | Target Range | Mean Target | Zero Target % |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **7-Day Task** | `2026-08-01` to `2026-11-08` | 100 origins | **1,325,600** | 1,102,601 (83.18%) | 0 to 280 units | 9.5851 units | 30.73% |
| **30-Day Task** | `2026-08-01` to `2026-10-16` | 77 origins | **1,020,712** | 853,740 (83.64%) | 0 to 569 units | 41.0686 units | 6.01% |

- **Missing Values:** Zero nulls across all features, targets, and eligibility indicators.
- **Key Uniqueness:** Unique across all `(outlet_id, product_id, forecast_origin_date)` triples ($13,256$ pairs per origin).

---

## 3. Overall Benchmark Comparison (Population A: All Validation Observations)

The primary evaluation population encompasses **all valid validation observations**, reflecting real-world retail store operations where stockouts and temporary disruptions naturally occur.

### 7-Day Horizon Overall Benchmark (1,325,600 Observations)

| Baseline Method | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) | Benchmark Assessment |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Historical Rolling Average** (`sales_mean_28d * 7`) | **7.0658** | **12.6544** | **73.96%** | **+0.0443** | **BEST BASELINE (Accurate & Unbiased)** |
| **Planning Prior** (`outlet_average_daily_demand * 7`) | 7.6029 | 12.1994 | 79.58% | +2.7970 | Biased Over-Forecast (+29.2% relative) |
| **Recent-Period Persistence** (`sales_sum_7d`) | 8.8011 | 16.2009 | 92.12% | +0.0339 | Highly Volatile; Stockout Vulnerable |

### 30-Day Horizon Overall Benchmark (1,020,712 Observations)

| Baseline Method | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) | Benchmark Assessment |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Historical Rolling Average** (`sales_mean_28d * 30`) | **17.7550** | **32.0077** | **43.19%** | **+0.0623** | **BEST BASELINE (Accurate & Unbiased)** |
| **Recent-Period Persistence** (`sales_sum_28d * 30/28`) | **17.7550** | **32.0077** | **43.19%** | **+0.0623** | Identical (Algebraic Equivalence) |
| **Planning Prior** (`outlet_average_daily_demand * 30`) | 17.9741 | 29.4080 | 43.72% | +11.8180 | Biased Over-Forecast (+28.8% relative) |

---

## 4. Availability-Eligible Comparison (Population B: Secondary Diagnostic)

To separate genuine demand forecasting error from stockout artifacts, we evaluate the availability-eligible subset (>= 5/7 accessible stock days for 7d; >= 20/30 accessible stock days for 30d):

### 7-Day Availability Comparison

| Baseline Method | Population | Observations | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Historical Rolling Average** | All Observations | 1,325,600 | 7.0658 | 12.6544 | 73.96% | +0.0443 |
| **Historical Rolling Average** | **Eligible Subset** | **1,102,601** | **7.9032** | **13.5906** | **70.30%** | **-0.2134** |
| **Recent-Period Persistence** | All Observations | 1,325,600 | 8.8011 | 16.2009 | 92.12% | +0.0339 |
| **Recent-Period Persistence** | Eligible Subset | 1,102,601 | 9.9463 | 17.3143 | 88.47% | -0.2141 |
| **Planning Prior Benchmark** | All Observations | 1,325,600 | 7.6029 | 12.1994 | 79.58% | +2.7970 |
| **Planning Prior Benchmark** | Eligible Subset | 1,102,601 | 7.1025 | 11.8687 | 63.18% | +1.3689 |

### 30-Day Availability Comparison

| Baseline Method | Population | Observations | MAE (units) | RMSE (units) | WAPE (%) | Bias (units) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Historical Rolling Average** | All Observations | 1,020,712 | 17.7550 | 32.0077 | 43.19% | +0.0623 |
| **Historical Rolling Average** | **Eligible Subset** | **853,740** | **19.8771** | **34.5539** | **41.69%** | **+0.0771** |
| **Recent-Period Persistence** | All Observations | 1,020,712 | 17.7550 | 32.0077 | 43.19% | +0.0623 |
| **Recent-Period Persistence** | Eligible Subset | 853,740 | 19.8771 | 34.5539 | 41.69% | +0.0771 |
| **Planning Prior Benchmark** | All Observations | 1,020,712 | 17.9741 | 29.4080 | 43.72% | +11.8180 |
| **Planning Prior Benchmark** | Eligible Subset | 853,740 | 14.0417 | 23.0648 | 29.45% | +6.6870 |

### Key Diagnostic Insights:
1. **The Bias Shift in Planning Prior:** On the overall population, the planning prior over-predicts by +2.80 units (7d) and +11.82 units (30d). On eligible periods, its bias cuts in half (+1.37 for 7d, +6.69 for 30d). This confirms that planning priors represent unconstrained demand, whereas observed retail sales are constrained by store stockouts and closures.
2. **Rolling Average Unbiased Stability:** The historical rolling average achieves virtually zero bias across all observations (+0.04 units for 7d, +0.06 units for 30d) and maintains stable relative accuracy (70.30% WAPE on 7d eligible, 41.69% WAPE on 30d eligible).

---

## 5. Granular Sliced Performance Analysis

### A. Performance by Product Category (7-Day Horizon, All Observations)

| Product Category | Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Baby-care essentials | 30,600 | 6.78 | 71.47% | 87.73% | 64.11% |
| Basic health and hygiene products | 28,200 | 6.67 | 72.87% | 90.30% | 65.42% |
| Beverages and bottled water | 84,300 | 6.51 | 69.97% | 88.02% | 63.33% |
| Biscuits and snacks | 83,300 | 5.95 | 69.68% | 87.12% | 62.77% |
| Bread and bakery products | 39,500 | 2.53 | 182.03% | 185.53% | 658.28% |
| Breakfast products | 35,900 | 6.39 | 70.75% | 88.73% | 64.07% |
| Cooking oil | 75,400 | 10.32 | 69.33% | 86.86% | 62.01% |
| Dairy products | 74,600 | 5.05 | 89.15% | 104.02% | 135.61% |
| Eggs | 38,200 | 10.40 | 99.45% | 127.97% | 108.53% |
| Fish and frozen foods | 31,500 | 1.13 | 197.64% | 197.31% | 1709.60% |
| Flour and baking ingredients | 61,700 | 10.87 | 70.01% | 87.05% | 62.15% |
| Fruits | 63,800 | 4.59 | 84.58% | 104.21% | 146.03% |
| Household cleaning products | 27,700 | 6.54 | 69.54% | 88.01% | 63.01% |
| Instant noodles and packaged food | 34,700 | 6.35 | 71.71% | 90.14% | 64.83% |
| Laundry products | 31,600 | 6.07 | 69.71% | 88.68% | 63.27% |
| Lentils and pulses | 78,500 | 9.94 | 69.66% | 87.49% | 62.61% |
| Meat and poultry | 31,700 | 1.86 | 189.35% | 194.10% | 1064.26% |
| Other daily necessities | 30,300 | 6.32 | 69.91% | 89.01% | 63.35% |
| Personal-care products | 31,000 | 6.54 | 69.94% | 87.41% | 63.52% |
| Rice and grains | 116,100 | 9.75 | 70.42% | 88.34% | 63.21% |
| Spices and condiments | 64,300 | 6.33 | 69.77% | 87.90% | 63.13% |
| Sugar and salt | 71,500 | 10.49 | 69.42% | 87.19% | 62.41% |
| Tea and coffee | 36,600 | 6.48 | 70.36% | 87.41% | 63.30% |
| Toiletries | 27,800 | 6.51 | 71.59% | 88.08% | 64.98% |
| Vegetables | 96,800 | 5.29 | 92.14% | 115.79% | 132.13% |

### B. Performance by Demand Volume Tier (7-Day Horizon)

Demand tiers are defined strictly from forecast-origin historical demand rate (sales_mean_28d * 7):
- **Zero / Intermittent:** < 2 units/week
- **Low Demand:** 2 to < 10 units/week
- **Medium Demand:** 10 to 50 units/week
- **High Demand:** > 50 units/week

| Demand Tier | 7d Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior Bias |
| :--- | :---: | :---: | :---: | :---: | :---: |
| High (>50/wk) | 19,975 | 35.42 | 86.36% | 108.28% | +8.59 |
| Low (2 to <10/wk) | 642,001 | 4.52 | 73.58% | 89.86% | +1.98 |
| Medium (10 to 50/wk) | 396,485 | 13.45 | 71.56% | 91.03% | +2.80 |
| Zero / Intermittent (<2/wk) | 267,139 | 1.58 | 94.65% | 100.74% | +4.32 |

### C. Performance by Outlet Format (7-Day Horizon)

| Outlet Format | Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Grocery shop | 562,600 | 3.98 | 73.76% | 91.89% | 79.62% |
| Grocery store | 404,800 | 4.62 | 74.15% | 92.53% | 81.47% |
| Supermarket | 358,200 | 14.68 | 73.98% | 92.08% | 78.90% |

### D. Performance by Area Profile (7-Day Horizon)

| Area Type Profile | Samples | Rolling Mean MAE | Rolling Mean WAPE | Persistence WAPE | Planning Prior WAPE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Commercial / office areas | 157,500 | 7.40 | 73.49% | 91.88% | 79.39% |
| Garment / industrial worker areas | 125,800 | 5.51 | 72.89% | 92.11% | 76.05% |
| Lower-income / dense urban residential | 158,300 | 5.47 | 73.65% | 91.10% | 77.43% |
| Middle-income residential | 254,800 | 7.81 | 74.39% | 92.39% | 80.73% |
| Mixed-income urban neighbourhoods | 141,500 | 7.35 | 74.04% | 92.90% | 80.00% |
| Premium / affluent residential | 187,700 | 9.70 | 73.83% | 91.75% | 79.19% |
| Rural-market or peri-urban areas | 53,400 | 4.26 | 73.17% | 91.69% | 78.06% |
| Semi-urban / small-town markets | 130,000 | 8.37 | 74.87% | 92.47% | 81.75% |
| University / student areas | 116,600 | 4.07 | 74.17% | 92.71% | 80.83% |

---

## 6. Best Baseline Selection & Benchmark Thresholds

### Selected Primary Baseline: **Historical Rolling Average Forecast**
- **7-Day Horizon Target Benchmark:**  
  **`sales_mean_28d * 7`** achieves **MAE = 7.0658**, **RMSE = 12.6544**, **WAPE = 73.96%**, and **Bias = +0.0443**.
- **30-Day Horizon Target Benchmark:**  
  **`sales_mean_28d * 30`** achieves **MAE = 17.7550**, **RMSE = 32.0077**, **WAPE = 43.19%**, and **Bias = +0.0623**.

### Justification:
1. **Superior Accuracy over Persistence:** Across the 7-day horizon, the 28-day rolling average outperforms recent-period persistence by **18.16 percentage points in WAPE** (73.96% vs 92.12%) and **1.74 units in MAE** (7.07 vs 8.80). Single-week persistence is excessively noisy in retail grocery environments where restocking occurs weekly or bi-weekly.
2. **Virtually Unbiased:** The rolling average exhibits almost zero global bias (+0.0443 units for 7d, +0.0623 units for 30d), whereas the planning prior systematically over-forecasts by +2.7970 units (7d) and +11.8180 units (30d).
3. **Completely Leak-Free:** The rolling average relies strictly on observations in [t-27, t], requiring zero future knowledge.

---

## 7. Statistical & Operational Limitations

1. **Overlapping Validation Target Windows:**
   Consecutive forecast origins have overlapping forward target spans (e.g. origin t target [t+1..t+7] overlaps origin t+1 target [t+2..t+8] by 6 days). While this accurately models real-world daily rolling replenishment decisions, observations are autocorrelated and do not constitute independent statistical draws.
2. **Observed Sales vs Unconstrained Customer Demand:**
   Observed sales are bounded by stock on hand. When an outlet stocks out, actual sales drop to zero regardless of customer demand. Baselines predicting strictly from past sales inherit this historical stockout suppression.
3. **Synthetic Demand Characteristics:**
   The underlying dataset was deterministically generated with retail simulation parameters. Staples (rice, flour, oil) exhibit high volume with low variance, whereas perishables and snacks exhibit higher intermittent zero-sales proportions.

---

## 8. Recommendations for Machine Learning Stages (Stage 3.3 & Stage 3.4)

1. **Target Benchmark Threshold:**
   Any machine learning model trained in Stage 3.3 (`Ridge`) or Stage 3.4 (`HistGradientBoostingRegressor`) must demonstrably beat the **Historical Rolling Average Benchmark**:
   - For 7d: Must beat **WAPE < 73.96%** and **MAE < 7.0658**.
   - For 30d: Must beat **WAPE < 43.19%** and **MAE < 17.7550**.
2. **Where Machine Learning is Expected to Add Value:**
   - **Intermittent & Low-Demand Items:** Historical rolling averages struggle with items selling < 2 units/week. ML tree models with categorical embeddings can leverage cross-outlet category velocity to improve intermittent demand calibration.
   - **Holiday & Festival Spikes:** Rolling averages lag during major festivals (Eid, Pohela Boishakh). GBDTs utilizing `days_until_next_festival` and `is_ramadan` are expected to capture holiday surges that static averages miss.
   - **Inventory Interaction:** Incorporating `current_stock_quantity`, `days_since_last_restock`, and `stock_expiring_next_7d` will allow tree models to account for stock depletion and expiry risks.
