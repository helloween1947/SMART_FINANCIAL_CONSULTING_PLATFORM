from sqlalchemy import Column, Integer, String, Float

from app.database.db import Base

class Company(Base):

    __tablename__ = "companies"

    company_id = Column(Integer, primary_key=True)

    company_name = Column(String)

    sector = Column(String)

    industry = Column(String)

    country = Column(String)

    founded_year = Column(Integer)

    market_cap = Column(Float)