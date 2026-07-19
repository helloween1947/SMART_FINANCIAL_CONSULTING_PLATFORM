from fastapi import APIRouter
from sqlalchemy import text

from app.database.db import engine

router = APIRouter()


@router.get("/executive-summary")
def executive_summary():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    company_name,
                    market_cap,
                    debt,
                    equity
                FROM companies
            """)
        )

        rows = [dict(row._mapping) for row in result]

    return rows