# Haalkhata MCP Server 🏪🤖

Official Model Context Protocol (MCP) server for **Haalkhata (হালখাতা)** — the AI-powered business operating system for grocery stores, retail outlets, and distributors across Bangladesh.

This server provides AI assistants (Claude, Cursor, custom agents) with read-only access to live grocery inventory, sales analytics, batch expiry tracking, and retail intelligence directly from Haalkhata's SQLite database (`bazarbondhu.db`).

---

## 🏗️ Architecture & Security Principles

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Claude Desktop / Cursor     │       │       MCP Inspector (CLI/Web)   │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 │ MCP Protocol (JSON-RPC 2.0)             │
                 ▼                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Haalkhata MCP Server                            │
│  Transport: Streamable HTTP (port 8001 /mcp)  |  Stdio  |  SSE             │
│  Framework: Official Python MCP SDK (`mcp` 2.3.0) + Starlette             │
├───────────────────────────────────────────────────────────────────────────┤
│  Tools:                                                                   │
│   1. get_inventory        - Real-time stock, pricing (BDT), search        │
│   2. get_low_stock        - Threshold alerts & reorder deficit ranking    │
│   3. get_sales_summary    - Revenue, margins, payments & top products     │
│   4. get_customer_dues    - Architectural audit & Dexie.js credit context │
│   5. check_expiry         - FEFO perishables & dynamic discount clearance │
│   6. get_business_insights- KPI health, inventory valuation, wastage      │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ Read-Only SQLAlchemy Session
                                      │ PRAGMA query_only = ON;
                                      ▼
                       ┌─────────────────────────────┐
                       │   SQLite Database           │
                       │   (`bazarbondhu.db`)        │
                       └─────────────────────────────┘
```

- **Strict Read-Only Guarantee**: Every database connection runs with SQLite `PRAGMA query_only = ON;`. Any `INSERT`, `UPDATE`, `DELETE`, or DDL attempt raises `sqlite3.OperationalError: attempt to write a readonly database`.
- **Zero Schema Pollution**: Reuses the existing `bazarbondhu.db` database schema without creating duplicate tables or modifying records.
- **Port Isolation**: Runs independently on port `8001` (by default), leaving the existing FastAPI backend (`8000`) and Vite frontend (`5173`) completely undisturbed.
- **Currency Standardization**: Database amounts stored in Poisha minor units (1 BDT = 100 Poisha) are automatically normalized to Bangladeshi Taka (৳ BDT) floats.
- **Parameterized Queries**: All database lookups use parameterized SQLAlchemy text queries to eliminate SQL injection vectors.

---

## 📦 Dependencies & Installation

### Requirements
- Python 3.10+ (Tested on Python 3.13)
- SQLite 3

### Installation

Install the required packages in your Python environment:

```bash
pip install mcp sqlalchemy pydantic starlette uvicorn
```

*(Note: MCP SDK version `2.3.0` or higher is recommended for full Streamable HTTP transport support).*

---

## 🚀 Running the MCP Server

The server supports three transport protocols via CLI flags:

### 1. Streamable HTTP Transport (Recommended)
Streamable HTTP is the modern HTTP/SSE transport for MCP. It mounts on `/mcp` by default on port `8001`:

```bash
python3 -m mcp_server.server --transport streamable-http --port 8001
```

Or run via standard ASGI web servers like Uvicorn:

```bash
uvicorn mcp_server.server:app --host 127.0.0.1 --port 8001
```

### 2. Standard Input/Output (Stdio) Transport
Best for local AI desktop applications (e.g., Claude Desktop, Cursor, MCP Inspector):

```bash
python3 -m mcp_server.server --stdio
# or
python3 -m mcp_server.server --transport stdio
```

### 3. Server-Sent Events (SSE) Transport
Legacy HTTP SSE transport:

```bash
python3 -m mcp_server.server --transport sse --port 8001
```

---

## 🔌 MCP Client Connection Configuration

### Claude Desktop Configuration
Add the Haalkhata MCP Server to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Option A: Using Stdio Transport (Direct Execution)
```json
{
  "mcpServers": {
    "haalkhata": {
      "command": "python3",
      "args": [
        "-m",
        "mcp_server.server",
        "--stdio"
      ],
      "cwd": "/Users/mdshahriarrahman/Documents/Hat-Bazar main folder"
    }
  }
}
```

#### Option B: Using Streamable HTTP Transport
```json
{
  "mcpServers": {
    "haalkhata": {
      "url": "http://127.0.0.1:8001/mcp"
    }
  }
}
```

### Cursor IDE Configuration
Create or edit `.cursor/mcp.json` in your workspace root:

```json
{
  "mcpServers": {
    "haalkhata": {
      "command": "python3",
      "args": ["-m", "mcp_server.server", "--stdio"]
    }
  }
}
```

---

## 🔬 Testing with MCP Inspector

You can test tool discovery and tool execution using `@modelcontextprotocol/inspector`.

### 1. Discover Registered Tools
```bash
mcp-inspector --cli --method tools/list python3 -m mcp_server.server --stdio
```

### 2. Execute a Tool via CLI
```bash
# Query Inventory:
mcp-inspector --cli --method tools/call --tool-name get_inventory \
  --tool-args-json '{"outlet_id":"OUT001","limit":3}' \
  python3 -m mcp_server.server --stdio

