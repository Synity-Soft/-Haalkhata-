"""
BazarBondhu / Haalkhata AI — Authenticated AI Copilot Router
============================================================

Exposes `POST /api/ai/chat` integrating:
- Mandatory JWT authentication via `get_current_user`.
- Strict multi-branch authorization: verifies that the selected outlet belongs
  to the authenticated user via `user_outlets` before any AI analysis.
- Tenant boundary enforcement: overrides any model-supplied outlet ID with the verified outlet.
- Gemini function calling & read-only MCP business tool execution.
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.database import get_db
from backend.models import User, Outlet, UserOutlet
from backend.security import get_current_user, verify_outlet_access
from backend.ai_service import ai_agent

logger = logging.getLogger("bazarbondhu.ai_router")

router = APIRouter(prefix="/ai", tags=["AI Copilot"])


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1500, description="User question in Bangla or English.")
    outlet_id: Optional[str] = Field(None, description="Target shop branch outlet ID (e.g. 'OUT001').")


class ChatResponse(BaseModel):
    success: bool
    reply: str
    tools_used: List[str]
    outlet_id: str
    outlet_name: Optional[str] = None
    provider: Optional[str] = "gemini_live"
    error: Optional[str] = None


@router.get("/health")
def ai_health():
    """Diagnostic health check for the AI Copilot router."""
    import os
    return {
        "status": "healthy",
        "service": "ai_copilot",
        "chat_endpoint": "/api/ai/chat",
        "model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
        "mcp_server": "http://127.0.0.1:8001/mcp",
    }


@router.get("/status")
def ai_status():
    """Alias for health status check."""
    return ai_health()


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated conversational AI endpoint for retail intelligence.
    Verifies branch ownership, executes Gemini function calling via MCP tools,
    and returns grounded natural language responses.
    """
    clean_question = req.question.strip()
    if not clean_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    # 1. Resolve and verify outlet ownership
    if req.outlet_id:
        # Strict validation: returns 404 if non-existent, 403 if user lacks ownership
        outlet = verify_outlet_access(req.outlet_id, current_user, db)
    else:
        # Fall back to user's primary or first registered branch
        link_row = db.execute(
            select(UserOutlet, Outlet)
            .join(Outlet, UserOutlet.outlet_id == Outlet.outlet_id)
            .where(UserOutlet.user_id == current_user.id)
            .order_by(UserOutlet.is_primary.desc(), UserOutlet.id.asc())
        ).first()

        if not link_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User has no registered or authorized store branches. Please register a branch first.",
            )
        _, outlet = link_row

    # 2. Invoke Gemini AI Agent with enforced authorized outlet ID
    try:
        result = await ai_agent.chat(
            question=clean_question,
            authorized_outlet_id=outlet.outlet_id,
            outlet_name=outlet.outlet_name,
        )
        return ChatResponse(
            success=result.get("success", True),
            reply=result.get("reply", ""),
            tools_used=result.get("tools_used", []),
            outlet_id=outlet.outlet_id,
            outlet_name=outlet.outlet_name,
            provider=result.get("provider", "gemini_live"),
        )
    except Exception as e:
        logger.error(f"Error processing AI chat request: {e}", exc_info=True)
        return ChatResponse(
            success=False,
            reply="দুঃখিত, এআই প্রসেসিংয়ে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
            tools_used=[],
            outlet_id=outlet.outlet_id,
            outlet_name=outlet.outlet_name,
            error=str(e),
        )
