"""
News Intelligence Engine
Fetches Finnhub news, scores sentiment, generates AI digest summaries
"""
from __future__ import annotations
from fastapi import APIRouter, Query
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
import requests, re, math

from app.services.finnhub_service import API_KEY

router = APIRouter()

# ─── HTTP helper ──────────────────────────────────────────────────────────────
def _fh(endpoint: str, params: dict, timeout: int = 8):
    try:
        r = requests.get(
            f"https://finnhub.io/api/v1{endpoint}",
            params=dict(params, token=API_KEY),
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return []


# ─── Sentiment Lexicon ────────────────────────────────────────────────────────
BULLISH_STRONG = {
    "surges","soars","skyrockets","explodes","blowout","record high","all-time high",
    "massive beat","crushes","smashes","blockbuster","exceptional","outstanding",
    "breakthrough","revolutionary","landmark","transformative","record earnings",
    "blowout quarter","all-time",
}
BULLISH_MOD = {
    "growth","profit","gains","rally","upgrade","buy","bullish","outperform",
    "beats","strong","rises","advances","climbs","positive","expansion","raises",
    "dividend","approval","acquisition","partnership","deal","launch","record",
    "recovery","rebound","turnaround","momentum","overweight","accumulate","adds",
    "increases","improve","innovative","invests","wins","awarded","selected",
    "accelerates","expands","raises guidance","top line","margin expansion",
    "cash flow","buyback","repurchase","upside","exceeds","outpaces","boosted",
    "breakout","surge","doubles","triples","boosts","green","optimistic",
}
BEARISH_STRONG = {
    "plunges","crashes","collapses","bankruptcy","default","fraud","criminal",
    "massive loss","catastrophic","devastating","crisis","meltdown",
    "blow-up","implosion","scandal","indicted","arrested","war","attack",
    "bombed","explosion","military strike","armed conflict","invasion",
}
BEARISH_MOD = {
    "decline","loss","misses","cut","downgrade","sell","bearish","underperform",
    "falls","drops","slides","negative","contraction","lowers","layoffs","warns",
    "warning","lawsuit","investigation","probe","fine","penalty","recall","delay",
    "disappoints","weak","below","guidance cut","headwinds","pressure","concern",
    "debt","deficit","shortfall","charges","write-off","impairment","underweight",
    "avoid","restructuring","job cuts","dismissed","suspended","violated",
    "strikes","closed","halted","abandoned","sanctions","tariff","tariffs",
    "geopolitical","tensions","conflict","hostilities","escalation","disruption",
    "shutdown","blockade","inflation","recession","slowdown","stagflation",
    "downward","losses","red","selloff","sell-off","plunge","slump","tumbles",
    "sinks","retreats","dips","miss","disappointed","shortfall","risk","risks",
}
NEUTRAL_TERMS = {
    "reports","announces","says","plans","expects","estimates","quarterly",
    "fiscal","update","meeting","conference","presentation","filing",
}


def _score_text(text: str) -> float:
    """Returns sentiment score -1.0 to +1.0"""
    if not text:
        return 0.0
    t = text.lower()
    score = 0.0
    # Strong signals
    for w in BULLISH_STRONG:
        if w in t: score += 2.0
    for w in BEARISH_STRONG:
        if w in t: score -= 2.0
    # Moderate signals
    for w in BULLISH_MOD:
        if re.search(r'\b' + re.escape(w) + r'\b', t): score += 1.0
    for w in BEARISH_MOD:
        if re.search(r'\b' + re.escape(w) + r'\b', t): score -= 1.0
    # Clamp and normalize to -1..+1
    return max(-1.0, min(1.0, score / 5.0))


def _sentiment_label(score: float) -> tuple[str, str]:
    """Returns (label, color)"""
    if   score >=  0.35: return "Bullish",          "#50DC78"
    elif score >=  0.12: return "Slightly Bullish",  "#4ADE80"
    elif score >= -0.12: return "Neutral",            "#D4AF37"
    elif score >= -0.35: return "Slightly Bearish",   "#FB923C"
    else:                return "Bearish",            "#E55050"


def _enrich_article(art: dict) -> dict:
    """Add sentiment fields to a raw Finnhub article"""
    headline = art.get("headline", "")
    summary  = art.get("summary", "")
    combined = headline + " " + summary
    score    = _score_text(combined)
    label, color = _sentiment_label(score)

    # Clean summary — strip HTML tags and Finnhub encoding artifacts
    clean_sum = re.sub(r'<[^>]+>', '', summary)
    # Remove non-printable/control characters and â€‹, Â·, Â type artifacts
    clean_sum = re.sub(r'[\x80-\x9f\xc2\xa0]+', ' ', clean_sum)
    clean_sum = re.sub(r'A[·\xb7\xa0\xc2]{1,3}', '', clean_sum)  # common Finnhub artifact
    clean_sum = re.sub(r'\s{2,}', ' ', clean_sum).strip()
    clean_sum = clean_sum[:420] + "…" if len(clean_sum) > 420 else clean_sum

    ts = art.get("datetime", 0)
    dt = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)
    age_h = (datetime.now(timezone.utc) - dt).total_seconds() / 3600

    return {
        "id":           art.get("id", 0),
        "headline":     headline,
        "summary":      clean_sum,
        "source":       art.get("source", "Unknown"),
        "url":          art.get("url", ""),
        "image":        art.get("image", ""),
        "category":     art.get("category", "general"),
        "related":      art.get("related", ""),
        "timestamp":    dt.isoformat(),
        "age_h":        round(age_h, 1),
        "sentiment_score": round(score, 3),
        "sentiment_label": label,
        "sentiment_color": color,
    }


