"""
BazarBondhu AI — Database Seeding Script
========================================

Seeds the persistent SQLite database (bazarbondhu.db) from the authoritative CSV datasets
in DataSets/ using SQLAlchemy 2.0 with strict foreign key constraints and transactional integrity.

Key Features:
1. Enforces topological dependency order (outlets -> products -> suppliers -> outlet_products -> inventory_batches -> sales -> wastage_records).
2. Converts monetary floating-point values to integer minor units (poisha = BDT * 100).
3. Supports historical sales windowing (default: sale_date >= 2026-08-01, covering the 107-day validation window and all recent operations).
4. Validates database integrity post-seeding via `PRAGMA foreign_key_check;` and record count assertions.
5. Provides command-line options for custom paths, date filtering, and complete database reset.

Usage:
    python backend/scripts/seed_db.py [--reset] [--all-sales] [--sales-since YYYY-MM-DD] [--db-path PATH]
"""

import os
import sys
import argparse
import time
from datetime import date
from pathlib import Path
from typing import Dict, Any, List

import pandas as pd
from sqlalchemy import text, func, select

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.database import engine, Base, SessionLocal, DEFAULT_DB_PATH
from backend.models import (
    Outlet,
    Product,
    Supplier,
    OutletProduct,
    InventoryBatch,
    Sale,
    WastageRecord,
)

DEFAULT_DATA_DIR = REPO_ROOT / "DataSets"
DEFAULT_SALES_SINCE = "2026-08-01"


def bdt_to_poisha(val: Any) -> int:
    """Converts a BDT monetary value to integer poisha (1 BDT = 100 Poisha)."""
    if pd.isna(val) or val is None:
        return 0
    return int(round(float(val) * 100))


def parse_date(val: Any) -> date | None:
    """Parses an ISO date string (YYYY-MM-DD) into a datetime.date object."""
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    return date.fromisoformat(str(val).strip())


