"""
BazarBondhu AI — Business Backend Package
=========================================

Centralized business domain and database layer supporting SQLite and SQLAlchemy 2.0.
"""

from backend.database import engine, SessionLocal, Base, get_db
from backend.models import (
    Outlet,
    Product,
    Supplier,
    OutletProduct,
    InventoryBatch,
    Sale,
    WastageRecord,
)

__all__ = [
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    "Outlet",
    "Product",
    "Supplier",
    "OutletProduct",
    "InventoryBatch",
    "Sale",
    "WastageRecord",
]
