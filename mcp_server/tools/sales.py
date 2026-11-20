"""
Haalkhata MCP Server — Sales & Business Analytics Tools
=======================================================
Implements:
3. get_sales_summary: Retrieve sales summaries for a requested date range.
6. get_business_insights: Return basic insights calculated from actual sales and inventory data.
"""

from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import Session

from backend.models import Sale, Product, InventoryBatch, OutletProduct, Outlet, WastageRecord
from backend.mapping import resolve_canonical_shop
from mcp_server.db import get_readonly_session


def _parse_iso_date(date_str: str, default: date) -> date:
    """Parses a YYYY-MM-DD date or returns default."""
    if not date_str or not date_str.strip():
        return default
    try:
        return date.fromisoformat(date_str.strip())
    except ValueError:
        raise ValueError(f"Invalid date format '{date_str}'. Expected 'YYYY-MM-DD'.")


def execute_get_sales_summary(
    start_date: str = "2026-11-01",
    end_date: str = "2026-11-15",
    outlet_id: Optional[str] = "OUT001",
    limit_top_products: int = 5,
) -> Dict[str, Any]:
    """
    Retrieves aggregated sales metrics for a specified date range.
    Includes gross revenue, COGS, estimated gross profit, profit margin,
    transaction count, volume, payment method distribution, and top-selling products.
    """
    limit_top_products = max(1, min(limit_top_products, 50))
    d_start = _parse_iso_date(start_date, date(2026, 11, 1))
    d_end = _parse_iso_date(end_date, date(2026, 11, 15))

    if d_start > d_end:
        raise ValueError(f"start_date ({d_start}) cannot be after end_date ({d_end}).")

    with get_readonly_session() as session:
        canonical_outlet: Optional[str] = None
        outlet_name: Optional[str] = None

        if outlet_id and outlet_id.strip():
            clean_id = (resolve_canonical_shop(outlet_id) or outlet_id).strip()
            outlet_obj = session.get(Outlet, clean_id)
            if outlet_obj is None:
                raise ValueError(f"Outlet '{outlet_id}' not found in database.")
            canonical_outlet = clean_id
            outlet_name = outlet_obj.outlet_name

        # Base filter conditions
        filters = [
            Sale.sale_date >= d_start,
            Sale.sale_date <= d_end,
        ]
        if canonical_outlet:
            filters.append(Sale.outlet_id == canonical_outlet)

        # 1. Financial and volume totals
        totals = session.execute(
            select(
                func.coalesce(func.sum(Sale.total_sales_poisha), 0).label("total_sales_poisha"),
                func.coalesce(func.sum(Sale.quantity_sold * Sale.unit_cost_price_poisha), 0).label("total_cost_poisha"),
                func.count(func.distinct(Sale.transaction_id)).label("transaction_count"),
                func.coalesce(func.sum(Sale.quantity_sold), 0).label("total_quantity"),
            ).where(and_(*filters))
        ).fetchone()

        total_sales_bdt = round((totals[0] or 0) / 100.0, 2)
        total_cost_bdt = round((totals[1] or 0) / 100.0, 2)
        gross_profit_bdt = round(total_sales_bdt - total_cost_bdt, 2)
        profit_margin = round((gross_profit_bdt / total_sales_bdt * 100.0), 2) if total_sales_bdt > 0 else 0.0
        txn_count = int(totals[2] or 0)
        items_sold = int(totals[3] or 0)
        aov = round(total_sales_bdt / txn_count, 2) if txn_count > 0 else 0.0

        # 2. Payment method breakdown
        pm_rows = session.execute(
            select(
                Sale.payment_method,
                func.sum(Sale.total_sales_poisha).label("amount_poisha"),
                func.count(Sale.sale_id).label("txn_count")
            )
            .where(and_(*filters))
            .group_by(Sale.payment_method)
            .order_by(desc("amount_poisha"))
        ).all()

        payment_methods: List[Dict[str, Any]] = []
        for r in pm_rows:
            pm_bdt = round((r.amount_poisha or 0) / 100.0, 2)
            pct = round((pm_bdt / total_sales_bdt * 100.0), 1) if total_sales_bdt > 0 else 0.0
            payment_methods.append({
                "payment_method": r.payment_method,
                "total_sales_bdt": pm_bdt,
                "transaction_count": int(r.txn_count),
                "percentage": pct,
            })

        # 3. Top selling products
        top_prod_rows = session.execute(
            select(
                Product.product_id,
                Product.product_name,
                func.sum(Sale.quantity_sold).label("qty_sold"),
                func.sum(Sale.total_sales_poisha).label("sales_poisha")
            )
            .join(Product, Product.product_id == Sale.product_id)
            .where(and_(*filters))
            .group_by(Product.product_id)
            .order_by(desc("sales_poisha"))
            .limit(limit_top_products)
        ).all()

        top_products: List[Dict[str, Any]] = [
            {
                "product_id": r.product_id,
                "product_name": r.product_name,
                "quantity_sold": int(r.qty_sold),
                "total_sales_bdt": round((r.sales_poisha or 0) / 100.0, 2),
            }
            for r in top_prod_rows
        ]

        return {
            "outlet_id": canonical_outlet,
            "outlet_name": outlet_name or "All Outlets (Consolidated)",
            "start_date": str(d_start),
            "end_date": str(d_end),
            "total_sales_bdt": total_sales_bdt,
            "total_cost_bdt": total_cost_bdt,
            "estimated_gross_profit_bdt": gross_profit_bdt,
            "profit_margin_percent": profit_margin,
            "transaction_count": txn_count,
            "total_items_sold": items_sold,
            "average_order_value_bdt": aov,
            "payment_methods": payment_methods,
            "top_selling_products": top_products,
        }


