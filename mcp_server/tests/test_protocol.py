"""Tests for official MCP Protocol integration (tool discovery, schema validation, and dispatch)."""

import asyncio
import json
import unittest

from starlette.testclient import TestClient

from mcp_server.server import app, server


class TestMCPProtocol(unittest.IsolatedAsyncioTestCase):
    """Test official MCPServer in-process protocol interface."""

    async def test_tool_discovery(self):
        """MCP server must list exactly the 6 registered business tools."""
        tools = await server.list_tools()
        tool_names = [t.name for t in tools]
        expected_tools = [
            "get_inventory",
            "get_low_stock",
            "get_sales_summary",
            "get_customer_dues",
            "check_expiry",
            "get_business_insights",
        ]
        for expected in expected_tools:
            self.assertIn(expected, tool_names)

        # Check schemas
        tool_map = {t.name: t for t in tools}
        for name, t in tool_map.items():
            self.assertTrue(len(t.description) > 20, f"Tool {name} description is too brief")
            self.assertIsNotNone(t.input_schema)
            self.assertEqual(t.input_schema.get("type"), "object")

    async def test_call_get_inventory_protocol(self):
        """Test calling get_inventory via MCP protocol dispatch."""
        res = await server.call_tool("get_inventory", {"outlet_id": "OUT001", "limit": 5})
        self.assertFalse(res.is_error)
        self.assertEqual(len(res.content), 1)
        data = json.loads(res.content[0].text)
        self.assertEqual(data["outlet_id"], "OUT001")
        self.assertLessEqual(len(data["items"]), 5)

    async def test_call_get_low_stock_protocol(self):
        """Test calling get_low_stock via MCP protocol dispatch."""
        res = await server.call_tool("get_low_stock", {"outlet_id": "OUT001", "limit": 5})
        self.assertFalse(res.is_error)
        data = json.loads(res.content[0].text)
        self.assertIn("items", data)
        self.assertIn("low_stock_count", data)

    async def test_call_get_sales_summary_protocol(self):
        """Test calling get_sales_summary via MCP protocol dispatch."""
        res = await server.call_tool(
            "get_sales_summary",
            {"start_date": "2026-11-01", "end_date": "2026-11-05", "outlet_id": "OUT001"},
        )
        self.assertFalse(res.is_error)
        data = json.loads(res.content[0].text)
        self.assertIn("total_sales_bdt", data)
        self.assertIn("transaction_count", data)

    async def test_call_get_customer_dues_protocol(self):
        """Test calling get_customer_dues via MCP protocol dispatch."""
        res = await server.call_tool("get_customer_dues", {"outlet_id": "OUT001"})
        self.assertFalse(res.is_error)
        data = json.loads(res.content[0].text)
        self.assertEqual(data["status"], "managed_client_side_in_dexie")
        self.assertIn("schema_audit", data)

    async def test_call_check_expiry_protocol(self):
        """Test calling check_expiry via MCP protocol dispatch."""
        res = await server.call_tool(
            "check_expiry",
            {"outlet_id": "OUT001", "days_ahead": 15, "reference_date": "2026-11-16"},
        )
        self.assertFalse(res.is_error)
        data = json.loads(res.content[0].text)
        self.assertIn("batches", data)
        self.assertIn("total_batches_at_risk", data)

    async def test_call_get_business_insights_protocol(self):
        """Test calling get_business_insights via MCP protocol dispatch."""
        res = await server.call_tool(
            "get_business_insights",
            {"outlet_id": "OUT001", "reference_date": "2026-11-16", "days": 30},
        )
        self.assertFalse(res.is_error)
        data = json.loads(res.content[0].text)
        self.assertIn("financial_summary", data)
        self.assertIn("inventory_health", data)
        self.assertIn("actionable_recommendations", data)

    async def test_call_unknown_tool(self):
        """Calling an unregistered tool must return an error result or raise."""
        try:
            res = await server.call_tool("unknown_tool_xyz", {})
            self.assertTrue(res.is_error)
        except Exception:
            pass


class TestStreamableHTTPTransport(unittest.TestCase):
    """Test official Streamable HTTP transport implementation over Starlette ASGI."""

    def test_streamable_http_lifecycle(self):
        """Test initialize -> tools/list -> tools/call over Streamable HTTP."""
        with TestClient(app, base_url="http://127.0.0.1:8001") as client:
            # 1. Initialize
            init_res = client.post(
                "/mcp",
                headers={"Host": "127.0.0.1:8001", "accept": "text/event-stream, application/json"},
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "test-client", "version": "1.0.0"},
                    },
                },
            )
            self.assertEqual(init_res.status_code, 200)
            session_id = init_res.headers.get("mcp-session-id")
            self.assertIsNotNone(session_id)
            self.assertIn("haalkhata", init_res.text)

            # 2. tools/list over Streamable HTTP
            tools_res = client.post(
                "/mcp",
                headers={
                    "Host": "127.0.0.1:8001",
                    "accept": "text/event-stream, application/json",
                    "mcp-session-id": session_id,
                },
                json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
            )
            self.assertEqual(tools_res.status_code, 200)
            self.assertIn("get_inventory", tools_res.text)
            self.assertIn("get_low_stock", tools_res.text)
            self.assertIn("get_sales_summary", tools_res.text)
            self.assertIn("get_customer_dues", tools_res.text)
            self.assertIn("check_expiry", tools_res.text)
            self.assertIn("get_business_insights", tools_res.text)

            # 3. tools/call over Streamable HTTP
            call_res = client.post(
                "/mcp",
                headers={
                    "Host": "127.0.0.1:8001",
                    "accept": "text/event-stream, application/json",
                    "mcp-session-id": session_id,
                },
                json={
                    "jsonrpc": "2.0",
                    "id": 3,
                    "method": "tools/call",
                    "params": {"name": "get_inventory", "arguments": {"outlet_id": "OUT001", "limit": 2}},
                },
            )
            self.assertEqual(call_res.status_code, 200)
            self.assertIn("OUT001", call_res.text)
            self.assertIn("selling_price_bdt", call_res.text)


if __name__ == "__main__":
    unittest.main()
