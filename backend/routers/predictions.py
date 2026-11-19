"""
BazarBondhu AI — Machine Learning Predictions Router
=====================================================

Exposes high-performance demand forecasting endpoints (/api/v1/predict) and
outlet catalog inspection (/api/v1/products/{outlet_id}).
Preserves 100% of the verified ML forecasting pipeline behavior and contracts.
"""

from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, status

from ml.api.schemas import (
    PredictRequest,
    PredictResponse,
    ProductItem,
    OutletProductsResponse,
    ErrorResponse,
)
from ml.inference.prediction_service import (
    PredictionService,
    PredictionResult,
)
from backend.mapping import (
    resolve_canonical_shop,
    resolve_canonical_product,
)

router = APIRouter(prefix="/api/v1", tags=["Machine Learning Forecasting"])


def get_prediction_service_or_503(request: Request) -> PredictionService:
    """Helper to retrieve active PredictionService from application state or raise HTTP 503."""
    service: Optional[PredictionService] = getattr(request.app.state, "prediction_service", None)
    if not getattr(request.app.state, "ml_ready", False) or service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forecasting service is currently unavailable or failed to initialize."
        )
    return service


@router.post(
    "/predict",
    response_model=PredictResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid date or boundary overrun"},
        404: {"model": ErrorResponse, "description": "Unknown outlet, product, or unregistered pair"},
        503: {"model": ErrorResponse, "description": "Prediction service not initialized"},
    },
    summary="Generate Demand Forecast"
)
async def predict_demand(req: PredictRequest, request: Request):
    """
    Generates 7-day and 30-day demand predictions for an outlet-product pair.
    Seamlessly resolves both canonical IDs (e.g. 'OUT001', 'PRD047') and mapped
    frontend mock IDs (e.g. 'shop-student-01', 'prod-s1-rice-mini').
    """
    service = get_prediction_service_or_503(request)

    horizon = req.horizon or "both"
    if horizon not in ("7d", "30d", "both"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid horizon '{horizon}'. Must be one of ['7d', '30d', 'both']."
        )

    # Safe ID resolution (pass-through for canonical, lookup for mapped mock, None for unknown)
    clean_outlet = resolve_canonical_shop(req.outlet_id) or req.outlet_id.strip()
    clean_product = resolve_canonical_product(req.product_id) or req.product_id.strip()

    try:
        res: PredictionResult = service.predict(
            outlet_id=clean_outlet,
            product_id=clean_product,
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


@router.get(
    "/products/{outlet_id}",
    response_model=OutletProductsResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Outlet not found"},
        503: {"model": ErrorResponse, "description": "Prediction service not initialized"},
    },
    summary="List Registered Products for Outlet"
)
async def get_outlet_products(outlet_id: str, request: Request):
    """
    Returns all products registered and stocked for the given outlet code.
    Reuses in-memory catalog from FeatureBuilder without duplicating data tables.
    """
    service = get_prediction_service_or_503(request)

    # Resolve shop ID if frontend mock ID is provided
    clean_outlet = resolve_canonical_shop(outlet_id) or outlet_id.strip()

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
