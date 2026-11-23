#!/usr/bin/env python3
"""
BazarBondhu AI — Unified Backend Application Entry Point
========================================================

Integrates SQAT business data operations (SQLite / SQLAlchemy 2.0) with the
verified Machine Learning forecasting services into a single, cohesive FastAPI backend.

Endpoints:
  - GET  /                           : Unified API metadata & status
  - GET  /health                     : Legacy ML service readiness check
  - GET  /api/health                 : Unified system health (Database + ML status)
  - GET  /api/shops                  : Retail outlet directory from SQLite
  - POST /api/v1/predict             : 7-day and 30-day demand forecasting
  - GET  /api/v1/products/{outlet_id}: Registered product catalog for outlet
"""

import os
import sys
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.security import load_env_if_present

# Load environment variables from project-root .env if present
load_env_if_present()

from backend.database import engine, DEFAULT_DB_PATH
from backend.routers import (
    health_router,
    shops_router,
    predictions_router,
    dashboard_router,
    inventory_router,
    expiry_router,
    reports_router,
    auth_router,
    ai_router,
)
from ml.inference.prediction_service import get_prediction_service
from ml.api.schemas import RootResponse

# Configure unified logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("bazarbondhu.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Unified application lifespan manager.
    Initializes both the SQLite database connection and the ML PredictionService.
    Ensures models are loaded into memory exactly once and degrades gracefully if either fails.
    """
    logger.info("=" * 65)
    logger.info("Starting BazarBondhu AI Unified Backend...")
    logger.info("=" * 65)

    # 1. Initialize & Verify Database Connectivity
    t_db = time.time()
    try:
        from backend.models import Base
        Base.metadata.create_all(bind=engine)

        with engine.connect() as conn:
            cnt = conn.execute(text("SELECT count(*) FROM outlets")).scalar()
            if cnt == 0:
                logger.info("Outlets table is empty. Running initial master seed from DataSets/...")
                data_dir = REPO_ROOT / "DataSets"
                if (data_dir / "outlets.csv").exists():
                    from backend.scripts.seed_db import (
                        seed_outlets,
                        seed_products,
                        seed_suppliers,
                        seed_outlet_products,
                        seed_inventory_batches,
                    )
                    with engine.begin() as seed_conn:
                        seed_outlets(seed_conn, data_dir)
                        if (data_dir / "products.csv").exists():
                            seed_products(seed_conn, data_dir)
                        if (data_dir / "suppliers.csv").exists():
                            seed_suppliers(seed_conn, data_dir)
                        if (data_dir / "outlet_products.csv").exists():
                            seed_outlet_products(seed_conn, data_dir)
                        if (data_dir / "inventory_batches.csv").exists():
                            seed_inventory_batches(seed_conn, data_dir)
                        logger.info("Core master data seeded successfully.")

        app.state.db_ready = True
        app.state.db_init_error = None
        logger.info(f"Database connected and verified in {time.time() - t_db:.3f} s")
    except Exception as e:
        logger.error(f"Database connection failed during startup: {e}", exc_info=True)
        app.state.db_ready = False
        app.state.db_init_error = str(e)

    # 2. Initialize Machine Learning Prediction Service Singleton
    t_ml = time.time()
    try:
        logger.info("Initializing ML PredictionService singleton (EXP3 7D & 30D models)...")
        service = get_prediction_service()
        app.state.prediction_service = service
        app.state.ml_ready = True
        app.state.ml_init_error = None
        logger.info(f"PredictionService loaded successfully in {time.time() - t_ml:.2f} s")
    except Exception as e:
        logger.error(f"ML PredictionService failed to initialize during startup: {e}", exc_info=True)
        app.state.prediction_service = None
        app.state.ml_ready = False
        app.state.ml_init_error = str(e)

    logger.info("Unified backend initialization complete. Service is ready to handle requests.")
    yield

    logger.info("Shutting down BazarBondhu AI Unified Backend.")


# Initialize Unified FastAPI Application
app = FastAPI(
    title="BazarBondhu AI Unified Retail & Demand Forecasting API",
    description="Unified API combining persistent retail operations with machine learning demand forecasting for Bangladesh.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for Frontend Client (Allows Localhost, Vercel, and Mobile Clients)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Standardizes HTTPException responses to match frontend contract."""
    error_type = "HTTP_ERROR"
    if exc.status_code == 404:
        error_type = "NOT_FOUND"
    elif exc.status_code == 400:
        error_type = "INVALID_REQUEST"
    elif exc.status_code == 503:
        error_type = "SERVICE_UNAVAILABLE"

    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error_type": error_type, "detail": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Shields frontend from unhandled internal tracebacks with a clean HTTP 500 JSON."""
    logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_type": "INTERNAL_SERVER_ERROR",
            "detail": "An internal server error occurred. Please verify inputs or contact administrator.",
        },
    )


# Root Endpoint
@app.get("/", response_model=RootResponse, summary="API Root & Status", tags=["General"])
async def root():
    """Returns basic API service metadata and version."""
    return RootResponse(
        api_name="BazarBondhu AI Unified Retail & Demand Forecasting API",
        version="1.0.0",
        status="online",
        docs_url="/docs",
    )


# Mount Subsystem Routers
app.include_router(health_router)
app.include_router(shops_router)
app.include_router(predictions_router)
app.include_router(dashboard_router)
app.include_router(inventory_router)
app.include_router(expiry_router)
app.include_router(reports_router)
app.include_router(auth_router, prefix="/api")
app.include_router(ai_router, prefix="/api")



if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, reload=False)
