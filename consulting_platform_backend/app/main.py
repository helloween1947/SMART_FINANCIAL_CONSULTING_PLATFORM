from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.company_routes         import router as company_router
from app.routes.executive_routes       import router as executive_router
from app.routes.live_market_routes     import router as live_market_router
from app.routes.market_explorer_routes import router as market_explorer_router
from app.routes.stock_routes           import router as stock_router
from app.routes.watchlist_routes       import router as watchlist_router
from app.routes.portfolio_routes       import router as portfolio_router
from app.routes.ai_routes             import router as ai_router
from app.routes.news_routes           import router as news_router
from app.routes.screener_routes       import router as screener_router

app = FastAPI(
    title="Consulting Intelligence Platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(live_market_router)
app.include_router(company_router)
app.include_router(executive_router)
app.include_router(market_explorer_router)
app.include_router(stock_router)
app.include_router(watchlist_router)
app.include_router(portfolio_router)
app.include_router(ai_router)
app.include_router(news_router)
app.include_router(screener_router)


@app.get("/")
def home():
    return {"message": "Consulting Intelligence Platform API v2.0"}