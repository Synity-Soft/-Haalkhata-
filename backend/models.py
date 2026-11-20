"""
BazarBondhu AI — SQLAlchemy 2.0 Domain Models
==============================================

Relational models preserving canonical CSV IDs, strict foreign key constraints,
index coverage for common query patterns, and monetary minor units (poisha).

Monetary Design:
- 1 Bangladeshi Taka (BDT) = 100 Poisha.
- Monetary columns are stored as 64-bit integer poisha to prevent floating-point errors.
- Python properties (@property) provide convenient read/write conversion to BDT floats.
"""

from datetime import date
from typing import Optional, List
from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    Date,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class Outlet(Base):
    """
    Physical store or retail location (matches outlets.csv).
    """
    __tablename__ = "outlets"

    outlet_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    outlet_name: Mapped[str] = mapped_column(String(128), nullable=False)
    outlet_type: Mapped[str] = mapped_column(String(64), nullable=False)
    business_size: Mapped[Optional[str]] = mapped_column(String(32))
    division: Mapped[Optional[str]] = mapped_column(String(64))
    district: Mapped[Optional[str]] = mapped_column(String(64))
    city: Mapped[Optional[str]] = mapped_column(String(64))
    neighbourhood: Mapped[Optional[str]] = mapped_column(String(64))
    area_type: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    average_daily_customers: Mapped[Optional[int]] = mapped_column(Integer)
    inventory_capacity_sku: Mapped[Optional[int]] = mapped_column(Integer)
    has_refrigeration: Mapped[bool] = mapped_column(Boolean, default=False)
    has_pos_system: Mapped[bool] = mapped_column(Boolean, default=False)
    established_year: Mapped[Optional[int]] = mapped_column(Integer)

    # Relationships
    outlet_products: Mapped[List["OutletProduct"]] = relationship(
        "OutletProduct", back_populates="outlet", cascade="all, delete-orphan"
    )
    batches: Mapped[List["InventoryBatch"]] = relationship(
        "InventoryBatch", back_populates="outlet", cascade="all, delete-orphan"
    )
    sales: Mapped[List["Sale"]] = relationship("Sale", back_populates="outlet")
    wastage_records: Mapped[List["WastageRecord"]] = relationship("WastageRecord", back_populates="outlet")

    def __repr__(self) -> str:
        return f"<Outlet(id={self.outlet_id}, name='{self.outlet_name}', type='{self.outlet_type}')>"


class Product(Base):
    """
    Global commodity or catalog product (matches products.csv).
    """
    __tablename__ = "products"

    product_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    product_name: Mapped[str] = mapped_column(String(128), nullable=False)
    product_name_bn: Mapped[Optional[str]] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(64))
    brand: Mapped[Optional[str]] = mapped_column(String(64))
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    package_size: Mapped[Optional[str]] = mapped_column(String(32))
    perishable_status: Mapped[str] = mapped_column(String(32), default="Non-perishable")
    typical_shelf_life_days: Mapped[int] = mapped_column(Integer, default=30)
    storage_type: Mapped[Optional[str]] = mapped_column(String(32))
    average_cost_price_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    average_selling_price_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    is_essential_item: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    outlet_products: Mapped[List["OutletProduct"]] = relationship(
        "OutletProduct", back_populates="product", cascade="all, delete-orphan"
    )
    batches: Mapped[List["InventoryBatch"]] = relationship(
        "InventoryBatch", back_populates="product", cascade="all, delete-orphan"
    )
    sales: Mapped[List["Sale"]] = relationship("Sale", back_populates="product")

    @property
    def average_cost_price_bdt(self) -> float:
        return self.average_cost_price_poisha / 100.0

    @property
    def average_selling_price_bdt(self) -> float:
        return self.average_selling_price_poisha / 100.0

    def __repr__(self) -> str:
        return f"<Product(id={self.product_id}, name='{self.product_name}', category='{self.category}')>"


class Supplier(Base):
    """
    Agricultural producer, distributor, or wholesale vendor (matches suppliers.csv).
    """
    __tablename__ = "suppliers"

    supplier_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    supplier_name: Mapped[str] = mapped_column(String(128), nullable=False)
    supplier_type: Mapped[Optional[str]] = mapped_column(String(64))
    division: Mapped[Optional[str]] = mapped_column(String(64))
    district: Mapped[Optional[str]] = mapped_column(String(64))
    operating_area: Mapped[Optional[str]] = mapped_column(String(128))
    average_delivery_time_days: Mapped[Optional[int]] = mapped_column(Integer)
    reliability_score: Mapped[Optional[float]] = mapped_column(Float)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(64))

    batches: Mapped[List["InventoryBatch"]] = relationship("InventoryBatch", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier(id={self.supplier_id}, name='{self.supplier_name}')>"


class OutletProduct(Base):
    """
    Store-product catalog link defining pricing, reorder rules, and stock bounds (matches outlet_products.csv).
    """
    __tablename__ = "outlet_products"

    outlet_product_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    outlet_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("outlets.outlet_id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False, index=True
    )
    selling_price_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    purchase_cost_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    minimum_stock_level: Mapped[int] = mapped_column(Integer, default=1)
    maximum_stock_level: Mapped[int] = mapped_column(Integer, default=50)
    reorder_point: Mapped[int] = mapped_column(Integer, default=5)
    average_daily_demand: Mapped[Optional[float]] = mapped_column(Float)
    preferred_supplier_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("suppliers.supplier_id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("outlet_id", "product_id", name="uq_outlet_product_pair"),
    )

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="outlet_products")
    product: Mapped["Product"] = relationship("Product", back_populates="outlet_products")

    @property
    def selling_price_bdt(self) -> float:
        return self.selling_price_poisha / 100.0

    @property
    def purchase_cost_bdt(self) -> float:
        return self.purchase_cost_poisha / 100.0

    def __repr__(self) -> str:
        return f"<OutletProduct(id={self.outlet_product_id}, outlet={self.outlet_id}, product={self.product_id})>"


