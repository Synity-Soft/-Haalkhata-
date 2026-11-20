"""
BazarBondhu / Haalkhata AI — Centralized Authentication Router
=============================================================
Enables cross-device and multi-browser login synchronization.
Accounts created on any device (PC, phone, Brave, Safari, Chrome)
are stored in the centralized backend database and accessible everywhere.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.database import get_db
from backend.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─── Password Security Utilities ──────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password with a unique salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify password against salt:hash format or plain text fallback."""
    if not stored_hash:
        return False
    if ":" not in stored_hash:
        return plain_password == stored_hash
    salt, hashed = stored_hash.split(":", 1)
    test_hash = hashlib.sha256(f"{salt}{plain_password}".encode("utf-8")).hexdigest()
    return test_hash == hashed


# ─── Request / Response Schemas ───────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)
    fullName: Optional[str] = None
    shopName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    username: str
    fullName: str
    shopName: str
    role: str
    phone: str
    address: str
    createdAt: str


class AuthResult(BaseModel):
    success: bool
    user: Optional[UserProfileResponse] = None
    error: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

def seed_default_users_if_needed(db: Session):
    """Ensure default demo accounts exist on every new deployment."""
    demo_accounts = [
        ("admin", "password123", "Shop Owner", "হালখাতা জেনারেল স্টোর"),
        ("owner", "password123", "Shop Owner", "হালখাতা জেনারেল স্টোর"),
    ]
    for username, pwd, role, shop in demo_accounts:
        existing = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
        if not existing:
            new_user = User(
                id=f"user-{username}",
                username=username,
                password_hash=hash_password(pwd),
                full_name=role,
                shop_name=shop,
                role=role,
                phone="",
                address="",
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(new_user)
    db.commit()


@router.post("/register", response_model=AuthResult)
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user in the centralized database."""
    clean_username = req.username.strip().lower()
    clean_password = req.password.strip()

    if len(clean_username) < 3:
        return AuthResult(success=False, error="Username must be at least 3 characters long.")
    if len(clean_password) < 4:
        return AuthResult(success=False, error="Password must be at least 4 characters long.")

    # Check for duplicate username
    existing = db.execute(select(User).where(User.username == clean_username)).scalar_one_or_none()
    if existing:
        return AuthResult(success=False, error="Username already taken. Please choose another username.")

    user_id = f"user-{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    new_user = User(
        id=user_id,
        username=clean_username,
        password_hash=hash_password(clean_password),
        full_name=req.fullName or clean_username,
        shop_name=req.shopName or "হালখাতা স্টোর",
        role="Shop Owner",
        phone=req.phone or "",
        address=req.address or "",
        district=req.district or "",
        area=req.area or "",
        created_at=now_iso,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return AuthResult(
        success=True,
        user=UserProfileResponse(
            id=new_user.id,
            username=new_user.username,
            fullName=new_user.full_name or new_user.username,
            shopName=new_user.shop_name or "হালখাতা স্টোর",
            role=new_user.role,
            phone=new_user.phone or "",
            address=new_user.address or "",
            createdAt=new_user.created_at,
        ),
    )


@router.post("/login", response_model=AuthResult)
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    """Logs in an existing user from any device or browser."""
    clean_username = req.username.strip().lower()
    clean_password = req.password.strip()

    # Make sure demo accounts exist
    seed_default_users_if_needed(db)

    user = db.execute(select(User).where(User.username == clean_username)).scalar_one_or_none()
    if not user or not verify_password(clean_password, user.password_hash):
        return AuthResult(success=False, error="Invalid username or password. Please try again.")

    return AuthResult(
        success=True,
        user=UserProfileResponse(
            id=user.id,
            username=user.username,
            fullName=user.full_name or user.username,
            shopName=user.shop_name or "হালখাতা স্টোর",
            role=user.role,
            phone=user.phone or "",
            address=user.address or "",
            createdAt=user.created_at,
        ),
    )
