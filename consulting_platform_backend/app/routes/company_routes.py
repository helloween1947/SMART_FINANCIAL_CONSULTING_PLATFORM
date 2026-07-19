from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text

from app.database.db import engine

from app.services.finnhub_service import (
    get_company_profile,
    get_stock_quote
)

router = APIRouter()

# -----------------------------------
# Companies Endpoint
# -----------------------------------

@router.get("/companies")
def get_companies():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT *, finnhub_symbol FROM companies ORDER BY company_id")
        )
        companies = [dict(row._mapping) for row in result]
    return companies


# -----------------------------------
# Dashboard KPI Endpoint
# -----------------------------------

@router.get("/dashboard-kpis")
def dashboard_kpis():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    COUNT(*) AS total_companies,
                    AVG(market_cap) AS avg_market_cap,
                    MAX(market_cap) AS highest_market_cap,
                    MIN(market_cap) AS lowest_market_cap
                FROM companies
            """)
        )

        kpis = [dict(row._mapping) for row in result]

    return kpis


# -----------------------------------
# Risk Analysis Endpoint
# -----------------------------------

@router.get("/risk-analysis")
def risk_analysis():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    company_id,
                    company_name,
                    assets,
                    liabilities,
                    debt,
                    equity,
                    ROUND(debt / NULLIF(equity, 0), 2) AS debt_to_equity_ratio,
                    ROUND(liabilities / NULLIF(assets, 0), 2) AS liability_ratio
                FROM companies
            """)
        )

        risk_data = [dict(row._mapping) for row in result]

    return risk_data


# -----------------------------------
# Benchmark Endpoint
# -----------------------------------

@router.get("/benchmark")
def benchmark():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    company_id,
                    company_name,
                    market_cap,
                    assets,
                    equity,
                    debt
                FROM companies
            """)
        )

        companies = [dict(row._mapping) for row in result]

    if not companies:
        return []

    # Maximum values for ranking
    max_market_cap = max(float(c["market_cap"] or 0) for c in companies)
    max_assets = max(float(c["assets"] or 0) for c in companies)
    max_equity = max(float(c["equity"] or 0) for c in companies)

    benchmark_data = []

    for company in companies:

        market_cap = float(company["market_cap"] or 0)
        assets = float(company["assets"] or 0)
        equity = float(company["equity"] or 0)
        debt = float(company["debt"] or 0)

        market_cap_score = (
            (market_cap / max_market_cap) * 100
            if max_market_cap > 0 else 0
        )

        assets_score = (
            (assets / max_assets) * 100
            if max_assets > 0 else 0
        )

        equity_score = (
            (equity / max_equity) * 100
            if max_equity > 0 else 0
        )

        debt_penalty = min((debt / equity) * 10, 30) if equity > 0 else 30

        benchmark_score = round(
            (
                market_cap_score * 0.40
                + assets_score * 0.30
                + equity_score * 0.30
            )
            - debt_penalty,
            2
        )

        benchmark_data.append({
            "company_name": company["company_name"],
            "market_cap": market_cap,
            "assets": assets,
            "equity": equity,
            "debt": debt,
            "benchmark_score": benchmark_score
        })

    benchmark_data.sort(
        key=lambda x: x["benchmark_score"],
        reverse=True
    )

    return benchmark_data

# -----------------------------------
# Investment Score Endpoint
# -----------------------------------

@router.get("/investment-score")
def investment_score():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    company_name,
                    market_cap,
                    debt,
                    equity,
                    ROUND(debt / NULLIF(equity, 0), 2) AS debt_to_equity_ratio
                FROM companies
            """)
        )

        rows = result.fetchall()

    recommendations = []

    for row in rows:

        data = dict(row._mapping)

        ratio = float(data["debt_to_equity_ratio"] or 0)

        if ratio < 0.5:
            rating = "LOW RISK"
        elif ratio < 1.0:
            rating = "MODERATE RISK"
        else:
            rating = "HIGH RISK"

        data["investment_rating"] = rating

        recommendations.append(data)

    return recommendations

