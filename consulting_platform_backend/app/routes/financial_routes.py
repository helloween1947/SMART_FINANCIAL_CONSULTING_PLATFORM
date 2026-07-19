from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.db import SessionLocal

router = APIRouter()

@router.get("/financial-summary")

def financial_summary():

    db: Session = SessionLocal()

    query = text("""
        SELECT
            AVG(assets) AS avg_assets,
            AVG(liabilities) AS avg_liabilities,
            AVG(debt) AS avg_debt,
            AVG(equity) AS avg_equity
        FROM financials
    """)

    result = db.execute(query).fetchall()

    return [dict(row._mapping) for row in result]