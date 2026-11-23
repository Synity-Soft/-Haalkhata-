#!/usr/bin/env python3
"""
Haalkhata Stage 2 — Live Gemini + MCP Integration Verification Script
====================================================================

Tests real Gemini API calls, real MCP function calling over Streamable HTTP,
database grounding, multi-branch authorization, and JWT security.
"""

import os
import sys
import json
import asyncio
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.security import load_env_if_present
load_env_if_present()

import httpx
from sqlalchemy import select, delete
from backend.database import SessionLocal, engine
from backend.models import User, Outlet, UserOutlet
from backend.security import hash_password, create_access_token
from backend.main import app

from datetime import datetime, timezone

OUTLET_A = "OUT001"
OUTLET_B = "OUT002"

TEST_USER_A_NAME = f"stage2_a_{uuid.uuid4().hex[:6]}"
TEST_USER_B_NAME = f"stage2_b_{uuid.uuid4().hex[:6]}"
TEST_PASSWORD = "StrongSecurePassword123!"


def setup_test_users():
    """Create test users with isolated outlet associations."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with SessionLocal() as db:
        user_a = User(
            id=f"usr-{TEST_USER_A_NAME}",
            username=TEST_USER_A_NAME,
            full_name="Stage 2 Test Owner A",
            shop_name="Nobo Bazar Branch A",
            password_hash=hash_password(TEST_PASSWORD),
            role="owner",
            created_at=now_iso,
        )
        user_b = User(
            id=f"usr-{TEST_USER_B_NAME}",
            username=TEST_USER_B_NAME,
            full_name="Stage 2 Test Owner B",
            shop_name="Shapla Bazar Branch B",
            password_hash=hash_password(TEST_PASSWORD),
            role="owner",
            created_at=now_iso,
        )
        db.add_all([user_a, user_b])
        db.flush()

        uo_a = UserOutlet(user_id=user_a.id, outlet_id=OUTLET_A, role="owner", is_primary=True, created_at=now_iso)
        uo_b = UserOutlet(user_id=user_b.id, outlet_id=OUTLET_B, role="owner", is_primary=True, created_at=now_iso)
        db.add_all([uo_a, uo_b])
        db.commit()

        token_a = create_access_token({"sub": str(user_a.id), "username": user_a.username, "role": user_a.role})
        token_b = create_access_token({"sub": str(user_b.id), "username": user_b.username, "role": user_b.role})

        return (user_a.id, token_a), (user_b.id, token_b)


def cleanup_test_users(user_a_id, user_b_id):
    """Remove test user records."""
    with SessionLocal() as db:
        db.execute(delete(UserOutlet).where(UserOutlet.user_id.in_([user_a_id, user_b_id])))
        db.execute(delete(User).where(User.id.in_([user_a_id, user_b_id])))
        db.commit()


async def run_live_tests():
    print("=" * 70)
    print("HAALKHATA STAGE 2 — LIVE GEMINI + MCP INTEGRATION TEST SUITE")
    print("=" * 70)

    (user_a_id, token_a), (user_b_id, token_b) = setup_test_users()
    print(f"Created Test User A ({TEST_USER_A_NAME}) -> OUT001")
    print(f"Created Test User B ({TEST_USER_B_NAME}) -> OUT002")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    results = {}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=60.0) as client:

        # -------------------------------------------------------------
        # QUESTION 1: আজকে আমার মোট বিক্রি কত?
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("QUESTION 1: 'আজকে আমার মোট বিক্রি কত?'")
        print("-" * 70)
        resp1 = await client.post(
            "/api/ai/chat",
            json={"question": "আজকে আমার মোট বিক্রি কত?", "outlet_id": OUTLET_A},
            headers=headers_a,
        )
        data1 = resp1.json()
        print(f"Status Code: {resp1.status_code}")
        print(f"Success: {data1.get('success')}")
        print(f"Tools Used: {data1.get('tools_used')}")
        print(f"Reply:\n{data1.get('reply')}\n")
        assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}"
        assert data1.get("success") is True
        assert "get_sales_summary" in data1.get("tools_used", [])
        results["q1_sales"] = {
            "status": "PASS",
            "tools_used": data1.get("tools_used"),
            "reply": data1.get("reply"),
        }

        # -------------------------------------------------------------
        # QUESTION 2: Which products are running low on stock?
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("QUESTION 2: 'Which products are running low on stock?'")
        print("-" * 70)
        resp2 = await client.post(
            "/api/ai/chat",
            json={"question": "Which products are running low on stock?", "outlet_id": OUTLET_A},
            headers=headers_a,
        )
        data2 = resp2.json()
        print(f"Status Code: {resp2.status_code}")
        print(f"Success: {data2.get('success')}")
        print(f"Tools Used: {data2.get('tools_used')}")
        print(f"Reply:\n{data2.get('reply')}\n")
        assert resp2.status_code == 200, f"Expected 200, got {resp2.status_code}"
        assert data2.get("success") is True
        assert "get_low_stock" in data2.get("tools_used", [])
        results["q2_low_stock"] = {
            "status": "PASS",
            "tools_used": data2.get("tools_used"),
            "reply": data2.get("reply"),
        }

        # -------------------------------------------------------------
        # QUESTION 3: কোন পণ্যগুলো এক্সপায়ার হওয়ার ঝুঁকিতে আছে?
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("QUESTION 3: 'কোন পণ্যগুলো এক্সপায়ার হওয়ার ঝুঁকিতে আছে?'")
        print("-" * 70)
        resp3 = await client.post(
            "/api/ai/chat",
            json={"question": "কোন পণ্যগুলো এক্সপায়ার হওয়ার ঝুঁকিতে আছে?", "outlet_id": OUTLET_A},
            headers=headers_a,
        )
        data3 = resp3.json()
        print(f"Status Code: {resp3.status_code}")
        print(f"Success: {data3.get('success')}")
        print(f"Tools Used: {data3.get('tools_used')}")
        print(f"Reply:\n{data3.get('reply')}\n")
        assert resp3.status_code == 200, f"Expected 200, got {resp3.status_code}"
        assert data3.get("success") is True
        assert "check_expiry" in data3.get("tools_used", [])
        results["q3_expiry"] = {
            "status": "PASS",
            "tools_used": data3.get("tools_used"),
            "reply": data3.get("reply"),
        }

        # -------------------------------------------------------------
        # QUESTION 4: Give me a summary of my business performance.
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("QUESTION 4: 'Give me a summary of my business performance.'")
        print("-" * 70)
        resp4 = await client.post(
            "/api/ai/chat",
            json={"question": "Give me a summary of my business performance.", "outlet_id": OUTLET_A},
            headers=headers_a,
        )
        data4 = resp4.json()
        print(f"Status Code: {resp4.status_code}")
        print(f"Success: {data4.get('success')}")
        print(f"Tools Used: {data4.get('tools_used')}")
        print(f"Reply:\n{data4.get('reply')}\n")
        assert resp4.status_code == 200, f"Expected 200, got {resp4.status_code}"
        assert data4.get("success") is True
        assert "get_business_insights" in data4.get("tools_used", [])
        results["q4_insights"] = {
            "status": "PASS",
            "tools_used": data4.get("tools_used"),
            "reply": data4.get("reply"),
        }

        # -------------------------------------------------------------
        # SECURITY & BRANCH ISOLATION TESTS
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("SECURITY TEST 1: Unauthenticated request rejected (401)")
        print("-" * 70)
        resp_unauth = await client.post("/api/ai/chat", json={"question": "sales?"})
        print(f"Unauth status: {resp_unauth.status_code}")
        assert resp_unauth.status_code == 401
        results["sec_unauth"] = "PASS"

        print("\n" + "-" * 70)
        print("SECURITY TEST 2: User A attempting to access unauthorized branch OUT002 (403)")
        print("-" * 70)
        resp_cross = await client.post(
            "/api/ai/chat",
            json={"question": "How much did we sell?", "outlet_id": OUTLET_B},
            headers=headers_a,
        )
        print(f"Cross-branch status: {resp_cross.status_code}")
        assert resp_cross.status_code == 403
        results["sec_cross_branch"] = "PASS"

        print("\n" + "-" * 70)
        print("SECURITY TEST 3: User B accesses own branch OUT002 (200)")
        print("-" * 70)
        resp_user_b = await client.post(
            "/api/ai/chat",
            json={"question": "What is my total sales?", "outlet_id": OUTLET_B},
            headers=headers_b,
        )
        print(f"User B status: {resp_user_b.status_code}")
        assert resp_user_b.status_code == 200
        assert resp_user_b.json().get("outlet_id") == OUTLET_B
        results["sec_user_b_isolation"] = "PASS"

    cleanup_test_users(user_a_id, user_b_id)
    print("\n" + "=" * 70)
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
    return results


if __name__ == "__main__":
    asyncio.run(run_live_tests())
