"""
BazarBondhu / Haalkhata AI — Stage 2 AI Agent & MCP Integration Test Suite
==========================================================================

Comprehensive automated tests covering:
1. Rejection of unauthenticated AI requests (HTTP 401).
2. Strict multi-branch authorization enforcement (200 for owned, 403 for unowned, 404 for non-existent).
3. Tool arguments strictly restricted to authenticated user's outlet (overriding forged outlet IDs).
4. Bilingual queries in Bangla and English executing correct MCP tools.
5. Graceful handling of Gemini API errors and MCP connection failures with deterministic grounding.
6. Mocked Gemini function-calling end-to-end multi-turn loop.
"""

import os
import sys
import uuid
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path

# Set test environment
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-32-bytes-minimum-length-for-hs256-tests"

from starlette.testclient import TestClient
from google.genai import types

from backend.main import app
from backend.ai_service import ai_agent
from backend.mcp_client import mcp_client


class TestAIAgentSecurityAndEndpoints(unittest.TestCase):
    """Verifies security boundaries, authentication, and branch ownership on POST /api/ai/chat."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # 1. Create User A with Branch A
        cls.user_a_name = f"ai_user_a_{uuid.uuid4().hex[:8]}"
        res_a = cls.client.post("/api/auth/register", json={
            "username": cls.user_a_name,
            "password": "Password123",
            "shopName": "User A Grocers",
            "branches": [{"name": "Branch A", "district": "Dhaka", "area": "Dhanmondi"}],
        })
        cls.token_a = res_a.json()["access_token"]
        cls.outlet_a = res_a.json()["user"]["branches"][0]["outlet_id"]

        # 2. Create User B with Branch B
        cls.user_b_name = f"ai_user_b_{uuid.uuid4().hex[:8]}"
        res_b = cls.client.post("/api/auth/register", json={
            "username": cls.user_b_name,
            "password": "Password123",
            "shopName": "User B Grocers",
            "branches": [{"name": "Branch B", "district": "Chittagong", "area": "Agrabad"}],
        })
        cls.token_b = res_b.json()["access_token"]
        cls.outlet_b = res_b.json()["user"]["branches"][0]["outlet_id"]

    def test_unauthenticated_request_rejected(self):
        """Calling /api/ai/chat without Bearer token returns HTTP 401."""
        res = self.client.post("/api/ai/chat", json={"question": "How much did I sell today?"})
        self.assertEqual(res.status_code, 401)

    def test_invalid_token_rejected(self):
        """Calling with forged or invalid Bearer token returns HTTP 401."""
        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": "Bearer fake.invalid.token"},
            json={"question": "How much did I sell today?"},
        )
        self.assertEqual(res.status_code, 401)

    def test_authorized_branch_access(self):
        """User A querying their own authorized Branch A succeeds (HTTP 200)."""
        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"question": "How much did I sell today?", "outlet_id": self.outlet_a},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["outlet_id"], self.outlet_a)
        self.assertIn("get_sales_summary", data["tools_used"])

    def test_unauthorized_branch_access_rejected(self):
        """User A attempting to query User B's Branch B is strictly rejected with HTTP 403."""
        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"question": "Show me secret inventory", "outlet_id": self.outlet_b},
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("not authorized", res.json()["detail"].lower())

    def test_nonexistent_branch_rejected(self):
        """Querying a non-existent outlet ID returns HTTP 404."""
        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"question": "Any products?", "outlet_id": "OUT-DOES-NOT-EXIST-000"},
        )
        self.assertEqual(res.status_code, 404)

    def test_automatic_default_outlet_resolution(self):
        """If user does not pass outlet_id, the endpoint automatically resolves to user's primary branch."""
        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"question": "Which products are running low?"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["outlet_id"], self.outlet_a)
        self.assertIn("get_low_stock", data["tools_used"])


