"""
BazarBondhu AI — Business Domain Pydantic Schemas
=================================================

Strongly typed Pydantic response models for read-only business APIs:
- Dashboard Summary (/api/v1/dashboard/summary)
- Outlet Inventory (/api/v1/outlets/{outlet_id}/inventory)
- Expiry Batches (/api/v1/expiry/batches)
- Sales Trend (/api/v1/reports/sales-trend)

All monetary fields are represented in Bangladeshi Taka (BDT) float values.
Physical quantities preserve original units and are never aggregated across incompatible units.
"""

from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# 1. Dashboard Summary Schemas
# -----------------------------------------------------------------------------

class DashboardReportingPeriod(BaseModel):
    """Reporting window specification for dashboard sales metrics."""
    start_date: str = Field(description="Start date of the sales window (YYYY-MM-DD)")
    end_date: str = Field(description="End date of the sales window (YYYY-MM-DD)")
    days: int = Field(description="Number of calendar days in the reporting window")


class DashboardSummaryResponse(BaseModel):
    """
    Comprehensive operational summary for an outlet.
    Physical units are separated to avoid summing incompatible measures.
    """
    outlet_id: str = Field(description="Canonical outlet code (e.g. 'OUT003')")
    outlet_name: str = Field(description="Outlet display name")
    distinct_stocked_products: int = Field(description="Count of distinct products with positive stock currently on hand")
    total_registered_products: int = Field(description="Total catalog products registered in outlet_products")
    available_inventory_by_unit: Dict[str, float] = Field(
        description="Current available stock aggregated strictly by original unit of measure"
    )
    low_stock_products_count: int = Field(
        description="Number of active catalog products where current stock is at or below the reorder point"
    )
    low_stock_threshold_basis: str = Field(
        default="reorder_point",
        description="Threshold criterion used to determine low-stock status"
    )
    batches_expiring_7d: int = Field(
        description="Count of active positive-stock batches expiring within 7 days from the reference date"
    )
    batches_expiring_30d: int = Field(
        description="Count of active positive-stock batches expiring within 30 days from the reference date"
    )
    batches_expired_with_stock: int = Field(
        description="Count of batches already past their expiration date that still have remaining stock"
    )
    reference_date: str = Field(description="Simulation / reference date used for expiry calculations (YYYY-MM-DD)")
    reporting_period: DashboardReportingPeriod
    sales_revenue_bdt: float = Field(description="Total gross sales revenue in BDT over the reporting period")
    sales_transactions_count: int = Field(description="Number of distinct sales transactions over the reporting period")
    sales_line_items_count: int = Field(description="Total individual sale line item records over the reporting period")
    units_sold_by_unit: Dict[str, float] = Field(
        description="Total units sold over the period grouped strictly by unit of measure"
    )


# -----------------------------------------------------------------------------
# 2. Outlet Inventory Schemas
# -----------------------------------------------------------------------------

class OutletInventoryItem(BaseModel):
    """Inventory record for a single distinct product stocked at an outlet."""
    product_id: str = Field(description="Canonical product code (e.g. 'PRD004')")
    product_name: str = Field(description="Product English name")
    product_name_bn: Optional[str] = Field(default=None, description="Product Bengali name")
    category: str = Field(description="High-level category classification")
    unit: str = Field(description="Unit of measurement (kg, litre, packet, piece, bottle, box, dozen)")
    available_quantity: float = Field(description="Total positive remaining stock across all active in-stock batches")
    active_batch_count: int = Field(description="Number of active positive-stock batches currently held")
    selling_price_bdt: Optional[float] = Field(default=None, description="Current catalog retail selling price in BDT")
    purchase_cost_bdt: Optional[float] = Field(default=None, description="Current catalog unit purchase cost in BDT")
    nearest_expiry_date: Optional[str] = Field(
        default=None,
        description="Earliest expiration date among currently stocked batches (YYYY-MM-DD)"
    )


class OutletInventoryResponse(BaseModel):
    """Paginated inventory response for an outlet."""
    outlet_id: str = Field(description="Canonical outlet code")
    outlet_name: str = Field(description="Outlet display name")
    total_matching_products: int = Field(description="Total distinct positive-stock products matching filter")
    limit: int = Field(description="Page size limit applied")
    offset: int = Field(description="Page offset applied")
    category_filter: Optional[str] = Field(default=None, description="Applied category filter if any")
    items: List[OutletInventoryItem] = Field(description="List of positive-stock inventory items")


# -----------------------------------------------------------------------------
# 3. Expiry Batches Schemas
# -----------------------------------------------------------------------------

class ExpiryBatchItem(BaseModel):
    """Detailed metadata for a batch approaching or past expiration."""
    batch_id: str = Field(description="Unique batch code (e.g. 'BAT0000177Q1')")
    product_id: str = Field(description="Product code")
    product_name: str = Field(description="Product English name")
    product_name_bn: Optional[str] = Field(default=None, description="Product Bengali name")
    category: str = Field(description="Product category")
    unit: str = Field(description="Unit of measurement")
    remaining_quantity: float = Field(description="Unsold stock remaining in this batch")
    expiry_date: str = Field(description="Expiration date (YYYY-MM-DD)")
    days_remaining: int = Field(description="Calendar days remaining until expiry (negative if already expired)")
    unit_cost_bdt: float = Field(description="Purchase cost per unit in BDT")
    total_cost_exposure_bdt: float = Field(description="Total financial exposure in BDT (remaining_quantity * unit_cost)")
    status: str = Field(description="'upcoming' if expiry is in future, 'expired' if past expiration")


class ExpirySummary(BaseModel):
    """Aggregated financial exposure summary for expiring batches."""
    upcoming_batches_count: int = Field(description="Number of batches expiring within the specified window")
    upcoming_cost_exposure_bdt: float = Field(description="Total cost value of stock expiring within the window")
    expired_batches_count: int = Field(description="Number of batches already past expiration with remaining stock")
    expired_cost_exposure_bdt: float = Field(description="Total sunk cost loss of already expired stock")


class ExpiryBatchesResponse(BaseModel):
    """
    Expiry audit report cleanly separating upcoming clearance batches from expired stock.
    Never recommends selling expired goods.
    """
    outlet_id: str = Field(description="Canonical outlet code")
    outlet_name: str = Field(description="Outlet display name")
    reference_date: str = Field(description="Simulation / reference date (YYYY-MM-DD)")
    window_days: int = Field(description="Window lookahead in days")
    summary: ExpirySummary
    upcoming_batches: List[ExpiryBatchItem] = Field(
        description="Batches expiring within the lookahead window (candidates for promotional clearance)"
    )
    expired_batches: List[ExpiryBatchItem] = Field(
        description="Batches already past expiration (must be quarantined/disposed; never sold)"
    )


# -----------------------------------------------------------------------------
# 4. Sales Trend Schemas
# -----------------------------------------------------------------------------

class DailySalesPoint(BaseModel):
    """Daily revenue and volume record for an outlet."""
    date: str = Field(description="Calendar date in YYYY-MM-DD format")
    revenue_bdt: float = Field(description="Gross sales revenue in BDT for this calendar day")
    transaction_count: int = Field(description="Number of distinct customer transactions on this day")
    line_items_count: int = Field(description="Number of individual sales records on this day")
    units_sold_by_unit: Dict[str, float] = Field(
        description="Volume sold on this day grouped strictly by unit of measure"
    )


class SalesTrendResponse(BaseModel):
    """
    Daily sales time-series report with continuous date alignment (zero-filled missing dates).
    """
    outlet_id: str = Field(description="Canonical outlet code")
    outlet_name: str = Field(description="Outlet display name")
    start_date: str = Field(description="Start date of the trend period (YYYY-MM-DD)")
    end_date: str = Field(description="End date of the trend period (YYYY-MM-DD)")
    days: int = Field(description="Number of calendar days in the trend period")
    total_revenue_bdt: float = Field(description="Aggregate sales revenue across the entire period in BDT")
    average_daily_revenue_bdt: float = Field(description="Mean daily sales revenue in BDT")
    total_transactions: int = Field(description="Total customer transactions across the period")
    total_line_items: int = Field(description="Total sales line items across the period")
    trend: List[DailySalesPoint] = Field(description="Continuous daily chronological sales data points")
