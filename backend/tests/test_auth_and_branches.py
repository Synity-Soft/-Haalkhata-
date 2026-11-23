"""
BazarBondhu / Haalkhata AI — Stage 1 Auth & Multi-Branch Test Suite
===================================================================

Comprehensive automated verification covering:
1. Argon2id password hashing and backward-compatible SHA-256 verification.
2. Automatic password hash upgrade from SHA-256 to Argon2id on successful login.
3. JWT access token generation, decoding, expiry rejection, and signature forgery rejection.
4. FastAPI `get_current_user` Bearer token authentication and 401 enforcement.
5. Multi-branch creation, registration synchronization, and user ownership isolation.
6. `verify_outlet_access` strict authorization enforcement (403 for unauthorized, 404 for nonexistent).
"""

import os
import sys
import uuid
import hashlib
import unittest
from datetime import datetime, timedelta, timezone

# Ensure project root is in sys.path
from pathlib import Path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Set test JWT secret key before imports
TEST_JWT_SECRET = "test-jwt-secret-key-32-bytes-minimum-length-for-hs256-tests"
os.environ["JWT_SECRET_KEY"] = TEST_JWT_SECRET

from starlette.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.models import User, Outlet, UserOutlet
from backend.main import app
from backend.security import (
    hash_password,
    verify_and_check_rehash,
    create_access_token,
    decode_access_token,
    JWT_ALGORITHM,
)
import jwt


class TestPasswordSecurityAndMigration(unittest.TestCase):
    """Verifies Argon2id hashing and backward-compatible SHA-256 legacy migration."""

    def test_argon2_hashing(self):
        """Argon2id produces standard RFC 9106 hashes starting with $argon2id$."""
        pwd = "TestPassword123!"
        hashed = hash_password(pwd)
        self.assertTrue(hashed.startswith("$argon2id$"))

        # Verify correct password
        is_valid, needs_rehash = verify_and_check_rehash(pwd, hashed)
        self.assertTrue(is_valid)
        self.assertFalse(needs_rehash)

        # Reject incorrect password
        is_valid, _ = verify_and_check_rehash("WrongPassword", hashed)
        self.assertFalse(is_valid)

    def test_legacy_sha256_verification_and_rehash_flag(self):
        """Legacy salted SHA-256 hashes (salt:hash) verify correctly and signal need for rehash."""
        pwd = "legacy_secret_password"
        salt = "9f8e7d6c5b4a3210"
        legacy_hash = f"{salt}:{hashlib.sha256(f'{salt}{pwd}'.encode('utf-8')).hexdigest()}"

        is_valid, needs_rehash = verify_and_check_rehash(pwd, legacy_hash)
        self.assertTrue(is_valid)
        self.assertTrue(needs_rehash, "Legacy SHA-256 hash must signal needs_rehash=True for upgrade")

        # Wrong password against legacy hash
        is_valid, _ = verify_and_check_rehash("invalid_guess", legacy_hash)
        self.assertFalse(is_valid)


