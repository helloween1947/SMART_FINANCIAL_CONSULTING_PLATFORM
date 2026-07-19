"""
Stock Screener — batch-fetch metrics for a curated universe, apply filters, rank results.
Cache metrics for 30 min to avoid rate-limit pressure on Finnhub free tier.
"""
from __future__ import annotations
from fastapi import APIRouter, Query
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import time, math, requests

from app.services.finnhub_service import API_KEY

router = APIRouter()

# ─── Universe ─────────────────────────────────────────────────────────────────
UNIVERSE: list[dict] = [
    # ── Technology ──
    {"s":"AAPL",  "n":"Apple Inc",               "sector":"Technology",             "country":"US"},
    {"s":"MSFT",  "n":"Microsoft Corp",           "sector":"Technology",             "country":"US"},
    {"s":"NVDA",  "n":"NVIDIA Corp",              "sector":"Technology",             "country":"US"},
    {"s":"GOOGL", "n":"Alphabet Inc",             "sector":"Technology",             "country":"US"},
    {"s":"META",  "n":"Meta Platforms",           "sector":"Technology",             "country":"US"},
    {"s":"AMZN",  "n":"Amazon.com Inc",           "sector":"Technology",             "country":"US"},
    {"s":"TSLA",  "n":"Tesla Inc",                "sector":"Technology",             "country":"US"},
    {"s":"AMD",   "n":"Advanced Micro Devices",   "sector":"Technology",             "country":"US"},
    {"s":"INTC",  "n":"Intel Corp",               "sector":"Technology",             "country":"US"},
    {"s":"QCOM",  "n":"QUALCOMM Inc",             "sector":"Technology",             "country":"US"},
    {"s":"ORCL",  "n":"Oracle Corp",              "sector":"Technology",             "country":"US"},
    {"s":"CRM",   "n":"Salesforce Inc",           "sector":"Technology",             "country":"US"},
    {"s":"ADBE",  "n":"Adobe Inc",                "sector":"Technology",             "country":"US"},
    {"s":"NOW",   "n":"ServiceNow Inc",           "sector":"Technology",             "country":"US"},
    {"s":"PLTR",  "n":"Palantir Technologies",    "sector":"Technology",             "country":"US"},
    {"s":"SNOW",  "n":"Snowflake Inc",            "sector":"Technology",             "country":"US"},
    {"s":"CRWD",  "n":"CrowdStrike Holdings",     "sector":"Technology",             "country":"US"},
    {"s":"UBER",  "n":"Uber Technologies",        "sector":"Technology",             "country":"US"},
    {"s":"TSM",   "n":"Taiwan Semiconductor",     "sector":"Technology",             "country":"TW"},
    {"s":"ASML",  "n":"ASML Holding",             "sector":"Technology",             "country":"NL"},
    {"s":"SAP",   "n":"SAP SE",                   "sector":"Technology",             "country":"DE"},
    # ── Communication Services ──
    {"s":"NFLX",  "n":"Netflix Inc",              "sector":"Communication Services", "country":"US"},
    {"s":"DIS",   "n":"Walt Disney Co",           "sector":"Communication Services", "country":"US"},
    {"s":"CMCSA", "n":"Comcast Corp",             "sector":"Communication Services", "country":"US"},
    {"s":"T",     "n":"AT&T Inc",                 "sector":"Communication Services", "country":"US"},
    {"s":"VZ",    "n":"Verizon Communications",   "sector":"Communication Services", "country":"US"},
    # ── Financial Services ──
    {"s":"JPM",   "n":"JPMorgan Chase",           "sector":"Financial Services",     "country":"US"},
    {"s":"BAC",   "n":"Bank of America",          "sector":"Financial Services",     "country":"US"},
    {"s":"WFC",   "n":"Wells Fargo",              "sector":"Financial Services",     "country":"US"},
    {"s":"GS",    "n":"Goldman Sachs",            "sector":"Financial Services",     "country":"US"},
    {"s":"MS",    "n":"Morgan Stanley",           "sector":"Financial Services",     "country":"US"},
    {"s":"BLK",   "n":"BlackRock Inc",            "sector":"Financial Services",     "country":"US"},
    {"s":"V",     "n":"Visa Inc",                 "sector":"Financial Services",     "country":"US"},
    {"s":"MA",    "n":"Mastercard Inc",           "sector":"Financial Services",     "country":"US"},
    {"s":"AXP",   "n":"American Express",         "sector":"Financial Services",     "country":"US"},
    {"s":"SCHW",  "n":"Charles Schwab",           "sector":"Financial Services",     "country":"US"},
    {"s":"C",     "n":"Citigroup Inc",            "sector":"Financial Services",     "country":"US"},
    # ── Healthcare ──
    {"s":"JNJ",   "n":"Johnson & Johnson",        "sector":"Healthcare",             "country":"US"},
    {"s":"UNH",   "n":"UnitedHealth Group",       "sector":"Healthcare",             "country":"US"},
    {"s":"PFE",   "n":"Pfizer Inc",               "sector":"Healthcare",             "country":"US"},
    {"s":"ABBV",  "n":"AbbVie Inc",               "sector":"Healthcare",             "country":"US"},
    {"s":"MRK",   "n":"Merck & Co",               "sector":"Healthcare",             "country":"US"},
    {"s":"TMO",   "n":"Thermo Fisher Scientific", "sector":"Healthcare",             "country":"US"},
    {"s":"ABT",   "n":"Abbott Laboratories",      "sector":"Healthcare",             "country":"US"},
    {"s":"LLY",   "n":"Eli Lilly",                "sector":"Healthcare",             "country":"US"},
    {"s":"AMGN",  "n":"Amgen Inc",                "sector":"Healthcare",             "country":"US"},
    {"s":"GILD",  "n":"Gilead Sciences",          "sector":"Healthcare",             "country":"US"},
    {"s":"REGN",  "n":"Regeneron Pharmaceuticals","sector":"Healthcare",             "country":"US"},
    # ── Energy ──
    {"s":"XOM",   "n":"Exxon Mobil",              "sector":"Energy",                 "country":"US"},
    {"s":"CVX",   "n":"Chevron Corp",             "sector":"Energy",                 "country":"US"},
    {"s":"COP",   "n":"ConocoPhillips",           "sector":"Energy",                 "country":"US"},
    {"s":"EOG",   "n":"EOG Resources",            "sector":"Energy",                 "country":"US"},
    {"s":"SLB",   "n":"Schlumberger Ltd",         "sector":"Energy",                 "country":"US"},
    {"s":"OXY",   "n":"Occidental Petroleum",     "sector":"Energy",                 "country":"US"},
    # ── Consumer Staples ──
    {"s":"WMT",   "n":"Walmart Inc",              "sector":"Consumer Staples",       "country":"US"},
    {"s":"COST",  "n":"Costco Wholesale",         "sector":"Consumer Staples",       "country":"US"},
    {"s":"PG",    "n":"Procter & Gamble",         "sector":"Consumer Staples",       "country":"US"},
    {"s":"KO",    "n":"Coca-Cola Co",             "sector":"Consumer Staples",       "country":"US"},
    {"s":"PEP",   "n":"PepsiCo Inc",              "sector":"Consumer Staples",       "country":"US"},
    {"s":"PM",    "n":"Philip Morris Intl",       "sector":"Consumer Staples",       "country":"US"},
    {"s":"MO",    "n":"Altria Group",             "sector":"Consumer Staples",       "country":"US"},
    # ── Consumer Discretionary ──
    {"s":"MCD",   "n":"McDonald's Corp",          "sector":"Consumer Discretionary", "country":"US"},
    {"s":"NKE",   "n":"Nike Inc",                 "sector":"Consumer Discretionary", "country":"US"},
    {"s":"SBUX",  "n":"Starbucks Corp",           "sector":"Consumer Discretionary", "country":"US"},
    {"s":"TGT",   "n":"Target Corp",              "sector":"Consumer Discretionary", "country":"US"},
    {"s":"HD",    "n":"Home Depot",               "sector":"Consumer Discretionary", "country":"US"},
    {"s":"LOW",   "n":"Lowe's Companies",         "sector":"Consumer Discretionary", "country":"US"},
    {"s":"TJX",   "n":"TJX Companies",            "sector":"Consumer Discretionary", "country":"US"},
    {"s":"TM",    "n":"Toyota Motor",             "sector":"Consumer Discretionary", "country":"JP"},
    {"s":"BABA",  "n":"Alibaba Group",            "sector":"Consumer Discretionary", "country":"CN"},
    # ── Industrials ──
    {"s":"CAT",   "n":"Caterpillar Inc",          "sector":"Industrials",            "country":"US"},
    {"s":"BA",    "n":"Boeing Co",                "sector":"Industrials",            "country":"US"},
    {"s":"GE",    "n":"GE Aerospace",             "sector":"Industrials",            "country":"US"},
    {"s":"HON",   "n":"Honeywell International",  "sector":"Industrials",            "country":"US"},
    {"s":"LMT",   "n":"Lockheed Martin",          "sector":"Industrials",            "country":"US"},
    {"s":"RTX",   "n":"RTX Corp",                 "sector":"Industrials",            "country":"US"},
    {"s":"UPS",   "n":"United Parcel Service",    "sector":"Industrials",            "country":"US"},
    {"s":"DE",    "n":"Deere & Company",          "sector":"Industrials",            "country":"US"},
    {"s":"UNP",   "n":"Union Pacific",            "sector":"Industrials",            "country":"US"},
    # ── Real Estate ──
    {"s":"AMT",   "n":"American Tower",           "sector":"Real Estate",            "country":"US"},
    {"s":"PLD",   "n":"Prologis Inc",             "sector":"Real Estate",            "country":"US"},
    {"s":"EQIX",  "n":"Equinix Inc",              "sector":"Real Estate",            "country":"US"},
    {"s":"SPG",   "n":"Simon Property Group",     "sector":"Real Estate",            "country":"US"},
    {"s":"O",     "n":"Realty Income",            "sector":"Real Estate",            "country":"US"},
    # ── Utilities ──
    {"s":"NEE",   "n":"NextEra Energy",           "sector":"Utilities",              "country":"US"},
    {"s":"DUK",   "n":"Duke Energy",              "sector":"Utilities",              "country":"US"},
    {"s":"SO",    "n":"Southern Company",         "sector":"Utilities",              "country":"US"},
    # ── Materials ──
    {"s":"LIN",   "n":"Linde PLC",                "sector":"Materials",              "country":"IE"},
    {"s":"APD",   "n":"Air Products & Chemicals", "sector":"Materials",              "country":"US"},
    {"s":"NEM",   "n":"Newmont Corp",             "sector":"Materials",              "country":"US"},
    {"s":"FCX",   "n":"Freeport-McMoRan",         "sector":"Materials",              "country":"US"},
]

