"""
Portfolio Tracker routes — CRUD + live P/L calculation.
Tables: portfolios, portfolio_holdings
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests, math

from app.database.db import engine
from app.services.finnhub_service import API_KEY

router = APIRouter()

# ─── Helpers ────────────────────────────────────────────────────────────────

def _safe(v, d: int = 2):
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, d)
    except Exception:
        return None

def _fh(endpoint: str, params: dict, timeout: int = 5):
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

def _fetch_quote_pair(sym: str) -> tuple:
    return sym, _fh("/quote", {"symbol": sym})

def _fetch_profile(sym: str) -> dict:
    d = _fh("/stock/profile2", {"symbol": sym})
    return d if isinstance(d, dict) else {}

def _batch_quotes(symbols: list) -> dict:
    if not symbols:
        return {}
    quotes: dict = {}
    with ThreadPoolExecutor(max_workers=min(10, len(symbols))) as ex:
        futures = {ex.submit(_fetch_quote_pair, s): s for s in symbols}
        for f in as_completed(futures, timeout=12):
            try:
                sym, q = f.result(timeout=4)
                quotes[sym] = q
            except Exception:
                pass
    return quotes

# ─── Request Schemas ─────────────────────────────────────────────────────────

class PortfolioRequest(BaseModel):
    name: str

class HoldingRequest(BaseModel):
    symbol: str
    quantity: float
    buy_price: float
    company_name: Optional[str] = None
    sector: Optional[str] = None

class UpdateHoldingRequest(BaseModel):
    quantity: float
    buy_price: float

# ─── Portfolio CRUD ─────────────────────────────────────────────────────────

@router.get("/portfolios")
def get_portfolios():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT p.portfolio_id, p.name, p.created_at,
                   COUNT(ph.holding_id)                   AS holding_count,
                   COALESCE(SUM(ph.quantity * ph.buy_price), 0) AS total_cost
            FROM portfolios p
            LEFT JOIN portfolio_holdings ph ON p.portfolio_id = ph.portfolio_id
            GROUP BY p.portfolio_id
            ORDER BY p.portfolio_id
        """))
        return [dict(r._mapping) for r in rows]


@router.post("/portfolios", status_code=201)
def create_portfolio(req: PortfolioRequest):
    name = req.name.strip()
    if not name:
        raise HTTPException(422, "Name cannot be empty")
    with engine.begin() as conn:
        row = conn.execute(
            text("INSERT INTO portfolios (name) VALUES (:n) RETURNING portfolio_id"),
            {"n": name},
        ).fetchone()
    return {"portfolio_id": row[0], "name": name, "holding_count": 0}


@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio(portfolio_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT name FROM portfolios WHERE portfolio_id=:id"),
            {"id": portfolio_id},
        ).fetchone()
        if not row:
            raise HTTPException(404, "Portfolio not found")
        conn.execute(
            text("DELETE FROM portfolio_holdings WHERE portfolio_id=:id"),
            {"id": portfolio_id},
        )
        conn.execute(
            text("DELETE FROM portfolios WHERE portfolio_id=:id"),
            {"id": portfolio_id},
        )
    return {"message": f"'{row[0]}' deleted"}

# ─── Portfolio Summary (main data endpoint) ──────────────────────────────────

@router.get("/portfolios/{portfolio_id}/summary")
def get_portfolio_summary(portfolio_id: int):
    with engine.connect() as conn:
        pf = conn.execute(
            text("SELECT portfolio_id, name FROM portfolios WHERE portfolio_id=:id"),
            {"id": portfolio_id},
        ).fetchone()
        if not pf:
            raise HTTPException(404, "Portfolio not found")

        rows = conn.execute(
            text("""
                SELECT holding_id, symbol, company_name, sector,
                       quantity, buy_price, added_at
                FROM portfolio_holdings
                WHERE portfolio_id=:id
                ORDER BY symbol
            """),
            {"id": portfolio_id},
        )
        holdings = [dict(r._mapping) for r in rows]

    empty_summary = {
        "total_value": 0, "total_cost": 0, "total_pl": 0,
        "total_pl_pct": 0, "daily_pl": 0, "holding_count": 0,
    }
    if not holdings:
        return {
            "portfolio_id": portfolio_id, "name": pf[1],
            "holdings": [], "summary": empty_summary,
            "sector_exposure": [], "allocation": [],
        }

    # Concurrent live quotes
    quotes = _batch_quotes([h["symbol"] for h in holdings])

    total_value = 0.0
    total_cost  = 0.0
    total_daily = 0.0

    for h in holdings:
        q          = quotes.get(h["symbol"], {})
        curr_price = _safe(q.get("c"), 4)
        prev_close = _safe(q.get("pc"), 4)
        qty        = float(h["quantity"])
        buy        = float(h["buy_price"])
        cost       = qty * buy

        h["quantity"]      = qty
        h["buy_price"]     = buy
        h["current_price"] = curr_price
        h["prev_close"]    = prev_close
        h["cost_basis"]    = round(cost, 2)

        if curr_price is not None:
            value   = qty * curr_price
            pl      = value - cost
            pl_pct  = (pl / cost * 100) if cost else 0
            daily   = qty * (curr_price - prev_close) if prev_close else 0

            h["current_value"] = round(value, 2)
            h["pl"]            = round(pl, 2)
            h["pl_pct"]        = round(pl_pct, 2)
            h["daily_pl"]      = round(daily, 2)

            total_value += value
            total_cost  += cost
            total_daily += daily
        else:
            total_cost      += cost
            h["current_value"] = None
            h["pl"]            = None
            h["pl_pct"]        = None
            h["daily_pl"]      = None

    # Allocation %
    for h in holdings:
        if h["current_value"] is not None and total_value > 0:
            h["allocation_pct"] = round(h["current_value"] / total_value * 100, 2)
        else:
            h["allocation_pct"] = None

    # Sector exposure
    sector_map: dict = {}
    for h in holdings:
        sector = (h.get("sector") or "Other").strip() or "Other"
        val    = h["current_value"] or h["cost_basis"] or 0
        sector_map[sector] = sector_map.get(sector, 0) + val

    sector_exposure = sorted(
        [
            {
                "sector": s,
                "value":  round(v, 2),
                "pct":    round(v / total_value * 100, 2) if total_value else 0,
            }
            for s, v in sector_map.items()
        ],
        key=lambda x: x["value"],
        reverse=True,
    )

    total_pl     = total_value - total_cost
    total_pl_pct = (total_pl / total_cost * 100) if total_cost else 0

    return {
        "portfolio_id": portfolio_id,
        "name":         pf[1],
        "holdings":     holdings,
        "summary": {
            "total_value":    round(total_value, 2),
            "total_cost":     round(total_cost, 2),
            "total_pl":       round(total_pl, 2),
            "total_pl_pct":   round(total_pl_pct, 2),
            "daily_pl":       round(total_daily, 2),
            "holding_count":  len(holdings),
        },
        "sector_exposure": sector_exposure,
        "allocation": [
            {
                "symbol": h["symbol"],
                "name":   h.get("company_name", h["symbol"]),
                "value":  h["current_value"] if h["current_value"] is not None else h["cost_basis"],
                "pct":    h.get("allocation_pct") or 0,
            }
            for h in holdings
        ],
    }

