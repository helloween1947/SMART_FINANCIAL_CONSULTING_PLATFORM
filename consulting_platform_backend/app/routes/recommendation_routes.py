from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.db import SessionLocal

router = APIRouter()

@router.get("/investment-score")

def investment_score():

    db: Session = SessionLocal()

    query = text("""

        SELECT

            c.company_name,

            c.market_cap,

            f.debt,

            f.equity,

            ROUND(
                CAST(f.debt AS NUMERIC) /
                NULLIF(CAST(f.equity AS NUMERIC), 0),
                2
            ) AS debt_to_equity_ratio,

            CASE

                WHEN
                    (
                        CAST(f.debt AS NUMERIC) /
                        NULLIF(CAST(f.equity AS NUMERIC), 0)
                    ) < 0.5

                THEN 'LOW RISK'

                WHEN
                    (
                        CAST(f.debt AS NUMERIC) /
                        NULLIF(CAST(f.equity AS NUMERIC), 0)
                    ) BETWEEN 0.5 AND 1.0

                THEN 'MEDIUM RISK'

                ELSE 'HIGH RISK'

            END AS investment_rating

        FROM companies c

        JOIN financials f
        ON c.company_id = f.company_id

    """)

    result = db.execute(query).fetchall()

    return [dict(row._mapping) for row in result]