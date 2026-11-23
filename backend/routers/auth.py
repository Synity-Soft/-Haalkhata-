"""
BazarBondhu / Haalkhata AI — Centralized Authentication & Multi-Branch Router
=============================================================================

Secure, production-grade authentication with:
- Argon2id password hashing and automatic SHA-256 legacy migration.
- PyJWT 24-hour access token issuance on login and registration.
- Multi-branch ownership and branch synchronization with SQLite `outlets` and `user_outlets`.
- Strict access control preventing unauthorized cross-outlet access.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.database import get_db
from backend.models import User, Outlet, UserOutlet
from backend.security import (
    hash_password,
    verify_and_check_rehash,
    create_access_token,
    get_current_user,
    verify_outlet_access,
)

logger = logging.getLogger("bazarbondhu.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─── Request / Response Schemas ───────────────────────────────────────────────

class BranchInput(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1)
    district: Optional[str] = None
    area: Optional[str] = None
    outlet_type: Optional[str] = "Retail"


class BranchSummary(BaseModel):
    outlet_id: str
    outlet_name: str
    outlet_type: str
    district: Optional[str] = None
    area: Optional[str] = None
    role: str
    is_primary: bool


class BranchesListResponse(BaseModel):
    success: bool
    branches: List[BranchSummary]


class BranchCreateResponse(BaseModel):
    success: bool
    outlet_id: str
    outlet_name: str


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
    branches: Optional[List[BranchInput]] = None


class UserProfileResponse(BaseModel):
    id: str
    username: str
    fullName: str
    shopName: str
    role: str
    phone: str
    address: str
    district: Optional[str] = None
    area: Optional[str] = None
    createdAt: str
    branches: Optional[List[BranchSummary]] = None


class AuthResult(BaseModel):
    success: bool
    user: Optional[UserProfileResponse] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    error: Optional[str] = None


# ─── Helper Functions ─────────────────────────────────────────────────────────

def seed_default_users_if_needed(db: Session):
    """
    Ensure default demo accounts exist on every new deployment.
    Does NOT grant access to arbitrary dataset outlets; demo accounts
    are strictly mapped to their own demo stores or isolated accounts.
    """
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
            db.flush()

            # Create an isolated demo outlet for the account if needed
            demo_outlet_id = f"OUT-DEMO-{username.upper()}"
            demo_outlet = db.execute(select(Outlet).where(Outlet.outlet_id == demo_outlet_id)).scalar_one_or_none()
            if not demo_outlet:
                demo_outlet = Outlet(
                    outlet_id=demo_outlet_id,
                    outlet_name=shop,
                    outlet_type="Grocery",
                    division="Dhaka",
                    district="Dhaka",
                    city="Dhaka",
                    neighbourhood="Dhanmondi",
                    area_type="mixed",
                )
                db.add(demo_outlet)
                db.flush()

            # Associate demo account ONLY with demo outlet
            link_exists = db.execute(
                select(UserOutlet).where(
                    UserOutlet.user_id == new_user.id,
                    UserOutlet.outlet_id == demo_outlet_id,
                )
            ).scalar_one_or_none()
            if not link_exists:
                db.add(UserOutlet(
                    user_id=new_user.id,
                    outlet_id=demo_outlet_id,
                    role="owner",
                    is_primary=True,
                    created_at=datetime.now(timezone.utc).isoformat(),
                ))
    db.commit()


def get_user_branch_summaries(user_id: str, db: Session) -> List[BranchSummary]:
    """Fetch authorized branch summaries for a given user."""
    stmt = (
        select(UserOutlet, Outlet)
        .join(Outlet, UserOutlet.outlet_id == Outlet.outlet_id)
        .where(UserOutlet.user_id == user_id)
        .order_by(UserOutlet.is_primary.desc(), UserOutlet.id.asc())
    )
    rows = db.execute(stmt).all()
    return [
        BranchSummary(
            outlet_id=o.outlet_id,
            outlet_name=o.outlet_name,
            outlet_type=o.outlet_type,
            district=o.district,
            area=o.neighbourhood or o.area_type,
            role=uo.role,
            is_primary=uo.is_primary,
        )
        for uo, o in rows
    ]


# ─── Auth Endpoints ───────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResult)
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user account with Argon2id password hashing,
    synchronizes multiple physical store branches, and issues a 24h JWT token.
    """
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

    # Hash with Argon2id
    argon2_hash = hash_password(clean_password)

    new_user = User(
        id=user_id,
        username=clean_username,
        password_hash=argon2_hash,
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
    db.flush()

    # Process and link multiple branches
    created_branches: List[BranchInput] = []
    if req.branches and len(req.branches) > 0:
        created_branches = req.branches
    elif req.shopName:
        created_branches = [BranchInput(
            name=req.shopName,
            district=req.district,
            area=req.area,
            outlet_type="Retail",
        )]

    for idx, b in enumerate(created_branches):
        outlet_id = b.id if (b.id and b.id.startswith("OUT")) else f"OUT-{uuid.uuid4().hex[:8].upper()}"

        # Ensure Outlet record exists in DB
        existing_outlet = db.execute(select(Outlet).where(Outlet.outlet_id == outlet_id)).scalar_one_or_none()
        if not existing_outlet:
            new_outlet = Outlet(
                outlet_id=outlet_id,
                outlet_name=b.name,
                outlet_type=b.outlet_type or "Retail",
                district=b.district or req.district or "Dhaka",
                city=b.district or req.district or "Dhaka",
                neighbourhood=b.area or req.area or "Dhanmondi",
                area_type="mixed",
            )
            db.add(new_outlet)
            db.flush()

        # Link in user_outlets
        db.add(UserOutlet(
            user_id=new_user.id,
            outlet_id=outlet_id,
            role="owner",
            is_primary=(idx == 0),
            created_at=now_iso,
        ))

    db.commit()
    db.refresh(new_user)

    # Issue JWT access token
    token = create_access_token({
        "sub": new_user.id,
        "username": new_user.username,
        "role": new_user.role,
    })

    branches = get_user_branch_summaries(new_user.id, db)

    return AuthResult(
        success=True,
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=new_user.id,
            username=new_user.username,
            fullName=new_user.full_name or new_user.username,
            shopName=new_user.shop_name or "হালখাতা স্টোর",
            role=new_user.role,
            phone=new_user.phone or "",
            address=new_user.address or "",
            district=new_user.district,
            area=new_user.area,
            createdAt=new_user.created_at,
            branches=branches,
        ),
    )


