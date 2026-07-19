"""Quick script to find all FK references to companies table and test cascade delete"""
import sys
sys.path.insert(0, ".")
from sqlalchemy import text
from app.database.db import engine

with engine.connect() as conn:
    # Find all tables with FK to companies
    result = conn.execute(text("""
        SELECT tc.table_name, kcu.column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.table_constraints tc2
            ON rc.unique_constraint_name = tc2.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name = 'companies'
        ORDER BY tc.table_name;
    """))
    rows = result.fetchall()
    print("Tables referencing companies:")
    for r in rows:
        print(f"  {r[0]}.{r[1]}  (constraint: {r[2]})")
    
    if not rows:
        print("  (none found)")
