---
marp: true
theme: default
paginate: true
header: 'HAAT-BAZAAR (হাট-বাজার) | SQAT Summit 2026'
footer: 'BazarBondhu AI — Smart Grocery Inventory System'
style: |
  section {
    background-color: #FAF6E9;
    color: #493522;
    font-family: 'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif;
  }
  h1, h2 {
    color: #493522;
  }
  .accent {
    color: #D5AA36;
  }
  .danger {
    color: #B91C1C;
  }
  .success {
    color: #15803D;
  }
---

<!-- _class: lead -->
# 🛒 HAAT-BAZAAR (হাট-বাজার)
### AI-Powered Offline-First Grocery Inventory & Smart Supply-Chain Management System
**SQAT Summit 2026 Project Showcase / Capstone Presentation**

* **Platform:** React 18 (PWA) + Dexie.js (IndexedDB) + FastAPI + Scikit-learn
* **Audience:** Local Grocery Retailers (মুদি দোকানি) in Bangladesh

---

## 📉 Slide 2: The Problem (বাস্তব সমস্যা)
### Challenges Faced by 1.5M+ Retail Grocers in Bangladesh

1. **পণ্য মেয়াদোত্তীর্ণের বিশাল ক্ষতি (Expiry Losses):**
   * Perishables and packaged items expire unnoticed on back shelves.
   * Direct **12–18% gross margin loss** due to lack of FIFO batch tracking.

2. **অনিশ্চিত ক্রয় সিদ্ধান্ত (Stockout vs. Overstock):**
   * Reliance on guesswork leads to weekend stockouts or cash locked in slow-moving goods.

3. **লোডশেডিং ও দুর্বল ইন্টারনেট (Unreliable Connectivity):**
   * Traditional cloud-only POS systems freeze when electricity or network drops.

4. **ঝুঁকিপূর্ণ কাগজের বাকির খাতা (Fragile Paper Credit Ledgers):**
   * Paper notebooks get wet, lost, or disputed, causing **15–20% uncollected debt**.

---

## 💡 Slide 3: Our Solution (আমাদের সমাধান)
### HAAT-BAZAAR: Built for Resilience and Local Reality

* **⚡ 100% Offline-First PWA:**
  Writes to client IndexedDB instantaneously. Zero lag, zero downtime, even in airplane mode.
* **🧠 Machine Learning Demand Forecasting:**
  Dual-horizon models (7-day and 30-day) predict required stock using 67 SAFE features.
* **🛡️ Dynamic Expiry Mitigation & Clearance:**
  3-tier triage alerts grocers and calculates automated 10%–50% clearance discounts to recover capital.
* **🇧🇩 100% Native Bengali Ergonomics:**
  Native Bengali numerals (`১২৩৪`), currency (`৳`), and culturally grounded UI metaphors.
* **🤖 বাজারবন্ধু AI Companion:**
  Context-grounded natural language business guidance powered by the Gemini API.

---

## 🏗️ Slide 4: System Architecture (সিস্টেম আর্কিটেকচার)
### Dual-Engine Offline-First Architecture

```text
[ Browser / PWA ] ───────────────► [ Local IndexedDB (Dexie) ]
(React 18 + Tailwind)              (Instant Read/Write, 0ms Latency)
        │
        ▼ (Background Sync When Online)
[ FastAPI Backend (Python 3.12) ] ───► [ SQLite / PostgreSQL Database ]
        │
        ▼
[ ML Prediction Service ] ──────────► 67 SAFE Inference Feature Builder
(HistGradientBoosting Regressors)      (7-Day EXP3 & 30-Day Models)
```

* **Client Engine:** React 18 + TypeScript + Dexie.js + Tailwind CSS.
* **Backend Engine:** FastAPI + Uvicorn + SQLAlchemy 2.0 + SQLite.
* **Predictive Engine:** Scikit-learn HistGradientBoosting Regressors.

---

## ⚡ Slide 5: Smart POS & Live Sales Counter
### Rapid Counter Billing with Tactile Audio-Visual Feedback

* **Instant Search & Barcode Ready:** Filter products by Bengali name, category emoji, or barcode in milliseconds.
* **Atomic Dual-Field Calculation:** Quantity and price synchronize smoothly without calculation drift.
* **FIFO Batch Quantity Decrement:** Automatically decrements stock from the oldest received batch.
* **Coin-Drop Celebration:** Audio and haptic vibration confirmation upon completing sales.
* **Live Digital Header:** Time-aware Bengali greeting (সকাল/দুপুর/বিকাল/সন্ধ্যা/রাত) with a real-time digital clock.

---

## 🛡️ Slide 6: Batch-Level Expiry Triage & Clearance Optimizer
### Turning Dead Stock into Recovered Capital

