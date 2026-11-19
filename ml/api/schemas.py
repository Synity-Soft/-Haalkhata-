"""
BazarBondhu AI — FastAPI Request & Response Schemas
===================================================

Defines strongly-typed Pydantic schemas for the forecasting API endpoints.
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    api_name: str = Field(default="BazarBondhu AI Demand Forecasting API")
    version: str = Field(default="1.0.0")
    status: str = Field(default="online")
    docs_url: str = Field(default="/docs")


class HealthResponse(BaseModel):
    status: str = Field(description="'healthy' when service is ready, 'unhealthy' otherwise")
    prediction_service_initialized: bool = Field(description="Whether PredictionService is ready")
    model_7d_loaded: bool = Field(description="Whether 7-day model is loaded")
    model_30d_loaded: bool = Field(description="Whether 30-day model is loaded")
    model_7d_id: Optional[str] = Field(default=None, description="Experiment ID of 7-day model")
    model_30d_id: Optional[str] = Field(default=None, description="Experiment ID of 30-day model")
    earliest_supported_date: Optional[str] = Field(default=None, description="Earliest forecast date with 28d history")
    latest_supported_date: Optional[str] = Field(default=None, description="Latest supported calendar date")
    initialization_error: Optional[str] = Field(default=None, description="Error detail if initialization failed")


class PredictRequest(BaseModel):
    outlet_id: str = Field(..., description="Outlet identifier, e.g. 'OUT001'", examples=["OUT001"])
    product_id: str = Field(..., description="Product identifier, e.g. 'PRD047'", examples=["PRD047"])
    forecast_date: str = Field(..., description="Forecast origin date in YYYY-MM-DD format", examples=["2026-08-01"])
    horizon: Optional[str] = Field(default="both", description="Forecast horizon: '7d', '30d', or 'both'", examples=["both"])


class PredictResponse(BaseModel):
    success: bool = Field(default=True, description="Whether forecast succeeded")
    outlet_id: str = Field(description="Outlet code")
    product_id: str = Field(description="Product code")
    forecast_date: str = Field(description="Forecast origin date")
    forecast_7d: Optional[float] = Field(default=None, description="7-day non-negative predicted quantity")
    forecast_30d: Optional[float] = Field(default=None, description="30-day non-negative predicted quantity")
    raw_forecast_7d: Optional[float] = Field(default=None, description="Unclipped raw 7-day prediction")
    raw_forecast_30d: Optional[float] = Field(default=None, description="Unclipped raw 30-day prediction")
    daily_implied_demand_7d: Optional[float] = Field(default=None, description="Implied daily demand over 7 days")
    daily_implied_demand_30d: Optional[float] = Field(default=None, description="Implied daily demand over 30 days")
    execution_time_ms: float = Field(description="Server prediction latency in milliseconds")
    status: str = Field(default="SUCCESS")
    models: Dict[str, str] = Field(default_factory=dict, description="Estimator IDs used")


class ProductItem(BaseModel):
    product_id: str = Field(description="Product identifier code")
    category: str = Field(description="Product high-level category")
    subcategory: str = Field(description="Product subcategory")
    brand: str = Field(description="Product manufacturer or brand")
    unit: str = Field(description="Unit of measure (e.g. kg, liter, piece)")
    package_size: str = Field(description="Retail package size")
    perishable_status: str = Field(description="Perishable or Non-perishable")
    selling_price_bdt: float = Field(description="Outlet retail selling price in BDT")
    purchase_cost_bdt: float = Field(description="Outlet purchase cost in BDT")
    is_essential_item: int = Field(description="Essential commodity flag (1 or 0)")


class OutletProductsResponse(BaseModel):
    success: bool = Field(default=True)
    outlet_id: str = Field(description="Outlet identifier")
    total_products: int = Field(description="Total products stocked at this outlet")
    products: List[ProductItem] = Field(description="List of registered product metadata")


class ErrorResponse(BaseModel):
    success: bool = Field(default=False)
    error_type: str = Field(description="High-level error classification")
    detail: str = Field(description="Frontend-friendly error explanation")
