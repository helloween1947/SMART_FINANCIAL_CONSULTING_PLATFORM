from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.db import SessionLocal

router = APIRouter()

@router.get("/benchmark")

def benchmark_companies():

    db: Session = SessionLocal()

    query = text("""

        SELECT

            c.company_name,

            c.market_cap,

            f.assets,

            f.debt,

            f.equity,

            ROUND(
                CAST(f.debt AS NUMERIC) /
                NULLIF(CAST(f.equity AS NUMERIC), 0),
                2
            ) AS debt_to_equity_ratio

        FROM companies c

        JOIN financials f
        ON c.company_id = f.company_id

        ORDER BY c.market_cap DESC

    """)

    result = db.execute(query).fetchall()

    return [dict(row._mapping) for row in result]