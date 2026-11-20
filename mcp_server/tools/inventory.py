"""
Haalkhata MCP Server — Inventory Tools
======================================
Implements:
1. get_inventory: Retrieve product names, quantities, and prices with search.
2. get_low_stock: Identify products whose stock is below their configured threshold.
"""

from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from backend.models import Product, InventoryBatch, OutletProduct, Outlet
from backend.mapping import resolve_canonical_shop
from mcp_server.db import get_readonly_session
from mcp_server.schemas import (
    InventoryResponse,
    InventoryItemOutput,
    LowStockResponse,
    LowStockItemOutput,
)


def _resolve_outlet(session: Session, outlet_id: str) -> tuple[str, str]:
    """Resolves outlet identifier to canonical ID and outlet name, or raises ValueError."""
    clean_id = (resolve_canonical_shop(outlet_id) or outlet_id).strip()
    outlet = session.get(Outlet, clean_id)
    if outlet is None:
        raise ValueError(f"Outlet '{outlet_id}' not found in database. Example valid outlet IDs: 'OUT001', 'OUT002', 'OUT003'.")
    return clean_id, outlet.outlet_name


def execute_get_inventory(
    outlet_id: str = "OUT001",
    search_query: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    Retrieves current on-hand inventory for an outlet, including available quantities,
    active batch counts, selling prices, purchase costs, and nearest expiration dates.
    Supports search by English or Bengali product name.
    """
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    with get_readonly_session() as session:
        canonical_id, outlet_name = _resolve_outlet(session, outlet_id)

        # Base query joining Product, OutletProduct, and active in-stock InventoryBatches
        stmt = (
            select(
                Product.product_id,
                Product.product_name,
                Product.product_name_bn,
                Product.category,
                Product.unit,
                Product.package_size,
                func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0).label("available_quantity"),
                func.count(InventoryBatch.batch_id).label("active_batch_count"),
                func.min(InventoryBatch.expiry_date).label("nearest_expiry_date"),
                OutletProduct.selling_price_poisha,
                OutletProduct.purchase_cost_poisha,
                OutletProduct.reorder_point,
            )
            .join(OutletProduct, and_(
                OutletProduct.product_id == Product.product_id,
                OutletProduct.outlet_id == canonical_id
            ))
            .outerjoin(InventoryBatch, and_(
                InventoryBatch.product_id == Product.product_id,
                InventoryBatch.outlet_id == canonical_id,
                InventoryBatch.batch_status == "In stock",
                InventoryBatch.remaining_quantity > 0
            ))
            .where(OutletProduct.is_active == True)
        )

        # Optional search filter
        if search_query and search_query.strip():
            term = f"%{search_query.strip()}%"
            stmt = stmt.where(or_(
                Product.product_name.ilike(term),
                Product.product_name_bn.ilike(term),
                Product.brand.ilike(term)
            ))

        # Optional category filter
        if category and category.strip():
            stmt = stmt.where(Product.category.ilike(f"%{category.strip()}%"))

        stmt = stmt.group_by(Product.product_id).order_by(
            func.sum(InventoryBatch.remaining_quantity).desc(),
            Product.product_name.asc()
        ).limit(limit).offset(offset)

        rows = session.execute(stmt).all()

        items: List[Dict[str, Any]] = []
        for r in rows:
            selling_poisha = r.selling_price_poisha or 0
            cost_poisha = r.purchase_cost_poisha or 0
            items.append({
                "product_id": r.product_id,
                "product_name": r.product_name,
                "product_name_bn": r.product_name_bn,
                "category": r.category,
                "unit": r.unit,
                "package_size": r.package_size,
                "available_quantity": float(r.available_quantity),
                "active_batch_count": int(r.active_batch_count),
                "selling_price_bdt": round(selling_poisha / 100.0, 2),
                "purchase_cost_bdt": round(cost_poisha / 100.0, 2),
                "nearest_expiry_date": str(r.nearest_expiry_date) if r.nearest_expiry_date else None,
                "reorder_point": r.reorder_point,
            })

        return {
            "outlet_id": canonical_id,
            "outlet_name": outlet_name,
            "total_products_found": len(items),
            "limit": limit,
            "offset": offset,
            "items": items,
        }


def execute_get_low_stock(
    outlet_id: str = "OUT001",
    threshold_type: str = "reorder_point",
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Identifies products whose current stock is at or below their configured threshold
    (reorder point or minimum stock level). Distinguishes critical stockouts (0 stock)
    from low stock approaching depletion.
    """
    limit = max(1, min(limit, 200))
    threshold_type = threshold_type.strip().lower()
    if threshold_type not in ("reorder_point", "minimum_stock_level"):
        threshold_type = "reorder_point"

    with get_readonly_session() as session:
        canonical_id, outlet_name = _resolve_outlet(session, outlet_id)

        # Subquery for active remaining stock
        stock_subq = (
            select(
                InventoryBatch.product_id,
                func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0).label("current_stock")
            )
            .where(and_(
                InventoryBatch.outlet_id == canonical_id,
                InventoryBatch.batch_status == "In stock",
                InventoryBatch.remaining_quantity > 0
            ))
            .group_by(InventoryBatch.product_id)
            .subquery()
        )

        threshold_col = (
            OutletProduct.reorder_point
            if threshold_type == "reorder_point"
            else OutletProduct.minimum_stock_level
        )

        stmt = (
            select(
                Product.product_id,
                Product.product_name,
                Product.product_name_bn,
                Product.category,
                Product.unit,
                func.coalesce(stock_subq.c.current_stock, 0).label("current_stock"),
                OutletProduct.reorder_point,
                OutletProduct.minimum_stock_level,
                OutletProduct.maximum_stock_level,
                (threshold_col - func.coalesce(stock_subq.c.current_stock, 0)).label("deficit_quantity"),
                OutletProduct.selling_price_poisha,
            )
            .join(OutletProduct, and_(
                OutletProduct.product_id == Product.product_id,
                OutletProduct.outlet_id == canonical_id
            ))
            .outerjoin(stock_subq, stock_subq.c.product_id == Product.product_id)
            .where(and_(
                OutletProduct.is_active == True,
                func.coalesce(stock_subq.c.current_stock, 0) <= threshold_col
            ))
            .order_by(
                (threshold_col - func.coalesce(stock_subq.c.current_stock, 0)).desc(),
                Product.product_name.asc()
            )
            .limit(limit)
        )

        rows = session.execute(stmt).all()

        items: List[Dict[str, Any]] = []
        critical_count = 0

        for r in rows:
            curr_stock = float(r.current_stock)
            if curr_stock <= 0:
                status_label = "CRITICAL_STOCKOUT"
                critical_count += 1
            else:
                status_label = "LOW_STOCK"

            selling_poisha = r.selling_price_poisha or 0
            items.append({
                "product_id": r.product_id,
                "product_name": r.product_name,
                "product_name_bn": r.product_name_bn,
                "category": r.category,
                "unit": r.unit,
                "current_stock": curr_stock,
                "reorder_point": r.reorder_point,
                "minimum_stock_level": r.minimum_stock_level,
                "maximum_stock_level": r.maximum_stock_level,
                "deficit_quantity": max(0.0, float(r.deficit_quantity)),
                "selling_price_bdt": round(selling_poisha / 100.0, 2),
                "urgency_status": status_label,
            })

        return {
            "outlet_id": canonical_id,
            "outlet_name": outlet_name,
            "threshold_type": threshold_type,
            "low_stock_count": len(items),
            "critical_stockout_count": critical_count,
            "items": items,
        }