def seed_outlets(conn, data_dir: Path, chunk_size: int = 5000) -> int:
    """Seed outlets table from outlets.csv."""
    csv_path = data_dir / "outlets.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)

    records = []
    for _, row in df.iterrows():
        records.append({
            "outlet_id": str(row["outlet_id"]).strip(),
            "outlet_name": str(row["outlet_name"]).strip(),
            "outlet_type": str(row["outlet_type"]).strip(),
            "business_size": str(row["business_size"]).strip() if pd.notnull(row["business_size"]) else None,
            "division": str(row["division"]).strip() if pd.notnull(row["division"]) else None,
            "district": str(row["district"]).strip() if pd.notnull(row["district"]) else None,
            "city": str(row["city"]).strip() if pd.notnull(row["city"]) else None,
            "neighbourhood": str(row["neighbourhood"]).strip() if pd.notnull(row["neighbourhood"]) else None,
            "area_type": str(row["area_type"]).strip() if pd.notnull(row["area_type"]) else None,
            "average_daily_customers": int(row["average_daily_customers"]) if pd.notnull(row["average_daily_customers"]) else None,
            "inventory_capacity_sku": int(row["inventory_capacity_sku"]) if pd.notnull(row["inventory_capacity_sku"]) else None,
            "has_refrigeration": bool(row["has_refrigeration"]),
            "has_pos_system": bool(row["has_pos_system"]),
            "established_year": int(row["established_year"]) if pd.notnull(row["established_year"]) else None,
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(Outlet.__table__.insert(), records[i : i + chunk_size])
    return len(records)


def seed_products(conn, data_dir: Path, chunk_size: int = 5000) -> int:
    """Seed products table from products.csv."""
    csv_path = data_dir / "products.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)

    records = []
    for _, row in df.iterrows():
        records.append({
            "product_id": str(row["product_id"]).strip(),
            "product_name": str(row["product_name"]).strip(),
            "product_name_bn": str(row["product_name_bn"]).strip() if pd.notnull(row["product_name_bn"]) else None,
            "category": str(row["category"]).strip(),
            "subcategory": str(row["subcategory"]).strip() if pd.notnull(row["subcategory"]) else None,
            "brand": str(row["brand"]).strip() if pd.notnull(row["brand"]) else None,
            "unit": str(row["unit"]).strip(),
            "package_size": str(row["package_size"]).strip() if pd.notnull(row["package_size"]) else None,
            "perishable_status": str(row["perishable_status"]).strip() if pd.notnull(row["perishable_status"]) else "Non-perishable",
            "typical_shelf_life_days": int(row["typical_shelf_life_days"]) if pd.notnull(row["typical_shelf_life_days"]) else 30,
            "storage_type": str(row["storage_type"]).strip() if pd.notnull(row["storage_type"]) else "Ambient",
            "average_cost_price_poisha": bdt_to_poisha(row["average_cost_price_bdt"]),
            "average_selling_price_poisha": bdt_to_poisha(row["average_selling_price_bdt"]),
            "is_essential_item": bool(row["is_essential_item"]),
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(Product.__table__.insert(), records[i : i + chunk_size])
    return len(records)


def seed_suppliers(conn, data_dir: Path, chunk_size: int = 5000) -> int:
    """Seed suppliers table from suppliers.csv."""
    csv_path = data_dir / "suppliers.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)

    records = []
    for _, row in df.iterrows():
        records.append({
            "supplier_id": str(row["supplier_id"]).strip(),
            "supplier_name": str(row["supplier_name"]).strip(),
            "supplier_type": str(row["supplier_type"]).strip() if pd.notnull(row["supplier_type"]) else None,
            "division": str(row["division"]).strip() if pd.notnull(row["division"]) else None,
            "district": str(row["district"]).strip() if pd.notnull(row["district"]) else None,
            "operating_area": str(row["operating_area"]).strip() if pd.notnull(row["operating_area"]) else None,
            "average_delivery_time_days": int(row["average_delivery_time_days"]) if pd.notnull(row["average_delivery_time_days"]) else None,
            "reliability_score": float(row["reliability_score"]) if pd.notnull(row["reliability_score"]) else None,
            "payment_terms": str(row["payment_terms"]).strip() if pd.notnull(row["payment_terms"]) else None,
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(Supplier.__table__.insert(), records[i : i + chunk_size])
    return len(records)


def seed_outlet_products(conn, data_dir: Path, chunk_size: int = 5000) -> int:
    """Seed outlet_products table from outlet_products.csv."""
    csv_path = data_dir / "outlet_products.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)

    records = []
    for _, row in df.iterrows():
        records.append({
            "outlet_product_id": str(row["outlet_product_id"]).strip(),
            "outlet_id": str(row["outlet_id"]).strip(),
            "product_id": str(row["product_id"]).strip(),
            "selling_price_poisha": bdt_to_poisha(row["selling_price_bdt"]),
            "purchase_cost_poisha": bdt_to_poisha(row["purchase_cost_bdt"]),
            "minimum_stock_level": int(row["minimum_stock_level"]) if pd.notnull(row["minimum_stock_level"]) else 1,
            "maximum_stock_level": int(row["maximum_stock_level"]) if pd.notnull(row["maximum_stock_level"]) else 50,
            "reorder_point": int(row["reorder_point"]) if pd.notnull(row["reorder_point"]) else 5,
            "average_daily_demand": float(row["average_daily_demand"]) if pd.notnull(row["average_daily_demand"]) else None,
            "preferred_supplier_id": str(row["preferred_supplier_id"]).strip() if pd.notnull(row["preferred_supplier_id"]) else None,
            "is_active": bool(row["is_active"]),
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(OutletProduct.__table__.insert(), records[i : i + chunk_size])
    return len(records)


def seed_inventory_batches(conn, data_dir: Path, chunk_size: int = 10000) -> int:
    """Seed inventory_batches table from inventory_batches.csv."""
    csv_path = data_dir / "inventory_batches.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)

    records = []
    for _, row in df.iterrows():
        records.append({
            "batch_id": str(row["batch_id"]).strip(),
            "outlet_id": str(row["outlet_id"]).strip(),
            "product_id": str(row["product_id"]).strip(),
            "supplier_id": str(row["supplier_id"]).strip() if pd.notnull(row["supplier_id"]) else None,
            "batch_received_date": parse_date(row["batch_received_date"]),
            "manufacturing_date": parse_date(row["manufacturing_date"]),
            "expiry_date": parse_date(row["expiry_date"]),
            "initial_quantity": int(row["initial_quantity"]),
            "remaining_quantity": int(row["remaining_quantity"]),
            "purchase_cost_per_unit_poisha": bdt_to_poisha(row["purchase_cost_per_unit_bdt"]),
            "selling_price_per_unit_poisha": bdt_to_poisha(row["selling_price_per_unit_bdt"]),
            "storage_condition": str(row["storage_condition"]).strip() if pd.notnull(row["storage_condition"]) else "Ambient",
            "batch_status": str(row["batch_status"]).strip() if pd.notnull(row["batch_status"]) else "In stock",
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(InventoryBatch.__table__.insert(), records[i : i + chunk_size])
    return len(records)


def seed_sales(conn, data_dir: Path, sales_since: str | None = None, chunk_size: int = 10000) -> tuple[int, int]:
    """
    Seed sales table from sales.csv.
    If sales_since is specified (e.g. '2026-08-01'), filters records with sale_date >= sales_since.
    Returns (inserted_count, total_in_csv).
    """
    csv_path = data_dir / "sales.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)
    total_csv_rows = len(df)

    if sales_since:
        print(f"Filtering sales records with sale_date >= '{sales_since}'...")
        df = df[df["sale_date"] >= sales_since]
        print(f"Retained {len(df):,} of {total_csv_rows:,} records (excluded {total_csv_rows - len(df):,} older records).")
    else:
        print(f"Loading all {total_csv_rows:,} sales records...")

    records = []
    for _, row in df.iterrows():
        records.append({
            "sale_id": str(row["sale_id"]).strip(),
            "transaction_id": str(row["transaction_id"]).strip(),
            "outlet_id": str(row["outlet_id"]).strip(),
            "product_id": str(row["product_id"]).strip(),
            "batch_id": str(row["batch_id"]).strip() if pd.notnull(row["batch_id"]) else None,
            "sale_date": parse_date(row["sale_date"]),
            "sale_time": str(row["sale_time"]).strip() if pd.notnull(row["sale_time"]) else None,
            "quantity_sold": int(row["quantity_sold"]),
            "unit_selling_price_poisha": bdt_to_poisha(row["unit_selling_price_bdt"]),
            "unit_cost_price_poisha": bdt_to_poisha(row["unit_cost_price_bdt"]),
            "discount_percentage": float(row["discount_percentage"]) if pd.notnull(row["discount_percentage"]) else 0.0,
            "total_sales_poisha": bdt_to_poisha(row["total_sales_bdt"]),
            "payment_method": str(row["payment_method"]).strip() if pd.notnull(row["payment_method"]) else "Cash",
            "customer_segment": str(row["customer_segment"]).strip() if pd.notnull(row["customer_segment"]) else None,
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(Sale.__table__.insert(), records[i : i + chunk_size])
    return len(records), total_csv_rows


def seed_wastage_records(conn, data_dir: Path, chunk_size: int = 5000) -> int:
    """Seed wastage_records table from wastage_records.csv."""
    csv_path = data_dir / "wastage_records.csv"
    print(f"Loading {csv_path.name}...")
    df = pd.read_csv(csv_path)

    records = []
    for _, row in df.iterrows():
        records.append({
            "wastage_id": str(row["wastage_id"]).strip(),
            "outlet_id": str(row["outlet_id"]).strip(),
            "product_id": str(row["product_id"]).strip(),
            "batch_id": str(row["batch_id"]).strip() if pd.notnull(row["batch_id"]) else None,
            "wastage_date": parse_date(row["wastage_date"]),
            "wasted_quantity": int(row["wasted_quantity"]),
            "wastage_reason": str(row["wastage_reason"]).strip(),
            "unit_cost_poisha": bdt_to_poisha(row["unit_cost_bdt"]),
            "total_wastage_value_poisha": bdt_to_poisha(row["total_wastage_value_bdt"]),
        })

    for i in range(0, len(records), chunk_size):
        conn.execute(WastageRecord.__table__.insert(), records[i : i + chunk_size])
    return len(records)


def validate_database(db_engine) -> Dict[str, Any]:
    """Runs database verification queries: foreign keys, record counts, and property helpers."""
    results = {}
    with db_engine.connect() as conn:
        # 1. Foreign key integrity check
        fk_check = conn.execute(text("PRAGMA foreign_key_check;")).fetchall()
        results["foreign_key_violations"] = len(fk_check)
        results["foreign_key_details"] = fk_check

        # 2. Record counts
        models = [
            ("outlets", Outlet),
            ("products", Product),
            ("suppliers", Supplier),
            ("outlet_products", OutletProduct),
            ("inventory_batches", InventoryBatch),
            ("sales", Sale),
            ("wastage_records", WastageRecord),
        ]
        counts = {}
        for name, model in models:
            cnt = conn.execute(select(func.count()).select_from(model)).scalar_one()
            counts[name] = cnt
        results["counts"] = counts

        # 3. Date ranges for sales and batches
        sales_dates = conn.execute(
            text("SELECT MIN(sale_date), MAX(sale_date) FROM sales")
        ).fetchone()
        results["sales_min_date"] = sales_dates[0] if sales_dates else None
        results["sales_max_date"] = sales_dates[1] if sales_dates else None

        batches_dates = conn.execute(
            text("SELECT MIN(batch_received_date), MAX(expiry_date) FROM inventory_batches")
        ).fetchone()
        results["batches_min_received"] = batches_dates[0] if batches_dates else None
        results["batches_max_expiry"] = batches_dates[1] if batches_dates else None

    # 4. Property conversion smoke test
    with SessionLocal() as session:
        sample_prod = session.execute(select(Product).limit(1)).scalar_one_or_none()
        sample_sale = session.execute(select(Sale).limit(1)).scalar_one_or_none()
        if sample_prod:
            results["sample_product"] = {
                "id": sample_prod.product_id,
                "name": sample_prod.product_name,
                "cost_poisha": sample_prod.average_cost_price_poisha,
                "cost_bdt": sample_prod.average_cost_price_bdt,
                "sell_poisha": sample_prod.average_selling_price_poisha,
                "sell_bdt": sample_prod.average_selling_price_bdt,
            }
        if sample_sale:
            results["sample_sale"] = {
                "id": sample_sale.sale_id,
                "unit_sell_poisha": sample_sale.unit_selling_price_poisha,
                "unit_sell_bdt": sample_sale.unit_selling_price_bdt,
                "total_poisha": sample_sale.total_sales_poisha,
                "total_bdt": sample_sale.total_sales_bdt,
            }

    return results


def run_seed(
    data_dir: Path,
    db_path: Path,
    sales_since: str | None = DEFAULT_SALES_SINCE,
    reset: bool = False,
):
    """Executes the complete database creation and seeding workflow."""
    start_time = time.time()
    print("=" * 70)
    print("BazarBondhu AI — Database Foundation & Seeding")
    print("=" * 70)
    print(f"Target DB Path:     {db_path}")
    print(f"Data Directory:     {data_dir}")
    print(f"Sales Filter:       {'ALL records' if sales_since is None else f'>= ' + sales_since}")
    print(f"Reset Database:     {reset}")
    print("-" * 70)

    if reset and db_path.exists():
        print(f"Dropping existing tables and resetting {db_path.name}...")
        Base.metadata.drop_all(bind=engine)
        print("Existing schema dropped successfully.")

    print("Creating tables via SQLAlchemy 2.0 metadata...")
    Base.metadata.create_all(bind=engine)
    print("Schema initialized: outlets, products, suppliers, outlet_products, inventory_batches, sales, wastage_records.")

    # Execute all seed steps in a single atomic transaction
    with engine.begin() as conn:
        print("\nBeginning seed transaction...")
        n_outlets = seed_outlets(conn, data_dir)
        print(f"  ✓ outlets: {n_outlets:,} rows")

        n_products = seed_products(conn, data_dir)
        print(f"  ✓ products: {n_products:,} rows")

        n_suppliers = seed_suppliers(conn, data_dir)
        print(f"  ✓ suppliers: {n_suppliers:,} rows")

        n_outlet_products = seed_outlet_products(conn, data_dir)
        print(f"  ✓ outlet_products: {n_outlet_products:,} rows")

        n_batches = seed_inventory_batches(conn, data_dir)
        print(f"  ✓ inventory_batches: {n_batches:,} rows")

        n_sales, total_sales_csv = seed_sales(conn, data_dir, sales_since=sales_since)
        print(f"  ✓ sales: {n_sales:,} rows (of {total_sales_csv:,} total in CSV)")

        n_wastage = seed_wastage_records(conn, data_dir)
        print(f"  ✓ wastage_records: {n_wastage:,} rows")

        print("Committing transaction to disk...")

    elapsed = time.time() - start_time
    print(f"\nSeeding complete in {elapsed:.2f} seconds.")

    # Validation
    print("\nRunning post-seeding validation...")
    validation = validate_database(engine)

    print("\n" + "=" * 70)
    print("DATABASE VALIDATION REPORT")
    print("=" * 70)
    print(f"Foreign Key Violations: {validation['foreign_key_violations']}")
    if validation['foreign_key_violations'] > 0:
        print(f"WARNING: FK Violations detected: {validation['foreign_key_details']}")
        sys.exit(1)
    else:
        print("  ✓ PRAGMA foreign_key_check PASSED with 0 violations.")

    print("\nTable Record Counts:")
    for tbl, count in validation["counts"].items():
        print(f"  • {tbl:20s}: {count:>8,d} rows")

    print(f"\nSales Date Range:       {validation['sales_min_date']} to {validation['sales_max_date']}")
    print(f"Batches Date Range:     {validation['batches_min_received']} to {validation['batches_max_expiry']}")

    if "sample_product" in validation:
        sp = validation["sample_product"]
        print(f"\nSample Product Verification ({sp['id']} - {sp['name']}):")
        print(f"  Average Cost:    {sp['cost_poisha']} poisha -> {sp['cost_bdt']:.2f} BDT")
        print(f"  Average Selling: {sp['sell_poisha']} poisha -> {sp['sell_bdt']:.2f} BDT")

    if "sample_sale" in validation:
        ss = validation["sample_sale"]
        print(f"\nSample Sale Verification ({ss['id']}):")
        print(f"  Unit Selling:    {ss['unit_sell_poisha']} poisha -> {ss['unit_sell_bdt']:.2f} BDT")
        print(f"  Total Sale:      {ss['total_poisha']} poisha -> {ss['total_bdt']:.2f} BDT")

    db_size_mb = db_path.stat().st_size / (1024 * 1024) if db_path.exists() else 0
    print(f"\nDatabase File Size:     {db_size_mb:.2f} MB")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="BazarBondhu AI SQLite Database Seeding Script")
    parser.add_argument("--db-path", type=str, default=str(DEFAULT_DB_PATH), help="Path to SQLite database file")
    parser.add_argument("--data-dir", type=str, default=str(DEFAULT_DATA_DIR), help="Path to CSV datasets directory")
    parser.add_argument("--sales-since", type=str, default=DEFAULT_SALES_SINCE, help="Filter sales to date >= YYYY-MM-DD (default: 2026-08-01)")
    parser.add_argument("--all-sales", action="store_true", help="Load all sales records without date filtering")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables before seeding")

    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    db_path = Path(args.db_path).resolve()
    sales_since = None if args.all_sales else args.sales_since

    if not data_dir.exists():
        print(f"Error: Data directory not found at {data_dir}", file=sys.stderr)
        sys.exit(1)

    run_seed(data_dir=data_dir, db_path=db_path, sales_since=sales_since, reset=args.reset)


if __name__ == "__main__":
    main()
