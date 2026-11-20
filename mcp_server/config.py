"""
Haalkhata MCP Server — Configuration
====================================
Centralized settings for the read-only Model Context Protocol server.
"""

import os
from pathlib import Path

# Path resolving to project root
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = REPO_ROOT / "bazarbondhu.db"

# Server Network Settings
MCP_HOST = os.environ.get("MCP_HOST", "127.0.0.1")
MCP_PORT = int(os.environ.get("MCP_PORT", "8001"))
MCP_TRANSPORT = os.environ.get("MCP_TRANSPORT", "streamable-http")  # 'streamable-http' | 'stdio' | 'sse'
MCP_STREAMABLE_PATH = os.environ.get("MCP_STREAMABLE_PATH", "/mcp")

# Database URI (enforcing read-only access)
SQLITE_DB_PATH = Path(os.environ.get("HAALKHATA_DB_PATH", str(DEFAULT_DB_PATH))).resolve()
DATABASE_URL = os.environ.get("MCP_DATABASE_URL", f"sqlite:///{SQLITE_DB_PATH}")

# Default reference date for simulations
DEFAULT_REFERENCE_DATE = "2026-11-16"
DEFAULT_OUTLET_ID = "OUT001"


class Settings:
    SERVER_NAME: str = "haalkhata"
    SERVER_VERSION: str = "1.0.0"
    MCP_HOST: str = MCP_HOST
    MCP_PORT: int = MCP_PORT
    MCP_TRANSPORT: str = MCP_TRANSPORT
    STREAMABLE_HTTP_PATH: str = MCP_STREAMABLE_PATH
    SQLITE_DB_PATH: Path = SQLITE_DB_PATH
    DATABASE_URL: str = DATABASE_URL
    DEFAULT_REFERENCE_DATE: str = DEFAULT_REFERENCE_DATE
    DEFAULT_OUTLET_ID: str = DEFAULT_OUTLET_ID


settings = Settings()

