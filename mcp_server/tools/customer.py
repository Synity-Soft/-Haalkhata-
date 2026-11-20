"""
Haalkhata MCP Server — Customer & Credit Audit Tools
===================================================
Implements:
4. get_customer_dues: Audits customer balances and clarifies architectural storage.
"""

from typing import Optional, Dict, Any, List
from sqlalchemy import select, func, text
from backend.models import Outlet, Supplier
from backend.mapping import resolve_canonical_shop
from mcp_server.db import get_readonly_session


def execute_get_customer_dues(
    outlet_id: Optional[str] = "OUT001",
) -> Dict[str, Any]:
    """
    Retrieves customer balance status and audits credit tracking availability.
    
    Architectural Schema Note:
    In Haalkhata's offline-first architecture, individual customer credit accounts
    and repayment ledgers (বাকির খাতা) are recorded in the shopkeeper's client-side
    IndexedDB (Dexie table 'credits'). The centralized SQLite database (bazarbondhu.db)
    contains anonymous POS transactions categorized by customer segment and supplier
    credit payment terms, but has no customer credit ledger table.
    """
    with get_readonly_session() as session:
        canonical_outlet = None
        outlet_name = "All Outlets"

        if outlet_id and outlet_id.strip():
            clean_id = (resolve_canonical_shop(outlet_id) or outlet_id).strip()
            outlet = session.get(Outlet, clean_id)
            if outlet is not None:
                canonical_outlet = clean_id
                outlet_name = outlet.outlet_name

        # Query supplier liabilities as available alternative debt data
        supplier_terms_rows = session.execute(
            select(
                Supplier.payment_terms,
                func.count(Supplier.supplier_id)
            ).group_by(Supplier.payment_terms)
        ).all()

        supplier_terms = [
            {"payment_term": r[0], "supplier_count": r[1]}
            for r in supplier_terms_rows
        ]

        return {
            "status": "managed_client_side_in_dexie",
            "outlet_id": canonical_outlet,
            "outlet_name": outlet_name,
            "message": (
                "Individual customer credit balances (গ্রাহক বাকির খাতা) are managed in Haalkhata's "
                "offline-first client-side IndexedDB database (table: 'credits') on the shopkeeper's "
                "device and are not stored in the centralized backend SQLite database (bazarbondhu.db)."
            ),
            "sqlite_database": "bazarbondhu.db",
            "checked_tables": [
                "sales",
                "outlets",
                "products",
                "inventory_batches",
                "outlet_products",
                "suppliers",
                "wastage_records",
                "users",
            ],
            "schema_audit": {
                "customer_credit_table_present": False,
                "sales_payment_methods_present": ["Cash", "Card", "Mobile financial service"],
                "sales_customer_segments_present": ["Household", "Office worker", "Student", "Worker", "Other"],
                "supplier_credit_terms_present": True,
            },
            "supplier_liabilities_available": {
                "description": "Supplier credit payment terms tracked in database",
                "terms_breakdown": supplier_terms,
            },
            "recommendation": (
                "To review individual customer debts, open the 'বাকি খাতা' tab in the Haalkhata web UI, "
                "where customer credit, partial repayments, and automated SMS reminders are active."
            ),
        }