class TestJwtTokenLifecycle(unittest.TestCase):
    """Verifies JWT generation, claim parsing, expiry enforcement, and tampering rejection."""

    def test_jwt_generation_and_decoding(self):
        """Valid JWT encodes subject and custom claims and decodes cleanly."""
        user_id = "user-test-uuid-1234"
        token = create_access_token({"sub": user_id, "username": "shafiq_traders", "role": "Shop Owner"})
        self.assertIsInstance(token, str)

        payload = decode_access_token(token)
        self.assertEqual(payload["sub"], user_id)
        self.assertEqual(payload["username"], "shafiq_traders")
        self.assertEqual(payload["role"], "Shop Owner")
        self.assertIn("exp", payload)
        self.assertIn("iat", payload)

    def test_expired_jwt_rejection(self):
        """Expired JWT raises HTTP 401 with clear expiration message."""
        expired_token = create_access_token(
            {"sub": "user-expired"},
            expires_delta=timedelta(seconds=-10),  # expired 10 seconds ago
        )
        with self.assertRaises(Exception) as ctx:
            decode_access_token(expired_token)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("expired", ctx.exception.detail.lower())

    def test_invalid_signature_rejection(self):
        """JWT signed with forged secret key raises HTTP 401."""
        forged_token = jwt.encode(
            {"sub": "user-attacker", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "attacker-fake-secret-key-1234567890",
            algorithm="HS256",
        )
        with self.assertRaises(Exception) as ctx:
            decode_access_token(forged_token)
        self.assertEqual(ctx.exception.status_code, 401)


class TestAuthenticationEndpoints(unittest.TestCase):
    """Verifies registration, login, auto-upgrade to Argon2, and input validation."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_register_and_login_flow(self):
        """Registers a user, receives JWT, and logs in successfully."""
        unique_user = f"owner_{uuid.uuid4().hex[:8]}"
        password = "SecurePassword123"

        # 1. Register
        reg_res = self.client.post("/api/auth/register", json={
            "username": unique_user,
            "password": password,
            "fullName": "Md. Shafiqul Islam",
            "shopName": "ধানমন্ডি ফ্রেশ মার্ট",
            "phone": "01711000000",
            "district": "Dhaka",
            "area": "Dhanmondi",
        })
        self.assertEqual(reg_res.status_code, 200)
        data = reg_res.json()
        self.assertTrue(data["success"])
        self.assertIsNotNone(data["access_token"])
        self.assertEqual(data["token_type"], "bearer")
        self.assertEqual(data["user"]["username"], unique_user)

        # 2. Login
        login_res = self.client.post("/api/auth/login", json={
            "username": unique_user,
            "password": password,
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()
        self.assertTrue(login_data["success"])
        self.assertIsNotNone(login_data["access_token"])
        self.assertEqual(login_data["user"]["shopName"], "ধানমন্ডি ফ্রেশ মার্ট")

    def test_duplicate_registration_rejection(self):
        """Cannot register with an existing username."""
        unique_user = f"dup_{uuid.uuid4().hex[:8]}"
        self.client.post("/api/auth/register", json={
            "username": unique_user,
            "password": "Password123",
        })

        dup_res = self.client.post("/api/auth/register", json={
            "username": unique_user,
            "password": "Password456",
        })
        self.assertEqual(dup_res.status_code, 200)
        data = dup_res.json()
        self.assertFalse(data["success"])
        self.assertIn("already taken", data["error"])

    def test_invalid_credentials_rejection(self):
        """Login rejects wrong password and nonexistent username."""
        res_wrong_pw = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "definitely_wrong_password",
        })
        self.assertFalse(res_wrong_pw.json()["success"])

        res_nonexistent = self.client.post("/api/auth/login", json={
            "username": "user_does_not_exist_9999",
            "password": "anyPassword123",
        })
        self.assertFalse(res_nonexistent.json()["success"])

    def test_legacy_sha256_login_auto_upgrades_to_argon2(self):
        """Users with existing SHA-256 password hashes are automatically upgraded to Argon2id upon login."""
        legacy_username = f"legacy_{uuid.uuid4().hex[:8]}"
        plain_pw = "MigrationPassword123"
        salt = "abcdef1234567890"
        sha_hash = f"{salt}:{hashlib.sha256(f'{salt}{plain_pw}'.encode('utf-8')).hexdigest()}"

        # Insert directly into DB with legacy hash
        from backend.database import SessionLocal
        with SessionLocal() as db:
            user = User(
                id=f"user-{legacy_username}",
                username=legacy_username,
                password_hash=sha_hash,
                full_name="Legacy Merchant",
                shop_name="পুরাতন হালখাতা",
                role="Shop Owner",
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(user)
            db.commit()

        # Login with the legacy account
        login_res = self.client.post("/api/auth/login", json={
            "username": legacy_username,
            "password": plain_pw,
        })
        self.assertTrue(login_res.json()["success"])

        # Verify in DB that the hash has been upgraded to Argon2id
        with SessionLocal() as db:
            updated_user = db.execute(select(User).where(User.username == legacy_username)).scalar_one()
            self.assertTrue(
                updated_user.password_hash.startswith("$argon2id$"),
                f"Password hash should have been upgraded to Argon2id, got {updated_user.password_hash[:20]}",
            )


class TestMultiBranchOwnershipAndAuthorization(unittest.TestCase):
    """Verifies multi-branch registration, branch queries, and boundary enforcement."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_registration_with_multiple_branches(self):
        """User registers with 3 distinct store branches; all 3 are stored in outlets and linked in user_outlets."""
        owner_name = f"multi_{uuid.uuid4().hex[:8]}"
        branches_input = [
            {"name": "ধানমন্ডি প্রধান শাখা", "district": "Dhaka", "area": "Dhanmondi"},
            {"name": "গুলশান শাখা", "district": "Dhaka", "area": "Gulshan"},
            {"name": "উত্তরা হাব", "district": "Dhaka", "area": "Uttara"},
        ]

        res = self.client.post("/api/auth/register", json={
            "username": owner_name,
            "password": "Password1234",
            "fullName": "Multi-Branch Owner",
            "shopName": "হালখাতা সুপারশপ চেইন",
            "branches": branches_input,
        })
        self.assertTrue(res.json()["success"])
        token = res.json()["access_token"]
        user_id = res.json()["user"]["id"]

        # Check returned branch summaries in registration response
        returned_branches = res.json()["user"]["branches"]
        self.assertEqual(len(returned_branches), 3)

        # Retrieve branches via protected endpoint GET /api/auth/branches
        branches_res = self.client.get(
            "/api/auth/branches",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(branches_res.status_code, 200)
        branches_data = branches_res.json()["branches"]
        self.assertEqual(len(branches_data), 3)

        branch_names = [b["outlet_name"] for b in branches_data]
        self.assertIn("ধানমন্ডি প্রধান শাখা", branch_names)
        self.assertIn("গুলশান শাখা", branch_names)
        self.assertIn("উত্তরা হাব", branch_names)

        # Verify exactly one primary branch
        primary_branches = [b for b in branches_data if b["is_primary"]]
        self.assertEqual(len(primary_branches), 1)

    def test_unauthenticated_request_rejected(self):
        """Protected branch endpoints return HTTP 401 when no token is supplied."""
        res = self.client.get("/api/auth/branches")
        self.assertEqual(res.status_code, 401)

    def test_verify_outlet_access_authorization_boundary(self):
        """
        verify_outlet_access strictly checks user_outlets:
        - 200 for user's authorized branch
        - 403 for unauthorized branch (e.g. another user's branch or unassigned outlet)
        - 404 for non-existent outlet ID
        """
        # Create User A with Branch A
        user_a = f"usera_{uuid.uuid4().hex[:8]}"
        res_a = self.client.post("/api/auth/register", json={
            "username": user_a,
            "password": "Password123",
            "shopName": "User A Store",
            "branches": [{"name": "Branch A Only", "district": "Dhaka", "area": "Mirpur"}],
        })
        token_a = res_a.json()["access_token"]
        outlet_a = res_a.json()["user"]["branches"][0]["outlet_id"]

        # Create User B with Branch B
        user_b = f"userb_{uuid.uuid4().hex[:8]}"
        res_b = self.client.post("/api/auth/register", json={
            "username": user_b,
            "password": "Password123",
            "shopName": "User B Store",
            "branches": [{"name": "Branch B Only", "district": "Chattogram", "area": "Agrabad"}],
        })
        token_b = res_b.json()["access_token"]
        outlet_b = res_b.json()["user"]["branches"][0]["outlet_id"]

        # 1. User A accesses Branch A -> 200 OK
        res_a_on_a = self.client.get(
            f"/api/auth/verify-access/{outlet_a}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res_a_on_a.status_code, 200)
        self.assertTrue(res_a_on_a.json()["authorized"])

        # 2. User A accesses Branch B -> 403 Forbidden
        res_a_on_b = self.client.get(
            f"/api/auth/verify-access/{outlet_b}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res_a_on_b.status_code, 403)
        self.assertIn("not authorized", res_a_on_b.json()["detail"].lower())

        # 3. User B accesses Branch A -> 403 Forbidden
        res_b_on_a = self.client.get(
            f"/api/auth/verify-access/{outlet_a}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        self.assertEqual(res_b_on_a.status_code, 403)

        # 4. User A accesses dataset outlet OUT001 (which exists, but User A does NOT own) -> 403 Forbidden
        res_a_on_dataset = self.client.get(
            "/api/auth/verify-access/OUT001",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res_a_on_dataset.status_code, 403)

        # 5. User A accesses non-existent outlet -> 404 Not Found
        res_nonexistent = self.client.get(
            "/api/auth/verify-access/OUT-NONEXISTENT-99999",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(res_nonexistent.status_code, 404)

    def test_add_branch_to_existing_account(self):
        """Authenticated user can add a secondary branch via POST /api/auth/branches."""
        owner = f"grow_{uuid.uuid4().hex[:8]}"
        res = self.client.post("/api/auth/register", json={
            "username": owner,
            "password": "Password123",
            "shopName": "Initial Shop",
        })
        token = res.json()["access_token"]

        # Add second branch
        add_res = self.client.post(
            "/api/auth/branches",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "নতুন শাখা ২", "district": "Sylhet", "area": "Zindabazar"},
        )
        self.assertEqual(add_res.status_code, 200)
        new_outlet_id = add_res.json()["outlet_id"]

        # Verify access to the newly added branch
        verify_res = self.client.get(
            f"/api/auth/verify-access/{new_outlet_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(verify_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
