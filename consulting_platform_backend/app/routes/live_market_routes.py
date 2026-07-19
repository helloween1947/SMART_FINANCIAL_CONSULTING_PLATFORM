from fastapi import APIRouter

router = APIRouter()

@router.get("/live-market")
def live_market():

    return [

        {
            "symbol": "AAPL",
            "price": 214.50,
            "change": 1.4,
            "volume": 45000000
        },

        {
            "symbol": "MSFT",
            "price": 512.30,
            "change": 0.8,
            "volume": 30000000
        },

        {
            "symbol": "AMZN",
            "price": 245.90,
            "change": -0.5,
            "volume": 22000000
        },

        {
            "symbol": "TSLA",
            "price": 342.10,
            "change": 2.2,
            "volume": 51000000
        }

    ]