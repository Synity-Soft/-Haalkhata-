"""
BazarBondhu AI — Expiry Batches Router
======================================

Exposes batch-level expiration tracking and financial exposure analytics.
Strictly separates upcoming clearance candidates from already expired stock.
Never recommends selling expired goods.
"""

from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Outlet, Product, InventoryBatch
from backend.mapping import resolve_canonical_shop
from backend.schemas.business import (
    ExpiryBatchesResponse,
    ExpiryBatchItem,
    ExpirySummary,
)

router = APIRouter(prefix="/api/v1/expiry", tags=["Business — Expiry & Spoilage"])


@router.get(
    "/batches",
    response_model=ExpiryBatchesResponse,
    summary="Outlet Expiry Batches",
    description="Lists batches approaching expiration within lookahead window and batches past expiration. Separates upcoming from expired."
)
def get_expiry_batches(
    outlet_id: str = Query(..., description="Outlet identifier (e.g. 'OUT003' or 'shop-garment-01')"),
    days: int = Query(default=30, ge=1, le=365, description="Lookahead window in days"),
    reference_date: Optional[str] = Query(default="2026-11-16", description="Reference simulation date (YYYY-MM-DD)"),
    status_filter: str = Query(default="all", description="Filter batches: 'all', 'upcoming', or 'expired'"),
    limit: int = Query(default=100, ge=1, le=500, description="Page limit for batch lists"),
    offset: int = Query(default=0, ge=0, description="Page offset"),
    db: Session = Depends(get_db),
) -> ExpiryBatchesResponse:
    """
    Audits perishable batch stock:
    - Calculates calendar days remaining or days elapsed since expiration.
    - Computes financial cost exposure = remaining_quantity * purchase_cost_per_unit.
    - Safely excludes zero-stock batches.
    - Cleanly separates upcoming clearance candidates from expired losses.
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

    clean_status = status_filter.lower().strip()
    if clean_status not in ("all", "upcoming", "expired"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status_filter '{status_filter}'. Must be one of ['all', 'upcoming', 'expired']."
        )

    threshold_d = ref_d + timedelta(days=days)

    # 3. Query Upcoming Batches (in stock, remaining > 0, expiry in [ref_d, threshold_d])
    upcoming_items: List[ExpiryBatchItem] = []
    total_upcoming_count = 0
    total_upcoming_cost_poisha = 0

    if clean_status in ("all", "upcoming"):
        q_upcoming = (
            select(
                InventoryBatch.batch_id,
                InventoryBatch.product_id,
                Product.product_name,
                Product.product_name_bn,
                Product.category,
                Product.unit,
                InventoryBatch.remaining_quantity,
                InventoryBatch.expiry_date,
                InventoryBatch.purchase_cost_per_unit_poisha,
            )
            .join(Product, InventoryBatch.product_id == Product.product_id)
            .where(InventoryBatch.outlet_id == clean_outlet)
            .where(InventoryBatch.batch_status == "In stock")
            .where(InventoryBatch.remaining_quantity > 0)
            .where(InventoryBatch.expiry_date.isnot(None))
            .where(InventoryBatch.expiry_date >= ref_d)
            .where(InventoryBatch.expiry_date <= threshold_d)
            .order_by(InventoryBatch.expiry_date.asc())
        )
        all_upcoming = db.execute(q_upcoming).all()
        total_upcoming_count = len(all_upcoming)
        total_upcoming_cost_poisha = sum(
            r.remaining_quantity * r.purchase_cost_per_unit_poisha for r in all_upcoming
        )

        for r in all_upcoming[offset : offset + limit]:
            days_rem = (r.expiry_date - ref_d).days if r.expiry_date else 0
            unit_cost = r.purchase_cost_per_unit_poisha / 100.0
            exposure = (r.remaining_quantity * r.purchase_cost_per_unit_poisha) / 100.0
            upcoming_items.append(
                ExpiryBatchItem(
                    batch_id=r.batch_id,
                    product_id=r.product_id,
                    product_name=r.product_name,
                    product_name_bn=r.product_name_bn,
                    category=r.category,
                    unit=r.unit,
                    remaining_quantity=float(r.remaining_quantity),
                    expiry_date=r.expiry_date.isoformat() if r.expiry_date else "N/A",
                    days_remaining=days_rem,
                    unit_cost_bdt=round(unit_cost, 2),
                    total_cost_exposure_bdt=round(exposure, 2),
                    status="upcoming",
                )
            )

    # 4. Query Expired Batches (remaining > 0, expiry < ref_d)
    expired_items: List[ExpiryBatchItem] = []
    total_expired_count = 0
    total_expired_cost_poisha = 0

    if clean_status in ("all", "expired"):
        q_expired = (
            select(
                InventoryBatch.batch_id,
                InventoryBatch.product_id,
                Product.product_name,
                Product.product_name_bn,
                Product.category,
                Product.unit,
                InventoryBatch.remaining_quantity,
                InventoryBatch.expiry_date,
                InventoryBatch.purchase_cost_per_unit_poisha,
            )
            .join(Product, InventoryBatch.product_id == Product.product_id)
            .where(InventoryBatch.outlet_id == clean_outlet)
            .where(InventoryBatch.remaining_quantity > 0)
            .where(InventoryBatch.expiry_date.isnot(None))
            .where(InventoryBatch.expiry_date < ref_d)
            .order_by(InventoryBatch.expiry_date.desc())
        )
        all_expired = db.execute(q_expired).all()
        total_expired_count = len(all_expired)
        total_expired_cost_poisha = sum(
            r.remaining_quantity * r.purchase_cost_per_unit_poisha for r in all_expired
        )

        for r in all_expired[offset : offset + limit]:
            days_rem = (r.expiry_date - ref_d).days if r.expiry_date else 0
            unit_cost = r.purchase_cost_per_unit_poisha / 100.0
            exposure = (r.remaining_quantity * r.purchase_cost_per_unit_poisha) / 100.0
            expired_items.append(
                ExpiryBatchItem(
                    batch_id=r.batch_id,
                    product_id=r.product_id,
                    product_name=r.product_name,
                    product_name_bn=r.product_name_bn,
                    category=r.category,
                    unit=r.unit,
                    remaining_quantity=float(r.remaining_quantity),
                    expiry_date=r.expiry_date.isoformat() if r.expiry_date else "N/A",
                    days_remaining=days_rem,
                    unit_cost_bdt=round(unit_cost, 2),
                    total_cost_exposure_bdt=round(exposure, 2),
                    status="expired",
                )
            )

    return ExpiryBatchesResponse(
        outlet_id=clean_outlet,
        outlet_name=outlet.outlet_name,
        reference_date=ref_d.isoformat(),
        window_days=days,
        summary=ExpirySummary(
            upcoming_batches_count=total_upcoming_count,
            upcoming_cost_exposure_bdt=round(total_upcoming_cost_poisha / 100.0, 2),
            expired_batches_count=total_expired_count,
            expired_cost_exposure_bdt=round(total_expired_cost_poisha / 100.0, 2),
        ),
        upcoming_batches=upcoming_items,
        expired_batches=expired_items,
    )
