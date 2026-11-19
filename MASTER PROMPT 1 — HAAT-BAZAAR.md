# MASTER PROMPT — HAAT-BAZAAR

Project: HAAT-BAZAAR
Tagline: Your Intelligent Grocery Business Assistant.

What: An offline-first, AI-powered inventory and supply-chain assistant (PWA) for grocery shops and supershops in Bangladesh. It helps shopkeepers decide what to buy and how much, which products are about to expire, what discount to give, and what to prepare for upcoming festivals.
Hackathon: SQAT Hackathon, theme "Enterprise software innovation". Team of 2. No money may be spent, free tools only.

Problem it solves: Shopkeepers buy by guesswork. This causes overstocking, shortages and missed sales, expired products, poor discount decisions, and a weak understanding of local demand.

---

## 1. Architecture Rules (mandatory)

1. OFFLINE-FIRST: The app does all work first on the device in IndexedDB (Dexie.js). Everything must work with no internet or a slow connection.
2. The UI never waits for the server. All reads and writes go to the local DB.
3. Every write (create/update/delete) is saved to an "outbox" table. When internet returns, the sync engine pushes the outbox to the server and pulls new changes back.
4. Every record has a client-side UUID id, an updatedAt field, and a deleted field (soft delete).
5. Sales are append-only events. Remaining stock = batch qty - total sales of that batch. This avoids sync conflicts.
6. For all other records, conflicts are resolved with last-write-wins (by updatedAt).
7. All "intelligence" runs as TypeScript engines in the frontend so it works offline. The engines are:
   - expiry risk and wastage
   - discount suggestion
   - purchase suggestion (area-based demand)
   - festival and seasonal insights
   - credit (বাকি) tracking
   The engines are deterministic and rule-based. The frontend must never invent AI predictions or numbers outside these engines.
8. AI Assistant: online, it calls Gemini through the FastAPI backend (the frontend never calls Gemini or Supabase directly). Offline or on failure, it falls back to local rule-based answers built from local data. Answers must be in Bangla or English to match the question.
9. Language: bilingual (Bangla + English). Bangla is the default. A language switcher in the header works instantly, with no refresh, and the choice persists. Numbers show in Bangla digits when Bangla is selected and in English digits when English is selected. Currency symbol: ৳. User-entered data (product names etc.) is never auto-translated.
10. Mobile-first, big buttons, minimal typing. Minimum text size is 16px.
11. Never use color alone. Always pair it with text and an icon (for example red + "Urgent").
12. SAFETY RULE: Never recommend selling or discounting an expired product. Show "Expired" and the action "Remove from sale".
13. Multi-shop: the user can switch between shops from the header. All shop-specific data updates with the selected shop ID. Do not hardcode one shop's data.
14. Never silently mix demo data into real data. When demo/mock data is shown, a small visible "Demo Data" badge must be on screen.
15. Secrets (API keys) exist only in the backend .env. Never in frontend code.

---

## 2. Core Features

1. Area-Based Smart Purchase: estimate demand from sales history and configurable area multipliers, then recommend what to buy and how much, with a simple explanation.
   Formula idea: Expected Demand = Avg Daily Sales x Planning Days x Area Multiplier. Suggested Order = Expected Demand + Safety Stock - Current Stock (never below 0).
2. Inventory Management: add, edit, search, delete products. Each product has multiple batches with their own quantity and expiry date.
3. Expiry and Wastage: batch-wise expiry, days remaining, expected sales before expiry, expected unsold quantity, potential loss, risk level.
4. Smart Discount Suggestions: for at-risk batches, suggest a discount using configurable rules. Show current price, suggested price, required daily sales vs current rate, and financial impact.
5. AI Assistant: Bangla/English chat over actual shop data, with simple actionable answers.
6. Business Dashboard: shop status at a glance, today's actions, low stock, expiry alerts, purchase preview.
7. Reports and Insights: sales trend, inventory distribution, low-stock analysis, expiry risk, estimated wastage.
8. Festival and Seasonal Insights: upcoming festivals, expected demand change, product categories to prepare, suggested preparation time.
9. Credit (বাকি) tracking: simple customer credit records (kept minimal, not a full accounting system).

