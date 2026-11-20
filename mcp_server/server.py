"""Haalkhata MCP Server.

Exposes Haalkhata's business data and operations from the SQLite database
through the official Model Context Protocol (MCP) Python SDK.
"""

import argparse
import asyncio
import logging
import sys
from typing import Any, Dict, Optional

from mcp.server.mcpserver import MCPServer

from mcp_server.config import settings
from mcp_server.tools import (
    execute_check_expiry,
    execute_get_business_insights,
    execute_get_customer_dues,
    execute_get_inventory,
    execute_get_low_stock,
    execute_get_sales_summary,
)

logger = logging.getLogger("mcp_server.server")

# Initialize official MCPServer
server = MCPServer(
    name=settings.SERVER_NAME,
    version=settings.SERVER_VERSION,
    description="Haalkhata AI Business Operating System MCP Server - Retail Analytics & Operations",
)


# ==============================================================================
# Tool 1: get_inventory
# ==============================================================================
@server.tool(
    name="get_inventory",
    description=(
        "Retrieve product inventory, current stock levels, retail pricing, "
        "cost prices, margins, and stock status for an outlet. Supports searching "
        "by product name or SKU substring, category filtering, and pagination."
    ),
)
async def get_inventory(
    outlet_id: str = "OUT001",
    search_query: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Retrieve product names, stock quantities, and prices with search/category support."""
    return execute_get_inventory(
        outlet_id=outlet_id,
        search_query=search_query,
        category=category,
        limit=limit,
        offset=offset,
    )


# ==============================================================================
# Tool 2: get_low_stock
# ==============================================================================
@server.tool(
    name="get_low_stock",
    description=(
        "Identify inventory items that have fallen below their configured stock threshold "
        "(reorder_point or minimum_stock_level). Returns items ranked by urgency deficit, "
        "including recommended reorder quantities and supplier details."
    ),
)
async def get_low_stock(
    outlet_id: str = "OUT001",
    threshold_type: str = "reorder_point",
    limit: int = 50,
) -> Dict[str, Any]:
    """Identify products whose stock is below their configured threshold."""
    return execute_get_low_stock(
        outlet_id=outlet_id,
        threshold_type=threshold_type,
        limit=limit,
    )


# ==============================================================================
# Tool 3: get_sales_summary
# ==============================================================================
@server.tool(
    name="get_sales_summary",
    description=(
        "Retrieve comprehensive sales aggregates for a requested date range (YYYY-MM-DD). "
        "Returns total revenue (BDT), gross profit, profit margin, transaction count, "
        "items sold, average basket value, payment method breakdowns, and top-performing products."
    ),
)
async def get_sales_summary(
    start_date: str = "2026-11-01",
    end_date: str = "2026-11-15",
    outlet_id: Optional[str] = "OUT001",
    limit_top_products: int = 5,
) -> Dict[str, Any]:
    """Retrieve sales summaries, totals, transaction counts, and payment breakdowns."""
    return execute_get_sales_summary(
        start_date=start_date,
        end_date=end_date,
        outlet_id=outlet_id,
        limit_top_products=limit_top_products,
    )


# ==============================================================================
# Tool 4: get_customer_dues
# ==============================================================================
@server.tool(
    name="get_customer_dues",
    description=(
        "Retrieve customer dues and credit ledger status. Inspects customer balance data "
        "and documents Haalkhata's offline-first architecture where customer credit (bakir khata) "
        "is managed in client-side IndexedDB with peer-to-peer sync."
    ),
)
async def get_customer_dues(
    outlet_id: Optional[str] = "OUT001",
) -> Dict[str, Any]:
    """Retrieve outstanding customer balances and credit ledger state."""
    return execute_get_customer_dues(outlet_id=outlet_id)


# ==============================================================================
# Tool 5: check_expiry
# ==============================================================================
@server.tool(
    name="check_expiry",
    description=(
        "Inspect inventory batches for perishable products approaching or past expiration. "
        "Classifies items into critical, warning, and safe risk tiers based on days remaining, "
        "calculates tied-up cost value, and suggests actionable FEFO markdown discount strategies."
    ),
)
async def check_expiry(
    outlet_id: str = "OUT001",
    days_ahead: int = 30,
    reference_date: str = "2026-11-16",
    include_already_expired: bool = True,
    limit: int = 50,
) -> Dict[str, Any]:
    """Find perishable products approaching expiry dates with FEFO liquidation guidance."""
    return execute_check_expiry(
        outlet_id=outlet_id,
        days_ahead=days_ahead,
        reference_date=reference_date,
        include_already_expired=include_already_expired,
        limit=limit,
    )


# ==============================================================================
# Tool 6: get_business_insights
# ==============================================================================
@server.tool(
    name="get_business_insights",
    description=(
        "Calculate actionable executive business intelligence and KPI analytics from actual "
        "sales, inventory, and wastage records. Evaluates gross margin, revenue velocity, "
        "inventory capital health, wastage ratios, and generates automated recommendations."
    ),
)
async def get_business_insights(
    outlet_id: str = "OUT001",
    reference_date: str = "2026-11-16",
    days: int = 30,
) -> Dict[str, Any]:
    """Return executive business insights and KPIs calculated from sales, stock, and wastage."""
    return execute_get_business_insights(
        outlet_id=outlet_id,
        reference_date=reference_date,
        days=days,
    )


# Starlette ASGI app instance for Streamable HTTP transport
app = server.streamable_http_app(streamable_http_path=settings.STREAMABLE_HTTP_PATH)


def main():
    """Command-line entry point for running Haalkhata MCP Server."""
    parser = argparse.ArgumentParser(description="Haalkhata MCP Server")
    parser.add_argument(
        "--stdio",
        action="store_true",
        help="Shortcut to run with stdio transport (useful with MCP clients and inspector)",
    )
    parser.add_argument(
        "--transport",
        choices=["streamable-http", "stdio", "sse"],
        default=settings.MCP_TRANSPORT,
        help=f"MCP transport protocol (default: {settings.MCP_TRANSPORT})",
    )
    parser.add_argument(
        "--host",
        default=settings.MCP_HOST,
        help=f"Host address to bind HTTP server (default: {settings.MCP_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.MCP_PORT,
        help=f"Port number for HTTP server (default: {settings.MCP_PORT})",
    )
    parser.add_argument(
        "--path",
        default=settings.STREAMABLE_HTTP_PATH,
        help=f"Path for Streamable HTTP endpoint (default: {settings.STREAMABLE_HTTP_PATH})",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity level",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if args.stdio or args.transport == "stdio":
        logger.info("Starting Haalkhata MCP Server on stdio transport")
        asyncio.run(server.run_stdio_async())
    elif args.transport == "streamable-http":
        logger.info(
            "Starting Haalkhata MCP Server on Streamable HTTP at http://%s:%d%s",
            args.host,
            args.port,
            args.path,
        )
        asyncio.run(
            server.run_streamable_http_async(
                host=args.host,
                port=args.port,
                streamable_http_path=args.path,
            )
        )
    elif args.transport == "sse":
        logger.info(
            "Starting Haalkhata MCP Server on SSE at http://%s:%d/sse",
            args.host,
            args.port,
        )
        asyncio.run(
            server.run_sse_async(
                host=args.host,
                port=args.port,
            )
        )


if __name__ == "__main__":
    main()
