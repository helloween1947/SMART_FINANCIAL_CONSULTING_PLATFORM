from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.db import SessionLocal

router = APIRouter()

@router.get("/risk-analysis")

def risk_analysis():

    db: Session = SessionLocal()

    query = text("""

        SELECT

            company_id,

            assets,

            liabilities,

            debt,

            equity,

            ROUND(
                CAST(debt AS NUMERIC) /
                NULLIF(CAST(equity AS NUMERIC), 0),
                2
            ) AS debt_to_equity_ratio,

            ROUND(
                CAST(liabilities AS NUMERIC) /
                NULLIF(CAST(assets AS NUMERIC), 0),
                2
            ) AS liability_ratio

        FROM financials

    """)

    result = db.execute(query).fetchall()

    return [dict(row._mapping) for row in result]