SECTORS   = sorted({u["sector"]  for u in UNIVERSE})
COUNTRIES = sorted({u["country"] for u in UNIVERSE})

# ─── In-memory cache ──────────────────────────────────────────────────────────
_metrics_cache: dict[str, dict] = {}
_cache_ts: float = 0.0
CACHE_TTL = 1800  # 30 min

# ─── Helpers ─────────────────────────────────────────────────────────────────
def _safe(v) -> float | None:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None

def _fetch_one(symbol: str) -> tuple[str, dict]:
    try:
        r = requests.get(
            "https://finnhub.io/api/v1/stock/metric",
            params={"symbol": symbol, "metric": "all", "token": API_KEY},
            timeout=8,
        )
        data = r.json()
        return symbol, data.get("metric", {}) if isinstance(data, dict) else {}
    except Exception:
        return symbol, {}

def _fetch_quote(symbol: str) -> tuple[str, dict]:
    try:
        r = requests.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": symbol, "token": API_KEY},
            timeout=6,
        )
        return symbol, r.json() if r.ok else {}
    except Exception:
        return symbol, {}

def _load_metrics(symbols: list[str], force: bool = False) -> dict[str, dict]:
    global _metrics_cache, _cache_ts
    now = time.time()
    if not force and (now - _cache_ts) < CACHE_TTL and _metrics_cache:
        return _metrics_cache

    result: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(_fetch_one, s): s for s in symbols}
        for f in as_completed(futures):
            sym, m = f.result()
            result[sym] = m

    _metrics_cache = result
    _cache_ts = now
    return result

def _compute_rank_score(m: dict) -> float:
    """Composite quality/value rank score 0-100"""
    score = 50.0  # start neutral
    # Growth (up to ±25)
    rg = _safe(m.get("revenueGrowth3Y"))
    if rg is not None:
        pct = rg * 100 if abs(rg) < 5 else rg
        score += min(25, max(-25, pct * 0.8))
    # Valuation (up to ±20)
    pe = _safe(m.get("peNormalizedAnnual") or m.get("peTTM"))
    if pe and pe > 0:
        if   pe < 12: score += 20
        elif pe < 20: score += 12
        elif pe < 30: score +=  5
        elif pe < 50: score -=  5
        else:         score -= 18
    # Profitability (up to ±20)
    npm = _safe(m.get("netProfitMarginAnnual") or m.get("netProfitMarginTTM"))
    if npm is not None:
        pct = npm * 100 if abs(npm) < 5 else npm
        score += min(20, max(-15, pct * 0.6))
    # Financial health (up to ±15)
    de = _safe(m.get("totalDebt/totalEquityAnnual"))
    if de is not None:
        if   de < 0.3: score += 15
        elif de < 0.7: score += 8
        elif de < 1.5: score += 2
        elif de < 3.0: score -= 8
        else:          score -= 15
    return round(min(100, max(0, score)), 1)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/screener/universe")
def get_universe():
    """Return the stock universe metadata (instant, no API calls)"""
    return {"universe": UNIVERSE, "sectors": SECTORS, "countries": COUNTRIES}


@router.get("/screener/run")
def run_screener(
    # Filters
    min_mktcap:    float | None = Query(None, description="Min market cap (USD billions)"),
    max_mktcap:    float | None = Query(None, description="Max market cap (USD billions)"),
    min_pe:        float | None = Query(None),
    max_pe:        float | None = Query(None),
    max_de:        float | None = Query(None, description="Max Debt/Equity ratio"),
    min_div:       float | None = Query(None, description="Min dividend yield %"),
    min_rev_growth:float | None = Query(None, description="Min 3Y revenue growth %"),
    max_rev_growth:float | None = Query(None),
    min_roe:       float | None = Query(None, description="Min ROE %"),
    sector:        str | None   = Query(None),
    country:       str | None   = Query(None),
    # Sort
    sort_by:  str = Query("rank_score", description="rank_score|market_cap|pe|de|div_yield|rev_growth|roe"),
    sort_dir: str = Query("desc"),
    # Pagination
    limit:   int  = Query(50, le=100),
    refresh: bool = Query(False),
):
    symbols = [u["s"] for u in UNIVERSE]
    metrics = _load_metrics(symbols, force=refresh)

    results = []
    for stock in UNIVERSE:
        sym    = stock["s"]
        m      = metrics.get(sym, {})

        # Extract values
        mktcap = _safe(m.get("marketCapitalization"))          # in millions
        pe     = _safe(m.get("peNormalizedAnnual") or m.get("peTTM"))
        de     = _safe(m.get("totalDebt/totalEquityAnnual") or m.get("totalDebt/totalEquityQuarterly"))
        div_y  = _safe(m.get("dividendYieldIndicatedAnnual"))
        rg_raw = _safe(m.get("revenueGrowth3Y"))
        rev_g  = (rg_raw * 100 if rg_raw is not None and abs(rg_raw) < 5 else rg_raw)
        roe_raw= _safe(m.get("roeAnnual") or m.get("roeTTM"))
        roe    = (roe_raw * 100 if roe_raw is not None and abs(roe_raw) < 5 else roe_raw)
        npm_raw= _safe(m.get("netProfitMarginAnnual") or m.get("netProfitMarginTTM"))
        npm    = (npm_raw * 100 if npm_raw is not None and abs(npm_raw) < 5 else npm_raw)
        beta   = _safe(m.get("beta"))
        high52 = _safe(m.get("52WeekHigh"))
        low52  = _safe(m.get("52WeekLow"))
        pb     = _safe(m.get("pbAnnual") or m.get("pbQuarterly"))
        mktcap_b = mktcap / 1000 if mktcap else None  # convert M → B

        # ── Apply filters ──
        if min_mktcap  is not None and (mktcap_b is None or mktcap_b < min_mktcap):  continue
        if max_mktcap  is not None and (mktcap_b is None or mktcap_b > max_mktcap):  continue
        if min_pe      is not None and (pe is None or pe < min_pe):                   continue
        if max_pe      is not None and (pe is None or pe > max_pe):                   continue
        if max_de      is not None and (de is None or de > max_de):                   continue
        if min_div     is not None and (div_y is None or div_y < min_div):            continue
        if min_rev_growth is not None and (rev_g is None or rev_g < min_rev_growth):  continue
        if max_rev_growth is not None and (rev_g is None or rev_g > max_rev_growth):  continue
        if min_roe     is not None and (roe is None or roe < min_roe):                continue
        if sector  and stock["sector"]  != sector:                                     continue
        if country and stock["country"] != country:                                    continue

        rank = _compute_rank_score(m)

        results.append({
            "symbol":     sym,
            "name":       stock["n"],
            "sector":     stock["sector"],
            "country":    stock["country"],
            "rank_score": rank,
            "market_cap": round(mktcap_b, 2) if mktcap_b else None,
            "pe":         round(pe, 2)      if pe     else None,
            "pb":         round(pb, 2)      if pb     else None,
            "de":         round(de, 3)      if de     else None,
            "div_yield":  round(div_y, 2)   if div_y  else None,
            "rev_growth": round(rev_g, 1)   if rev_g  else None,
            "roe":        round(roe, 1)      if roe    else None,
            "net_margin": round(npm, 1)      if npm    else None,
            "beta":       round(beta, 2)     if beta   else None,
            "52w_high":   high52,
            "52w_low":    low52,
        })

    # Sort
    reverse = sort_dir.lower() != "asc"
    results.sort(
        key=lambda x: (x.get(sort_by) is not None, x.get(sort_by) or 0),
        reverse=reverse,
    )

    cache_age_min = round((time.time() - _cache_ts) / 60, 1) if _cache_ts else None

    return {
        "total":      len(results),
        "results":    results[:limit],
        "cache_age_min": cache_age_min,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
