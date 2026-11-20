"""
Haalkhata MCP Server — Read-Only Database Session Factory
=========================================================
Strictly enforces read-only access at the SQLite database engine level.
Guarantees that no MCP tool can modify, insert, delete, or drop existing data.
"""

from contextlib import contextmanager
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from mcp_server.config import DATABASE_URL

# Create read-only engine with multi-threading compatibility
engine_readonly = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)

# Enforce strict read-only pragma on every connection if SQLite
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine_readonly, "connect")
    def enforce_sqlite_readonly(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA query_only = ON;")
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.close()

# Session factory for read-only transactions
ReadOnlySession = sessionmaker(
    bind=engine_readonly,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@contextmanager
def get_readonly_session() -> Generator[Session, None, None]:
    """Context manager delivering a transactional read-only session."""
    session = ReadOnlySession()
    try:
        yield session
    finally:
        session.rollback()  # Explicit rollback to guarantee zero state changes
        session.close()
