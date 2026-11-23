"""
BazarBondhu / Haalkhata AI — Gemini + MCP Business Agent Service
================================================================

Enterprise AI Business Copilot combining:
- Google GenAI SDK (`google.genai.Client`) with configurable Gemini Flash models.
- Bilingual natural language understanding (Bangla & English).
- 6-Tool MCP function calling executing against read-only SQLite business records.
- Mandatory tenant boundary enforcement: all tool calls are forced to the authenticated user's outlet.
- Deterministic fallback when API keys are unconfigured or external services are offline.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path

from google import genai
from google.genai import types

from backend.mcp_client import mcp_client
from backend.security import load_env_if_present

logger = logging.getLogger("bazarbondhu.ai_service")

# Configurable Gemini model (default: gemini-3.5-flash)
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"

# System instruction establishing persona, bilingual rules, and grounded calculation constraints
SYSTEM_INSTRUCTION = """
You are Haalkhata AI (হালখাতা এআই), the intelligent Business Operating System Copilot for retail and grocery shop owners in Bangladesh.

Core Instructions:
1. BILINGUAL FLUENCY:
   - If the user asks in Bengali (বাংলা), respond entirely in natural, professional Bengali.
   - If the user asks in English, respond in English.
   - Maintain a respectful, helpful merchant copilot tone (e.g., using 'আপনি', 'টাকা / BDT', '৳').

2. GROUNDED IN BUSINESS TRUTH:
   - ALWAYS call the appropriate MCP business tool to retrieve actual data before answering questions regarding sales, inventory stock, expiring batches, low stock, or financial summaries.
   - Tool selection guide:
     * Sales / revenue / turnover queries -> call get_sales_summary.
     * Low stock / shortage / reorder queries -> call get_low_stock.
     * Expiry / shelf-life risk queries -> call check_expiry.
     * Business performance / health / general analytics queries -> call get_business_insights.
     * General inventory / stock queries -> call get_inventory.
     * Customer dues / credit ledger -> call get_customer_dues.
   - NEVER invent, hallucinate, or extrapolate financial or stock figures.
   - Base all answers strictly on the figures returned by the tools.
   - Temporal reference: The current operating date is 2026-11-16. The latest recorded business sales day in the ledger is 2026-11-15. When asked for 'today's sales' (আজকের বিক্রি), query the latest recorded sales date (2026-11-15) and report the exact figures from the ledger.

3. ARCHITECTURAL TRANSPARENCY:
   - Note on customer dues (*বাকির খাতা*): Individual customer credit ledger balances are stored securely offline in the shop's local browser database (Dexie.js / IndexedDB), while backend tools report supplier liabilities and central inventory.

4. FORMATTING & ACTIONABILITY:
   - Summarize key takeaways with bullet points, emojis, and clear currency formatting (৳ or BDT).
   - Provide practical, actionable merchant advice (e.g. FEFO discount clearance for near-expiry items, restock reorder warnings).