# ─── AI Digest Generator ──────────────────────────────────────────────────────
def _build_digest(articles: list[dict], context: str = "market") -> dict:
    """
    Build an AI-style narrative digest from enriched articles.
    Returns: { summary, overall_score, overall_label, overall_color, distribution }
    """
    if not articles:
        return {
            "summary": "No recent news available.",
            "overall_score": 0,
            "overall_label": "Neutral",
            "overall_color": "#D4AF37",
            "distribution": {"bullish": 0, "neutral": 0, "bearish": 0},
        }

    scores = [a["sentiment_score"] for a in articles]
    overall = sum(scores) / len(scores)
    label, color = _sentiment_label(overall)

    bullish  = [a for a in articles if a["sentiment_score"] >= 0.12]
    bearish  = [a for a in articles if a["sentiment_score"] <= -0.12]
    neutral  = [a for a in articles if -0.12 < a["sentiment_score"] < 0.12]

    dist = {
        "bullish": len(bullish),
        "neutral":  len(neutral),
        "bearish": len(bearish),
    }
    total = len(articles)
    bull_pct = int(len(bullish) / total * 100) if total else 0
    bear_pct = int(len(bearish) / total * 100) if total else 0

    # Extract key themes from top headlines
    top_bull = sorted(bullish, key=lambda x: x["sentiment_score"], reverse=True)[:3]
    top_bear = sorted(bearish, key=lambda x: x["sentiment_score"])[:3]
    sources  = list({a["source"] for a in articles[:10]})[:5]

    # Build narrative
    if context == "market":
        intro = f"Across {total} articles from {', '.join(sources[:3])} and other outlets, "
    else:
        intro = f"Based on {total} recent news items, "

    tone = (
        "the overall news flow is decidedly optimistic"    if overall >= 0.35 else
        "the news tone leans constructive"                  if overall >= 0.12 else
        "sentiment is broadly neutral with mixed signals"   if overall >= -0.12 else
        "the news flow carries a cautious, risk-off tone"   if overall >= -0.35 else
        "the news environment is markedly negative"
    )

    body = f"{intro}{tone} (composite score: {overall:+.2f}). "
    body += f"{bull_pct}% of articles carry bullish signals while {bear_pct}% are bearish. "

    if top_bull:
        body += f"Notable positive catalysts include: **{top_bull[0]['headline'][:80]}**"
        if len(top_bull) > 1:
            body += f" and **{top_bull[1]['headline'][:70]}**"
        body += ". "

    if top_bear:
        body += f"Key risk headlines: **{top_bear[0]['headline'][:80]}**"
        if len(top_bear) > 1:
            body += f" and **{top_bear[1]['headline'][:70]}**"
        body += ". "

    body += (
        "Investors are advised to position accordingly and monitor developing stories closely."
        if overall < 0 else
        "Market participants appear receptive to the positive narrative, though selective risk management remains prudent."
    )

    return {
        "summary":        body,
        "overall_score":  round(overall, 3),
        "overall_label":  label,
        "overall_color":  color,
        "distribution":   dist,
        "article_count":  total,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/news/market")
def get_market_news(
    category: str = Query("general", description="general | forex | crypto | merger"),
    limit: int    = Query(40,  le=100),
):
    raw = _fh("/news", {"category": category}) or []
    raw = raw[:limit]
    articles = [_enrich_article(a) for a in raw if a.get("headline")]
    digest   = _build_digest(articles, context="market")
    return {
        "category":  category,
        "articles":  articles,
        "digest":    digest,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/news/stock/{symbol}")
def get_stock_news(
    symbol: str,
    days:   int = Query(7,  le=30),
    limit:  int = Query(30, le=60),
):
    sym = symbol.strip().upper()
    to_dt   = datetime.now(timezone.utc)
    from_dt = to_dt - timedelta(days=days)

    def fetch_news():
        return _fh("/company-news", {
            "symbol": sym,
            "from":   from_dt.strftime("%Y-%m-%d"),
            "to":     to_dt.strftime("%Y-%m-%d"),
        })

    def fetch_profile():
        try:
            r = requests.get(
                "https://finnhub.io/api/v1/stock/profile2",
                params={"symbol": sym, "token": API_KEY},
                timeout=6,
            )
            return r.json()
        except Exception:
            return {}

    with ThreadPoolExecutor(max_workers=2) as ex:
        nf = ex.submit(fetch_news)
        pf = ex.submit(fetch_profile)
        raw     = nf.result(timeout=12) or []
        profile = pf.result(timeout=10) or {}

    raw      = raw[:limit]
    articles = [_enrich_article(a) for a in raw if a.get("headline")]
    digest   = _build_digest(articles, context=sym)

    return {
        "symbol":     sym,
        "name":       profile.get("name", sym),
        "logo":       profile.get("logo", ""),
        "sector":     profile.get("finnhubIndustry", ""),
        "days":       days,
        "articles":   articles,
        "digest":     digest,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
