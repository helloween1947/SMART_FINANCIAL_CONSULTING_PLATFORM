# Consulting Intelligence Platform

> **Enterprise-grade investment intelligence platform** for institutional analysts, hedge fund researchers, and strategy teams — built with a FastAPI backend and a React 19 frontend using a premium luxury dark-mode design system.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Design System](#design-system)
- [Pages & Modules](#pages--modules)

---

## Overview

The Consulting Intelligence Platform is a full-stack financial analytics dashboard that provides real-time market intelligence, AI-driven investment recommendations, portfolio tracking, news sentiment analysis, and a multi-factor stock screener — all wrapped in a Bloomberg-inspired enterprise UI.

It was built in 9 phases:

| Phase | Feature |
|-------|---------|
| 1 | Core dashboard, company explorer, live market data |
| 2 | Company detail with financials, charts, and peer comparison |
| 3 | Watchlist management |
| 4 | Benchmark comparison |
| 5 | Portfolio tracker with P&L, allocation, and sector exposure |
| 6 | AI Investment Engine (Buy / Hold / Sell / Strong Buy / Strong Sell) |
| 7 | News Intelligence with Finnhub API + sentiment scoring |
| 8 | Multi-factor Stock Screener with ranked output |
| 9 | Enterprise UI Redesign — luxury dark mode, Framer Motion animations |

---

## Architecture

```
consulting_dashboard/
├── consulting_dashboard_frontend/    ← React 19 + Vite SPA
└── consulting_platform_backend/      ← Python FastAPI REST API
```

The frontend communicates with the backend via Axios at `http://localhost:8001`. The backend fetches real-time data from Finnhub and Yahoo Finance, applies AI scoring, caches responses, and returns structured JSON.

```
Browser  ──→  React SPA (port 5173)
                  ↓  Axios
FastAPI (port 8001)
    ├── Finnhub API  (stock quotes, news, company profiles)
    ├── Yahoo Finance (financial statements, metrics)
    └── SQLite / in-memory cache
```

---

## Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build Tool | Vite 8 |
| Routing | React Router v7 |
| HTTP | Axios |
| Animations | Framer Motion 12 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Fonts | Playfair Display · Inter · IBM Plex Mono · Space Grotesk |
| Styling | Vanilla CSS with CSS Custom Properties |

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | FastAPI |
| Server | Uvicorn |
| Data Sources | Finnhub API · yfinance (Yahoo Finance) |
| Concurrency | ThreadPoolExecutor (parallel API fetching) |
| Caching | In-memory TTL cache |
| Language | Python 3.10+ |

---

## Project Structure

### Frontend (`consulting_dashboard_frontend/`)

```
src/
├── main.jsx                   # React entry point
├── App.jsx                    # Route definitions (all 13 routes)
├── index.css                  # Global design system (CSS tokens, animations)
│
├── layouts/
│   └── DashboardLayout.jsx    # Shell: sidebar, header, command palette (⌘K)
│
├── pages/
│   ├── DashboardPage.jsx      # Main overview: KPIs, charts, AI signals
│   ├── StockDetailPage.jsx    # Company deep-dive: financials, charts, peers
│   ├── WatchlistPage.jsx      # Watchlist management and live prices
│   ├── PortfolioPage.jsx      # Portfolio tracker: P&L, allocation, sectors
│   ├── AIEnginePage.jsx       # AI recommendation engine
│   ├── NewsPage.jsx           # News intelligence + sentiment scoring
│   ├── ScreenerPage.jsx       # Multi-factor stock screener
│   ├── CompaniesPage.jsx      # Company explorer / universe browser
│   ├── LiveMarketPage.jsx     # Live market data and indices
│   ├── BenchmarkPage.jsx      # Benchmark performance comparison
│   ├── RecommendationPage.jsx # Investment score cards
│   ├── RiskPage.jsx           # Risk analysis
│   └── ExecutivePage.jsx      # Executive summary / brief
│
└── services/
    └── api.js                 # Axios instance pointing to localhost:8001
```

### Backend (`consulting_platform_backend/`)

```
app/
├── main.py                        # FastAPI app, CORS, route registration
│
├── routes/
│   ├── stock_routes.py            # /stock/* — quotes, history, financials
│   ├── company_routes.py          # /company/* — profiles, metrics, peers
│   ├── watchlist_routes.py        # /watchlist/* — CRUD watchlist
│   ├── portfolio_routes.py        # /portfolio/* — positions, P&L, allocation
│   ├── ai_routes.py               # /ai/* — investment engine & scoring
│   ├── news_routes.py             # /news/* — Finnhub headlines + sentiment
│   ├── screener_routes.py         # /screener/* — filter & rank stocks
│   ├── market_explorer_routes.py  # /market/* — sector data, movers
│   ├── live_market_routes.py      # /live-market/* — real-time indices
│   ├── executive_routes.py        # /executive/* — summary reports
│   ├── benchmark_routes.py        # /benchmark/* — index comparisons
│   ├── recommendation_routes.py   # /recommendation/* — score cards
│   ├── risk_routes.py             # /risk/* — risk metrics
│   ├── dashboard_routes.py        # /dashboard/* — homepage aggregates
│   └── financial_routes.py        # /financial/* — raw financials
│
├── services/                      # Business logic (data fetching, scoring)
├── models/                        # SQLAlchemy / Pydantic models
├── schemas/                       # Pydantic request/response schemas
├── database/                      # DB connection, session management
├── analytics/                     # AI scoring, signal generation
└── utils/                         # Helpers, formatters, cache utilities
```

---

## Features

### 🏠 Dashboard Overview
- Time-of-day greeting with live date
- Live market pulse strip: S&P 500, NASDAQ, DOW, VIX, 10Y Treasury, Gold
- **KPI Bento Grid**: Portfolio value (animated counter), universe size, AI signal count (Buy/Sell/Hold split), live AAPL price, VIX risk gauge
- **Index Performance Chart**: Dual area chart — S&P 500 vs NASDAQ YTD
- **Sector Donut**: S&P 500 sector weight breakdown
- **Top 8 Companies Table**: Click-to-navigate to company detail
- **AI Signals Panel**: 4 active signals with Framer Motion card animations
- **Quick Action Grid**: Screener, AI Engine, News, Portfolio launchers

### 🏢 Company Detail
- Full company profile (sector, country, employees, description)
- Live quote: price, change %, volume, 52-week range
- Interactive stock price chart (1D / 1W / 1M / 3M / 1Y)
- Key financial metrics: P/E, EV/EBITDA, D/E, ROE, Net Margin, Revenue Growth
- Income statement and balance sheet breakdown
- Peer comparison table
- Recent company news

### ⭐ Watchlist
- Add/remove tickers to a personal watchlist
- Live price updates for all tracked symbols
- Daily change, volume, and market cap display
- One-click navigation to company detail

### 💼 Portfolio Tracker
- Add positions: Stock symbol · Quantity · Buy price
- Calculates: Current value, Unrealised P&L, Daily P&L, Allocation %
- **Sector Exposure** breakdown with donut chart
- **Allocation Chart**: Visual weight of each position
- Real-time P&L calculation against live prices

### 🤖 AI Investment Engine
- Generates signals for all tracked stocks:
  - **Strong Buy** · **Buy** · **Hold** · **Sell** · **Strong Sell**
- Scoring uses 5 factors:
  - Debt/Equity ratio
  - Revenue Growth (3Y CAGR)
  - Market Cap tier
  - Price Volatility (Beta)
  - Analyst consensus estimate
- Morningstar-style written explanation for each recommendation
- Conviction score (0–100) displayed as a progress bar

### 📰 News Intelligence
- Pulls live headlines from **Finnhub News API**
- Per-article display:
  - Headline and source
  - Publication timestamp
  - **Sentiment score** (Bullish / Neutral / Bearish)
  - **AI Summary** (condensed analysis)
  - Tag badges: Bullish 🟢 / Bearish 🔴
- Filterable by ticker symbol

### 🔍 Stock Screener
- Filters across 85+ global stocks:
  - P/E Ratio (Min / Max)
  - Market Cap in $B (Min / Max)
  - Max Debt/Equity
  - Min ROE %
  - Min Revenue Growth 3Y %
  - Min Dividend Yield %
  - Sector (11 sectors)
  - Country (US, TW, NL, DE, JP, CN, IE)
- **6 Preset Strategies**: Value, Growth, Income, Quality, Mega Cap, Low Beta
- Results ranked by **AI composite score** (0–100)
- Sortable columns: Score, Market Cap, P/E, D/E, ROE, Div Yield, Rev Growth, Beta
- **Export to CSV** button
- Click any row → Company Detail page

### 🌐 Live Market
- Real-time index levels
- Market movers: Top gainers and losers
- Sector performance heatmap

### 📊 Benchmark
- Compare any stock against S&P 500, NASDAQ, or sector ETF
- Normalised return chart from a common base date

### ⚠️ Risk Analysis
- Beta, Sharpe ratio, max drawdown metrics
- Portfolio-level risk score

### 📋 Executive Brief
- One-page summary of portfolio health, top signals, and market context

---

## API Reference

All endpoints are served at `http://localhost:8001`.

### Stock
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stock/quote/{symbol}` | Live quote: price, change, volume |
| GET | `/stock/history/{symbol}` | OHLCV price history |
| GET | `/stock/financials/{symbol}` | Income statement, balance sheet |

### Company
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/company/profile/{symbol}` | Full company profile |
| GET | `/company/metrics/{symbol}` | Valuation & financial ratios |
| GET | `/company/peers/{symbol}` | Peer comparison |
| GET | `/company/news/{symbol}` | Company-specific news |

### Watchlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/watchlist/` | Get all watchlist items |
| POST | `/watchlist/add` | Add ticker to watchlist |
| DELETE | `/watchlist/remove/{symbol}` | Remove ticker |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolio/` | All positions |
| GET | `/portfolio/summary` | Total value, P&L, allocation |
| POST | `/portfolio/add` | Add position |
| DELETE | `/portfolio/remove/{symbol}` | Remove position |

### AI Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ai/recommendations` | AI signals for all tracked stocks |
| GET | `/ai/score/{symbol}` | Single-stock AI score + explanation |

### News
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/news/feed` | Latest market news with sentiment |
| GET | `/news/company/{symbol}` | Ticker-specific news |

### Screener
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screener/run` | Run screener with query params |
| GET | `/screener/universe` | Full stock universe metadata |

### Interactive API Docs
FastAPI auto-generates docs — open after starting the backend:
- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

---

## Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+
- A **Finnhub API key** (free tier works): https://finnhub.io

---

### 1. Clone / Navigate to the project

```bash
cd "C:\Users\marka\OneDrive\Documents\consulting_dashboard"
```

---

### 2. Start the Backend

```powershell
cd consulting_platform_backend

# First time only — create virtual environment and install dependencies
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install fastapi uvicorn yfinance finnhub-python python-dotenv sqlalchemy

# Set your API key (see Environment Variables below)

# Start the server
python -m uvicorn app.main:app --reload --port 8001
```

Backend runs at → **http://localhost:8001**

---

### 3. Start the Frontend

```powershell
cd consulting_dashboard_frontend

# First time only
npm install

# Start dev server
npm run dev
```

Frontend runs at → **http://localhost:5173**

---

### 4. Open the App

Navigate to **http://localhost:5173** in your browser.

> ⚠️ Start the backend **before** the frontend. The dashboard fetches live data on load.

---

## Environment Variables

Create a `.env` file inside `consulting_platform_backend/`:

```env
FINNHUB_API_KEY=your_finnhub_api_key_here
```

Get a free key at https://finnhub.io/register

---

## Design System

The frontend uses a **luxury dark-mode** design system defined in `src/index.css` as CSS Custom Properties.

### Colour Palette
| Token | Value | Use |
|-------|-------|-----|
| `--bg-base` | `#090909` | App background |
| `--bg-panel` | `#161616` | Card / panel surfaces |
| `--bg-elevated` | `#1c1c1c` | Elevated elements |
| `--accent` | `#C8A44D` | Gold — primary accent |
| `--text-primary` | `#F5F3EF` | Warm white body text |
| `--success` | `#4ADE80` | Positive / bullish |
| `--danger` | `#F87171` | Negative / bearish |
| `--warning` | `#FBBF24` | Caution / neutral |

### Typography
| Role | Font |
|------|------|
| Display / Headings | Playfair Display (serif) |
| UI / Body | Inter · Space Grotesk (sans-serif) |
| Numbers / Code | IBM Plex Mono (monospace) |

### Key UI Patterns
- **Bento Grid**: 12-column CSS grid for KPI cards
- **Framer Motion**: Spring animations on all cards, page transitions, sidebar collapse
- **Command Palette**: `⌘K` / `Ctrl+K` to fuzzy-search all pages and companies
- **Active Nav Indicator**: Gold left-border pill with `layoutId` shared animation
- **Animated Counters**: Numbers count up from 0 on page load
- **Mini Sparklines**: Inline SVG trend lines in KPI cards
- **Noise Texture**: Subtle film-grain overlay for premium depth
- **Live Dot**: Pulsing green indicator in header and hero

---

## Pages & Modules

| Route | Page | Description |
|-------|------|-------------|
| `/` or `/dashboard` | Dashboard Overview | Hero, KPIs, charts, AI signals |
| `/company/:symbol` | Company Detail | Deep-dive: price, financials, peers |
| `/watchlist` | Watchlist | Track and monitor tickers |
| `/portfolio` | Portfolio Tracker | Positions, P&L, allocation |
| `/ai-engine` | AI Engine | Buy/Sell/Hold signals with explanations |
| `/news` | News Intelligence | Sentiment-scored headlines |
| `/screener` | Stock Screener | Multi-factor filter and rank |
| `/companies` | Companies | Full universe browser |
| `/live-market` | Live Market | Indices and movers |
| `/benchmark` | Benchmark | Performance comparison |
| `/risk-analysis` | Risk Analysis | Risk metrics and portfolio beta |
| `/investment-score` | Recommendations | Score cards |
| `/executive-summary` | Executive Brief | One-page summary |

---

## Scripts

### Frontend
```bash
npm run dev       # Start development server (localhost:5173)
npm run build     # Build production bundle → dist/
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

### Backend
```bash
# Activate venv (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Start with hot-reload
python -m uvicorn app.main:app --reload --port 8001

# Start without reload (production-like)
python -m uvicorn app.main:app --port 8001
```

---

## License

Private project — all rights reserved.