"""

# Tool function declarations matching the 6 MCP tools
MCP_TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_inventory",
        description="Retrieve current inventory stock levels, unit selling prices, and reorder points for products at the store.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "search": types.Schema(type=types.Type.STRING, description="Optional product name search filter (English or Bangla)."),
                "category": types.Schema(type=types.Type.STRING, description="Optional product category filter."),
                "page": types.Schema(type=types.Type.INTEGER, description="Page number for pagination (default 1)."),
                "page_size": types.Schema(type=types.Type.INTEGER, description="Number of items per page (default 20)."),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_low_stock",
        description="Identify products that are running low on stock (below reorder point or minimum stock threshold).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "threshold_type": types.Schema(type=types.Type.STRING, description="Threshold comparison: 'reorder_point' or 'minimum_stock'."),
                "limit": types.Schema(type=types.Type.INTEGER, description="Maximum items to return (default 20)."),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_sales_summary",
        description="Retrieve aggregate sales revenue, profit margins, cost of goods sold (COGS), transaction counts, and payment breakdowns over a date range.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "start_date": types.Schema(type=types.Type.STRING, description="Start date in YYYY-MM-DD format (default: '2026-11-15')."),
                "end_date": types.Schema(type=types.Type.STRING, description="End date in YYYY-MM-DD format (default: '2026-11-15')."),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_customer_dues",
        description="Audit store credit architecture, supplier liabilities, and explain offline customer ledger (Dexie.js).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "min_due_amount": types.Schema(type=types.Type.NUMBER, description="Minimum due amount threshold in BDT."),
                "limit": types.Schema(type=types.Type.INTEGER, description="Maximum supplier liability records to return."),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="check_expiry",
        description="Inspect inventory batches approaching expiration dates, categorizing risk tiers and FEFO clearance recommendations.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "days_ahead": types.Schema(type=types.Type.INTEGER, description="Days ahead window to check (default 30)."),
                "reference_date": types.Schema(type=types.Type.STRING, description="Reference baseline date in YYYY-MM-DD format (default '2026-11-16')."),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_business_insights",
        description="Generate comprehensive business performance insights, revenue metrics, wastage loss, and actionable inventory health recommendations.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "days": types.Schema(type=types.Type.INTEGER, description="Historical analysis window in days (default 30)."),
                "reference_date": types.Schema(type=types.Type.STRING, description="Reference date in YYYY-MM-DD format (default '2026-11-16')."),
            },
        ),
    ),
]


class AIBusinessAgent:
    """
    Orchestrates user queries, Gemini tool invocation, MCP execution, and response synthesis.
    """

    def __init__(self, model_name: Optional[str] = None):
        load_env_if_present()
        self.model_name = model_name or os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        self.client: Optional[genai.Client] = None
        self._init_client()

    def _init_client(self) -> None:
        """Initialize Google GenAI client if GEMINI_API_KEY is available."""
        load_env_if_present()
        self.model_name = os.environ.get("GEMINI_MODEL", self.model_name or DEFAULT_GEMINI_MODEL)
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key and api_key != "YOUR_GEMINI_API_KEY" and not api_key.startswith("your-"):
            try:
                self.client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=15000))
                logger.info(f"Initialized Google GenAI Client with model '{self.model_name}'")
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI Client: {e}")
                self.client = None
        else:
            self.client = None

    def _generate_with_fallback(self, contents: Any, config: Any) -> Tuple[Any, str]:
        """
        Generate content with automatic model cascade if Google returns 404 (model retired)
        or 503 (temporary high demand spike on free tier).
        """
        candidate_models = [self.model_name]
        for fallback in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        last_error = None
        for m in candidate_models:
            try:
                response = self.client.models.generate_content(
                    model=m,
                    contents=contents,
                    config=config,
                )
                if m != self.model_name:
                    logger.info(
                        f"Generated response using fallback model '{m}' because configured model '{self.model_name}' was unavailable."
                    )
                return response, m
            except Exception as e:
                last_error = e
                err_str = str(e)
                if (
                    "404" in err_str
                    or "503" in err_str
                    or "504" in err_str
                    or "429" in err_str
                    or "NOT_FOUND" in err_str
                    or "UNAVAILABLE" in err_str
                    or "DEADLINE_EXCEEDED" in err_str
                    or "RESOURCE_EXHAUSTED" in err_str
                    or "Timeout" in err_str
                ):
                    logger.warning(
                        f"Model '{m}' temporarily unavailable ({type(e).__name__}: {err_str[:80]}). "
                        f"Cascading to next candidate model..."
                    )
                    continue
                raise e
        raise last_error or RuntimeError("All candidate Gemini models failed.")

    async def chat(
        self,
        question: str,
        authorized_outlet_id: str,
        outlet_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process user question with Gemini function calling and MCP execution.
        Returns:
          {"reply": str, "tools_used": List[str], "success": bool}
        """
        tools_used: List[str] = []
        shop_label = outlet_name or authorized_outlet_id

        # If client not initialized, check environment again in case .env was updated
        if not self.client:
            self._init_client()

        # If still no valid Gemini API key, use intelligent deterministic fallback
        if not self.client:
            logger.info("GEMINI_API_KEY not configured or placeholder detected; executing deterministic business engine fallback.")
            return await self._deterministic_fallback(question, authorized_outlet_id, shop_label)

        # Build Gemini tools configuration
        gemini_tools = [types.Tool(function_declarations=MCP_TOOL_DECLARATIONS)]
        config = types.GenerateContentConfig(
            temperature=0.2,
            system_instruction=SYSTEM_INSTRUCTION,
            tools=gemini_tools,
        )

        user_content = types.Content(
            role="user",
            parts=[types.Part.from_text(
                text=f"Outlet: {shop_label} (ID: {authorized_outlet_id})\n"
                     f"Reference date: 2026-11-16 (Latest recorded sales date: 2026-11-15)\n"
                     f"Question: {question}"
            )],
        )

        contents = [user_content]

        try:
            # Multi-turn Agent loop supporting tool execution and synthesis
            max_turns = 5
            turn_count = 0
            while turn_count < max_turns:
                turn_count += 1
                response, active_model = self._generate_with_fallback(contents=contents, config=config)

                # If Gemini did not request any function calls, it produced its final text response
                if not response.function_calls:
                    texts = [
                        p.text for p in (response.candidates[0].content.parts or [])
                        if getattr(p, "text", None)
                    ]
                    reply_text = "\n\n".join(texts) if texts else (response.text or "তথ্য বিশ্লেষিত হয়েছে।")
                    return {
                        "success": True,
                        "reply": reply_text,
                        "tools_used": tools_used,
                    }

                # Add model's function call turn to conversation history
                contents.append(response.candidates[0].content)

                # Execute all requested tool calls securely via MCP client
                response_parts: List[types.Part] = []
                for call in response.function_calls:
                    tool_name = call.name
                    if tool_name not in tools_used:
                        tools_used.append(tool_name)
                    tool_args = dict(call.args or {})

                    # CRITICAL SECURITY RULE: Force the authorized outlet ID
                    tool_args["outlet_id"] = authorized_outlet_id

                    logger.info(f"Executing MCP tool '{tool_name}' for authorized outlet '{authorized_outlet_id}' with args {tool_args}")
                    tool_result = await mcp_client.call_tool(tool_name, tool_args, authorized_outlet_id)

                    response_parts.append(
                        types.Part.from_function_response(
                            name=tool_name,
                            response={"result": tool_result},
                        )
                    )

                # Add tool responses as next turn
                contents.append(types.Content(role="user", parts=response_parts))

            # If loop reached max_turns, synthesize final answer
            final_config = types.GenerateContentConfig(
                temperature=0.2,
                system_instruction=SYSTEM_INSTRUCTION,
            )
            final_resp, _ = self._generate_with_fallback(contents=contents, config=final_config)
            texts = [
                p.text for p in (final_resp.candidates[0].content.parts or [])
                if getattr(p, "text", None)
            ]
            reply_text = "\n\n".join(texts) if texts else (final_resp.text or "তথ্য বিশ্লেষিত হয়েছে।")
            return {
                "success": True,
                "reply": reply_text,
                "tools_used": tools_used,
            }

        except Exception as e:
            logger.error(f"Gemini API interaction failed: {e}", exc_info=True)
            # Graceful fallback: answer using direct MCP tool execution rather than returning a blank error
            return await self._deterministic_fallback(question, authorized_outlet_id, shop_label, error_note=str(e))

    async def _deterministic_fallback(
        self,
        question: str,
        authorized_outlet_id: str,
        shop_label: str,
        error_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Deterministic business intelligence fallback when Gemini API is unconfigured or unreachable.
        Directly queries the 6 MCP tools to guarantee a helpful, grounded response.
        """
        q_lower = question.lower()
        tools_used: List[str] = []
        is_bn = any(ord(char) >= 0x0980 and ord(char) <= 0x09FF for char in question)

        # 1. Sales question
        if any(w in q_lower for w in ["বিক্রি", "সেল", "বিক্রয়", "sale", "sales", "sell", "revenue", "sold"]):
            tools_used.append("get_sales_summary")
            data = await mcp_client.call_tool(
                "get_sales_summary",
                {"start_date": "2026-11-15", "end_date": "2026-11-15"},
                authorized_outlet_id,
            )
            revenue = data.get("total_sales_bdt", 0.0)
            tx_count = data.get("transaction_count", 0)
            margin = data.get("profit_margin_percent", data.get("profit_margin_pct", 0.0))

            if is_bn:
                reply = (
                    f"📊 **{shop_label}-এর সর্বশেষ বিক্রির হিসাব (১৫ নভেম্বর ২০২৬):**\n\n"
                    f"- 💰 **মোট বিক্রি:** {revenue:,.2f} টাকা\n"
                    f"- 🧾 **মোট লেনদেন:** {tx_count:,} টি\n"
                    f"- 📈 **মুনাফা মার্জিন:** {margin:.1f}%\n\n"
                    f"*(তথ্যসূত্র: হালখাতা সেন্ট্রাল সেলস লেজার)*"
                )
            else:
                reply = (
                    f"📊 **Sales Summary for {shop_label} (Nov 15, 2026):**\n\n"
                    f"- 💰 **Total Revenue:** {revenue:,.2f} BDT\n"
                    f"- 🧾 **Transactions:** {tx_count:,}\n"
                    f"- 📈 **Profit Margin:** {margin:.1f}%\n\n"
                    f"*(Source: Haalkhata Sales Ledger)*"
                )
            return {"success": True, "reply": reply, "tools_used": tools_used}

        # 2. Low stock question
        if any(w in q_lower for w in ["শেষ", "কম", "লো স্টক", "stock", "low", "shortage"]):
            tools_used.append("get_low_stock")
            data = await mcp_client.call_tool("get_low_stock", {"limit": 5}, authorized_outlet_id)
            items = data.get("items", [])

            if is_bn:
                if items:
                    lines = [f"{i+1}. ⚠️ **{it.get('product_name')}**: বর্তমান স্টক **{it.get('current_stock')}** {it.get('unit')} (রিঅর্ডার পয়েন্ট: {it.get('reorder_point')})" for i, it in enumerate(items)]
                    reply = f"📦 **{shop_label}-এ দ্রুত স্টক শেষ হতে চলা পণ্যসমূহ:**\n\n" + "\n".join(lines) + "\n\n💡 *পরামর্শ: স্টক শেষ হওয়ার আগেই ডিস্ট্রিবিউটরকে নতুন ক্রয়ের অর্ডার দিন।*"
                else:
                    reply = f"✅ **{shop_label}-এর সব পণ্যের স্টক বর্তমানে পর্যাপ্ত রয়েছে।** কোনো সংকট নেই।"
            else:
                if items:
                    lines = [f"{i+1}. ⚠️ **{it.get('product_name')}**: Current stock **{it.get('current_stock')}** {it.get('unit')} (Reorder Point: {it.get('reorder_point')})" for i, it in enumerate(items)]
                    reply = f"📦 **Low Stock Alert for {shop_label}:**\n\n" + "\n".join(lines)
                else:
                    reply = f"✅ **All inventory items at {shop_label} have healthy stock levels.**"
            return {"success": True, "reply": reply, "tools_used": tools_used}

        # 3. Expiry question
        if any(w in q_lower for w in ["মেয়াদ", "মেয়াদ", "এক্সপায়ার", "এক্সপায়ার", "ঝুঁকি", "expiry", "expire", "batch"]):
            tools_used.append("check_expiry")
            data = await mcp_client.call_tool("check_expiry", {"days_ahead": 30}, authorized_outlet_id)
            batches = data.get("batches", [])[:4]
            total_risk = data.get("total_batches_at_risk", 0)

            if is_bn:
                if batches:
                    lines = [f"{i+1}. ⏰ **{b.get('product_name')}**: {b.get('remaining_quantity')} একক (মেয়াদ বাকি: {b.get('days_remaining', b.get('days_to_expiry'))} দিন) → *{b.get('recommended_clearance_action', b.get('urgency_status'))}*" for i, b in enumerate(batches)]
                    reply = f"⚠️ **{shop_label}-এ মেয়াদের ঝুঁকিতে থাকা পণ্যসমূহ (মোট {total_risk} টি ব্যাচ):**\n\n" + "\n".join(lines) + "\n\n👉 *পরামর্শ: FEFO নীতি অনুসরণ করে ছাড় দিয়ে আগে বিক্রি করুন।*"
                else:
                    reply = f"✅ **{shop_label}-এর কোনো পণ্যের মেয়াদ এই মুহূর্তে ঝুঁকিপূর্ণ নয়।**"
            else:
                if batches:
                    lines = [f"{i+1}. ⏰ **{b.get('product_name')}**: {b.get('remaining_quantity')} units ({b.get('days_remaining', b.get('days_to_expiry'))} days left) → *{b.get('recommended_clearance_action', b.get('urgency_status'))}*" for i, b in enumerate(batches)]
                    reply = f"⚠️ **Expiry Risk Batches for {shop_label} ({total_risk} batches at risk):**\n\n" + "\n".join(lines)
                else:
                    reply = f"✅ **No batches at {shop_label} are approaching expiry in the next 30 days.**"
            return {"success": True, "reply": reply, "tools_used": tools_used}

        # 4. General / insights question
        tools_used.append("get_business_insights")
        data = await mcp_client.call_tool("get_business_insights", {"days": 30}, authorized_outlet_id)
        fin = data.get("financial_summary", {})
        recs = data.get("actionable_recommendations", [])[:2]

        if is_bn:
            rec_text = "\n".join([f"- 💡 {r}" if isinstance(r, str) else f"- 💡 {r.get('title', '')}: {r.get('description', '')}" for r in recs])
            reply = (
                f"🏪 **{shop_label}-এর সার্বিক ব্যবসায়িক রিপোর্ট (বিগত ৩০ দিন):**\n\n"
                f"- 💰 **মোট আয়:** {fin.get('total_sales_bdt', fin.get('total_revenue_bdt', 0)):,.2f} টাকা\n"
                f"- 📈 **মোট মুনাফা:** {fin.get('gross_profit_bdt', 0):,.2f} টাকা (মার্জিন: {fin.get('gross_margin_percent', fin.get('profit_margin_pct', 0)):.1f}%)\n"
                f"- 🧾 **গড় দৈনিক বিক্রি:** {fin.get('average_daily_sales_bdt', fin.get('average_daily_revenue_bdt', 0)):,.2f} টাকা\n\n"
                f"**প্রয়োজনীয় পদক্ষেপ:**\n{rec_text}"
            )
        else:
            rec_text = "\n".join([f"- 💡 {r}" if isinstance(r, str) else f"- 💡 {r.get('title', '')}: {r.get('description', '')}" for r in recs])
            reply = (
                f"🏪 **Business Insights for {shop_label} (Past 30 Days):**\n\n"
                f"- 💰 **Revenue:** {fin.get('total_sales_bdt', fin.get('total_revenue_bdt', 0)):,.2f} BDT\n"
                f"- 📈 **Gross Profit:** {fin.get('gross_profit_bdt', 0):,.2f} BDT ({fin.get('gross_margin_percent', fin.get('profit_margin_pct', 0)):.1f}%)\n"
                f"- 🧾 **Avg Daily Sales:** {fin.get('average_daily_sales_bdt', fin.get('average_daily_revenue_bdt', 0)):,.2f} BDT\n\n"
                f"**Recommendations:**\n{rec_text}"
            )

        if error_note:
            reply += f"\n\n*(Note: Gemini live synthesis fallback activated: {error_note})*"

        return {"success": True, "reply": reply, "tools_used": tools_used}


# Global agent singleton
ai_agent = AIBusinessAgent()
