"""
BazarBondhu AI — Unified Backend Routers Package
"""

from backend.routers.health import router as health_router
from backend.routers.shops import router as shops_router
from backend.routers.predictions import router as predictions_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.inventory import router as inventory_router
from backend.routers.expiry import router as expiry_router
from backend.routers.reports import router as reports_router
from backend.routers.auth import router as auth_router

__all__ = [
    "health_router",
    "shops_router",
    "predictions_router",
    "dashboard_router",
    "inventory_router",
    "expiry_router",
    "reports_router",
    "auth_router",
]
