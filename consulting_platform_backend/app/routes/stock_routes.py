"""
GET /stock/{symbol}
Institutional-grade stock detail — all data for the Stock Detail Page.
All Finnhub calls run concurrently via ThreadPoolExecutor to avoid timeouts.
"""
from fastapi import APIRouter, HTTPException
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FutureTimeout
import math, datetime, time

from app.services.finnhub_service import API_KEY
import requests

router = APIRouter()

# ─── Simple in-memory TTL cache ───────────────────────────────────────────────
_CACHE: dict = {}
_CACHE_EXP: dict = {}
CACHE_TTL = 300  # 5 minutes

def _cache_get(key: str):
    if key in _CACHE and time.time() < _CACHE_EXP.get(key, 0):
        return _CACHE[key]
    return None

def _cache_set(key: str, val):
    _CACHE[key] = val
    _CACHE_EXP[key] = time.time() + CACHE_TTL

# ─── Shorter-timeout Finnhub helper for this module ───────────────────────────
def _fh(endpoint: str, params: dict, timeout: int = 6) -> dict | list:
    params = dict(params, token=API_KEY)
    try:
        r = requests.get(
            f"https://finnhub.io/api/v1{endpoint}",
            params=params, timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return {}


def _safe(v, decimals: int = 2):
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, decimals)
    except Exception:
        return None


# ─── Individual data fetchers (called concurrently) ───────────────────────────

def _fetch_profile(sym: str) -> dict:
    d = _fh("/stock/profile2", {"symbol": sym})
    return d if isinstance(d, dict) else {}


def _fetch_quote(sym: str) -> dict:
    d = _fh("/quote", {"symbol": sym})
    return d if isinstance(d, dict) else {}


def _fetch_metrics(sym: str) -> dict:
    d = _fh("/stock/metric", {"symbol": sym, "metric": "all"})
    return d if isinstance(d, dict) else {}


def _fetch_rec_trends(sym: str) -> list:
    d = _fh("/stock/recommendation", {"symbol": sym})
    return d if isinstance(d, list) else []


def _fetch_news(sym: str) -> list:
    today     = datetime.date.today()
    from_date = (today - datetime.timedelta(days=60)).strftime("%Y-%m-%d")
    to_date   = today.strftime("%Y-%m-%d")
    d = _fh("/company-news", {"symbol": sym, "from": from_date, "to": to_date}, timeout=7)
    if not isinstance(d, list):
        return []
    return [
        {
            "headline": item.get("headline", ""),
            "summary":  (item.get("summary", "")[:200] + "…")
                        if len(item.get("summary", "")) > 200 else item.get("summary", ""),
            "source":   item.get("source", ""),
            "url":      item.get("url", ""),
            "datetime": item.get("datetime", 0),
            "image":    item.get("image", ""),
        }
        for item in d[:6]
        if item.get("headline")
    ]


def _fetch_peers(sym: str) -> list:
    d = _fh("/stock/peers", {"symbol": sym}, timeout=5)
    if isinstance(d, list):
        return [s for s in d if isinstance(s, str) and s != sym][:4]
    return []


def _fetch_peer_detail(sym: str) -> dict:
    """Fetch quote + profile for a single peer concurrently."""
    with ThreadPoolExecutor(max_workers=2) as ex:
        fq = ex.submit(_fetch_quote,   sym)
        fp = ex.submit(_fetch_profile, sym)
        q  = fq.result(timeout=5)
        p  = fp.result(timeout=5)
    return {
        "symbol":     sym,
        "name":       p.get("name", sym),
        "price":      _safe(q.get("c"), 4),
        "change_pct": _safe(q.get("dp"), 4),
        "market_cap": _safe(p.get("marketCapitalization"), 0),
    }


# ─── AI / Rule-based recommendation ──────────────────────────────────────────