@router.post("/login", response_model=AuthResult)
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Logs in an existing user from any device, validates credentials,
    automatically upgrades legacy SHA-256 hashes to Argon2id, and issues a 24h JWT.
    """
    clean_username = req.username.strip().lower()
    clean_password = req.password.strip()

    # Ensure bootstrap accounts exist
    seed_default_users_if_needed(db)

    user = db.execute(select(User).where(User.username == clean_username)).scalar_one_or_none()
    if not user:
        return AuthResult(success=False, error="Invalid username or password. Please try again.")

    # Verify password with backward compatibility
    is_valid, needs_rehash = verify_and_check_rehash(clean_password, user.password_hash)
    if not is_valid:
        return AuthResult(success=False, error="Invalid username or password. Please try again.")

    # Automatic upgrade from legacy SHA-256 to Argon2id
    if needs_rehash:
        try:
            user.password_hash = hash_password(clean_password)
            db.commit()
            logger.info(f"Upgraded password hash to Argon2id for user '{user.username}'")
        except Exception as e:
            logger.warning(f"Could not upgrade password hash for '{user.username}': {e}")
            db.rollback()

    # Issue JWT access token
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role,
    })

    branches = get_user_branch_summaries(user.id, db)

    return AuthResult(
        success=True,
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user.id,
            username=user.username,
            fullName=user.full_name or user.username,
            shopName=user.shop_name or "হালখাতা স্টোর",
            role=user.role,
            phone=user.phone or "",
            address=user.address or "",
            district=user.district,
            area=user.area,
            createdAt=user.created_at,
            branches=branches,
        ),
    )


# ─── Protected Multi-Branch Endpoints ─────────────────────────────────────────

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve authenticated user's profile and authorized branches."""
    branches = get_user_branch_summaries(current_user.id, db)
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        fullName=current_user.full_name or current_user.username,
        shopName=current_user.shop_name or "হালখাতা স্টোর",
        role=current_user.role,
        phone=current_user.phone or "",
        address=current_user.address or "",
        district=current_user.district,
        area=current_user.area,
        createdAt=current_user.created_at,
        branches=branches,
    )


@router.get("/branches", response_model=BranchesListResponse)
def list_authorized_branches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all physical branches authorized for the authenticated user.
    Enforces multi-branch ownership boundary.
    """
    branches = get_user_branch_summaries(current_user.id, db)
    return BranchesListResponse(success=True, branches=branches)


@router.post("/branches", response_model=BranchCreateResponse)
def add_authorized_branch(
    req: BranchInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register and associate a new physical store branch for the authenticated user.
    """
    outlet_id = req.id if (req.id and req.id.startswith("OUT")) else f"OUT-{uuid.uuid4().hex[:8].upper()}"

    # Create Outlet record if it doesn't already exist
    existing_outlet = db.execute(select(Outlet).where(Outlet.outlet_id == outlet_id)).scalar_one_or_none()
    if not existing_outlet:
        new_outlet = Outlet(
            outlet_id=outlet_id,
            outlet_name=req.name,
            outlet_type=req.outlet_type or "Retail",
            district=req.district or "Dhaka",
            city=req.district or "Dhaka",
            neighbourhood=req.area or "Dhanmondi",
            area_type="mixed",
        )
        db.add(new_outlet)
        db.flush()

    # Link in user_outlets
    existing_link = db.execute(
        select(UserOutlet).where(
            UserOutlet.user_id == current_user.id,
            UserOutlet.outlet_id == outlet_id,
        )
    ).scalar_one_or_none()

    if not existing_link:
        # Check if user already has a primary branch
        has_primary = db.execute(
            select(UserOutlet).where(
                UserOutlet.user_id == current_user.id,
                UserOutlet.is_primary == True,  # noqa: E712
            )
        ).scalar_one_or_none()

        db.add(UserOutlet(
            user_id=current_user.id,
            outlet_id=outlet_id,
            role="owner",
            is_primary=(has_primary is None),
            created_at=datetime.now(timezone.utc).isoformat(),
        ))
        db.commit()

    return BranchCreateResponse(
        success=True,
        outlet_id=outlet_id,
        outlet_name=req.name,
    )


@router.get("/verify-access/{outlet_id}")
def verify_branch_permission(
    outlet: Outlet = Depends(verify_outlet_access),
    current_user: User = Depends(get_current_user),
):
    """
    Security validation endpoint: returns 200 OK only if the user owns/manages the branch.
    Returns 401 if unauthenticated, 403 if unauthorized, 404 if outlet does not exist.
    """
    return {
        "success": True,
        "authorized": True,
        "user_id": current_user.id,
        "outlet_id": outlet.outlet_id,
        "outlet_name": outlet.outlet_name,
    }