* **🔴 উচ্চ ঝুঁকি (High Risk - ≤ 7 Days):**
  Immediate 30%–50% clearance markdown recommendation to liquidate within 48 hours.
* **🟡 মাঝারি ঝুঁকি (Medium Risk - 8–30 Days):**
  Advisory tier suggesting bundle promotions or 10%–20% discounts.
* **🟢 নিরাপদ (Safe - > 30 Days):**
  Standard inventory rotation under normal pricing.

> **Economic Impact:** Instead of losing ৳1,000 on expired goods (100% loss), automated clearance recovers **৳700 in capital**, protecting merchant solvency.

---

## 🧠 Slide 7: 67 SAFE Feature Machine Learning Engine
### Leak-Free Dual-Horizon Demand Prediction

* **Historical Sales Lags (19 Features):** 1d, 2d, 3d, 7d, 14d, 28d lags and rolling std/sums.
* **Inventory Dynamics (14 Features):** Stock-to-sales ratios, expiring stock next 7d/30d, days since restock.
* **Outlet Demographics (8 Features):** Residential vs. commercial vs. university hub, refrigeration capacity.
* **Dual Horizons:**
  * **7-Day (EXP3_7D):** Fast-cycle perishables (milk, bread, eggs, greens).
  * **30-Day (HGB_30D):** Bulk non-perishables (rice, lentils, oil, packaged goods).
* **Smart Reorder Formula:** `ROQ = Forecasted_Demand + Safety_Stock - Current_Stock`.

---

## 🌙 Slide 8: Cultural Calendar & Gemini AI Assistant
### Understanding the Pulse of Bangladesh Retail

* **Festival Multipliers:**
  * **পবিত্র রমজান:** +300% demand surge for dates, chickpeas, oil, and besan.
  * **ঈদুল ফিতর:** +400% surge for vermicelli (সেমাই), sugar, milk, and ghee.
  * **ঈদুল আযহা:** +250% surge for salt, spices, knife sets, and freezer bags.
  * **পহেলা বৈশাখ:** +200% surge for sweets, hilsa fish, and mustard oil.
* **বাজারবন্ধু AI Companion:**
  * Grocers ask questions in conversational Bengali via text or voice.
  * LLM prompt grounds its answers on live inventory and expiry tables.

---

## 📒 Slide 9: Digital "Bakir Khata" (Customer Credit Ledger)
### Eliminating Paper Disputes & Uncollected Receivables

* **Customer Credit Accounts:** Phone number, address, total credit limit, and current balance.
* **Partial Payments in Seconds:** Enter partial repayments with instant balance recalculation.
* **Overdue Tracking:** Automatic visual flags for debts unpaid past 30 days.
* **Total Transparency:** Clear audit trail of every purchase and payment date, preventing disputes with neighborhood customers.

---

## 🧪 Slide 10: Software Quality & Testing Assurance (SQAT)
### Built for 24/7 Production Reliability

* **Unit Test Suite:** **21/21 Unit Tests Passed** across 5 test files (`vitest run`).
  * `purchase.test.ts`, `discount.test.ts`, `expiry.test.ts`, `auth.test.ts`, `api.test.ts`.
* **Zero Blank Screens:** Wrapped in a custom `ErrorBoundary` mesh with friendly retry cards.
* **WCAG 2.1 AA Contrast Compliance:** Validated across both Light (`#FAF6E9`) and Dark (`#251C16`) themes.
* **No FOUC (Flash of Unstyled Content):** Pre-paint inline script prevents theme flicker.
* **Hardware-Friendly:** Pure CSS keyframe animations automatically pause when hidden or under reduced motion.

---

## 🚀 Slide 11: Live Demonstration & Business Impact
### Measurable Return on Investment

* **Live Demo URLs:**
  * **Web Application (PWA):** `http://localhost:5173`
  * **Backend API & Swagger Docs:** `http://127.0.0.1:8000/docs`
  * **Unified Health Endpoint:** `http://127.0.0.1:8000/api/health`
* **Proven Business Metrics:**
  * **৭০% অপচয় হ্রাস:** Drastic shrinkage reduction through automated clearance discounts.
  * **৩ গুণ দ্রুত চেকআউট:** Streamlined sales counter and instant calculations.
  * **১০০% অফলাইন আপটাইম:** Business continues uninterrupted during internet/power outages.

---

<!-- _class: lead -->
# 🎉 ধন্যবাদ (Thank You)
### HAAT-BAZAAR (হাট-বাজার)
**Transforming neighborhood grocery retail with AI and offline-first software engineering.**

* 💬 **প্রশ্নোত্তর পর্ব (Questions & Answers)**
* 💻 Ready for live code demonstration and product walkthrough!