# Query Sales Summary:
mcp-inspector --cli --method tools/call --tool-name get_sales_summary \
  --tool-args-json '{"outlet_id":"OUT001","start_date":"2026-11-01","end_date":"2026-11-15"}' \
  python3 -m mcp_server.server --stdio

# Query Business Insights:
mcp-inspector --cli --method tools/call --tool-name get_business_insights \
  --tool-args-json '{"outlet_id":"OUT001","days":30}' \
  python3 -m mcp_server.server --stdio
```

### 3. Interactive Web UI Inspector
Launch the visual browser interface to test prompts and tools interactively:

```bash
mcp-inspector python3 -m mcp_server.server --stdio
```
Open the provided browser URL (e.g. `http://localhost:5173` or port assigned by inspector) to inspect schemas and run live queries.

---

## 🛠️ MCP Tools Reference

### 1. `get_inventory`
Retrieve product names, available stock levels, retail pricing, cost prices, and category breakdowns for a specific grocery outlet.

- **Parameters**:
  - `outlet_id` (*string*, default `"OUT001"`): Outlet identifier code (e.g. `"OUT001"`, `"OUT002"`).
  - `search_query` (*string*, optional): Filter products by name or SKU substring (e.g. `"Rice"`, `"Salt"`).
  - `category` (*string*, optional): Filter products by category (e.g. `"Groceries"`, `"Dairy products"`, `"Beverages"`).
  - `limit` (*integer*, default `50`): Maximum records to return (1-200).
  - `offset` (*integer*, default `0`): Pagination offset.

**Example Input**:
```json
{
  "outlet_id": "OUT001",
  "search_query": "Salt",
  "limit": 2
}
```

**Example Output**:
```json
{
  "outlet_id": "OUT001",
  "outlet_name": "Nobo Bazar 001",
  "total_products_found": 1,
  "limit": 2,
  "offset": 0,
  "items": [
    {
      "product_id": "PRD125",
      "product_name": "Iodized salt - Value pack 4",
      "product_name_bn": "আয়োডিনযুক্ত লবণ - প্যাক 4",
      "category": "Sugar and salt",
      "unit": "kg",
      "package_size": "4 kg",
      "available_quantity": 355.0,
      "active_batch_count": 4,
      "selling_price_bdt": 56.69,
      "purchase_cost_bdt": 44.62,
      "nearest_expiry_date": "2027-11-14",
      "reorder_point": 11
    }
  ]
}
```

---

### 2. `get_low_stock`
Identify products whose available inventory has dropped below safety thresholds (`reorder_point` or `minimum_stock_level`). Items are ranked by urgency deficit.

- **Parameters**:
  - `outlet_id` (*string*, default `"OUT001"`): Outlet identifier code.
  - `threshold_type` (*string*, default `"reorder_point"`): Either `"reorder_point"` or `"minimum_stock"`.
  - `limit` (*integer*, default `50`): Maximum items to return.

**Example Input**:
```json
{
  "outlet_id": "OUT001",
  "threshold_type": "reorder_point",
  "limit": 2
}
```

**Example Output**:
```json
{
  "outlet_id": "OUT001",
  "outlet_name": "Nobo Bazar 001",
  "threshold_type": "reorder_point",
  "low_stock_count": 2,
  "critical_stockout_count": 2,
  "items": [
    {
      "product_id": "PRD244",
      "product_name": "Farm egg - Family pack 7",
      "product_name_bn": "ফার্মের ডিম - প্যাক 7",
      "category": "Eggs",
      "unit": "piece",
      "current_stock": 0.0,
      "reorder_point": 5,
      "minimum_stock_level": 5,
      "maximum_stock_level": 29,
      "deficit_quantity": 5.0,
      "selling_price_bdt": 21.61,
      "urgency_status": "CRITICAL_STOCKOUT"
    }
  ]
}
```

