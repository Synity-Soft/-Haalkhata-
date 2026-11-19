"""
BazarBondhu AI — Shops / Outlets Router
=======================================

Exposes endpoints for querying store and outlet metadata from SQLite.
Satisfies frontend /api/shops contract.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Outlet
from backend.schemas.shop import ShopResponse

router = APIRouter(prefix="/api", tags=["Shops & Outlets"])


@router.get(
    "/shops",
    response_model=List[ShopResponse],
    summary="List Retail Outlets",
    description="Returns available retail outlets from the SQLite database. Supports optional area filtering and pagination."
)
def get_shops(
    area_type: Optional[str] = Query(None, description="Filter by area type classification"),
    limit: int = Query(default=200, ge=1, le=500, description="Maximum number of outlets to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
) -> List[ShopResponse]:
    """
    Retrieves retail outlets from the SQLite database.
    Preserves canonical CSV IDs and attributes.
    """
    stmt = select(Outlet)

    if area_type:
        clean_area = area_type.strip()
        stmt = stmt.where(Outlet.area_type == clean_area)

    stmt = stmt.order_by(Outlet.outlet_id).offset(offset).limit(limit)
    outlets = db.execute(stmt).scalars().all()

    return [
        ShopResponse(
            id=o.outlet_id,
            name=o.outlet_name,
            outlet_type=o.outlet_type,
            areaType=o.area_type,
            business_size=o.business_size,
            division=o.division,
            district=o.district,
            city=o.city,
            neighbourhood=o.neighbourhood,
            average_daily_customers=o.average_daily_customers,
            inventory_capacity_sku=o.inventory_capacity_sku,
            has_refrigeration=bool(o.has_refrigeration),
            has_pos_system=bool(o.has_pos_system),
            established_year=o.established_year,
        )
        for o in outlets
    ]
