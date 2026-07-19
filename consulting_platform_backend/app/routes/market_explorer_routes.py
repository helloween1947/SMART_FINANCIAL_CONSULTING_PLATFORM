"""
Market Explorer routes  –  v2 (with in-memory cache + background refresh)
GET /market-explorer          – paginated, filtered, sorted company list
GET /market-explorer/search   – autocomplete symbol/name search
GET /market-explorer/refresh  – force-refresh the cache
GET /market-explorer/{symbol} – full enriched profile for a single ticker
"""
from fastapi import APIRouter, Query, BackgroundTasks
from typing import Optional
import time
import threading

from app.services.finnhub_service import (
    search_symbols,
    get_company_profile,
    get_stock_quote,
    get_basic_financials,
    get_enriched_company,
)

router = APIRouter(prefix="/market-explorer", tags=["Market Explorer"])


# ── Default symbol list (top 20 for fast first load, expands in background) ───
PRIORITY_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN",
    "META", "TSLA", "JPM",  "V",     "UNH",
    "XOM",  "JNJ",  "PG",   "MA",    "HD",
    "AVGO", "LLY",  "MRK",  "COST",  "KO",
]

EXTENDED_SYMBOLS = [
    "PEP",  "MCD",  "TMO",  "ACN",   "DHR",
    "TXN",  "NEE",  "PM",   "UPS",   "CRM",
    "QCOM", "AMGN", "LOW",  "NKE",   "SBUX",
    "GS",   "IBM",  "CAT",  "GE",    "CVX",
    "ABBV", "BRK.B","DIS",  "PYPL",  "BA",
    "MMM",  "F",    "INTC",
]

ALL_SYMBOLS = PRIORITY_SYMBOLS + EXTENDED_SYMBOLS


# ── In-memory cache ────────────────────────────────────────────────────────────
_cache: dict = {
    "rows":       [],
    "loaded_at":  0,
    "refreshing": False,
}
_CACHE_TTL = 300   # seconds — refresh data every 5 minutes
_lock = threading.Lock()


# ── Build one row ──────────────────────────────────────────────────────────────
def _build_row(symbol: str, profile: dict, quote: dict, metrics: dict) -> dict:
    metric     = metrics.get("metric", {}) if isinstance(metrics, dict) else {}
    price      = float(quote.get("c") or 0)
    pc         = float(quote.get("pc") or 0)
    change_pct = round(((price - pc) / pc * 100), 2) if pc else 0

    return {
        "symbol":       symbol,
        "name":         profile.get("name", ""),
        "sector":       profile.get("finnhubIndustry", "Other"),
        "country":      profile.get("country", ""),
        "exchange":     profile.get("exchange", ""),
        "currency":     profile.get("currency", "USD"),
        "logo":         profile.get("logo", ""),

        # Quote
        "price":        round(price, 2),
        "open":         round(float(quote.get("o") or 0), 2),
        "high":         round(float(quote.get("h") or 0), 2),
        "low":          round(float(quote.get("l") or 0), 2),
        "prev_close":   round(pc, 2),
        "change":       round(float(quote.get("d") or 0), 2),
        "change_pct":   change_pct,

        # Fundamentals
        "market_cap":   profile.get("marketCapitalization", 0),
        "pe_ratio":     metric.get("peBasicExclExtraTTM"),
        "eps":          metric.get("epsBasicExclExtraAnnual"),
        "revenue_ttm":  metric.get("revenueTTM"),
        "gross_margin": metric.get("grossMarginTTM"),
        "debt_equity":  metric.get("totalDebt/totalEquityAnnual"),
        "roe":          metric.get("roeTTM"),
        "beta":         metric.get("beta"),
        "52w_high":     metric.get("52WeekHigh"),
        "52w_low":      metric.get("52WeekLow"),
    }


def _fetch_symbol(symbol: str) -> dict | None:
    """Fetch one symbol — returns None on any failure."""
    try:
        profile = get_company_profile(symbol)
        if not profile or not profile.get("name"):
            return None
        quote   = get_stock_quote(symbol)
        metrics = get_basic_financials(symbol)
        return _build_row(symbol, profile, quote, metrics)
    except Exception:
        return None


def _populate_cache(symbols: list[str], replace: bool = False):
    """
    Fetch all symbols and store in cache.
    If replace=False, APPEND new rows so the UI can show partial results.
    """
    with _lock:
        if _cache["refreshing"]:
            return
        _cache["refreshing"] = True

    try:
        new_rows = []
        for sym in symbols:
            row = _fetch_symbol(sym)
            if row:
                new_rows.append(row)
                if not replace:
                    with _lock:
                        # Merge: update existing or append
                        existing = {r["symbol"]: r for r in _cache["rows"]}
                        existing[sym] = row
                        _cache["rows"] = list(existing.values())
            time.sleep(0.08)    # ~12 req/s — safe for Finnhub free tier (30/s)

        if replace:
            with _lock:
                _cache["rows"] = new_rows

        with _lock:
            _cache["loaded_at"] = time.time()
    finally:
        with _lock:
            _cache["refreshing"] = False


