"""
AI Investment Recommendation Engine
Multi-factor scoring → Buy / Hold / Sell signal + Morningstar-style explanation
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests, math

from app.services.finnhub_service import API_KEY

router = APIRouter()

# ─── Sector classification ────────────────────────────────────────────────────
GROWTH_SECTORS = {
    "Technology", "Semiconductors", "Software—Application",
    "Software—Infrastructure", "Internet Content & Information",
    "Communication Services", "Biotechnology", "Electronic Components",
}

# ─── HTTP helper ──────────────────────────────────────────────────────────────
def _fh(endpoint: str, params: dict, timeout: int = 6) -> dict | list:
    try:
        r = requests.get(
            f"https://finnhub.io/api/v1{endpoint}",
            params=dict(params, token=API_KEY),
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return {}


def _safe(v, allow_zero: bool = False) -> float | None:
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        if not allow_zero and f == 0:
            return None
        return f
    except Exception:
        return None


# ─── Scoring Components (each returns score -10..+10, detail str) ─────────────

def _score_valuation(m: dict, sector: str) -> tuple[float, str]:
    pe = _safe(m.get("peNormalizedAnnual") or m.get("peTTM"))
    pb = _safe(m.get("pbAnnual") or m.get("pbQuarterly"))
    is_growth = sector in GROWTH_SECTORS
    total, count, details = 0.0, 0, []

    if pe and pe > 0:
        count += 1
        if is_growth:
            buckets = [(15, 9), (25, 6.5), (40, 3), (60, 0), (100, -5), (1e9, -9)]
        else:
            buckets = [(10, 9), (15, 6.5), (22, 3), (30, 0), (45, -5), (1e9, -9)]
        for thresh, s in buckets:
            if pe <= thresh:
                total += s; break
        label = "growth-adjusted" if is_growth else "sector-adjusted"
        details.append(f"P/E of {pe:.1f}x ({label})")

    if pb and pb > 0:
        count += 1
        for thresh, s in [(1, 8), (2, 5), (4, 2), (8, -2), (15, -6), (1e9, -9)]:
            if pb <= thresh:
                total += s; break
        details.append(f"P/B of {pb:.1f}x")

    score = (total / count) if count else 0
    detail = (
        ". ".join(details) + " — "
        + ("deep value" if score > 6 else "fair value" if score > 1 else
           "stretched valuation" if score < -3 else "moderate valuation")
    ) if details else "Valuation data unavailable"
    return min(10, max(-10, score)), detail


def _score_growth(m: dict) -> tuple[float, str]:
    rev3y   = _safe(m.get("revenueGrowth3Y"), True)
    rev5y   = _safe(m.get("revenueGrowth5Y"), True)
    eps3y   = _safe(m.get("epsGrowth3Y"), True)
    epsTTM  = _safe(m.get("epsGrowthTTMYoy"), True)
    total, count, details = 0.0, 0, []

    rev_g = rev3y if rev3y is not None else rev5y
    if rev_g is not None:
        count += 1
        # Finnhub returns decimals (0.15 = 15%) or sometimes pct form
        pct = rev_g * 100 if abs(rev_g) <= 5 else rev_g
        for thresh, s in [(25, 9), (15, 6.5), (8, 3.5), (3, 0.5), (-3, -3), (-15, -7), (-1e9, -9)]:
            if pct >= thresh:
                total += s; break
        details.append(f"Revenue CAGR {pct:+.1f}%")

    eps_g = eps3y if eps3y is not None else epsTTM
    if eps_g is not None:
        count += 1
        pct = eps_g * 100 if abs(eps_g) <= 5 else eps_g
        for thresh, s in [(20, 8), (10, 5), (0, 2), (-10, -3), (-1e9, -7)]:
            if pct >= thresh:
                total += s; break
        details.append(f"EPS CAGR {pct:+.1f}%")

    score = (total / count) if count else 0
    quality = "compounding at an exceptional rate" if score > 6 else \
              "demonstrating healthy growth" if score > 2 else \
              "showing stagnant fundamentals" if score < -2 else "growing modestly"
    detail = (". ".join(details) + f" — earnings power is {quality}") if details else "Growth data unavailable"
    return min(10, max(-10, score)), detail


def _score_financial_health(m: dict) -> tuple[float, str]:
    de  = _safe(m.get("totalDebt/totalEquityAnnual") or m.get("totalDebt/totalEquityQuarterly"))
    npm = _safe(m.get("netProfitMarginAnnual") or m.get("netProfitMarginTTM"), True)
    roe = _safe(m.get("roeAnnual") or m.get("roeTTM"), True)
    cr  = _safe(m.get("currentRatioAnnual") or m.get("currentRatioQuarterly"))
    total, count, details = 0.0, 0, []

    if de is not None:
        count += 1
        for thresh, s in [(0.2, 9), (0.5, 7), (1.0, 3), (2.0, -1), (4.0, -6), (1e9, -9)]:
            if de <= thresh:
                total += s; break
        details.append(f"D/E {de:.2f}x")

    if npm is not None:
        count += 1
        pct = npm * 100 if abs(npm) <= 5 else npm
        for thresh, s in [(25, 9), (15, 6.5), (8, 3.5), (3, 0.5), (0, -2), (-1e9, -7)]:
            if pct >= thresh:
                total += s; break
        details.append(f"Net margin {pct:.1f}%")

    if roe is not None:
        count += 1
        pct = roe * 100 if abs(roe) <= 5 else roe
        for thresh, s in [(25, 8), (15, 5), (8, 2), (0, -2), (-1e9, -7)]:
            if pct >= thresh:
                total += s; break
        details.append(f"ROE {pct:.1f}%")

    score = (total / count) if count else 0
    summary = ("fortress balance sheet" if score > 6 else
               "healthy financials" if score > 2 else
               "financially stressed" if score < -3 else "adequate financial health")
    detail = (". ".join(details) + f" — {summary}") if details else "Financial health data unavailable"
    return min(10, max(-10, score)), detail


def _score_momentum(quote: dict, m: dict) -> tuple[float, str]:
    curr   = _safe(quote.get("c"))
    pc     = _safe(quote.get("pc"))
    h52    = _safe(m.get("52WeekHigh"))
    l52    = _safe(m.get("52WeekLow"))
    total, count, details = 0.0, 0, []

    if curr and h52 and l52 and h52 > l52:
        count += 1
        pos = (curr - l52) / (h52 - l52)
        for thresh, s in [(0.85, 7), (0.65, 4), (0.40, 0), (0.20, -4), (-1, -7)]:
            if pos >= thresh:
                total += s; break
        from_high = (curr - h52) / h52 * 100
        details.append(
            f"Price at {pos*100:.0f}% of 52-week range "
            f"(${l52:.2f} – ${h52:.2f})"
        )

    if curr and pc:
        count += 1
        chg = (curr - pc) / pc * 100
        for thresh, s in [(3, 5), (1, 2), (-1, 0), (-3, -3), (-1e9, -6)]:
            if chg >= thresh:
                total += s; break
        details.append(f"Day change {chg:+.2f}%")

    score = (total / count) if count else 0
    trend = ("strong bullish momentum" if score > 5 else
             "positive technical setup" if score > 1 else
             "bearish technical setup" if score < -3 else "neutral technicals")
    detail = (". ".join(details) + f" — {trend}") if details else "Momentum data unavailable"
    return min(10, max(-10, score)), detail


def _score_analyst(recs: list) -> tuple[float, str]:
    if not isinstance(recs, list) or not recs:
        return 0.0, "No analyst coverage available"
    r   = recs[0]
    sb  = int(r.get("strongBuy", 0))
    b   = int(r.get("buy", 0))
    h   = int(r.get("hold", 0))
    s   = int(r.get("sell", 0))
    ss  = int(r.get("strongSell", 0))
    tot = sb + b + h + s + ss
    if tot == 0:
        return 0.0, "No analyst ratings on record"
    weighted   = sb * 2 + b * 1 + h * 0 + s * (-1) + ss * (-2)
    normalized = (weighted / (tot * 2)) * 10
    bull = (sb + b) / tot * 100
    bear = (s + ss) / tot * 100
    consensus = ("overwhelming Wall Street conviction" if normalized > 7 else
                 "strong analyst support" if normalized > 3 else
                 "neutral analyst stance" if normalized > -2 else
                 "analyst caution" if normalized > -5 else "strong analyst bearishness")
    detail = (
        f"{tot} analysts polled: {sb+b} Buy ({bull:.0f}%), "
        f"{h} Hold, {s+ss} Sell ({bear:.0f}%) — {consensus}"
    )
    return min(10, max(-10, normalized)), detail


def _score_risk(m: dict) -> tuple[float, str]:
    beta = _safe(m.get("beta"))
    if beta is None:
        return 0.0, "Volatility data unavailable"
    for thresh, s in [(0.5, 8), (0.8, 5), (1.2, 2), (1.6, -2), (2.0, -5), (1e9, -8)]:
        if beta <= thresh:
            label = ("very defensive" if s > 6 else "below-market volatility" if s > 3 else
                     "market-like risk" if s > 0 else "elevated volatility" if s > -4 else "high-risk")
            return min(10, max(-10, float(s))), f"Beta {beta:.2f} — {label}"
    return 0.0, f"Beta {beta:.2f}"


# ─── Summary generator ────────────────────────────────────────────────────────
_RATING_PHRASE = {
    "Strong Buy":  ("an exceptional risk/reward opportunity", "We recommend aggressive accumulation"),
    "Buy":         ("an attractive entry point",              "We recommend initiating or adding positions"),
    "Hold":        ("a fairly valued hold",                   "We recommend maintaining current allocation"),
    "Sell":        ("a risk-elevated position",               "We recommend reducing exposure"),
    "Strong Sell": ("a materially overvalued or distressed asset", "We recommend exiting positions"),
}

def _generate_summary(
    name: str, sym: str, rating: str,
    score: float, signals: list,
    profile: dict, m: dict,
) -> str:
    sector = profile.get("finnhubIndustry", "")
    pe     = _safe(m.get("peNormalizedAnnual") or m.get("peTTM"))
    de     = _safe(m.get("totalDebt/totalEquityAnnual"))
    npm_raw= _safe(m.get("netProfitMarginAnnual") or m.get("netProfitMarginTTM"), True)
    npm    = (npm_raw * 100 if npm_raw and abs(npm_raw) <= 5 else npm_raw) if npm_raw else None
    phrase, action = _RATING_PHRASE.get(rating, ("under review", "Review position"))

    best  = max(signals, key=lambda s: s["score"])
    worst = min(signals, key=lambda s: s["score"])

    para  = (
        f"{name} ({sym}) screens as {phrase} on our institutional-grade multi-factor model, "
        f"earning a composite score of {score:.1f}/10 across six analytical dimensions. "
    )

    if best["score"] > 4:
        para += (
            f"The company's most compelling attribute is its **{best['name'].lower()}** profile, "
            f"which scores {best['score']:.1f}/10 and represents a meaningful margin of safety. "
        )

    if pe:
        context = (
            "compelling relative to growth potential" if pe < 20 and sector in GROWTH_SECTORS
            else "reasonable for the sector" if pe < 25
            else "elevated, pricing in continued execution"
        )
        para += f"At {pe:.1f}x normalized earnings, valuation is {context}. "

    if de:
        balance = "fortress-like" if de < 0.3 else "conservative" if de < 0.7 else "moderate" if de < 1.5 else "stressed"
        para += f"The balance sheet is {balance} at {de:.2f}x Debt/Equity. "

    if worst["score"] < -2:
        para += (
            f"Investors should note headwinds in **{worst['name'].lower()}** "
            f"(score: {worst['score']:.1f}/10), which constrains our overall conviction. "
        )

    para += f"{action} at current prices based on the prevailing risk/reward profile."
    return para


# ─── Main Endpoint ────────────────────────────────────────────────────────────

@router.get("/ai/recommendation/{symbol}")
def get_recommendation(symbol: str):
    sym = symbol.strip().upper()
    if not sym:
        raise HTTPException(422, "Symbol required")

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {
            "profile":  ex.submit(_fh, "/stock/profile2",      {"symbol": sym}),
            "quote":    ex.submit(_fh, "/quote",                {"symbol": sym}),
            "metrics":  ex.submit(_fh, "/stock/metric",         {"symbol": sym, "metric": "all"}),
            "recs":     ex.submit(_fh, "/stock/recommendation", {"symbol": sym}),
        }
        results = {k: v.result(timeout=12) for k, v in futures.items()}

    profile = results["profile"]
    if not profile or not profile.get("name"):
        raise HTTPException(404, f"Symbol '{sym}' not found on Finnhub")

    quote  = results["quote"] or {}
    m_raw  = results["metrics"]
    recs   = results["recs"]
    m      = m_raw.get("metric", {}) if isinstance(m_raw, dict) else {}
    sector = profile.get("finnhubIndustry", "Other")
    name   = profile.get("name", sym)

    # Score
    s_val,  d_val  = _score_valuation(m, sector)
    s_gr,   d_gr   = _score_growth(m)
    s_fh,   d_fh   = _score_financial_health(m)
    s_mom,  d_mom  = _score_momentum(quote, m)
    s_an,   d_an   = _score_analyst(recs if isinstance(recs, list) else [])
    s_rk,   d_rk   = _score_risk(m)

    W = dict(valuation=0.20, growth=0.25, health=0.20, momentum=0.15, analyst=0.15, risk=0.05)
    composite = (
        s_val * W["valuation"] + s_gr * W["growth"] + s_fh * W["health"] +
        s_mom * W["momentum"]  + s_an * W["analyst"] + s_rk * W["risk"]
    )

    if   composite >= 5.5:  rating, rc, rbg = "Strong Buy",  "#50DC78", "rgba(80,220,120,0.12)"
    elif composite >= 2.0:  rating, rc, rbg = "Buy",         "#4ADE80", "rgba(74,222,128,0.10)"
    elif composite >= -2.0: rating, rc, rbg = "Hold",        "#D4AF37", "rgba(212,175,55,0.10)"
    elif composite >= -5.5: rating, rc, rbg = "Sell",        "#FB923C", "rgba(251,146,60,0.10)"
    else:                   rating, rc, rbg = "Strong Sell", "#E55050", "rgba(229,80,80,0.12)"

    # Confidence
    data_count = sum([
        m.get("peNormalizedAnnual") is not None or m.get("peTTM") is not None,
        m.get("totalDebt/totalEquityAnnual") is not None,
        m.get("netProfitMarginAnnual") is not None or m.get("netProfitMarginTTM") is not None,
        m.get("revenueGrowth3Y") is not None,
        m.get("beta") is not None,
        isinstance(recs, list) and len(recs) > 0,
    ])
    confidence = int((min(abs(composite) / 10, 1) * 0.55 + (data_count / 6) * 0.45) * 100)

    signals = [
        {"name": "Valuation",         "score": round(s_val, 1), "detail": d_val,  "weight": 20},
        {"name": "Growth",            "score": round(s_gr,  1), "detail": d_gr,   "weight": 25},
        {"name": "Financial Health",  "score": round(s_fh,  1), "detail": d_fh,   "weight": 20},
        {"name": "Momentum",          "score": round(s_mom, 1), "detail": d_mom,  "weight": 15},
        {"name": "Analyst Consensus", "score": round(s_an,  1), "detail": d_an,   "weight": 15},
        {"name": "Risk / Volatility", "score": round(s_rk,  1), "detail": d_rk,   "weight": 5},
    ]

    summary = _generate_summary(name, sym, rating, composite, signals, profile, m)

    # Key display metrics
    npm_raw = _safe(m.get("netProfitMarginAnnual") or m.get("netProfitMarginTTM"), True)
    roe_raw = _safe(m.get("roeAnnual") or m.get("roeTTM"), True)
    rg3y    = _safe(m.get("revenueGrowth3Y"), True)

    # Analyst distribution history (last 4 periods)
    analyst_history = []
    if isinstance(recs, list):
        for r in recs[:4]:
            sb  = int(r.get("strongBuy", 0))
            b   = int(r.get("buy", 0))
            h   = int(r.get("hold", 0))
            s   = int(r.get("sell", 0))
            ss  = int(r.get("strongSell", 0))
            analyst_history.append({
                "period":     r.get("period", ""),
                "strongBuy":  sb,
                "buy":        b,
                "hold":       h,
                "sell":       s,
                "strongSell": ss,
                "total":      sb + b + h + s + ss,
            })

    return {
        "symbol":      sym,
        "name":        name,
        "sector":      sector,
        "exchange":    profile.get("exchange", ""),
        "logo":        profile.get("logo", ""),
        "weburl":      profile.get("weburl", ""),
        "rating":      rating,
        "rating_color":rc,
        "badge_bg":    rbg,
        "score":       round(composite, 2),
        "confidence":  confidence,
        "summary":     summary,
        "signals":     signals,
        "key_metrics": {
            "price":           _safe(quote.get("c")),
            "change_pct":      _safe(quote.get("dp"), True),
            "pe":              _safe(m.get("peNormalizedAnnual") or m.get("peTTM")),
            "pb":              _safe(m.get("pbAnnual")),
            "debt_equity":     _safe(m.get("totalDebt/totalEquityAnnual")),
            "net_margin":      (npm_raw * 100 if npm_raw and abs(npm_raw) <= 5 else npm_raw),
            "roe":             (roe_raw * 100 if roe_raw and abs(roe_raw) <= 5 else roe_raw),
            "revenue_growth":  (rg3y * 100 if rg3y and abs(rg3y) <= 5 else rg3y),
            "beta":            _safe(m.get("beta")),
            "div_yield":       _safe(m.get("dividendYieldIndicatedAnnual"), True),
            "52w_high":        _safe(m.get("52WeekHigh")),
            "52w_low":         _safe(m.get("52WeekLow")),
            "market_cap":      _safe(profile.get("marketCapitalization")),
            "eps_growth":      _safe(m.get("epsGrowth3Y"), True),
        },
        "analyst_history": analyst_history,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