@router.get("/investment-score")
def investment_score():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    company_id,
                    company_name,
                    sector,
                    market_cap,
                    debt,
                    equity,

                    ROUND(
                        (
                            LEAST(market_cap / 1000, 50)
                            +
                            LEAST(
                                (equity / NULLIF(debt,0)) * 10,
                                50
                            )
                        ),2
                    ) AS investment_score

                FROM companies
            """)
        )

        data = [dict(row._mapping) for row in result]

    return data



@router.get("/live-company/{symbol}")
def live_company(symbol: str):

    profile = get_company_profile(symbol)

    quote = get_stock_quote(symbol)

    return {
        "profile": profile,
        "quote": quote
    }


# -----------------------------------
# Portfolio Management — Add Company
# -----------------------------------

class AddCompanyRequest(BaseModel):
    symbol:       str
    company_name: Optional[str] = None
    sector:       Optional[str] = None
    industry:     Optional[str] = None
    country:      Optional[str] = None
    founded_year: Optional[int] = None
    market_cap:   Optional[float] = None
    assets:       Optional[float] = None
    liabilities:  Optional[float] = None
    debt:         Optional[float] = None
    equity:       Optional[float] = None


from app.services.finnhub_service import get_basic_financials

@router.post("/companies", status_code=201)
def add_company(req: AddCompanyRequest):
    """
    Add a company to the portfolio.
    If only symbol is supplied, auto-enriches from Finnhub.
    Manual fields override the Finnhub data.
    """
    # 1. Fetch Finnhub data
    profile = get_company_profile(req.symbol.upper())
    metrics_raw = get_basic_financials(req.symbol.upper())
    metric = metrics_raw.get("metric", {}) if isinstance(metrics_raw, dict) else {}

    if not profile or not profile.get("name"):
        raise HTTPException(status_code=404, detail=f"Symbol '{req.symbol}' not found on Finnhub.")

    # 2. Resolve field values (manual overrides Finnhub)
    company_name = req.company_name or profile.get("name", req.symbol)
    sector       = req.sector       or profile.get("finnhubIndustry", "Unknown")
    industry     = req.industry     or profile.get("finnhubIndustry", "Unknown")
    country      = req.country      or profile.get("country", "US")

    # Founded year: parse from IPO date
    ipo_str = profile.get("ipo", "")
    try:
        founded_year = req.founded_year or (int(ipo_str[:4]) if ipo_str else None)
    except Exception:
        founded_year = req.founded_year

    # Market cap: Finnhub returns in $M — convert to full dollars
    market_cap_m = profile.get("marketCapitalization", 0) or 0
    market_cap   = req.market_cap or (market_cap_m * 1_000_000)

    # Financials from metrics (annual, in $M — convert to full dollars)
    def _m(key):
        v = metric.get(key)
        return float(v) * 1_000_000 if v is not None else None

    assets      = req.assets      or _m("totalAssetAnnual")
    debt        = req.debt        or _m("totalDebt/totalEquityAnnual")  # ratio, fall back
    equity      = req.equity      or _m("bookValuePerShareAnnual")
    liabilities = req.liabilities or (assets - equity if assets and equity else None)

    # 3. Check for duplicate (by symbol or company name)
    with engine.connect() as conn:
        dup = conn.execute(
            text("SELECT company_id FROM companies WHERE LOWER(finnhub_symbol) = LOWER(:sym) OR LOWER(company_name) = LOWER(:name)"),
            {"sym": req.symbol.upper(), "name": company_name}
        ).fetchone()
        if dup:
            raise HTTPException(status_code=409, detail=f"'{company_name}' ({req.symbol.upper()}) is already in the portfolio.")

    # 4. Insert into DB
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                INSERT INTO companies
                    (finnhub_symbol, company_name, sector, industry, country, founded_year,
                     market_cap, assets, liabilities, debt, equity)
                VALUES
                    (:finnhub_symbol, :company_name, :sector, :industry, :country, :founded_year,
                     :market_cap, :assets, :liabilities, :debt, :equity)
                RETURNING company_id
            """),
            {
                "finnhub_symbol": req.symbol.upper(),
                "company_name": company_name,
                "sector":       sector,
                "industry":     industry,
                "country":      country,
                "founded_year": founded_year,
                "market_cap":   market_cap,
                "assets":       assets,
                "liabilities":  liabilities,
                "debt":         debt,
                "equity":       equity,
            }
        )
        new_id = result.fetchone()[0]

    return {
        "message":    f"'{company_name}' added to portfolio.",
        "company_id": new_id,
        "company_name": company_name,
        "symbol":     req.symbol.upper(),
    }


# -----------------------------------
# Portfolio Management — Remove Company
# -----------------------------------

@router.delete("/companies/{company_id}", status_code=200)
def remove_company(company_id: int):
    """Remove a company and all its dependent data from the portfolio."""
    with engine.begin() as conn:
        # Verify company exists
        row = conn.execute(
            text("SELECT company_name FROM companies WHERE company_id = :id"),
            {"id": company_id}
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Company #{company_id} not found.")

        # Cascade-delete all dependent tables first
        conn.execute(text("DELETE FROM recommendations WHERE company_id = :id"), {"id": company_id})
        conn.execute(text("DELETE FROM financials     WHERE company_id = :id"), {"id": company_id})

        # Now safe to delete the company
        conn.execute(text("DELETE FROM companies WHERE company_id = :id"), {"id": company_id})

    return {"message": f"'{row[0]}' removed from portfolio.", "company_id": company_id}


# -----------------------------------
# Finnhub Preview — before adding
# -----------------------------------

@router.get("/companies/preview/{symbol}")
def preview_company(symbol: str):
    """
    Returns Finnhub enriched data for a symbol so the frontend
    can show a preview card before the user confirms add.
    """
    profile = get_company_profile(symbol.upper())
    if not profile or not profile.get("name"):
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found.")

    from app.services.finnhub_service import get_stock_quote
    quote   = get_stock_quote(symbol.upper())
    metrics = get_basic_financials(symbol.upper())
    metric  = metrics.get("metric", {}) if isinstance(metrics, dict) else {}

    price = float(quote.get("c") or 0)
    pc    = float(quote.get("pc") or 1)

    return {
        "symbol":       symbol.upper(),
        "name":         profile.get("name", ""),
        "sector":       profile.get("finnhubIndustry", ""),
        "country":      profile.get("country", ""),
        "exchange":     profile.get("exchange", ""),
        "logo":         profile.get("logo", ""),
        "weburl":       profile.get("weburl", ""),
        "market_cap_m": profile.get("marketCapitalization", 0),
        "price":        round(price, 2),
        "change_pct":   round((price - pc) / pc * 100, 2) if pc else 0,
        "pe_ratio":     metric.get("peBasicExclExtraTTM"),
        "roe":          metric.get("roeTTM"),
        "beta":         metric.get("beta"),
        "52w_high":     metric.get("52WeekHigh"),
        "52w_low":      metric.get("52WeekLow"),
    }