def _ensure_cache_warm():
    """Kick off background population if cache is cold or stale."""
    with _lock:
        age = time.time() - _cache["loaded_at"]
        already_refreshing = _cache["refreshing"]

    if age > _CACHE_TTL and not already_refreshing:
        t = threading.Thread(
            target=_populate_cache,
            args=(ALL_SYMBOLS,),
            kwargs={"replace": True},
            daemon=True,
        )
        t.start()


# ── Warm the cache on first import (priority symbols only, fast) ──────────────
def _initial_warm():
    _populate_cache(PRIORITY_SYMBOLS, replace=False)
    # Then fill extended symbols in the same thread
    _populate_cache(EXTENDED_SYMBOLS, replace=False)

_init_thread = threading.Thread(target=_initial_warm, daemon=True)
_init_thread.start()


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def market_explorer(
    q:        Optional[str] = Query(None),
    sector:   Optional[str] = Query(None),
    country:  Optional[str] = Query(None),
    sort_by:  Optional[str] = Query("market_cap"),
    sort_dir: Optional[str] = Query("desc"),
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=50),
):
    """
    Returns cached + paginated market data.
    If a search query is provided, fetches live from Finnhub search API.
    """
    _ensure_cache_warm()

    # ── Search mode: live Finnhub lookup ─────────────────────────────────────
    if q and q.strip():
        search_results = search_symbols(q.strip())
        symbols = [
            r["symbol"] for r in search_results
            if r.get("type") in ("Common Stock", "EQS", "")
        ][:20]

        rows = []
        for sym in symbols:
            # Check cache first
            cached = next((r for r in _cache["rows"] if r["symbol"] == sym), None)
            if cached:
                rows.append(cached)
            else:
                row = _fetch_symbol(sym)
                if row:
                    rows.append(row)
                    with _lock:
                        existing = {r["symbol"]: r for r in _cache["rows"]}
                        existing[sym] = row
                        _cache["rows"] = list(existing.values())
            time.sleep(0.05)
    else:
        with _lock:
            rows = list(_cache["rows"])

    # ── Filter ───────────────────────────────────────────────────────────────
    if sector and sector.upper() != "ALL":
        rows = [r for r in rows if (r.get("sector") or "").lower() == sector.lower()]
    if country and country.upper() != "ALL":
        rows = [r for r in rows if (r.get("country") or "").upper() == country.upper()]

    # ── Collect filter options ────────────────────────────────────────────────
    all_sectors   = sorted({r["sector"]  for r in rows if r.get("sector")})
    all_countries = sorted({r["country"] for r in rows if r.get("country")})

    # ── Sort ─────────────────────────────────────────────────────────────────
    valid_sort = {"market_cap", "price", "change_pct", "pe_ratio",
                  "revenue_ttm", "beta", "symbol", "name", "roe"}
    key = sort_by if sort_by in valid_sort else "market_cap"
    reverse = sort_dir != "asc"
    rows.sort(key=lambda r: (r.get(key) is None, r.get(key) or 0), reverse=reverse)

    # ── Paginate ─────────────────────────────────────────────────────────────
    total = len(rows)
    start = (page - 1) * per_page
    paged = rows[start: start + per_page]

    return {
        "data":        paged,
        "total":       total,
        "page":        page,
        "per_page":    per_page,
        "sectors":     all_sectors,
        "countries":   all_countries,
        "cache_age_s": round(time.time() - _cache["loaded_at"]),
        "refreshing":  _cache["refreshing"],
    }


@router.get("/search")
def autocomplete_search(q: str = Query(..., min_length=1)):
    """Lightweight autocomplete — symbol + name matches."""
    results = search_symbols(q)
    return [
        {
            "symbol":      r.get("symbol", ""),
            "description": r.get("description", ""),
            "type":        r.get("type", ""),
        }
        for r in results
        if r.get("symbol")
    ]


@router.get("/refresh")
def force_refresh(background_tasks: BackgroundTasks):
    """Force a full cache refresh in the background."""
    background_tasks.add_task(_populate_cache, ALL_SYMBOLS, True)
    return {"status": "refresh started", "symbols": len(ALL_SYMBOLS)}


@router.get("/{symbol}")
def get_symbol_detail(symbol: str):
    """Full enriched profile for a single ticker."""
    sym = symbol.upper()
    # Check cache first
    cached = next((r for r in _cache["rows"] if r["symbol"] == sym), None)
    if cached:
        return get_enriched_company(sym)   # always fresh for detail view
    return get_enriched_company(sym)
