"""
Haalkhata MCP Server — Tool Schemas & Input Validators
======================================================
Strict Pydantic models for parameter validation and structured outputs.
Prevents parameter tampering, path traversal, and out-of-range queries.
"""

from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class InventoryItemOutput(BaseModel):
    product_id: str
    product_name: str
    product_name_bn: Optional[str] = None
    category: str
    unit: str
    package_size: Optional[str] = None
    available_quantity: float
    active_batch_count: int
    selling_price_bdt: float
    purchase_cost_bdt: float
    nearest_expiry_date: Optional[str] = None
    reorder_point: Optional[int] = None


class InventoryResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    total_products_found: int
    items: List[InventoryItemOutput]


class LowStockItemOutput(BaseModel):
    product_id: str
    product_name: str
    product_name_bn: Optional[str] = None
    category: str
    unit: str
    current_stock: float
    reorder_point: int
    minimum_stock_level: int
    maximum_stock_level: int
    deficit_quantity: float
    selling_price_bdt: float
    urgency_status: str  # "CRITICAL_STOCKOUT" | "LOW_STOCK"


class LowStockResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    threshold_type: str
    low_stock_count: int
    critical_stockout_count: int
    items: List[LowStockItemOutput]


class PaymentMethodSummary(BaseModel):
    payment_method: str
    total_sales_bdt: float
    transaction_count: int
    percentage: float


class TopSellingProduct(BaseModel):
    product_id: str
    product_name: str
    quantity_sold: int
    total_sales_bdt: float


class SalesSummaryResponse(BaseModel):
    outlet_id: Optional[str] = None
    outlet_name: Optional[str] = None
    start_date: str
    end_date: str
    total_sales_bdt: float
    total_cost_bdt: float
    estimated_gross_profit_bdt: float
    profit_margin_percent: float
    transaction_count: int
    total_items_sold: int
    average_order_value_bdt: float
    payment_methods: List[PaymentMethodSummary]
    top_selling_products: List[TopSellingProduct]


class CustomerDuesResponse(BaseModel):
    status: str
    message: str
    sqlite_database: str
    checked_tables: List[str]
    architecture_clarification: str
    alternative_available_data: Optional[Dict[str, Any]] = None


class ExpiryBatchItemOutput(BaseModel):
    batch_id: str
    product_id: str
    product_name: str
    product_name_bn: Optional[str] = None
    category: str
    unit: str
    remaining_quantity: int
    expiry_date: str
    days_remaining: int
    unit_cost_bdt: float
    financial_loss_exposure_bdt: float
    urgency_status: str  # "ALREADY_EXPIRED" | "URGENT_CLEARANCE" | "APPROACHING_EXPIRY" | "MONITOR"
    recommended_clearance_action: str


class ExpiryCheckResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    reference_date: str
    days_ahead: int
    total_batches_at_risk: int
    already_expired_count: int
    urgent_clearance_count: int
    total_financial_loss_exposure_bdt: float
    batches: List[ExpiryBatchItemOutput]


class BusinessInsightsResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    area_type: Optional[str] = None
    reference_date: str
    window_days: int
    financial_summary: Dict[str, Any]
    inventory_health: Dict[str, Any]
    wastage_loss_summary: Dict[str, Any]
    top_selling_categories: List[Dict[str, Any]]
    actionable_recommendations: List[str]
