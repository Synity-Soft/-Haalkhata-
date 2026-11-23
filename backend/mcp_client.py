"""
BazarBondhu / Haalkhata AI — Enterprise MCP Client Bridge
=========================================================

Connects the FastAPI backend to the Haalkhata MCP Server:
- Primary transport: Streamable HTTP (default: http://127.0.0.1:8001/mcp) using official `mcp.client.streamable_http`.
- Resilient fallback: Direct in-process execution via `mcp_server.server.server.call_tool`
  if the external HTTP process is temporarily restarting or in standalone test harnesses.
- Security enforcement: Overrides and forces the authenticated user's authorized outlet ID
  into every tool argument, completely preventing cross-tenant data access.
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional

import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

# Direct server fallback for maximum resilience
from mcp_server.server import server as in_process_mcp_server
from mcp_server.config import DEFAULT_REFERENCE_DATE

logger = logging.getLogger("bazarbondhu.mcp_client")

MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://127.0.0.1:8001/mcp")
MCP_TIMEOUT_SECONDS = float(os.environ.get("MCP_TIMEOUT_SECONDS", "5.0"))


class MCPClientBridge:
    """
    Bridge client that connects to the Haalkhata MCP Server and executes business tools.
    """

    def __init__(self, server_url: str = MCP_SERVER_URL, timeout: float = MCP_TIMEOUT_SECONDS):
        self.server_url = server_url
        self.timeout = timeout

    async def call_tool(
        self,
        name: str,
        arguments: Dict[str, Any],
        authorized_outlet_id: str,
    ) -> Dict[str, Any]:
        """
        Execute an MCP tool while strictly enforcing the authorized outlet boundary.
        """
        # Security: Force authorized outlet ID for all outlet-scoped tools
        enforced_args = dict(arguments or {})
        enforced_args["outlet_id"] = authorized_outlet_id

        # Sensible defaults for reference dates if omitted by LLM
        if name in ("check_expiry", "get_business_insights") and "reference_date" not in enforced_args:
            enforced_args["reference_date"] = DEFAULT_REFERENCE_DATE

        if name == "get_sales_summary":
            if "start_date" not in enforced_args:
                enforced_args["start_date"] = "2026-11-16"
            if "end_date" not in enforced_args:
                enforced_args["end_date"] = "2026-11-16"

        # 1. Try Streamable HTTP transport first
        try:
            return await asyncio.wait_for(
                self._call_streamable_http(name, enforced_args),
                timeout=self.timeout,
            )
        except Exception as http_err:
            logger.info(
                f"Streamable HTTP transport to {self.server_url} unavailable or timed out ({http_err}). "
                f"Falling back to in-process MCP server dispatch."
            )

        # 2. Resilient in-process protocol dispatch
        return await self._call_in_process(name, enforced_args)

    async def _call_streamable_http(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Connect to MCP server over Streamable HTTP and execute tool."""
        transport_timeout = httpx2.Timeout(self.timeout, connect=2.0)
        async with httpx2.AsyncClient(timeout=transport_timeout) as http_client:
            async with streamable_http_client(self.server_url, http_client=http_client) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    result = await session.call_tool(name, arguments=arguments)
                    if result.is_error:
                        error_msg = result.content[0].text if result.content else "Unknown MCP error"
                        return {"error": error_msg, "success": False}
                    raw_text = result.content[0].text if result.content else "{}"
                    try:
                        return json.loads(raw_text)
                    except json.JSONDecodeError:
                        return {"raw": raw_text, "success": True}

    async def _call_in_process(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Direct in-process protocol dispatch (identical read-only guarantees)."""
        try:
            result = await in_process_mcp_server.call_tool(name, arguments)
            if result.is_error:
                error_msg = result.content[0].text if result.content else "Unknown MCP error"
                return {"error": error_msg, "success": False}
            raw_text = result.content[0].text if result.content else "{}"
            try:
                return json.loads(raw_text)
            except json.JSONDecodeError:
                return {"raw": raw_text, "success": True}
        except Exception as e:
            logger.error(f"In-process MCP tool execution failed: {e}", exc_info=True)
            return {"error": str(e), "success": False}


# Global singleton instance
mcp_client = MCPClientBridge()
