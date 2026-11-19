#!/usr/bin/env python3
"""
BazarBondhu AI — FastAPI Inference Application
==============================================

Lightweight REST API exposing the standalone PredictionService to frontend
and client applications.

Endpoints:
  - GET  /                           : API metadata & status
  - GET  /health                     : Service readiness & model health check
  - POST /api/v1/predict             : Dual-horizon / single-horizon demand prediction
  - GET  /api/v1/products/{outlet_id}: List products registered for a specific outlet
"""

import os
import sys
import time
import logging
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.inference.prediction_service import (
    PredictionService,
    PredictionResult,
    get_prediction_service,
)
from ml.api.schemas import (
    RootResponse,
    HealthResponse,
    PredictRequest,
    PredictResponse,
    ProductItem,
    OutletProductsResponse,
    ErrorResponse,
)

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("bazarbondhu.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager that initializes the PredictionService singleton on startup.
    If initialization fails, records the failure state so /health returns degraded
    and /predict returns HTTP 503 without crashing the server process.
    """
    logger.info("Initializing BazarBondhu AI PredictionService on startup...")
    t0 = time.time()
    try:
        service = get_prediction_service()
        app.state.prediction_service = service
        app.state.is_ready = True
        app.state.init_error = None
        logger.info(f"PredictionService initialized successfully in {time.time() - t0:.2f} s")
    except Exception as e:
        logger.error(f"PredictionService failed to initialize: {e}", exc_info=True)
        app.state.prediction_service = None
        app.state.is_ready = False
        app.state.init_error = str(e)

    yield

    logger.info("Shutting down BazarBondhu AI API.")


# Initialize FastAPI App
app = FastAPI(
    title="BazarBondhu AI Demand Forecasting API",
    description="Lightweight forecasting service for grocery and supermarket retail in Bangladesh.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
raw_cors = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:8000"
)
allowed_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Global Exception Handlers (frontend-friendly JSON error contracts)
# -----------------------------------------------------------------------------

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
    """Shields frontend from internal tracebacks, returning a clean HTTP 500."""
    logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_type": "INTERNAL_SERVER_ERROR",
            "detail": "An internal forecasting error occurred. Please verify inputs or contact administrator."
        },
    )


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/", response_model=RootResponse, summary="API Root & Status")
async def root():
    """Returns basic API service metadata and version."""
    return RootResponse(
        api_name="BazarBondhu AI Demand Forecasting API",
        version="1.0.0",
        status="online",
        docs_url="/docs"
    )


@app.get("/health", response_model=HealthResponse, summary="Service & Model Health Check")
async def health():
    """
    Reports readiness of the prediction service, model loaded statuses, and
    supported historical calendar boundaries.
    """
    service: Optional[PredictionService] = getattr(app.state, "prediction_service", None)
    is_ready: bool = getattr(app.state, "is_ready", False)
    init_error: Optional[str] = getattr(app.state, "init_error", None)

    if not is_ready or service is None:
        return HealthResponse(
            status="unhealthy",
            prediction_service_initialized=False,
            model_7d_loaded=False,
            model_30d_loaded=False,
            initialization_error=init_error
        )

    # Retrieve boundaries from feature builder
    earliest_date = service.feature_builder.canonical_dates[service.feature_builder.min_history_idx]
    latest_date = service.feature_builder.canonical_dates[-1]

    return HealthResponse(
        status="healthy",
        prediction_service_initialized=True,
        model_7d_loaded=True,
        model_30d_loaded=True,
        model_7d_id=service.model_7d_id,
        model_30d_id=service.model_30d_id,
        earliest_supported_date=earliest_date,
        latest_supported_date=latest_date,
        initialization_error=None
    )


@app.post(
    "/api/v1/predict",
    response_model=PredictResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid date or boundary overrun"},
        404: {"model": ErrorResponse, "description": "Unknown outlet, product, or unregistered pair"},
        503: {"model": ErrorResponse, "description": "Prediction service not initialized"},
    },
    summary="Generate Demand Forecast"
)
async def predict_demand(req: PredictRequest):
    """
    Generates 7-day and 30-day demand predictions for an outlet-product pair.
    """
    service: Optional[PredictionService] = getattr(app.state, "prediction_service", None)
    if not getattr(app.state, "is_ready", False) or service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forecasting service is currently unavailable or failed to initialize."
        )

    horizon = req.horizon or "both"
    if horizon not in ("7d", "30d", "both"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid horizon '{horizon}'. Must be one of ['7d', '30d', 'both']."
        )

    try:
        res: PredictionResult = service.predict(
            outlet_id=req.outlet_id,
            product_id=req.product_id,
            forecast_origin_date=req.forecast_date,
            horizon=horizon
        )
    except ValueError as e:
        msg = str(e)
        msg_lower = msg.lower()
        if "unknown outlet" in msg_lower or "unknown product" in msg_lower or "not found in outlet_products" in msg_lower:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        elif "timeline" in msg_lower or "history" in msg_lower or "date" in msg_lower:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return PredictResponse(
        success=True,
        outlet_id=res.outlet_id,
        product_id=res.product_id,
        forecast_date=res.forecast_origin_date,
        forecast_7d=res.forecast_7d,
        forecast_30d=res.forecast_30d,
        raw_forecast_7d=res.raw_forecast_7d,
        raw_forecast_30d=res.raw_forecast_30d,
        daily_implied_demand_7d=res.daily_implied_demand_7d,
        daily_implied_demand_30d=res.daily_implied_demand_30d,
        execution_time_ms=res.execution_time_ms or 0.0,
        status=res.status,
        models=res.models
    )


@app.get(
    "/api/v1/products/{outlet_id}",
    response_model=OutletProductsResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Outlet not found"},
        503: {"model": ErrorResponse, "description": "Prediction service not initialized"},
    },
    summary="List Registered Products for Outlet"
)
async def get_outlet_products(outlet_id: str):
    """
    Returns all products registered and stocked for the given outlet code.
    Reuses in-memory catalog from FeatureBuilder without duplicating data tables.
    """
    service: Optional[PredictionService] = getattr(app.state, "prediction_service", None)
    if not getattr(app.state, "is_ready", False) or service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Catalog service is currently unavailable or failed to initialize."
        )

    clean_outlet = outlet_id.strip()
    fb = service.feature_builder
    if clean_outlet not in fb.known_outlets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outlet '{clean_outlet}' not found in catalog."
        )

    # Collect registered products for this outlet
    items: List[ProductItem] = []
    for o_id, p_id in fb.op_pairs:
        if o_id == clean_outlet:
            p_idx = fb.pair_to_idx[(o_id, p_id)]
            static = fb.static_pair_data[p_idx]
            items.append(ProductItem(
                product_id=p_id,
                category=static["category"],
                subcategory=static["subcategory"],
                brand=static["brand"],
                unit=static["unit"],
                package_size=static["package_size"],
                perishable_status=static["perishable_status"],
                selling_price_bdt=static["outlet_selling_price_bdt"],
                purchase_cost_bdt=static["outlet_purchase_cost_bdt"],
                is_essential_item=static["is_essential_item"]
            ))

    return OutletProductsResponse(
        success=True,
        outlet_id=clean_outlet,
        total_products=len(items),
        products=items
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("ml.api.main:app", host="127.0.0.1", port=port, reload=False)
