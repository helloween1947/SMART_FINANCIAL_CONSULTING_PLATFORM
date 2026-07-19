import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import DashboardLayout   from "./layouts/DashboardLayout";

import DashboardPage     from "./pages/DashboardPage";
import CompaniesPage     from "./pages/CompaniesPage";
import RiskPage          from "./pages/RiskPage";
import BenchmarkPage     from "./pages/BenchmarkPage";
import RecommendationPage from "./pages/RecommendationPage";
import ExecutivePage     from "./pages/ExecutivePage";
import LiveMarketPage    from "./pages/LiveMarketPage";
import StockDetailPage   from "./pages/StockDetailPage";
import WatchlistPage     from "./pages/WatchlistPage";
import PortfolioPage     from "./pages/PortfolioPage";
import AIEnginePage      from "./pages/AIEnginePage";
import NewsPage          from "./pages/NewsPage";
import ScreenerPage      from "./pages/ScreenerPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>

          {/* Root → Dashboard */}
          <Route index                element={<DashboardPage />} />
          <Route path="dashboard"     element={<DashboardPage />} />

          {/* Intelligence */}
          <Route path="ai-engine"     element={<AIEnginePage />} />
          <Route path="screener"      element={<ScreenerPage />} />
          <Route path="benchmark"     element={<BenchmarkPage />} />
          <Route path="investment-score" element={<RecommendationPage />} />

          {/* Markets */}
          <Route path="news"          element={<NewsPage />} />
          <Route path="watchlist"     element={<WatchlistPage />} />
          <Route path="live-market"   element={<LiveMarketPage />} />
          <Route path="companies"     element={<CompaniesPage />} />

          {/* Portfolio & Risk */}
          <Route path="portfolio"     element={<PortfolioPage />} />
          <Route path="risk-analysis" element={<RiskPage />} />

          {/* Reports */}
          <Route path="executive-summary" element={<ExecutivePage />} />

          {/* Stock Detail */}
          <Route path="company/:symbol"   element={<StockDetailPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;