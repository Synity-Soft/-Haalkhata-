"""
BazarBondhu AI — Dashboard Summary Router
=========================================

Exposes executive and store-level dashboard metrics for retail outlets.
Preserves unit-level isolation to prevent summing incompatible physical measures.
"""

from datetime import date, timedelta
from typing import Optional, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, distinct
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Outlet, Product, OutletProduct, InventoryBatch, Sale
from backend.mapping import resolve_canonical_shop
from backend.schemas.business import (
    DashboardSummaryResponse,
    DashboardReportingPeriod,
)

router = APIRouter(prefix="/api/v1/dashboard", tags=["Business — Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    summary="Outlet Dashboard Summary",
    description="Returns high-level inventory, expiry, and sales metrics for a specified outlet. Aggregates inventory strictly by unit."
)
def get_dashboard_summary(
    outlet_id: str = Query(..., description="Outlet identifier (e.g. 'OUT003' or 'shop-garment-01')"),
    days: int = Query(default=30, ge=1, le=180, description="Reporting period in days for sales metrics"),
    reference_date: Optional[str] = Query(default="2026-11-16", description="Reference simulation date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    """
    Computes dashboard KPIs:
    - Distinct stocked products & total catalog SKUs
    - Current available stock grouped strictly by original unit
    - Low-stock count based on verified catalog reorder points
    - Batches expiring in 7 and 30 days vs already expired
    - Gross sales revenue and volume grouped by unit for reporting period
    """
    # 1. Resolve & Validate Outlet
    clean_outlet = resolve_canonical_shop(outlet_id) or outlet_id.strip()
    outlet = db.get(Outlet, clean_outlet)
    if outlet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outlet '{clean_outlet}' not found in database."
        )

    # 2. Parse Reference Date
    try:
        ref_d = date.fromisoformat(reference_date.strip()) if reference_date else date(2026, 11, 16)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reference_date format '{reference_date}'. Expected YYYY-MM-DD."
        )

    # 3. Distinct Stocked Products (positive inventory currently on hand)
    distinct_stocked = db.execute(
        select(func.count(distinct(InventoryBatch.product_id)))
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.batch_status == "In stock")
        .where(InventoryBatch.remaining_quantity > 0)
    ).scalar_one() or 0

    # 4. Total Catalog SKUs (registered in outlet_products)
    total_registered = db.execute(
        select(func.count(distinct(OutletProduct.product_id)))
        .where(OutletProduct.outlet_id == clean_outlet)
        .where(OutletProduct.is_active == True)
    ).scalar_one() or 0

    # 5. Available Stock Grouped Strictly by Unit
    unit_rows = db.execute(
        select(
            Product.unit,
            func.sum(InventoryBatch.remaining_quantity).label("total_qty")
        )
        .join(Product, InventoryBatch.product_id == Product.product_id)
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.batch_status == "In stock")
        .where(InventoryBatch.remaining_quantity > 0)
        .group_by(Product.unit)
        .order_by(Product.unit)
    ).all()
    inventory_by_unit = {r.unit: float(r.total_qty) for r in unit_rows}

    # 6. Low Stock Count (where available stock <= catalog reorder_point)
    stock_subq = (
        select(
            InventoryBatch.product_id,
            func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0).label("stock")
        )
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.batch_status == "In stock")
        .where(InventoryBatch.remaining_quantity > 0)
        .group_by(InventoryBatch.product_id)
        .subquery()
    )
    low_stock_count = db.execute(
        select(func.count(OutletProduct.product_id))
        .outerjoin(stock_subq, OutletProduct.product_id == stock_subq.c.product_id)
        .where(OutletProduct.outlet_id == clean_outlet)
        .where(OutletProduct.is_active == True)
        .where(func.coalesce(stock_subq.c.stock, 0) <= OutletProduct.reorder_point)
    ).scalar_one() or 0

    # 7. Expiry Metrics (7d, 30d, and past expiration)
    d7 = ref_d + timedelta(days=7)
    d30 = ref_d + timedelta(days=30)

    batches_7d = db.execute(
        select(func.count(InventoryBatch.batch_id))
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.batch_status == "In stock")
        .where(InventoryBatch.remaining_quantity > 0)
        .where(InventoryBatch.expiry_date >= ref_d)
        .where(InventoryBatch.expiry_date <= d7)
    ).scalar_one() or 0

    batches_30d = db.execute(
        select(func.count(InventoryBatch.batch_id))
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.batch_status == "In stock")
        .where(InventoryBatch.remaining_quantity > 0)
        .where(InventoryBatch.expiry_date >= ref_d)
        .where(InventoryBatch.expiry_date <= d30)
    ).scalar_one() or 0

    batches_expired = db.execute(
        select(func.count(InventoryBatch.batch_id))
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.remaining_quantity > 0)
        .where(InventoryBatch.expiry_date < ref_d)
    ).scalar_one() or 0

    # 8. Sales Reporting Window
    max_sale_d = db.execute(
        select(func.max(Sale.sale_date)).where(Sale.outlet_id == clean_outlet)
    ).scalar()

    sales_end = min(ref_d, max_sale_d) if max_sale_d else ref_d
    sales_start = sales_end - timedelta(days=days - 1)

    # 9. Sales Aggregation
    sales_poisha = db.execute(
        select(func.coalesce(func.sum(Sale.total_sales_poisha), 0))
        .where(Sale.outlet_id == clean_outlet)
        .where(Sale.sale_date >= sales_start)
        .where(Sale.sale_date <= sales_end)
    ).scalar_one() or 0

    tx_count = db.execute(
        select(func.count(distinct(Sale.transaction_id)))
        .where(Sale.outlet_id == clean_outlet)
        .where(Sale.sale_date >= sales_start)
        .where(Sale.sale_date <= sales_end)
    ).scalar_one() or 0

    line_items_count = db.execute(
        select(func.count(Sale.sale_id))
        .where(Sale.outlet_id == clean_outlet)
        .where(Sale.sale_date >= sales_start)
        .where(Sale.sale_date <= sales_end)
    ).scalar_one() or 0

    sold_by_unit_rows = db.execute(
        select(
            Product.unit,
            func.sum(Sale.quantity_sold).label("total_sold")
        )
        .join(Product, Sale.product_id == Product.product_id)
        .where(Sale.outlet_id == clean_outlet)
        .where(Sale.sale_date >= sales_start)
        .where(Sale.sale_date <= sales_end)
        .group_by(Product.unit)
        .order_by(Product.unit)
    ).all()
    units_sold_by_unit = {r.unit: float(r.total_sold) for r in sold_by_unit_rows}

    return DashboardSummaryResponse(
        outlet_id=clean_outlet,
        outlet_name=outlet.outlet_name,
        distinct_stocked_products=distinct_stocked,
        total_registered_products=total_registered,
        available_inventory_by_unit=inventory_by_unit,
        low_stock_products_count=low_stock_count,
        low_stock_threshold_basis="reorder_point",
        batches_expiring_7d=batches_7d,
        batches_expiring_30d=batches_30d,
        batches_expired_with_stock=batches_expired,
        reference_date=ref_d.isoformat(),
        reporting_period=DashboardReportingPeriod(
            start_date=sales_start.isoformat(),
            end_date=sales_end.isoformat(),
            days=days,
        ),
        sales_revenue_bdt=round(sales_poisha / 100.0, 2),
        sales_transactions_count=tx_count,
        sales_line_items_count=line_items_count,
        units_sold_by_unit=units_sold_by_unit,
    )
