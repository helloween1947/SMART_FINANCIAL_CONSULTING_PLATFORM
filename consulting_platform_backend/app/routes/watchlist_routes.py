"""
Watchlist routes — full CRUD for multi-watchlist support.
Tables: watchlists, watchlist_items
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

# ─── Finnhub helpers ──────────────────────────────────────────────────────────

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

def _fetch_quote(sym: str) -> tuple[str, dict]:
    return sym, _fh("/quote", {"symbol": sym})

def _fetch_profile(sym: str) -> dict:
    d = _fh("/stock/profile2", {"symbol": sym})
    return d if isinstance(d, dict) else {}

def _batch_quotes(symbols: list[str]) -> dict[str, dict]:
    if not symbols:
        return {}
    quotes: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=min(10, len(symbols))) as ex:
        futures = {ex.submit(_fetch_quote, s): s for s in symbols}
        for f in as_completed(futures, timeout=10):
            try:
                sym, q = f.result(timeout=3)
                quotes[sym] = q
            except Exception:
                pass
    return quotes

# ─── Request schemas ──────────────────────────────────────────────────────────

class WatchlistRequest(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#D4AF37"

class AddItemRequest(BaseModel):
    symbol: str
    company_name: Optional[str] = None

# ─── Watchlist CRUD ───────────────────────────────────────────────────────────

@router.get("/watchlists")
def get_watchlists():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                w.watchlist_id,
                w.name,
                w.description,
                w.color,
                w.created_at,
                COUNT(wi.item_id) AS item_count,
                COUNT(CASE WHEN wi.is_favorite THEN 1 END) AS favorite_count
            FROM watchlists w
            LEFT JOIN watchlist_items wi ON w.watchlist_id = wi.watchlist_id
            GROUP BY w.watchlist_id
            ORDER BY w.watchlist_id
        """))
        return [dict(r._mapping) for r in rows]


@router.post("/watchlists", status_code=201)
def create_watchlist(req: WatchlistRequest):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")
    with engine.begin() as conn:
        dup = conn.execute(
            text("SELECT watchlist_id FROM watchlists WHERE LOWER(name)=LOWER(:n)"),
            {"n": name},
        ).fetchone()
        if dup:
            raise HTTPException(status_code=409, detail=f"'{name}' already exists")
        row = conn.execute(
            text("""
                INSERT INTO watchlists (name, description, color)
                VALUES (:name, :desc, :color)
                RETURNING watchlist_id
            """),
            {"name": name, "desc": req.description, "color": req.color or "#D4AF37"},
        ).fetchone()
    return {"watchlist_id": row[0], "name": name, "item_count": 0}