def execute_get_business_insights(
    outlet_id: str = "OUT001",
    reference_date: str = "2026-11-16",
    days: int = 30,
) -> Dict[str, Any]:
    """
    Computes actionable business health insights derived from actual sales, inventory levels,
    and wastage logs over a trailing time window.
    """
    days = max(7, min(days, 180))
    ref_d = _parse_iso_date(reference_date, date(2026, 11, 16))
    start_d = ref_d - timedelta(days=days)

    with get_readonly_session() as session:
        clean_id = (resolve_canonical_shop(outlet_id) or outlet_id).strip()
        outlet = session.get(Outlet, clean_id)
        if outlet is None:
            raise ValueError(f"Outlet '{outlet_id}' not found in database.")

        # 1. Sales & Profitability for trailing window
        sales_data = session.execute(
            select(
                func.coalesce(func.sum(Sale.total_sales_poisha), 0),
                func.coalesce(func.sum(Sale.quantity_sold * Sale.unit_cost_price_poisha), 0),
                func.count(func.distinct(Sale.transaction_id)),
                func.coalesce(func.sum(Sale.quantity_sold), 0),
            ).where(and_(
                Sale.outlet_id == clean_id,
                Sale.sale_date >= start_d,
                Sale.sale_date <= ref_d,
            ))
        ).fetchone()

        total_sales_bdt = round((sales_data[0] or 0) / 100.0, 2)
        total_cost_bdt = round((sales_data[1] or 0) / 100.0, 2)
        profit_bdt = round(total_sales_bdt - total_cost_bdt, 2)
        margin = round((profit_bdt / total_sales_bdt * 100.0), 2) if total_sales_bdt > 0 else 0.0
        avg_daily_sales = round(total_sales_bdt / days, 2)

        # 2. Inventory Health & Capital Locked
        inv_data = session.execute(
            select(
                func.count(func.distinct(InventoryBatch.product_id)),
                func.count(InventoryBatch.batch_id),
                func.coalesce(func.sum(InventoryBatch.remaining_quantity * InventoryBatch.purchase_cost_per_unit_poisha), 0),
                func.coalesce(func.sum(InventoryBatch.remaining_quantity * InventoryBatch.selling_price_per_unit_poisha), 0),
            ).where(and_(
                InventoryBatch.outlet_id == clean_id,
                InventoryBatch.batch_status == "In stock",
                InventoryBatch.remaining_quantity > 0,
            ))
        ).fetchone()

        stocked_skus = int(inv_data[0] or 0)
        active_batches = int(inv_data[1] or 0)
        inv_cost_valuation_bdt = round((inv_data[2] or 0) / 100.0, 2)
        inv_retail_valuation_bdt = round((inv_data[3] or 0) / 100.0, 2)

        # 3. Stockout and Reorder Deficit Check
        stock_subq = (
            select(
                InventoryBatch.product_id,
                func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0).label("stock")
            )
            .where(and_(
                InventoryBatch.outlet_id == clean_id,
                InventoryBatch.batch_status == "In stock",
                InventoryBatch.remaining_quantity > 0
            ))
            .group_by(InventoryBatch.product_id)
            .subquery()
        )

        low_stock_count = session.execute(
            select(func.count(OutletProduct.product_id))
            .outerjoin(stock_subq, stock_subq.c.product_id == OutletProduct.product_id)
            .where(and_(
                OutletProduct.outlet_id == clean_id,
                OutletProduct.is_active == True,
                func.coalesce(stock_subq.c.stock, 0) <= OutletProduct.reorder_point
            ))
        ).scalar() or 0

        # 4. Spoilage and Wastage Loss (from wastage_records)
        wastage_data = session.execute(
            select(
                func.coalesce(func.sum(WastageRecord.wasted_quantity), 0),
                func.coalesce(func.sum(WastageRecord.total_wastage_value_poisha), 0),
            ).where(and_(
                WastageRecord.outlet_id == clean_id,
                WastageRecord.wastage_date >= start_d,
                WastageRecord.wastage_date <= ref_d,
            ))
        ).fetchone()

        wasted_units = int(wastage_data[0] or 0)
        wastage_loss_bdt = round((wastage_data[1] or 0) / 100.0, 2)

        # 5. Top Categories by Sales
        cat_rows = session.execute(
            select(
                Product.category,
                func.sum(Sale.total_sales_poisha).label("cat_sales_poisha"),
                func.sum(Sale.quantity_sold).label("cat_qty")
            )
            .join(Product, Product.product_id == Sale.product_id)
            .where(and_(
                Sale.outlet_id == clean_id,
                Sale.sale_date >= start_d,
                Sale.sale_date <= ref_d,
            ))
            .group_by(Product.category)
            .order_by(desc("cat_sales_poisha"))
            .limit(4)
        ).all()

        top_categories = [
            {
                "category": r.category,
                "sales_bdt": round((r.cat_sales_poisha or 0) / 100.0, 2),
                "quantity_sold": int(r.cat_qty),
            }
            for r in cat_rows
        ]

        # 6. Actionable Business Recommendations
        recommendations: List[str] = []
        if low_stock_count > 0:
            recommendations.append(
                f"🚨 Reorder Alert: {low_stock_count} products have reached or breached their reorder threshold. Generate purchase orders to prevent stockouts."
            )
        if wastage_loss_bdt > 0:
            wastage_pct = round((wastage_loss_bdt / total_sales_bdt * 100), 2) if total_sales_bdt > 0 else 0
            recommendations.append(
                f"📉 Wastage Warning: Recorded ৳{wastage_loss_bdt:,.2f} in spoiled goods ({wastage_pct}% of sales). Implement FEFO dynamic discounting to salvage near-expiry items."
            )
        if margin > 0:
            recommendations.append(
                f"💡 Profit Margin: Operating at {margin}% gross margin with average daily sales of ৳{avg_daily_sales:,.2f}. Top revenue category: {top_categories[0]['category'] if top_categories else 'N/A'}."
            )
        recommendations.append(
            f"📦 Capital Allocation: Currently holding ৳{inv_cost_valuation_bdt:,.2f} in inventory cost across {stocked_skus} stocked SKUs ({active_batches} active batches)."
        )

        return {
            "outlet_id": clean_id,
            "outlet_name": outlet.outlet_name,
            "area_type": outlet.area_type,
            "reference_date": str(ref_d),
            "window_days": days,
            "financial_summary": {
                "total_sales_bdt": total_sales_bdt,
                "total_cost_bdt": total_cost_bdt,
                "gross_profit_bdt": profit_bdt,
                "gross_margin_percent": margin,
                "average_daily_sales_bdt": avg_daily_sales,
                "transaction_count": int(sales_data[2] or 0),
            },
            "inventory_health": {
                "stocked_skus_count": stocked_skus,
                "active_batches_count": active_batches,
                "cost_valuation_bdt": inv_cost_valuation_bdt,
                "retail_valuation_bdt": inv_retail_valuation_bdt,
                "low_stock_items_count": low_stock_count,
            },
            "wastage_loss_summary": {
                "wasted_units": wasted_units,
                "total_wastage_loss_bdt": wastage_loss_bdt,
            },
            "top_selling_categories": top_categories,
            "actionable_recommendations": recommendations,
        }