# ─── Holdings CRUD ───────────────────────────────────────────────────────────

@router.post("/portfolios/{portfolio_id}/holdings", status_code=201)
def add_holding(portfolio_id: int, req: HoldingRequest):
    sym = req.symbol.strip().upper()
    if not sym:
        raise HTTPException(422, "Symbol required")
    if req.quantity <= 0:
        raise HTTPException(422, "Quantity must be > 0")
    if req.buy_price <= 0:
        raise HTTPException(422, "Buy price must be > 0")

    company_name = (req.company_name or "").strip()
    sector       = (req.sector or "").strip()

    if not company_name or not sector:
        profile = _fetch_profile(sym)
        if not company_name:
            company_name = profile.get("name", sym)
            if not profile.get("name"):
                raise HTTPException(404, f"Symbol '{sym}' not found on Finnhub")
        if not sector:
            sector = profile.get("finnhubIndustry", "Other") or "Other"

    with engine.begin() as conn:
        pf = conn.execute(
            text("SELECT portfolio_id FROM portfolios WHERE portfolio_id=:id"),
            {"id": portfolio_id},
        ).fetchone()
        if not pf:
            raise HTTPException(404, "Portfolio not found")

        existing = conn.execute(
            text("""
                SELECT holding_id, quantity, buy_price
                FROM portfolio_holdings
                WHERE portfolio_id=:pid AND UPPER(symbol)=:sym
            """),
            {"pid": portfolio_id, "sym": sym},
        ).fetchone()

        if existing:
            old_qty   = float(existing[1])
            old_price = float(existing[2])
            new_qty   = old_qty + req.quantity
            avg_price = (old_qty * old_price + req.quantity * req.buy_price) / new_qty
            conn.execute(
                text("""
                    UPDATE portfolio_holdings
                    SET quantity=:qty, buy_price=:price
                    WHERE holding_id=:hid
                """),
                {"qty": new_qty, "price": round(avg_price, 4), "hid": existing[0]},
            )
            return {
                "symbol": sym, "message": "Position averaged",
                "quantity": new_qty, "avg_price": round(avg_price, 4),
            }

        conn.execute(
            text("""
                INSERT INTO portfolio_holdings
                    (portfolio_id, symbol, company_name, sector, quantity, buy_price)
                VALUES (:pid, :sym, :name, :sector, :qty, :price)
            """),
            {
                "pid": portfolio_id, "sym": sym,
                "name": company_name, "sector": sector,
                "qty": req.quantity, "price": req.buy_price,
            },
        )
    return {"symbol": sym, "company_name": company_name, "message": "Position added"}


@router.put("/portfolios/{portfolio_id}/holdings/{symbol}")
def update_holding(portfolio_id: int, symbol: str, req: UpdateHoldingRequest):
    sym = symbol.upper()
    if req.quantity <= 0 or req.buy_price <= 0:
        raise HTTPException(422, "Quantity and price must be > 0")
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                SELECT holding_id FROM portfolio_holdings
                WHERE portfolio_id=:pid AND UPPER(symbol)=:sym
            """),
            {"pid": portfolio_id, "sym": sym},
        ).fetchone()
        if not row:
            raise HTTPException(404, f"{sym} not in portfolio")
        conn.execute(
            text("UPDATE portfolio_holdings SET quantity=:qty, buy_price=:p WHERE holding_id=:hid"),
            {"qty": req.quantity, "p": req.buy_price, "hid": row[0]},
        )
    return {"message": "Updated"}


@router.delete("/portfolios/{portfolio_id}/holdings/{symbol}")
def remove_holding(portfolio_id: int, symbol: str):
    sym = symbol.upper()
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                SELECT holding_id FROM portfolio_holdings
                WHERE portfolio_id=:pid AND UPPER(symbol)=:sym
            """),
            {"pid": portfolio_id, "sym": sym},
        ).fetchone()
        if not row:
            raise HTTPException(404, f"{sym} not in portfolio")
        conn.execute(
            text("DELETE FROM portfolio_holdings WHERE holding_id=:hid"),
            {"hid": row[0]},
        )
    return {"message": f"{sym} removed"}