---

### 3. `get_sales_summary`
Retrieve comprehensive sales aggregates for any date range, including revenue, estimated gross profit, profit margin, transaction count, average basket value, payment method breakdowns, and top selling products.

- **Parameters**:
  - `start_date` (*string*, default `"2026-11-01"`): Start date (YYYY-MM-DD).
  - `end_date` (*string*, default `"2026-11-15"`): End date (YYYY-MM-DD).
  - `outlet_id` (*string*, optional, default `"OUT001"`): Outlet code, or `null` for all outlets combined.
  - `limit_top_products` (*integer*, default `5`): Number of top revenue products to include.

**Example Input**:
```json
{
  "outlet_id": "OUT001",
  "start_date": "2026-11-01",
  "end_date": "2026-11-07",
  "limit_top_products": 3
}
```

**Example Output**:
```json
{
  "outlet_id": "OUT001",
  "outlet_name": "Nobo Bazar 001",
  "start_date": "2026-11-01",
  "end_date": "2026-11-07",
  "total_sales_bdt": 67370.77,
  "total_cost_bdt": 55795.94,
  "estimated_gross_profit_bdt": 11574.83,
  "profit_margin_percent": 17.18,
  "transaction_count": 100,
  "total_items_sold": 487,
  "average_order_value_bdt": 673.71,
  "payment_methods": [
    {
      "payment_method": "Cash",
      "total_sales_bdt": 28592.96,
      "transaction_count": 38,
      "percentage": 42.4
    },
    {
      "payment_method": "Mobile financial service",
      "total_sales_bdt": 20291.57,
      "transaction_count": 37,
      "percentage": 30.1
    },
    {
      "payment_method": "Card",
      "total_sales_bdt": 18486.24,
      "transaction_count": 25,
      "percentage": 27.4
    }
  ],
  "top_selling_products": [
    {
      "product_id": "PRD238",
      "product_name": "Refined sugar - Family pack 7",
      "quantity_sold": 25,
      "total_sales_bdt": 4943.93
    }
  ]
}
```

---

### 4. `get_customer_dues`
Inspects customer balance data and credit ledger status.

> [!NOTE]
> **Architectural Reality**: In Haalkhata's offline-first architecture, individual customer credit accounts (*গ্রাহক বাকির খাতা*) are stored in client-side **IndexedDB (Dexie.js `credits` table)** on the shopkeeper's device, not in the central backend SQLite database.
> The tool transparently reports this architectural design, audits the SQLite schema, and provides supplier payment credit terms tracked in the backend database.

**Example Input**:
```json
{
  "outlet_id": "OUT001"
}
```

**Example Output**:
```json
{
  "status": "managed_client_side_in_dexie",
  "outlet_id": "OUT001",
  "outlet_name": "Nobo Bazar 001",
  "message": "Individual customer credit balances (গ্রাহক বাকির খাতা) are managed in Haalkhata's offline-first client-side IndexedDB database (table: 'credits') on the shopkeeper's device and are not stored in the centralized backend SQLite database (bazarbondhu.db).",
  "sqlite_database": "bazarbondhu.db",
  "checked_tables": ["sales", "outlets", "products", "inventory_batches", "outlet_products", "suppliers", "wastage_records", "users"],
  "schema_audit": {
    "customer_credit_table_present": false,
    "sales_payment_methods_present": ["Cash", "Card", "Mobile financial service"],
    "sales_customer_segments_present": ["Household", "Office worker", "Student", "Worker", "Other"],
    "supplier_credit_terms_present": true
  },
  "supplier_liabilities_available": {
    "description": "Supplier credit payment terms tracked in database",
    "terms_breakdown": [
      { "payment_term": "15 days", "supplier_count": 31 },
      { "payment_term": "30 days", "supplier_count": 23 },
      { "payment_term": "7 days", "supplier_count": 37 },
      { "payment_term": "Cash on delivery", "supplier_count": 29 }
    ]
  },
  "recommendation": "To review individual customer debts, open the 'বাকি খাতা' tab in the Haalkhata web UI, where customer credit, partial repayments, and automated SMS reminders are active."
}
```

---

### 5. `check_expiry`
Inspect perishable batches approaching or past their expiration dates. Implements First-Expired, First-Out (FEFO) clearance discount guidance to minimize grocery shrinkage.

