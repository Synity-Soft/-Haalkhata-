"""
BazarBondhu AI — Sales Trend & Reports Router
=============================================

Exposes daily sales revenue and volume time-series analytics.
Fills missing dates with zero revenue to maintain continuous timeline integrity.
"""

from datetime import date, timedelta
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, distinct
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Outlet, Product, Sale
from backend.mapping import resolve_canonical_shop
from backend.schemas.business import (
    SalesTrendResponse,
    DailySalesPoint,
)

router = APIRouter(prefix="/api/v1/reports", tags=["Business — Reports & Analytics"])


@router.get(
    "/sales-trend",
    response_model=SalesTrendResponse,
    summary="Daily Sales Revenue Trend",
    description="Returns daily revenue and transaction time-series. Automatically fills calendar gaps with zero revenue."
)
def get_sales_trend(
    outlet_id: str = Query(..., description="Outlet identifier (e.g. 'OUT003' or 'shop-garment-01')"),
    days: int = Query(default=30, ge=1, le=180, description="Reporting window duration in days"),
    end_date: Optional[str] = Query(default=None, description="End date of the trend (YYYY-MM-DD); defaults to latest recorded sale"),
    db: Session = Depends(get_db),
) -> SalesTrendResponse:
    """
    Computes daily time-series metrics:
    - Daily gross revenue in BDT
    - Daily unique transaction counts & line item counts
    - Daily units sold grouped strictly by unit of measure
    - Zero-fills any missing calendar dates to ensure continuous series
    """
    # 1. Resolve & Validate Outlet
    clean_outlet = resolve_canonical_shop(outlet_id) or outlet_id.strip()
    outlet = db.get(Outlet, clean_outlet)
    if outlet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outlet '{clean_outlet}' not found in database."
        )

    # 2. Determine Time Window
    if end_date:
        try:
            trend_end = date.fromisoformat(end_date.strip())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid end_date format '{end_date}'. Expected YYYY-MM-DD."
            )
    else:
        max_d = db.execute(
            select(func.max(Sale.sale_date)).where(Sale.outlet_id == clean_outlet)
        ).scalar()
        trend_end = max_d if max_d else date(2026, 11, 15)

    trend_start = trend_end - timedelta(days=days - 1)

    # 3. Aggregate Daily Revenue & Transactions
    q_daily = (
        select(
            Sale.sale_date,
            func.coalesce(func.sum(Sale.total_sales_poisha), 0).label("revenue_poisha"),
            func.count(distinct(Sale.transaction_id)).label("tx_count"),
            func.count(Sale.sale_id).label("line_items"),
        )
        .where(Sale.outlet_id == clean_outlet)
        .where(Sale.sale_date >= trend_start)
        .where(Sale.sale_date <= trend_end)
        .group_by(Sale.sale_date)
        .order_by(Sale.sale_date.asc())
    )
    daily_rows = {r.sale_date: r for r in db.execute(q_daily).all()}

    # 4. Aggregate Units Sold by Unit per Day
    q_units = (
        select(
            Sale.sale_date,
            Product.unit,
            func.sum(Sale.quantity_sold).label("qty")
        )
        .join(Product, Sale.product_id == Product.product_id)
        .where(Sale.outlet_id == clean_outlet)
        .where(Sale.sale_date >= trend_start)
        .where(Sale.sale_date <= trend_end)
        .group_by(Sale.sale_date, Product.unit)
        .order_by(Sale.sale_date.asc())
    )
    units_by_day: Dict[date, Dict[str, float]] = {}
    for r in db.execute(q_units).all():
        units_by_day.setdefault(r.sale_date, {})[r.unit] = float(r.qty)

    # 5. Build Continuous Time-Series (Zero-Filling Gaps)
    trend_points: List[DailySalesPoint] = []
    total_rev_poisha = 0
    total_tx = 0
    total_items = 0

    curr = trend_start
    while curr <= trend_end:
        if curr in daily_rows:
            r = daily_rows[curr]
            rev_bdt = round(r.revenue_poisha / 100.0, 2)
            total_rev_poisha += r.revenue_poisha
            total_tx += r.tx_count
            total_items += r.line_items
            trend_points.append(
                DailySalesPoint(
                    date=curr.isoformat(),
                    revenue_bdt=rev_bdt,
                    transaction_count=r.tx_count,
                    line_items_count=r.line_items,
                    units_sold_by_unit=units_by_day.get(curr, {}),
                )
            )
        else:
            trend_points.append(
                DailySalesPoint(
                    date=curr.isoformat(),
                    revenue_bdt=0.0,
                    transaction_count=0,
                    line_items_count=0,
                    units_sold_by_unit={},
                )
            )
        curr += timedelta(days=1)

    total_revenue_bdt = round(total_rev_poisha / 100.0, 2)
    avg_daily_revenue = round(total_revenue_bdt / float(days), 2) if days > 0 else 0.0

    return SalesTrendResponse(
        outlet_id=clean_outlet,
        outlet_name=outlet.outlet_name,
        start_date=trend_start.isoformat(),
        end_date=trend_end.isoformat(),
        days=days,
        total_revenue_bdt=total_revenue_bdt,
        average_daily_revenue_bdt=avg_daily_revenue,
        total_transactions=total_tx,
        total_line_items=total_items,
        trend=trend_points,
    )