def _ai_rec(pe, debt_equity, roe, beta, gross_m, total_analysts, strong_buy, buy) -> dict:
    score = 0
    reasons = []

    if pe and pe > 0:
        if pe < 15:
            score += 2; reasons.append("Undervalued P/E (< 15×)")
        elif pe < 25:
            score += 1; reasons.append("Fairly valued P/E")
        else:
            score -= 1; reasons.append("Premium P/E (> 25×)")

    if debt_equity is not None:
        if debt_equity < 0.3:
            score += 2; reasons.append("Low leverage (D/E < 0.3×)")
        elif debt_equity < 0.8:
            score += 1; reasons.append("Moderate leverage")
        else:
            score -= 1; reasons.append("High leverage (D/E > 0.8×)")

    if roe is not None:
        if roe > 20:
            score += 2; reasons.append("Strong ROE (> 20%)")
        elif roe > 10:
            score += 1; reasons.append("Adequate ROE")
        else:
            score -= 1; reasons.append("Weak ROE (< 10%)")

    if beta is not None:
        if beta < 0.8:
            score += 1; reasons.append("Low volatility (β < 0.8)")
        elif beta > 1.5:
            score -= 1; reasons.append("High volatility (β > 1.5)")

    if gross_m and gross_m > 40:
        score += 1; reasons.append("Strong gross margin (> 40%)")

    if total_analysts > 0:
        bull_pct = (strong_buy + buy) / total_analysts
        if bull_pct > 0.6:
            score += 1; reasons.append(f"{int(bull_pct*100)}% analyst buy consensus")
        elif bull_pct < 0.35:
            score -= 1; reasons.append("Weak analyst consensus")

    if score >= 5:    rating, color = "STRONG BUY",  "#50DC78"
    elif score >= 3:  rating, color = "BUY",          "#7BC86C"
    elif score >= 1:  rating, color = "ACCUMULATE",   "#D4AF37"
    elif score == 0:  rating, color = "HOLD",         "#FB923C"
    elif score >= -2: rating, color = "REDUCE",       "#E87050"
    else:             rating, color = "SELL",         "#E55050"

    return {"rating": rating, "score": score, "color": color, "reasons": reasons}


# ─── Main endpoint ────────────────────────────────────────────────────────────

