from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.db import SessionLocal

router = APIRouter()

@router.get("/dashboard-kpis")

def dashboard_kpis():

    db: Session = SessionLocal()

    query = text("""

        SELECT

            COUNT(*) AS total_companies,

            AVG(market_cap) AS avg_market_cap,

            MAX(market_cap) AS highest_market_cap,

            MIN(market_cap) AS lowest_market_cap

        FROM companies

    """)

    result = db.execute(query).fetchall()

    return [dict(row._mapping) for row in result]