- **Parameters**:
  - `outlet_id` (*string*, default `"OUT001"`): Outlet code.
  - `days_ahead` (*integer*, default `30`): Lookahead window in days (e.g. 7, 15, 30, 60).
  - `reference_date` (*string*, default `"2026-11-16"`): Reference 'today' date (YYYY-MM-DD).
  - `include_already_expired` (*boolean*, default `true`): Whether to include batches that have already passed expiration.
  - `limit` (*integer*, default `50`): Maximum batch records to return.

**Example Input**:
```json
{
  "outlet_id": "OUT001",
  "days_ahead": 15,
  "reference_date": "2026-11-16",
  "limit": 2
}
```

**Example Output**:
```json
{
  "outlet_id": "OUT001",
  "outlet_name": "Nobo Bazar 001",
  "reference_date": "2026-11-16",
  "days_ahead": 15,
  "total_batches_at_risk": 2,
  "already_expired_count": 2,
  "urgent_clearance_count": 0,
  "total_financial_loss_exposure_bdt": 8057.82,
  "batches": [
    {
      "batch_id": "BAT0000030Q1",
      "product_id": "PRD094",
      "product_name": "Tilapia fish - Family pack 3",
      "product_name_bn": "তেলাপিয়া মাছ - প্যাক 3",
      "category": "Fish and frozen foods",
      "unit": "kg",
      "remaining_quantity": 17,
      "expiry_date": "2025-11-16",
      "days_remaining": -365,
      "unit_cost_bdt": 193.71,
      "financial_loss_exposure_bdt": 3293.07,
      "urgency_status": "ALREADY_EXPIRED",
      "recommended_clearance_action": "DO NOT SELL. Quarantined stock. Record in wastage log to prevent health violations."
    }
  ]
}
```

---

### 6. `get_business_insights`
Calculate executive retail KPIs from actual sales transactions, live stock valuations, and wastage logs.

- **Parameters**:
  - `outlet_id` (*string*, default `"OUT001"`): Outlet identifier code.
  - `reference_date` (*string*, default `"2026-11-16"`): Reference date for the analysis window.
  - `days` (*integer*, default `30`): Historical analysis window (e.g. 7, 30, 90).

**Example Input**:
```json
{
  "outlet_id": "OUT001",
  "reference_date": "2026-11-16",
  "days": 30
}
```

**Example Output**:
```json
{
  "outlet_id": "OUT001",
  "outlet_name": "Nobo Bazar 001",
  "area_type": "Premium / affluent residential",
  "reference_date": "2026-11-16",
  "window_days": 30,
  "financial_summary": {
    "total_sales_bdt": 319697.80,
    "total_cost_bdt": 267681.18,
    "gross_profit_bdt": 52016.62,
    "gross_margin_percent": 16.27,
    "average_daily_sales_bdt": 10656.59,
    "transaction_count": 464
  },
  "inventory_health": {
    "stocked_skus_count": 70,
    "active_batches_count": 201,
    "cost_valuation_bdt": 1054337.52,
    "retail_valuation_bdt": 1253235.11,
    "low_stock_items_count": 18
  },
  "wastage_loss_summary": {
    "wasted_units": 7,
    "total_wastage_loss_bdt": 613.31
  },
  "top_selling_categories": [
    { "category": "Breakfast products", "sales_bdt": 45928.97, "quantity_sold": 125 },
    { "category": "Lentils and pulses", "sales_bdt": 37991.56, "quantity_sold": 191 },
    { "category": "Fruits", "sales_bdt": 33044.33, "quantity_sold": 107 },
    { "category": "Dairy products", "sales_bdt": 32365.99, "quantity_sold": 71 }
  ],
  "actionable_recommendations": [
    "🚨 Reorder Alert: 18 products have reached or breached their reorder threshold. Generate purchase orders to prevent stockouts.",
    "📉 Wastage Warning: Recorded ৳613.31 in spoiled goods (0.19% of sales). Implement FEFO dynamic discounting to salvage near-expiry items.",
    "💡 Profit Margin: Operating at 16.27% gross margin with average daily sales of ৳10,656.59. Top revenue category: Breakfast products.",
    "📦 Capital Allocation: Currently holding ৳1,054,337.52 in inventory cost across 70 stocked SKUs (201 active batches)."
  ]
}
```

---

## 🧪 Running Automated Tests

Run the complete test suite (32 tests covering tools, read-only enforcement, error handling, protocol dispatch, and Streamable HTTP):

```bash
python3 -m unittest discover -s mcp_server/tests -p "test_*.py"
```