---

## 3. Pages (React Router)

/           Dashboard: greeting, shop name, date, summary cards (Total Products, Low Stock, Expiring Soon, Potential Wastage, Today's Sales), "Today's Actions" (আজকের করণীয়) linking to relevant pages, purchase preview, expiry alerts preview, sales chart, festival preview.
/inventory  Search, category filter, stock-status filter, product table (name, category, stock, cost price, selling price, status, actions), add/edit/delete (with confirmation), batch view and add batch. The add form needs few fields: name, category, cost price, selling price, quantity, expiry date.
/purchase   Shop, area type, planning period selector, category filter. Per product: avg daily sales, area multiplier, expected demand, current stock, safety stock, suggested order, plain explanation. Never claim demand is guaranteed.
/expiry     Summary cards (Expired, Expiring Soon, High-Risk Batches, Estimated Loss) and a batch table with risk levels: Expired (red), High (orange), Medium (yellow), Low (green), each with text and icon. Expandable batch details.
/discounts  Discount cards: product, risk level, current price, suggested price, discount %, explanation. Never for expired products.
/assistant  Chat UI: user/assistant messages, input, send, suggested questions, loading, error and retry. Responses use short paragraphs, bullets and highlighted quantities.
/reports    Recharts charts with clear titles, tooltips, empty states, readable in both themes.
/festivals  Timeline or calendar-style list of upcoming festivals and preparation suggestions.
/settings   Language, theme, shop and area profile, sync status.

Suggested assistant questions (English / বাংলা):
- Which products should I purchase today? / আজ কোন পণ্য কিনতে হবে?
- Which products are at risk of expiry? / কোন পণ্যগুলোর মেয়াদ শেষ হওয়ার ঝুঁকি আছে?
- Which products have excess stock? / কোন পণ্যের মজুদ বেশি?
- How can I reduce wastage? / কীভাবে পণ্যের অপচয় কমাতে পারি?
- What should I prepare for the upcoming festival? / সামনে কোন উৎসবের জন্য প্রস্তুতি নেওয়া উচিত?

Demo shops (simulated): (1) student-area grocery shop, (2) garment-worker-area grocery shop, (3) affluent residential-area grocery shop. Show each shop's area type and location.

---

## 4. Design System

Feel: clean, friendly, modern, grocery-focused, comfortable for daily use by ordinary shopkeepers. It must not look like a generic corporate admin dashboard.

Brand colors (exact):
- Warm Cream #F9E6A8: soft backgrounds, highlights
- Golden Yellow #F2A900: primary actions, active elements
- Burnt Orange #CC6F00: secondary actions, emphasis
- Deep Brown #4D2A00: headings, strong contrast

Light theme: off-white/cream background, white cards, brown headings, yellow primary buttons, orange secondary buttons, subtle beige borders.
Dark theme (properly designed, not inverted): deep charcoal/brown background, slightly lighter cards, cream headings, yellow primary actions, orange secondary emphasis.
Theme toggle (Light/Dark/System) in header, instant, persisted, no flash on load. Charts must be readable in both themes.
Status colors: green (success), amber (warning), red (danger), blue (info). Always with text and icons.
Icons: Lucide React for all functional icons. Small, consistent grocery illustrations (rice, vegetables, milk, oil, baskets) only for empty states and decoration. No random emoji as the icon system. No copyrighted brand logos.
Typography: Hind Siliguri or Noto Sans Bengali. Long Bangla text must not break layouts.
Animation: Framer Motion, 150-300ms, purposeful only (page transitions, card entrance, modal, sidebar). Respect reduced-motion. No heavy parallax or long loaders.

Layout:
- Mobile (primary): compact header, bottom navigation for key sections, stacked cards, touch-friendly controls.
- Tablet/desktop: collapsible left sidebar, top header, responsive content.
- Header: logo and name, shop selector, language switcher, theme switcher, online/offline + sync status, notifications.
- Tables stay usable on small screens (card lists or horizontal scroll only when needed).

---

## 5. Usability Rules for Shopkeepers

- Simple language. Prefer "How many do I need?", "How many do I have?", "What will expire?", "How much could I lose?" over terms like "demand forecasting" or "inventory optimization". Put technical details behind expandable explanations.
- Few steps: sensible defaults, dropdowns for categories, date pickers for dates, remember recent values.
- Clear hierarchy: what needs attention, what to do, how much to buy, which products are at risk, how much money could be lost.
- Accessible: large buttons, visible focus states, keyboard support, good contrast.
- Every screen has loading skeletons, empty states, and friendly error states.

---

## 6. Tech Stack

- apps/web: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Lucide React + Framer Motion + React Router + React Hook Form + Zod + Recharts + Dexie.js + vite-plugin-pwa (Workbox)
  - Theme: small custom ThemeProvider using the Tailwind dark class
  - Localization: small custom i18n context and dictionaries (bn.ts, en.ts), no heavy library
- apps/api: Python FastAPI + SQLAlchemy + Pydantic (SQLite in dev, Supabase Postgres free tier in deploy, via the DATABASE_URL env var)
- AI: google-genai (Gemini API), key only in the backend .env
- ml: Python, pandas, scikit-learn (Ridge regression). Output is a JSON model that runs in TypeScript.

Backend endpoints (the frontend talks only to these, through one API layer in apps/web/src/lib/api.ts, with the base URL from VITE_API_BASE_URL):
- GET  /api/health
- GET  /api/shops
- POST /api/sync/push      (send outbox changes)
- GET  /api/sync/pull      (get changes since a timestamp)
- POST /api/shops/{id}/assistant   (Gemini via backend)

---

## 7. Code Rules

- Small files. The first line of every file is a 1-line comment saying what it does.
- No unnecessary libraries.
- TypeScript everywhere. Avoid "any".
- Business logic lives in engines (src/engines), not in UI components.
- Reusable components, no duplicated styling, semantic HTML.
- Each engine function has 2-3 unit tests (Vitest).
- Suggested structure: src/{app, components, engines, db, sync, lib, i18n, hooks, providers, pages, mock}
- Keep mock/demo data in its own folder, separate from the real data layer.
- Handle API errors and network failure with clear messages. Prevent duplicate form submissions.
- No console errors or warnings.

---

## 8. Data

Demo data is simulated (artificial). Show a small "Demo Data" badge in the UI. Seed the three demo shops with products, batches (including near-expiry and already-expired ones), and 60-90 days of sales history so every engine and chart has something to show.
No political, offensive, or sexual content.

---

## 9. Out of Scope

Full POS, payment gateway, online marketplace, delivery management, complex authentication/roles, direct Gemini or database calls from the browser, voice assistant, advanced enterprise analytics, real-time infrastructure, 3D engines.

---

## 10. Build Order

1. Foundation: Vite project, Tailwind, brand colors, fonts, dark/light theme, bn/en i18n, Dexie schema with outbox, PWA setup.
2. Layout: sidebar, header, shop selector, language and theme switchers, mobile bottom navigation, sync status.
3. Engines + unit tests: expiry, discount, purchase, festival, credit.
4. Pages in this order: Dashboard, Inventory, Expiry, Discounts, Purchase, Assistant (with offline fallback), Reports, Festivals, Settings.
5. Sync engine and FastAPI integration.
6. Testing: offline mode, Bangla and English, dark and light, mobile/tablet/desktop, empty data, long Bangla text, expired-product safety rule, console errors.

At the end, give a report: final folder structure, dependencies, pages and engines done, sync status, tests and results, remaining issues, and the exact commands to run locally.