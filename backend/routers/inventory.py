"""
BazarBondhu AI — Outlet Inventory Router
========================================

Exposes granular product-level inventory for a store.
Aggregates active positive-stock batches per product with pricing and nearest expiration date.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Outlet, Product, OutletProduct, InventoryBatch
from backend.mapping import resolve_canonical_shop
from backend.schemas.business import (
    OutletInventoryResponse,
    OutletInventoryItem,
)

router = APIRouter(prefix="/api/v1/outlets", tags=["Business — Inventory"])


@router.get(
    "/{outlet_id}/inventory",
    response_model=OutletInventoryResponse,
    summary="Outlet Active Inventory",
    description="Returns active positive-stock inventory grouped by product. Supports category filtering and pagination."
)
def get_outlet_inventory(
    outlet_id: str,
    category: Optional[str] = Query(None, description="Optional category filter (e.g. 'Rice and grains')"),
    limit: int = Query(default=50, ge=1, le=500, description="Maximum products per page"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
) -> OutletInventoryResponse:
    """
    Retrieves distinct products currently holding positive available stock.
    Preserves exact product identity and units; never substitutes multipacks.
    """
    clean_outlet = resolve_canonical_shop(outlet_id) or outlet_id.strip()
    outlet = db.get(Outlet, clean_outlet)
    if outlet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outlet '{clean_outlet}' not found in database."
        )

    # Base query for positive remaining stock across in-stock batches
    base_stmt = (
        select(
            Product.product_id,
            Product.product_name,
            Product.product_name_bn,
            Product.category,
            Product.unit,
            func.sum(InventoryBatch.remaining_quantity).label("available_quantity"),
            func.count(InventoryBatch.batch_id).label("active_batch_count"),
            func.min(InventoryBatch.expiry_date).label("nearest_expiry_date"),
            OutletProduct.selling_price_poisha,
            OutletProduct.purchase_cost_poisha,
            Product.average_selling_price_poisha,
            Product.average_cost_price_poisha,
        )
        .join(Product, InventoryBatch.product_id == Product.product_id)
        .outerjoin(
            OutletProduct,
            (OutletProduct.outlet_id == InventoryBatch.outlet_id)
            & (OutletProduct.product_id == InventoryBatch.product_id)
        )
        .where(InventoryBatch.outlet_id == clean_outlet)
        .where(InventoryBatch.batch_status == "In stock")
        .where(InventoryBatch.remaining_quantity > 0)
    )

    if category:
        clean_cat = category.strip()
        base_stmt = base_stmt.where(Product.category == clean_cat)

    grouped_stmt = base_stmt.group_by(
        Product.product_id,
        Product.product_name,
        Product.product_name_bn,
        Product.category,
        Product.unit,
        OutletProduct.selling_price_poisha,
        OutletProduct.purchase_cost_poisha,
        Product.average_selling_price_poisha,
        Product.average_cost_price_poisha,
    )

    # Total matching count subquery
    count_subq = grouped_stmt.subquery()
    total_matching = db.execute(select(func.count()).select_from(count_subq)).scalar_one() or 0

    # Paginated query
    paged_stmt = grouped_stmt.order_by(Product.product_id.asc()).offset(offset).limit(limit)
    rows = db.execute(paged_stmt).all()

    items = []
    for r in rows:
        # Determine selling price: prefer outlet_products, fallback to product catalog
        if r.selling_price_poisha is not None:
            sell_bdt = r.selling_price_poisha / 100.0
        elif r.average_selling_price_poisha is not None:
            sell_bdt = r.average_selling_price_poisha / 100.0
        else:
            sell_bdt = None

        # Determine purchase cost: prefer outlet_products, fallback to product catalog
        if r.purchase_cost_poisha is not None:
            cost_bdt = r.purchase_cost_poisha / 100.0
        elif r.average_cost_price_poisha is not None:
            cost_bdt = r.average_cost_price_poisha / 100.0
        else:
            cost_bdt = None

        items.append(
            OutletInventoryItem(
                product_id=r.product_id,
                product_name=r.product_name,
                product_name_bn=r.product_name_bn,
                category=r.category,
                unit=r.unit,
                available_quantity=float(r.available_quantity),
                active_batch_count=int(r.active_batch_count),
                selling_price_bdt=round(sell_bdt, 2) if sell_bdt is not None else None,
                purchase_cost_bdt=round(cost_bdt, 2) if cost_bdt is not None else None,
                nearest_expiry_date=r.nearest_expiry_date.isoformat() if r.nearest_expiry_date else None,
            )
        )

    return OutletInventoryResponse(
        outlet_id=clean_outlet,
        outlet_name=outlet.outlet_name,
        total_matching_products=total_matching,
        limit=limit,
        offset=offset,
        category_filter=category,
        items=items,
    )