@router.get("/stock/{symbol}")
def get_stock_detail(symbol: str):
    sym = symbol.upper()

    # Serve from cache if warm
    cached = _cache_get(sym)
    if cached:
        return cached

    # Phase 1: fire all primary calls concurrently (profile, quote, metrics, rec, news)
    with ThreadPoolExecutor(max_workers=5) as ex:
        f_profile = ex.submit(_fetch_profile,    sym)
        f_quote   = ex.submit(_fetch_quote,      sym)
        f_metrics = ex.submit(_fetch_metrics,    sym)
        f_rec     = ex.submit(_fetch_rec_trends, sym)
        f_news    = ex.submit(_fetch_news,       sym)

        try:
            profile = f_profile.result(timeout=8)
            quote   = f_quote.result(timeout=8)
            metrics = f_metrics.result(timeout=8)
            rec     = f_rec.result(timeout=8)
            news    = f_news.result(timeout=10)
        except FutureTimeout:
            profile = f_profile.result() if f_profile.done() else {}
            quote   = f_quote.result()   if f_quote.done()   else {}
            metrics = {}
            rec     = []
            news    = []

    if not profile or not profile.get("name"):
        raise HTTPException(status_code=404, detail=f"Symbol '{sym}' not found on Finnhub.")

    metric = metrics.get("metric", {}) if isinstance(metrics, dict) else {}

    # Phase 2: fire peer calls concurrently (non-blocking — don't fail if slow)
    peers = []
    try:
        peer_syms = _fetch_peers(sym)
        if peer_syms:
            with ThreadPoolExecutor(max_workers=min(4, len(peer_syms))) as ex:
                futures = {ex.submit(_fetch_peer_detail, s): s for s in peer_syms}
                for f in as_completed(futures, timeout=8):
                    try:
                        peers.append(f.result(timeout=3))
                    except Exception:
                        pass
    except Exception:
        peers = []

    # ── Parse quote ──────────────────────────────────────────────────────────
    price      = _safe(quote.get("c"), 4)
    change     = _safe(quote.get("d"), 4)
    change_pct = _safe(quote.get("dp"), 4)
    high       = _safe(quote.get("h"), 4)
    low        = _safe(quote.get("l"), 4)
    prev_close = _safe(quote.get("pc"), 4)
    open_price = _safe(quote.get("o"), 4)

    # ── Market cap ────────────────────────────────────────────────────────────
    mkt_cap_m = _safe(profile.get("marketCapitalization"), 0)
    mkt_cap   = mkt_cap_m * 1_000_000 if mkt_cap_m else None
    shares    = _safe(profile.get("shareOutstanding"), 0)

    # ── Fundamental metrics ───────────────────────────────────────────────────
    pe         = _safe(metric.get("peBasicExclExtraTTM"))
    eps        = _safe(metric.get("epsBasicExclExtraAnnual"))
    pb         = _safe(metric.get("pbAnnual"))
    ps         = _safe(metric.get("psTTM"))
    ev_ebitda  = _safe(metric.get("enterpriseValueEbitdaTTM"))
    roe        = _safe(metric.get("roeTTM"))
    roa        = _safe(metric.get("roaTTM"))
    gross_m    = _safe(metric.get("grossMarginTTM"))
    net_margin = _safe(metric.get("netProfitMarginTTM"))
    op_margin  = _safe(metric.get("operatingMarginTTM"))
    revenue    = _safe(metric.get("revenueTTM"))
    ebitda_ps  = _safe(metric.get("ebitdaPerShareTTM"))
    debt_eq    = _safe(metric.get("totalDebt/totalEquityAnnual"))
    curr_r     = _safe(metric.get("currentRatioAnnual"))
    quick_r    = _safe(metric.get("quickRatioAnnual"))
    beta       = _safe(metric.get("beta"))
    w52_h      = _safe(metric.get("52WeekHigh"))
    w52_l      = _safe(metric.get("52WeekLow"))
    div_yield  = _safe(metric.get("dividendYieldIndicatedAnnual"))
    div_ps     = _safe(metric.get("dividendPerShareAnnual"))
    payout_r   = _safe(metric.get("payoutRatioAnnual"))
    fcf_ps     = _safe(metric.get("freeCashFlowAnnual"))
    book_v     = _safe(metric.get("bookValuePerShareAnnual"))

    # ── Enterprise Value (approx) ─────────────────────────────────────────────
    ev = None
    if ev_ebitda and ebitda_ps and shares:
        try:
            ev = _safe(ev_ebitda * ebitda_ps * shares * 1_000_000, 0)
        except Exception:
            ev = None

    # ── Analyst consensus ─────────────────────────────────────────────────────
    latest       = rec[0] if rec else {}
    strong_buy   = latest.get("strongBuy",  0)
    buy          = latest.get("buy",         0)
    hold         = latest.get("hold",        0)
    sell         = latest.get("sell",        0)
    strong_sell  = latest.get("strongSell",  0)
    total_ana    = strong_buy + buy + hold + sell + strong_sell

    # ── AI recommendation ─────────────────────────────────────────────────────
    ai_rec = _ai_rec(pe, debt_eq, roe, beta, gross_m, total_ana, strong_buy, buy)

    res = {
        # Identity
        "symbol":      sym,
        "name":        profile.get("name", sym),
        "exchange":    profile.get("exchange", ""),
        "sector":      profile.get("finnhubIndustry", ""),
        "country":     profile.get("country", ""),
        "currency":    profile.get("currency", "USD"),
        "logo":        profile.get("logo", ""),
        "weburl":      profile.get("weburl", ""),
        "ipo":         profile.get("ipo", ""),
        "shares":      shares,

        # Live quote
        "price":       price,
        "change":      change,
        "change_pct":  change_pct,
        "open":        open_price,
        "high":        high,
        "low":         low,
        "prev_close":  prev_close,

        # Market data
        "market_cap":  mkt_cap,
        "ev":          ev,
        "w52_high":    w52_h,
        "w52_low":     w52_l,
        "beta":        beta,

        # Valuation
        "pe":          pe,
        "pb":          pb,
        "ps":          ps,
        "eps":         eps,
        "ev_ebitda":   ev_ebitda,
        "book_value":  book_v,

        # Income / growth
        "revenue_ttm":  revenue,
        "gross_margin": gross_m,
        "op_margin":    op_margin,
        "net_margin":   net_margin,
        "ebitda_ps":    ebitda_ps,

        # Balance sheet / risk
        "debt_equity":  debt_eq,
        "curr_ratio":   curr_r,
        "quick_ratio":  quick_r,
        "roe":          roe,
        "roa":          roa,
        "fcf_ps":       fcf_ps,

        # Dividend
        "div_yield":    div_yield,
        "div_per_sh":   div_ps,
        "payout_ratio": payout_r,

        # Analyst
        "analyst": {
            "strong_buy":  strong_buy,
            "buy":         buy,
            "hold":        hold,
            "sell":        sell,
            "strong_sell": strong_sell,
            "total":       total_ana,
            "period":      latest.get("period", ""),
        },

        # AI
        "ai_rec": ai_rec,

        # News
        "news": news,

        # Peers
        "peers": peers,
    }

    _cache_set(sym, res)
    return res
