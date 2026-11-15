# BazarBondhu AI — Synthetic Dataset
All records are synthetic; not actual Bangladesh retailer/customer/supplier data or a representative survey.
Date range: 2025-11-16 to 2026-11-15 (365 days). Currency BDT; UTF-8; ISO dates; random seed 20261116.
Approximate coordinates in outlets.csv are synthetic district-centre jitter and are not for navigation.

## Files
- `outlets.csv`: 200 rows
- `area_profiles.csv`: 200 rows
- `products.csv`: 260 rows
- `outlet_products.csv`: 13,256 rows
- `suppliers.csv`: 120 rows
- `outlet_suppliers.csv`: 854 rows
- `inventory_batches.csv`: 80,216 rows
- `sales.csv`: 834,819 rows
- `daily_outlet_metrics.csv`: 73,000 rows
- `purchase_orders.csv`: 800 rows
- `purchase_order_items.csv`: 53,024 rows
- `wastage_records.csv`: 3,237 rows
- `promotions_discounts.csv`: 800 rows
- `calendar_events.csv`: 10 rows
- `data_dictionary.csv`: field metadata and examples.
- `methodology.md`: generation assumptions and limitations.
- `relationship_diagram.md`: Mermaid ER diagram.
- `validate_dataset.py`: standalone QA checks.
- `validation_report.txt`: actual checks run for this archive.
- `example_records.md`: first three records of each CSV.

## Important interpretation
- `area_profiles.csv` has 200 outlet-specific profiles, not 40–80 deduplicated neighbourhoods, to preserve outlet variation.
- `sales.csv` is daily outlet-product-batch line-level aggregate data, not individual basket receipts. `transaction_id` identifies a synthetic line; daily transaction counts are line proxies.
- Sales are stock-constrained and batch-linked; they are not latent unconstrained demand.
- Quarterly batches are used for long-life goods and monthly batches for products with shelf life <=30 days. Sales are assigned only before expiry; residual quantities are captured in remaining stock or wastage.
- Area, payday, season and event relationships are synthetic hypotheses and must be tested against real local data before operational use.
- Missing customer estimates are intentional; identifiers and inventory essentials are not intentionally missing.
- Product prices are illustrative reference prices. Outlet-specific prices vary.
## Load
`pd.read_csv("sales.csv", parse_dates=["sale_date"])`. Load dimensions before facts in PostgreSQL.