@router.put("/watchlists/{watchlist_id}")
def update_watchlist(watchlist_id: int, req: WatchlistRequest):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT watchlist_id FROM watchlists WHERE watchlist_id=:id"),
            {"id": watchlist_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        conn.execute(
            text("""
                UPDATE watchlists
                SET name=:name, description=:desc, color=:color
                WHERE watchlist_id=:id
            """),
            {"name": req.name, "desc": req.description,
             "color": req.color or "#D4AF37", "id": watchlist_id},
        )
    return {"message": "Updated"}


@router.delete("/watchlists/{watchlist_id}")
def delete_watchlist(watchlist_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT name FROM watchlists WHERE watchlist_id=:id"),
            {"id": watchlist_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        conn.execute(
            text("DELETE FROM watchlist_items WHERE watchlist_id=:id"),
            {"id": watchlist_id},
        )
        conn.execute(
            text("DELETE FROM watchlists WHERE watchlist_id=:id"),
            {"id": watchlist_id},
        )
    return {"message": f"'{row[0]}' deleted"}


# ─── Watchlist Items ──────────────────────────────────────────────────────────

@router.get("/watchlists/{watchlist_id}/items")
def get_items(watchlist_id: int):
    with engine.connect() as conn:
        wl = conn.execute(
            text("SELECT watchlist_id FROM watchlists WHERE watchlist_id=:id"),
            {"id": watchlist_id},
        ).fetchone()
        if not wl:
            raise HTTPException(status_code=404, detail="Watchlist not found")

        rows = conn.execute(
            text("""
                SELECT item_id, symbol, company_name, is_favorite, added_at
                FROM watchlist_items
                WHERE watchlist_id=:id
                ORDER BY is_favorite DESC, symbol ASC
            """),
            {"id": watchlist_id},
        )
        items = [dict(r._mapping) for r in rows]

    if not items:
        return []

    # Enrich with live quotes concurrently
    quotes = _batch_quotes([i["symbol"] for i in items])
    for item in items:
        q = quotes.get(item["symbol"], {})
        item["price"]      = _safe(q.get("c"), 4)
        item["change"]     = _safe(q.get("d"), 4)
        item["change_pct"] = _safe(q.get("dp"), 4)
        item["high"]       = _safe(q.get("h"), 4)
        item["low"]        = _safe(q.get("l"), 4)
        item["prev_close"] = _safe(q.get("pc"), 4)
        item["open"]       = _safe(q.get("o"), 4)
    return items


@router.post("/watchlists/{watchlist_id}/items", status_code=201)
def add_item(watchlist_id: int, req: AddItemRequest):
    sym = req.symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=422, detail="Symbol required")

    # Resolve company name from Finnhub if not provided
    company_name = (req.company_name or "").strip()
    if not company_name:
        profile = _fetch_profile(sym)
        company_name = profile.get("name", sym)
        if not profile.get("name"):
            raise HTTPException(
                status_code=404,
                detail=f"Symbol '{sym}' not found on Finnhub.",
            )

    with engine.begin() as conn:
        wl = conn.execute(
            text("SELECT watchlist_id FROM watchlists WHERE watchlist_id=:id"),
            {"id": watchlist_id},
        ).fetchone()
        if not wl:
            raise HTTPException(status_code=404, detail="Watchlist not found")

        dup = conn.execute(
            text("""
                SELECT item_id FROM watchlist_items
                WHERE watchlist_id=:wid AND UPPER(symbol)=:sym
            """),
            {"wid": watchlist_id, "sym": sym},
        ).fetchone()
        if dup:
            raise HTTPException(
                status_code=409, detail=f"{sym} is already in this watchlist"
            )

        conn.execute(
            text("""
                INSERT INTO watchlist_items (watchlist_id, symbol, company_name)
                VALUES (:wid, :sym, :name)
            """),
            {"wid": watchlist_id, "sym": sym, "name": company_name},
        )

    return {"symbol": sym, "company_name": company_name, "message": f"{sym} added"}


@router.delete("/watchlists/{watchlist_id}/items/{symbol}")
def remove_item(watchlist_id: int, symbol: str):
    sym = symbol.upper()
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                SELECT item_id FROM watchlist_items
                WHERE watchlist_id=:wid AND UPPER(symbol)=:sym
            """),
            {"wid": watchlist_id, "sym": sym},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"{sym} not in watchlist")
        conn.execute(
            text("""
                DELETE FROM watchlist_items
                WHERE watchlist_id=:wid AND UPPER(symbol)=:sym
            """),
            {"wid": watchlist_id, "sym": sym},
        )
    return {"message": f"{sym} removed"}


@router.patch("/watchlists/{watchlist_id}/items/{symbol}/favorite")
def toggle_favorite(watchlist_id: int, symbol: str):
    sym = symbol.upper()
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                SELECT item_id, is_favorite FROM watchlist_items
                WHERE watchlist_id=:wid AND UPPER(symbol)=:sym
            """),
            {"wid": watchlist_id, "sym": sym},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")
        new_fav = not row[1]
        conn.execute(
            text("""
                UPDATE watchlist_items SET is_favorite=:fav
                WHERE watchlist_id=:wid AND UPPER(symbol)=:sym
            """),
            {"fav": new_fav, "wid": watchlist_id, "sym": sym},
        )
    return {"symbol": sym, "is_favorite": new_fav}