class InventoryBatch(Base):
    """
    Specific received batch of stock with expiration date and remaining quantity (matches inventory_batches.csv).
    Multiple batches per product per outlet are explicitly supported.
    """
    __tablename__ = "inventory_batches"

    batch_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    outlet_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("outlets.outlet_id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False, index=True
    )
    supplier_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("suppliers.supplier_id"), nullable=True
    )
    batch_received_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    manufacturing_date: Mapped[Optional[date]] = mapped_column(Date)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    initial_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    purchase_cost_per_unit_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    selling_price_per_unit_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_condition: Mapped[Optional[str]] = mapped_column(String(32))
    batch_status: Mapped[str] = mapped_column(String(32), default="In stock", index=True)

    __table_args__ = (
        Index("ix_batch_outlet_prod_status", "outlet_id", "product_id", "batch_status"),
        Index("ix_batch_outlet_expiry", "outlet_id", "expiry_date"),
    )

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="batches")
    product: Mapped["Product"] = relationship("Product", back_populates="batches")
    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier", back_populates="batches")
    sales: Mapped[List["Sale"]] = relationship("Sale", back_populates="batch")
    wastage_records: Mapped[List["WastageRecord"]] = relationship("WastageRecord", back_populates="batch")

    @property
    def purchase_cost_per_unit_bdt(self) -> float:
        return self.purchase_cost_per_unit_poisha / 100.0

    @property
    def selling_price_per_unit_bdt(self) -> float:
        return self.selling_price_per_unit_poisha / 100.0

    def __repr__(self) -> str:
        return f"<InventoryBatch(id={self.batch_id}, product={self.product_id}, remaining={self.remaining_quantity}, expiry={self.expiry_date})>"


class Sale(Base):
    """
    Individual sales transaction line item (matches sales.csv).
    """
    __tablename__ = "sales"

    sale_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(32), index=True)
    outlet_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("outlets.outlet_id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("inventory_batches.batch_id"), nullable=True, index=True
    )
    sale_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    sale_time: Mapped[Optional[str]] = mapped_column(String(16))
    quantity_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_selling_price_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost_price_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    total_sales_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(32), default="Cash")
    customer_segment: Mapped[Optional[str]] = mapped_column(String(64))

    __table_args__ = (
        Index("ix_sales_outlet_date", "outlet_id", "sale_date"),
        Index("ix_sales_outlet_prod_date", "outlet_id", "product_id", "sale_date"),
    )

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="sales")
    product: Mapped["Product"] = relationship("Product", back_populates="sales")
    batch: Mapped[Optional["InventoryBatch"]] = relationship("InventoryBatch", back_populates="sales")

    @property
    def unit_selling_price_bdt(self) -> float:
        return self.unit_selling_price_poisha / 100.0

    @property
    def total_sales_bdt(self) -> float:
        return self.total_sales_poisha / 100.0

    def __repr__(self) -> str:
        return f"<Sale(id={self.sale_id}, outlet={self.outlet_id}, product={self.product_id}, qty={self.quantity_sold}, date={self.sale_date})>"


class WastageRecord(Base):
    """
    Spoilage, expiry, and damaged stock loss records (matches wastage_records.csv).
    """
    __tablename__ = "wastage_records"

    wastage_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    outlet_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("outlets.outlet_id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("inventory_batches.batch_id"), nullable=True, index=True
    )
    wastage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    wasted_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    wastage_reason: Mapped[str] = mapped_column(String(64), nullable=False)
    unit_cost_poisha: Mapped[int] = mapped_column(Integer, nullable=False)
    total_wastage_value_poisha: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_wastage_outlet_date", "outlet_id", "wastage_date"),
    )

    # Relationships
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="wastage_records")
    batch: Mapped[Optional["InventoryBatch"]] = relationship("InventoryBatch", back_populates="wastage_records")

    @property
    def unit_cost_bdt(self) -> float:
        return self.unit_cost_poisha / 100.0

    @property
    def total_wastage_value_bdt(self) -> float:
        return self.total_wastage_value_poisha / 100.0

    def __repr__(self) -> str:
        return f"<WastageRecord(id={self.wastage_id}, outlet={self.outlet_id}, qty={self.wasted_quantity}, reason='{self.wastage_reason}')>"


class User(Base):
    """
    Centralized user accounts for cross-device authentication across PC, mobile, and browsers.
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(128))
    shop_name: Mapped[Optional[str]] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(64), default="Shop Owner")
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    address: Mapped[Optional[str]] = mapped_column(String(256))
    district: Mapped[Optional[str]] = mapped_column(String(64))
    area: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(32))

    def __repr__(self) -> str:
        return f"<User(id='{self.id}', username='{self.username}', shop='{self.shop_name}')>"
