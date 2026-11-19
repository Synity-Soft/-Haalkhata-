"""
BazarBondhu AI — Shop / Outlet Pydantic Schemas
===============================================

Defines response models for retail outlet endpoints.
Compatible with frontend ShopSummary interface in Frontend/src/lib/api.ts.
"""

from typing import Optional
from pydantic import BaseModel, Field


class ShopResponse(BaseModel):
    """
    Detailed shop response model representing an outlet from the SQLite database.
    Includes camelCase 'areaType' to match Frontend/src/lib/api.ts ShopSummary interface.
    """
    id: str = Field(..., description="Canonical outlet identifier (e.g. 'OUT001')", examples=["OUT001"])
    name: str = Field(..., description="Outlet display name", examples=["Nobo Bazar 001"])
    outlet_type: str = Field(..., description="Retail format classification", examples=["Grocery store"])
    areaType: Optional[str] = Field(None, description="Demographic / socioeconomic area classification", examples=["Premium / affluent residential"])
    business_size: Optional[str] = Field(None, description="Retail scale (Small, Medium, Large supermarket)")
    division: Optional[str] = Field(None, description="Administrative division (e.g. Dhaka, Chittagong)")
    district: Optional[str] = Field(None, description="Administrative district")
    city: Optional[str] = Field(None, description="City name")
    neighbourhood: Optional[str] = Field(None, description="Neighbourhood / locality")
    average_daily_customers: Optional[int] = Field(None, description="Average estimated daily customer footfall")
    inventory_capacity_sku: Optional[int] = Field(None, description="Maximum SKU storage capacity")
    has_refrigeration: bool = Field(default=False, description="Whether cold-chain refrigeration is installed")
    has_pos_system: bool = Field(default=False, description="Whether an electronic POS terminal is used")
    established_year: Optional[int] = Field(None, description="Store establishment year")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }
