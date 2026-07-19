import requests
import time
from functools import lru_cache

API_KEY = "d8qhl61r01qr03nj5sa0d8qhl61r01qr03nj5sag"
BASE_URL = "https://finnhub.io/api/v1"


def _get(endpoint: str, params: dict) -> dict | list:
    """Shared GET with timeout and error handling."""
    params["token"] = API_KEY
    try:
        res = requests.get(f"{BASE_URL}{endpoint}", params=params, timeout=8)
        res.raise_for_status()
        return res.json()
    except Exception:
        return {}


# ── Basic helpers ──────────────────────────────────────────────────────────────

def get_company_profile(symbol: str) -> dict:
    return _get("/stock/profile2", {"symbol": symbol})


def get_stock_quote(symbol: str) -> dict:
    return _get("/quote", {"symbol": symbol})


def get_basic_financials(symbol: str) -> dict:
    return _get("/stock/metric", {"symbol": symbol, "metric": "all"})


def get_recommendation_trends(symbol: str) -> list:
    data = _get("/stock/recommendation", {"symbol": symbol})
    return data if isinstance(data, list) else []


# ── Symbol list for exchange ──────────────────────────────────────────────────

@lru_cache(maxsize=4)
def get_exchange_symbols(exchange: str = "US") -> list[dict]:
    """
    Returns list of {description, displaySymbol, symbol, type}.
    Cached per exchange to avoid hammering the API.
    """
    data = _get("/stock/symbol", {"exchange": exchange})
    return data if isinstance(data, list) else []


# ── Autocomplete / search ──────────────────────────────────────────────────────

def search_symbols(query: str) -> list[dict]:
    """Finnhub symbol search — returns up to 10 matches."""
    data = _get("/search", {"q": query})
    if isinstance(data, dict):
        results = data.get("result", [])
    else:
        results = []
    return results[:10]


# ── Batch quote for multiple symbols ──────────────────────────────────────────

def get_quotes_batch(symbols: list[str]) -> dict[str, dict]:
    """
    Fetch quotes for a list of symbols.
    Returns {symbol: quote_dict}.
    Finnhub free tier: ~60 req/min — keep batches small.
    """
    out = {}
    for sym in symbols:
        out[sym] = get_stock_quote(sym)
        time.sleep(0.05)          # ~20 req/s — safe for free tier
    return out


# ── Enriched company record ────────────────────────────────────────────────────

def get_enriched_company(symbol: str) -> dict:
    """
    Combines profile + quote + basic metrics into one flat dict
    ready for the Market Explorer table.
    """
    profile = get_company_profile(symbol)
    quote   = get_stock_quote(symbol)
    metrics = get_basic_financials(symbol)
    metric  = metrics.get("metric", {}) if isinstance(metrics, dict) else {}

    return {
        "symbol":          symbol,
        "name":            profile.get("name", ""),
        "exchange":        profile.get("exchange", ""),
        "sector":          profile.get("finnhubIndustry", ""),
        "country":         profile.get("country", ""),
        "currency":        profile.get("currency", "USD"),
        "logo":            profile.get("logo", ""),
        "weburl":          profile.get("weburl", ""),
        "market_cap":      profile.get("marketCapitalization", 0),   # in $M
        "ipo":             profile.get("ipo", ""),
        "shares_outstanding": profile.get("shareOutstanding", 0),

        # Quote
        "price":           quote.get("c", 0),
        "open":            quote.get("o", 0),
        "high":            quote.get("h", 0),
        "low":             quote.get("l", 0),
        "prev_close":      quote.get("pc", 0),
        "change":          round(quote.get("d", 0) or 0, 2),
        "change_pct":      round(quote.get("dp", 0) or 0, 2),

        # Fundamental metrics
        "pe_ratio":        metric.get("peBasicExclExtraTTM", None),
        "eps":             metric.get("epsBasicExclExtraAnnual", None),
        "revenue_ttm":     metric.get("revenueTTM", None),
        "gross_margin":    metric.get("grossMarginTTM", None),
        "debt_equity":     metric.get("totalDebt/totalEquityAnnual", None),
        "roe":             metric.get("roeTTM", None),
        "52w_high":        metric.get("52WeekHigh", None),
        "52w_low":         metric.get("52WeekLow", None),
        "beta":            metric.get("beta", None),
    }