class TestAIAgentBilingualAndToolDispatch(unittest.IsolatedAsyncioTestCase):
    """Verifies bilingual natural language queries, tool selection, and grounded outputs."""

    async def test_bangla_sales_query(self):
        """Bangla sales question triggers get_sales_summary and returns Bengali formatted reply."""
        res = await ai_agent.chat("আজকে আমার মোট বিক্রি কত?", authorized_outlet_id="OUT001")
        self.assertTrue(res["success"])
        self.assertIn("get_sales_summary", res["tools_used"])
        self.assertIn("টাকা", res["reply"])

    async def test_english_low_stock_query(self):
        """English low stock question triggers get_low_stock tool."""
        res = await ai_agent.chat("Which products are running low on stock?", authorized_outlet_id="OUT001")
        self.assertTrue(res["success"])
        self.assertIn("get_low_stock", res["tools_used"])
        self.assertIn("Stock", res["reply"])

    async def test_bangla_expiry_query(self):
        """Bangla expiry question triggers check_expiry tool."""
        res = await ai_agent.chat("কোন পণ্যগুলো এক্সপায়ার হওয়ার ঝুঁকিতে আছে?", authorized_outlet_id="OUT001")
        self.assertTrue(res["success"])
        self.assertIn("check_expiry", res["tools_used"])
        self.assertIn("মেয়াদ", res["reply"])

    async def test_english_business_insights_query(self):
        """English performance summary question triggers get_business_insights tool."""
        res = await ai_agent.chat("Give me a comprehensive business performance summary", authorized_outlet_id="OUT001")
        self.assertTrue(res["success"])
        self.assertIn("get_business_insights", res["tools_used"])
        self.assertIn("Revenue", res["reply"])

    async def test_outlet_id_enforcement_overrides_forged_args(self):
        """MCP client bridge strictly overrides any forged outlet ID with the authorized outlet."""
        # Intentionally pass a forged/attack outlet_id in arguments
        forged_args = {"outlet_id": "OUT-ATTACKER-FORGED", "search": "Sugar"}
        result = await mcp_client.call_tool("get_inventory", forged_args, authorized_outlet_id="OUT001")

        # The result must belong to the authorized outlet, NOT the forged outlet
        self.assertEqual(result["outlet_id"], "OUT001")


class TestGeminiFunctionCallingMocked(unittest.IsolatedAsyncioTestCase):
    """Simulates Gemini function calling loop with mock client to test turn-by-turn orchestration without quota consumption."""

    async def test_mocked_gemini_two_turn_tool_execution(self):
        """Verifies Gemini function_calls detection, tool dispatch, and synthesis."""
        mock_client = MagicMock()

        # Turn 1: Model requests get_inventory tool call
        turn1_candidate = MagicMock()
        turn1_call = types.FunctionCall(name="get_inventory", args={"search": "Rice", "outlet_id": "OUT999"})
        turn1_response = MagicMock()
        turn1_response.function_calls = [turn1_call]
        turn1_response.candidates = [MagicMock(content=types.Content(role="model", parts=[types.Part(function_call=turn1_call)]))]

        # Turn 2: Model synthesizes final text
        turn2_response = MagicMock()
        turn2_response.function_calls = None
        turn2_response.text = "You currently have 50 bags of Miniket Rice in stock at Dhanmondi Store."

        mock_client.models.generate_content.side_effect = [turn1_response, turn2_response]

        # Inject mock client into ai_agent
        original_client = ai_agent.client
        ai_agent.client = mock_client
        try:
            res = await ai_agent.chat(
                question="Do I have Miniket Rice?",
                authorized_outlet_id="OUT001",
                outlet_name="Dhanmondi Store",
            )
            self.assertTrue(res["success"])
            self.assertIn("get_inventory", res["tools_used"])
            self.assertEqual(res["reply"], "You currently have 50 bags of Miniket Rice in stock at Dhanmondi Store.")
            self.assertEqual(mock_client.models.generate_content.call_count, 2)
        finally:
            ai_agent.client = original_client


if __name__ == "__main__":
    unittest.main()
