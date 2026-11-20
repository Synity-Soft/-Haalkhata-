"""
Haalkhata MCP Server — Expiry & Spoilage Auditing Tools
======================================================
Implements:
5. check_expiry: Find products approaching their expiry dates and calculate
   spoilage financial risk with FEFO liquidation discount recommendations.
"""

from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from backend.models import InventoryBatch, Product, Outlet
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


def execute_check_expiry(
    outlet_id: str = "OUT001",
    days_ahead: int = 30,
    reference_date: str = "2026-11-16",
    include_already_expired: bool = True,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Audits perishable and packaged inventory batches approaching expiration or already expired.
    Calculates calendar days remaining, financial loss exposure at cost, and prescribes
    FEFO (First Expired, First Out) discount liquidation actions to eliminate total loss.
    """
    days_ahead = max(1, min(days_ahead, 365))
    limit = max(1, min(limit, 200))
    ref_d = _parse_iso_date(reference_date, date(2026, 11, 16))
    threshold_d = ref_d + timedelta(days=days_ahead)

    with get_readonly_session() as session:
        clean_id = (resolve_canonical_shop(outlet_id) or outlet_id).strip()
        outlet = session.get(Outlet, clean_id)
        if outlet is None:
            raise ValueError(f"Outlet '{outlet_id}' not found in database.")

        # Base filter: batches holding positive stock in this outlet
        filters = [
            InventoryBatch.outlet_id == clean_id,
            InventoryBatch.remaining_quantity > 0,
            InventoryBatch.expiry_date <= threshold_d,
        ]

        if not include_already_expired:
            filters.append(InventoryBatch.expiry_date >= ref_d)

        stmt = (
            select(
                InventoryBatch.batch_id,
                Product.product_id,
                Product.product_name,
                Product.product_name_bn,
                Product.category,
                Product.unit,
                InventoryBatch.remaining_quantity,
                InventoryBatch.expiry_date,
                InventoryBatch.purchase_cost_per_unit_poisha,
                InventoryBatch.selling_price_per_unit_poisha,
                InventoryBatch.batch_status,
            )
            .join(Product, Product.product_id == InventoryBatch.product_id)
            .where(and_(*filters))
            .order_by(InventoryBatch.expiry_date.asc())
            .limit(limit)
        )

        rows = session.execute(stmt).all()

        batches_output: List[Dict[str, Any]] = []
        already_expired_count = 0
        urgent_clearance_count = 0
        total_loss_exposure_poisha = 0

        for r in rows:
            days_rem = (r.expiry_date - ref_d).days
            cost_poisha = r.purchase_cost_per_unit_poisha or 0
            exposure_poisha = int(r.remaining_quantity * cost_poisha)
            total_loss_exposure_poisha += exposure_poisha

            # Haalkhata Section 4.3 FEFO Discount & Urgency Strategy
            if days_rem < 0:
                urgency = "ALREADY_EXPIRED"
                action = "DO NOT SELL. Quarantined stock. Record in wastage log to prevent health violations."
                already_expired_count += 1
            elif days_rem <= 2:
                urgency = "CRITICAL_CLEARANCE"
                action = "Apply Buy 1 Get 1 Free (BOGO) or Buy 2 Get 1 bundle immediately to recover cost."
                urgent_clearance_count += 1
            elif days_rem <= 7:
                urgency = "URGENT_CLEARANCE"
                action = "Apply 25% – 30% discount. Move batch to front eye-level checkout shelves."
                urgent_clearance_count += 1
            elif days_rem <= 15:
                urgency = "APPROACHING_EXPIRY"
                action = "Apply 15% – 20% discount. Recommend FEFO priority to customers."
            else:
                urgency = "MONITOR"
                action = "Apply 10% promotional discount if volume is slow-moving."

            batches_output.append({
                "batch_id": r.batch_id,
                "product_id": r.product_id,
                "product_name": r.product_name,
                "product_name_bn": r.product_name_bn,
                "category": r.category,
                "unit": r.unit,
                "remaining_quantity": int(r.remaining_quantity),
                "expiry_date": str(r.expiry_date),
                "days_remaining": days_rem,
                "unit_cost_bdt": round(cost_poisha / 100.0, 2),
                "financial_loss_exposure_bdt": round(exposure_poisha / 100.0, 2),
                "urgency_status": urgency,
                "recommended_clearance_action": action,
            })

        return {
            "outlet_id": clean_id,
            "outlet_name": outlet.outlet_name,
            "reference_date": str(ref_d),
            "days_ahead": days_ahead,
            "total_batches_at_risk": len(batches_output),
            "already_expired_count": already_expired_count,
            "urgent_clearance_count": urgent_clearance_count,
            "total_financial_loss_exposure_bdt": round(total_loss_exposure_poisha / 100.0, 2),
            "batches": batches_output,
        }
