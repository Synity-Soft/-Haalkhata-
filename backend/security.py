"""
BazarBondhu / Haalkhata AI — Core Security & Multi-Branch Authorization
======================================================================

Enterprise-grade authentication and authorization primitives:
- Argon2id password hashing with automatic legacy SHA-256 upgrade.
- HS256 JWT access token generation, decoding, and validation (24h validity).
- Reusable FastAPI `get_current_user` dependency.
- Multi-branch authorization validator `verify_outlet_access`.
"""

import os
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHash
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.database import get_db
from backend.models import User, Outlet, UserOutlet

logger = logging.getLogger("bazarbondhu.security")

# Project root for .env resolution
REPO_ROOT = Path(__file__).resolve().parent.parent

# JWT Settings
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Argon2id password hasher (RFC 9106 recommended parameters)
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# HTTP Bearer scheme
security_scheme = HTTPBearer(auto_error=False)


def load_env_if_present() -> None:
    """Parse .env file in repository root if present without requiring third-party libraries."""
    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        return
    try:
        content = env_file.read_text(encoding="utf-8")
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception as e:
        logger.warning(f"Could not read .env file: {e}")


def get_jwt_secret_key() -> str:
    """
    Retrieve JWT secret key from environment or .env.
    Raises HTTPException 500 if missing.
    """
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        load_env_if_present()
        secret = os.environ.get("JWT_SECRET_KEY")

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "JWT_SECRET_KEY is not configured in environment or .env file. "
                "Please configure JWT_SECRET_KEY as instructed in project documentation."
            ),
        )
    return secret


# ─── Password Hashing & Verification ─────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password using Argon2id with automatic salt generation."""
    return ph.hash(password)


def verify_and_check_rehash(plain_password: str, stored_hash: str) -> Tuple[bool, bool]:
    """
    Verify plain password against stored hash with backward compatibility.
    Supports:
      1. Argon2id ($argon2id$, $argon2i$, $argon2d$)
      2. Legacy salted SHA-256 (salt:hash)
      3. Plaintext fallback (legacy demo accounts)

    Returns:
      (is_valid: bool, needs_rehash: bool)
    """
    if not stored_hash:
        return False, False

    # 1. Argon2 verification
    if stored_hash.startswith("$argon2"):
        try:
            ph.verify(stored_hash, plain_password)
            needs_rehash = ph.check_needs_rehash(stored_hash)
            return True, needs_rehash
        except VerifyMismatchError:
            return False, False
        except (InvalidHash, VerificationError):
            pass

    # 2. Legacy salted SHA-256 (salt:hex_hash)
    if ":" in stored_hash:
        salt, hashed = stored_hash.split(":", 1)
        test_hash = hashlib.sha256(f"{salt}{plain_password}".encode("utf-8")).hexdigest()
        if test_hash == hashed:
            return True, True  # Valid, but needs upgrade to Argon2id
        return False, False

    # 3. Plaintext fallback (for bootstrap accounts)
    if stored_hash == plain_password:
        return True, True

    return False, False


# ─── JWT Access Token Generation & Decoding ──────────────────────────────────

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token with 24-hour expiration."""
    payload = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
    payload.update({
        "exp": expire,
        "iat": now,
    })
    secret = get_jwt_secret_key()
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT access token signature and expiration."""
    secret = get_jwt_secret_key()
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token signature or payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─── FastAPI Dependencies ────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency to extract and verify authenticated User from JWT Bearer token.
    Raises HTTP 401 if token is missing, invalid, or user does not exist.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required. Please provide Authorization: Bearer <token>.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject (sub) claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account not found in database.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optional user extractor for endpoints allowing anonymous fallback."""
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    except HTTPException:
        return None


def verify_outlet_access(
    outlet_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Outlet:
    """
    Verify that the authenticated user has explicit ownership or manager access
    to the requested outlet via user_outlets.
    Raises 404 if outlet does not exist.
    Raises 403 if user is not authorized to manage the outlet.
    """
    link = db.execute(
        select(UserOutlet).where(
            UserOutlet.user_id == current_user.id,
            UserOutlet.outlet_id == outlet_id,
        )
    ).scalar_one_or_none()

    if not link:
        # Check if the outlet exists in the database
        outlet_exists = db.execute(
            select(Outlet.outlet_id).where(Outlet.outlet_id == outlet_id)
        ).scalar_one_or_none()

        if not outlet_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Outlet '{outlet_id}' does not exist.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: User '{current_user.username}' is not authorized to access outlet '{outlet_id}'.",
        )

    outlet = db.execute(select(Outlet).where(Outlet.outlet_id == outlet_id)).scalar_one()
    return outlet
