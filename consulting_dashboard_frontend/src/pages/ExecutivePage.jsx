import { useEffect, useState, useMemo } from "react";
import { getExecutiveSummary } from "../services/companyService";
import ExecutiveCharts from "../components/ExecutiveCharts";

/* ─── Helpers ─── */
function fmtCap(val) {
  const n = Number(val);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtRaw(val) {
  const n = Number(val);
  if (isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function getDebtHealthColor(debt, equity) {
  const d = Number(debt), e = Number(equity);
  if (!e || !d) return "rgba(255,255,255,0.5)";
  const ratio = d / e;
  if (ratio <= 0.5)  return "#50DC78";
  if (ratio <= 1.0)  return "#F0B429";
  if (ratio <= 2.0)  return "#F07529";
  return "#E55050";
}

function getDebtLabel(debt, equity) {
  const d = Number(debt)  || 0;
  const e = Number(equity) || 1; // guard against 0 / null / undefined → prevents Infinity / NaN
  const ratio = d / e;
  if (ratio <= 0.5) return { label: "HEALTHY",   color: "#50DC78", bg: "rgba(80,220,120,0.08)",  border: "rgba(80,220,120,0.2)"  };
  if (ratio <= 1.0) return { label: "MODERATE",  color: "#F0B429", bg: "rgba(240,180,41,0.08)",  border: "rgba(240,180,41,0.2)"  };
  if (ratio <= 2.0) return { label: "LEVERAGED", color: "#F07529", bg: "rgba(240,117,41,0.08)",  border: "rgba(240,117,41,0.2)"  };
  return                   { label: "HIGH RISK", color: "#E55050", bg: "rgba(229,80,80,0.08)",   border: "rgba(229,80,80,0.2)"   };
}

/* ─── Animated fill bar ─── */
function MiniBar({ value, max, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min((value / max) * 100, 100)), 250);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 2,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        width: `${w}%`,
        transition: "width 1s cubic-bezier(.4,0,.2,1)",
      }}/>
    </div>
  );
}

/* ─── Summary tile ─── */
function SummaryTile({ label, value, sub, color = "#D4AF37", delay = 0 }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "22px 24px",
      animation: `fadeSlideUp 0.5s ${delay}s ease both`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40, width: 110, height: 110,
        borderRadius: "50%", pointerEvents: "none",
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
      }}/>
      <p style={{
        fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.28)", marginBottom: 10,
        fontFamily: "'Syne', sans-serif",
      }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontFamily: "'Cormorant Garamond', serif",
        fontSize: 34, fontWeight: 300, color, letterSpacing: "-0.02em",
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif" }}>
          {sub}
        </p>
      )}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
      }}/>
    </div>
  );
}

/* ─── Skeleton row ─── */
function SkeletonRow() {
  return (
    <tr>
      {[55, 35, 30, 30, 45, 40].map((w, i) => (
        <td key={i} style={{ padding: "16px" }}>
          <div style={{
            height: 11, borderRadius: 5,
            background: "rgba(255,255,255,0.055)",
            width: `${w}%`,
            animation: "shimmer 1.6s infinite",
          }}/>
        </td>
      ))}
    </tr>
  );
}

const ROWS_PER_PAGE = 12;

function PageBtn({ label, onClick, disabled, active }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        minWidth: 32, height: 32, borderRadius: 8, padding: "0 6px",
        border: active
          ? "1px solid rgba(212,175,55,0.5)"
          : h && !disabled ? "1px solid rgba(255,255,255,0.13)" : "1px solid rgba(255,255,255,0.06)",
        background: active ? "rgba(212,175,55,0.12)" : h && !disabled ? "rgba(255,255,255,0.05)" : "transparent",
        color: active ? "#D4AF37" : disabled ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.5)",
        fontSize: 12, cursor: disabled ? "default" : "pointer",
        fontFamily: "'Syne', sans-serif", transition: "all .14s",
      }}
    >{label}</button>
  );
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total-4, total-3, total-2, total-1, total];
  return [1, "…", current-1, current, current+1, "…", total];
}

/* ─── Insight card ─── */
function InsightCard({ title, value, description, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${color}25`,
      borderRadius: 16, padding: 24,
      position: "relative", overflow: "hidden",
      animation: "fadeSlideUp 0.5s ease both",
    }}>
      <div style={{
        position: "absolute", top: -30, right: -30,
        width: 90, height: 90, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }}/>
      <p style={{
        fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.28)", marginBottom: 10,
        fontFamily: "'Syne', sans-serif", fontWeight: 600,
      }}>
        {title}
      </p>
      <h3 style={{
        margin: 0, color, fontSize: 26, fontWeight: 300,
        fontFamily: "'Cormorant Garamond', serif",
        letterSpacing: "-0.02em", lineHeight: 1.1,
        wordBreak: "break-word",
      }}>
        {value ?? "—"}
      </h3>
      <p style={{
        marginTop: 8, fontSize: 11,
        color: "rgba(255,255,255,0.3)",
        fontFamily: "'Syne', sans-serif",
      }}>
        {description}
      </p>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}45, transparent)`,
      }}/>
    </div>
  );
}

/* ─── Strategy recommendation card ─── */
function StrategyCard({ title, message, priority }) {
  const color =
    priority === "HIGH"   ? "#E55050" :
    priority === "MEDIUM" ? "#F0B429" :
                            "#50DC78";
  return (
    <div style={{
      marginBottom: 30,
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${color}30`,
      borderRadius: 18, padding: "28px 32px",
      position: "relative", overflow: "hidden",
      animation: "fadeSlideUp 0.5s ease both",
    }}>
      {/* Ambient corner glow */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 200, height: 200, borderRadius: "50%", pointerEvents: "none",
        background: `radial-gradient(circle, ${color}0e 0%, transparent 70%)`,
      }}/>
      {/* Bottom accent line */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}45, transparent)`,
      }}/>

      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{
          fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase",
          color: `${color}cc`, margin: 0,
          fontFamily: "'Syne', sans-serif", fontWeight: 600,
        }}>
          Executive Recommendation
        </p>
        <span style={{
          padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: `${color}18`,
          border: `1px solid ${color}35`,
          color, fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em",
        }}>
          {priority} PRIORITY
        </span>
      </div>

      {/* Title */}
      <h2 style={{
        margin: "0 0 12px",
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 300,
        letterSpacing: "-0.02em", color: "#fff", lineHeight: 1,
      }}>
        {title}
      </h2>

      {/* Message */}
      <p style={{
        margin: 0, fontSize: 13.5, lineHeight: 1.75,
        color: "rgba(255,255,255,0.58)",
        fontFamily: "'Syne', sans-serif",
        maxWidth: 720,
      }}>
        {message}
      </p>
    </div>
  );
}

/* ─── What-If Simulator card ─── */
function SimulatorCard({
  debtAdjustment, equityAdjustment,
  setDebtAdjustment, setEquityAdjustment,
  simulatedHealth, baseHealth,
}) {
  const delta = simulatedHealth - baseHealth;
  const deltaColor = delta > 0 ? "#50DC78" : delta < 0 ? "#E55050" : "rgba(255,255,255,0.4)";
  const simColor    = simulatedHealth >= 70 ? "#50DC78" : simulatedHealth >= 40 ? "#F0B429" : "#E55050";

  const SliderRow = ({ label, value, setter, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{
          margin: 0, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)", fontFamily: "'Syne', sans-serif", fontWeight: 600,
        }}>{label}</p>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300,
          color: value === 0 ? "rgba(255,255,255,0.3)" : value > 0 ? "#50DC78" : "#E55050",
          letterSpacing: "-0.02em",
        }}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <input
          type="range" min="-50" max="50" value={value}
          onChange={e => setter(Number(e.target.value))}
          style={{
            width: "100%", appearance: "none", height: 4, borderRadius: 2,
            background: `linear-gradient(90deg, ${color} ${((value + 50) / 100) * 100}%, rgba(255,255,255,0.08) 0%)`,
            outline: "none", cursor: "pointer",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "'Syne', sans-serif" }}>-50%</span>
        <button onClick={() => setter(0)} style={{
          background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
          color: "rgba(255,255,255,0.3)", fontSize: 9, padding: "2px 8px",
          cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em",
        }}>RESET</button>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "'Syne', sans-serif" }}>+50%</span>
      </div>
    </div>
  );

  return (
    <div style={{
      marginBottom: 30, padding: "28px 32px", borderRadius: 18,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      position: "relative", overflow: "hidden",
      animation: "fadeSlideUp 0.5s ease both",
    }}>
      {/* Corner glow */}
      <div style={{
        position: "absolute", top: -60, right: -60, width: 200, height: 200,
        borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)",
      }}/>
      {/* Bottom accent */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)",
      }}/>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{
            margin: "0 0 4px", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(212,175,55,0.55)", fontFamily: "'Syne', sans-serif", fontWeight: 600,
          }}>What-If Scenario</p>
          <h2 style={{
            margin: 0, fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 300,
            color: "#fff", letterSpacing: "-0.02em",
          }}>Scenario Simulator</h2>
        </div>

        {/* Live result badge */}
        <div style={{ textAlign: "right" }}>
          <p style={{
            margin: "0 0 4px", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)", fontFamily: "'Syne', sans-serif",
          }}>Simulated Score</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "flex-end" }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 300,
              color: simColor, letterSpacing: "-0.04em", lineHeight: 1,
            }}>{simulatedHealth}</span>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 300,
              color: deltaColor, letterSpacing: "-0.02em",
            }}>
              {delta > 0 ? "+" : ""}{delta !== 0 ? delta : ""}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Syne', sans-serif" }}>
            Base: {baseHealth}
          </p>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        <SliderRow
          label="Debt Adjustment"
          value={debtAdjustment}
          setter={setDebtAdjustment}
          color="#E55050"
        />
        <SliderRow
          label="Equity Adjustment"
          value={equityAdjustment}
          setter={setEquityAdjustment}
          color="#50DC78"
        />
      </div>

      {/* Insight hint */}
      <p style={{
        marginTop: 20, fontSize: 11.5, color: "rgba(255,255,255,0.28)",
        fontFamily: "'Syne', sans-serif", lineHeight: 1.6,
        borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16,
      }}>
        Drag the sliders to model debt reduction or equity injection scenarios.
        The simulated score updates in real time across all {" "}
        <span style={{ color: "rgba(212,175,55,0.6)" }}>portfolio companies</span>.
      </p>
    </div>
  );
}

/* ─── Main page ─── */
export default function ExecutivePage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState("market_cap");
  const [sortDir, setSortDir]     = useState("desc");
  const [page, setPage]           = useState(1);
  const [hovered, setHovered]     = useState(null);
  const [focused, setFocused]     = useState(false);
  const [filter, setFilter]         = useState("ALL");
  const [debtAdjustment, setDebtAdjustment]     = useState(0);
  const [equityAdjustment, setEquityAdjustment] = useState(0);

  useEffect(() => {
    getExecutiveSummary()
      .then(res => {
        // Safe unwrap: handles bare array or { data: [] }
        const data = Array.isArray(res)      ? res
                   : Array.isArray(res?.data) ? res.data
                   : [];
        setCompanies(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load executive summary.");
        setLoading(false);
      });
  }, []);

  /* ─── Derived ─── */
  const enriched = useMemo(() =>
    companies.map(c => ({ ...c, health: getDebtLabel(c.debt, c.equity) })),
    [companies]
  );

  const HEALTH_FILTERS = ["ALL", "HEALTHY", "MODERATE", "LEVERAGED", "HIGH RISK"];
  const HEALTH_COLORS  = {
    ALL: "#D4AF37", HEALTHY: "#50DC78",
    MODERATE: "#F0B429", LEVERAGED: "#F07529", "HIGH RISK": "#E55050",
  };

  const afterFilter = useMemo(() =>
    filter === "ALL" ? enriched : enriched.filter(c => c.health.label === filter),
    [enriched, filter]
  );

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return afterFilter;
    return afterFilter.filter(c =>
      [c.company_name].some(v => v?.toLowerCase().includes(q))
    );
  }, [afterFilter, search]);

  const sorted = useMemo(() => [...afterSearch].sort((a, b) => {
    const numKeys = ["market_cap", "debt", "equity"];
    const isNum = numKeys.includes(sortKey);
    const cmp = isNum
      ? Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)
      : String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
    return sortDir === "asc" ? cmp : -cmp;
  }), [afterSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const pageData   = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  /* ─── Aggregates ─── */
  const totalMktCap  = useMemo(() => enriched.reduce((s, c) => s + (Number(c.market_cap) || 0), 0), [enriched]);
  const totalDebt    = useMemo(() => enriched.reduce((s, c) => s + (Number(c.debt) || 0), 0),       [enriched]);
  const totalEquity  = useMemo(() => enriched.reduce((s, c) => s + (Number(c.equity) || 0), 0),     [enriched]);
  const avgDebtEq    = useMemo(() => {
    if (!totalEquity) return "—";
    return (totalDebt / totalEquity).toFixed(2) + "x";
  }, [totalDebt, totalEquity]);

  const maxMktCap = useMemo(() => Math.max(...enriched.map(c => Number(c.market_cap) || 0), 1), [enriched]);

  /* ─── Phase 2 KPIs ─── */
  const totalPortfolioValue = useMemo(() =>
    enriched.reduce((sum, c) => sum + Number(c.market_cap || 0), 0),
    [enriched]
  );

  const averageDebt = useMemo(() =>
    enriched.length > 0
      ? enriched.reduce((sum, c) => sum + Number(c.debt || 0), 0) / enriched.length
      : 0,
    [enriched]
  );

  const topCompany = useMemo(() =>
    enriched.length > 0
      ? [...enriched].sort((a, b) => Number(b.market_cap) - Number(a.market_cap))[0]
      : null,
    [enriched]
  );

  const portfolioHealth = useMemo(() => {
    if (!enriched.length) return 0;
    return Math.round(
      enriched.reduce((sum, c) => {
        const equity = Math.max(Number(c.equity) || 1, 1);
        const debt   = Number(c.debt) || 0;
        return sum + (1 - debt / equity) * 100;
      }, 0) / enriched.length
    );
  }, [enriched]);

  const healthColor = portfolioHealth >= 70 ? "#50DC78" : portfolioHealth >= 40 ? "#F0B429" : "#E55050";

  /* ─── Phase 3 Insights ─── */
  const bestCompany = useMemo(() => {
    if (!enriched.length) return null;
    return [...enriched].sort((a, b) => {
      const ra = (Number(a.debt) || 0) / (Number(a.equity) || 1);
      const rb = (Number(b.debt) || 0) / (Number(b.equity) || 1);
      return ra - rb;
    })[0];
  }, [enriched]);

  const weakestCompany = useMemo(() => {
    if (!enriched.length) return null;
    return [...enriched].sort((a, b) => {
      const ra = (Number(a.debt) || 0) / (Number(a.equity) || 1);
      const rb = (Number(b.debt) || 0) / (Number(b.equity) || 1);
      return rb - ra;
    })[0];
  }, [enriched]);

  const debtConcentration = useMemo(() => {
    if (!totalDebt) return "0.0";
    const largest = Math.max(...enriched.map(c => Number(c.debt) || 0), 0);
    return ((largest / totalDebt) * 100).toFixed(1);
  }, [enriched, totalDebt]);

  const healthGrade = useMemo(() => {
    if (portfolioHealth >= 80) return "A";
    if (portfolioHealth >= 65) return "B";
    if (portfolioHealth >= 50) return "C";
    if (portfolioHealth >= 35) return "D";
    return "F";
  }, [portfolioHealth]);

  const strategyRecommendation = useMemo(() => {
    if (!enriched.length) return { title: "No Data", message: "No portfolio data available.", priority: "LOW" };
    const best    = bestCompany?.company_name    || "N/A";
    const weakest = weakestCompany?.company_name || "N/A";
    if (portfolioHealth >= 80) return {
      title:    "Growth Strategy",
      message:  `Portfolio health is excellent. Increase allocation toward ${best} while maintaining current diversification.`,
      priority: "LOW",
    };
    if (portfolioHealth >= 60) return {
      title:    "Balanced Strategy",
      message:  `Portfolio remains stable. Continue monitoring ${weakest} and gradually increase exposure to ${best}.`,
      priority: "MEDIUM",
    };
    return {
      title:    "Risk Reduction Strategy",
      message:  `Portfolio leverage is elevated. Reduce exposure to ${weakest} and prioritize financially stronger companies such as ${best}.`,
      priority: "HIGH",
    };
  }, [portfolioHealth, bestCompany, weakestCompany, enriched]);

  /* ─── What-If Simulator ─── */
  const simulatedHealth = useMemo(() => {
    if (!companies.length) return 0;
    const adjusted = companies.map(c => ({
      debt:   Number(c.debt   || 0) * (1 + debtAdjustment   / 100),
      equity: Number(c.equity || 0) * (1 + equityAdjustment / 100),
    }));
    const score = adjusted.reduce((sum, c) => {
      const ratio = c.debt / Math.max(c.equity, 1);
      return sum + (1 - ratio) * 100;
    }, 0) / adjusted.length;
    return Math.round(score);
  }, [companies, debtAdjustment, equityAdjustment]);

  const COLUMNS = [
    { key: "company_name", label: "Company",    sortable: true  },
    { key: "market_cap",   label: "Market Cap", sortable: true, numeric: true },
    { key: "debt",         label: "Debt",       sortable: true, numeric: true },
    { key: "equity",       label: "Equity",     sortable: true, numeric: true },
    { key: "d_e_ratio",    label: "D/E Ratio",  sortable: false },
    { key: "health",       label: "Health",     sortable: false },
  ];

  return (
    <div>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 40, animation: "fadeSlideUp 0.6s ease both" }}>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(32px, 4vw, 52px)",
          fontWeight: 300, letterSpacing: "-0.03em",
          color: "#fff", margin: 0, lineHeight: 1,
        }}>
          Executive <span style={{ color: "#D4AF37" }}>Summary</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
          Capital structure overview — market cap, debt, and equity across the portfolio
        </p>
      </div>

      {/* ── Gold divider ── */}
      <div style={{
        height: 1, marginBottom: 32,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)",
        animation: "fadeSlideUp 0.6s 0.05s ease both",
      }}/>

      {/* ── Phase 2 Executive KPI Row ── */}
      {!loading && !error && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16, marginBottom: 24,
          animation: "fadeSlideUp 0.6s 0.08s ease both",
        }}>

          {/* Total Portfolio Value */}
          <div style={{
            background: "rgba(212,175,55,0.06)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 16, padding: "24px 26px",
            position: "relative", overflow: "hidden",
            animation: "borderGlow 4s ease infinite",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30, width: 100, height: 100,
              borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
            }}/>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(212,175,55,0.55)", marginBottom: 10, fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>
              Total Portfolio
            </p>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 300, color: "#D4AF37", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {fmtCap(totalPortfolioValue)}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Syne', sans-serif" }}>portfolio valuation</p>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)" }}/>
          </div>

          {/* Top Company */}
          <div style={{
            background: "rgba(96,165,250,0.05)",
            border: "1px solid rgba(96,165,250,0.15)",
            borderRadius: 16, padding: "24px 26px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30, width: 100, height: 100,
              borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 70%)",
            }}/>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(96,165,250,0.55)", marginBottom: 10, fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>
              Top Company
            </p>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: topCompany?.company_name?.length > 12 ? 22 : 30, fontWeight: 300, color: "#60A5FA", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {topCompany?.company_name ?? "—"}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Syne', sans-serif" }}>
              {topCompany ? fmtCap(topCompany.market_cap) + " market cap" : "no data"}
            </p>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent)" }}/>
          </div>

          {/* Average Debt */}
          <div style={{
            background: "rgba(229,80,80,0.05)",
            border: "1px solid rgba(229,80,80,0.15)",
            borderRadius: 16, padding: "24px 26px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30, width: 100, height: 100,
              borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle, rgba(229,80,80,0.1) 0%, transparent 70%)",
            }}/>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(229,80,80,0.55)", marginBottom: 10, fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>
              Average Debt
            </p>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 300, color: "#E55050", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {fmtCap(averageDebt)}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Syne', sans-serif" }}>per company avg</p>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(229,80,80,0.4), transparent)" }}/>
          </div>

          {/* Portfolio Health Score */}
          <div style={{
            background: `${healthColor}0d`,
            border: `1px solid ${healthColor}30`,
            borderRadius: 16, padding: "24px 26px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30, width: 100, height: 100,
              borderRadius: "50%", pointerEvents: "none",
              background: `radial-gradient(circle, ${healthColor}18 0%, transparent 70%)`,
            }}/>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: `${healthColor}99`, marginBottom: 10, fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>
              Health Score
            </p>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 300, color: healthColor, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {portfolioHealth}<span style={{ fontSize: 18, opacity: 0.5 }}>/100</span>
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Syne', sans-serif" }}>
              {portfolioHealth >= 70 ? "portfolio in good shape" : portfolioHealth >= 40 ? "moderate leverage" : "high debt exposure"}
            </p>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${healthColor}50, transparent)` }}/>
          </div>

        </div>
      )}

      {/* ── Summary tiles ── */}
      {!loading && !error && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16, marginBottom: 32,
          animation: "fadeSlideUp 0.6s 0.1s ease both",
        }}>
          <SummaryTile label="Total Market Cap" value={fmtCap(totalMktCap)} sub="portfolio valuation"  color="#D4AF37" delay={0}   />
          <SummaryTile label="Total Debt"        value={fmtCap(totalDebt)}   sub="aggregate liabilities" color="#E55050" delay={0.05}/>
          <SummaryTile label="Total Equity"      value={fmtCap(totalEquity)} sub="aggregate equity"     color="#50DC78" delay={0.1} />
          <SummaryTile label="Avg D/E Ratio"     value={avgDebtEq}           sub="portfolio leverage"   color="#60A5FA" delay={0.15}/>
          <SummaryTile label="Companies"         value={enriched.length}     sub="tracked entities"     color="#A78BFA" delay={0.2} />
        </div>
      )}

      {/* ── Executive Insights ── */}
      {!loading && !error && (
        <>
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <p style={{
              fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.22)", fontFamily: "'Syne', sans-serif", fontWeight: 600,
            }}>
              Executive Insights
            </p>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16, marginBottom: 30,
          }}>
            <InsightCard
              title="Best Company"
              value={bestCompany?.company_name}
              description="Lowest debt-to-equity profile"
              color="#50DC78"
            />
            <InsightCard
              title="Weakest Company"
              value={weakestCompany?.company_name}
              description="Highest leverage exposure"
              color="#E55050"
            />
            <InsightCard
              title="Health Grade"
              value={healthGrade}
              description={`Portfolio score ${portfolioHealth}/100`}
              color="#D4AF37"
            />
            <InsightCard
              title="Debt Concentration"
              value={`${debtConcentration}%`}
              description="Share of debt from largest debtor"
              color="#60A5FA"
            />
          </div>
        </>
      )}

      {/* ── Strategy Recommendation ── */}
      {!loading && !error && (
        <StrategyCard
          title={strategyRecommendation.title}
          message={strategyRecommendation.message}
          priority={strategyRecommendation.priority}
        />
      )}

      {/* ── Charts ── */}
      {!loading && !error && companies.length > 0 && (
        <ExecutiveCharts companies={companies} />
      )}

      {/* ── What-If Simulator ── */}
      {!loading && !error && (
        <SimulatorCard
          debtAdjustment={debtAdjustment}
          equityAdjustment={equityAdjustment}
          setDebtAdjustment={setDebtAdjustment}
          setEquityAdjustment={setEquityAdjustment}
          simulatedHealth={simulatedHealth}
          baseHealth={portfolioHealth}
        />
      )}

      {/* ── Table card ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18, overflow: "hidden",
        animation: "fadeSlideUp 0.6s 0.2s ease both",
        position: "relative",
      }}>

        {/* Corner glow */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 260, height: 260, borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)",
        }}/>

        {/* ── Table header bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 28px", flexWrap: "wrap", gap: 14,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>

          {/* Left: label + count + health filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <p style={{
              margin: 0, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.28)",
              fontFamily: "'Syne', sans-serif",
            }}>
              Capital Structure
            </p>
            {!loading && (
              <span style={{
                fontSize: 10, padding: "2px 9px", borderRadius: 20,
                background: "rgba(212,175,55,0.1)",
                border: "1px solid rgba(212,175,55,0.22)",
                color: "rgba(212,175,55,0.75)",
                letterSpacing: "0.06em", fontFamily: "'Syne', sans-serif",
              }}>
                {sorted.length.toLocaleString()} records
              </span>
            )}
          </div>

          {/* Right: health filter + search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

            {/* Health filters */}
            <div style={{ display: "flex", gap: 5 }}>
              {HEALTH_FILTERS.map(f => {
                const active = filter === f;
                const col = HEALTH_COLORS[f];
                return (
                  <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
                    padding: "4px 10px", borderRadius: 7, fontSize: 9,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    fontFamily: "'Syne', sans-serif", fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${active ? col + "55" : "rgba(255,255,255,0.07)"}`,
                    background: active ? col + "15" : "transparent",
                    color: active ? col : "rgba(255,255,255,0.3)",
                    transition: "all .15s",
                  }}>
                    {f}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                style={{ position: "absolute", left: 10, pointerEvents: "none", opacity: focused ? 0.65 : 0.28, transition: "opacity .2s" }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="white" strokeWidth="1.4"/>
                <path d="M9 9L11.5 11.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                type="text" value={search} placeholder="Search companies…"
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                style={{
                  background: focused ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${focused ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 10, padding: "7px 28px 7px 30px",
                  color: "#fff", fontSize: 12,
                  fontFamily: "'Syne', sans-serif",
                  outline: "none", width: 200,
                  transition: "background .18s, border .18s",
                  caretColor: "#D4AF37",
                }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} style={{
                  position: "absolute", right: 8,
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", fontSize: 15, padding: 0,
                }}>×</button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{
                      padding: "12px 16px",
                      textAlign: col.numeric ? "right" : "left",
                      fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                      fontFamily: "'Syne', sans-serif", fontWeight: 600,
                      color: sortKey === col.key ? "rgba(212,175,55,0.85)" : "rgba(255,255,255,0.28)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: sortKey === col.key ? "rgba(212,175,55,0.03)" : "transparent",
                      cursor: col.sortable ? "pointer" : "default",
                      userSelect: "none", whiteSpace: "nowrap",
                      transition: "color .18s",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {col.label}
                      {col.sortable && (
                        <svg width="8" height="10" viewBox="0 0 8 10" fill="none"
                          style={{ opacity: sortKey === col.key ? 0.9 : 0.2 }}>
                          {sortKey === col.key && sortDir === "asc"
                            ? <path d="M4 0L7.5 5H0.5L4 0Z" fill="#D4AF37"/>
                            : sortKey === col.key && sortDir === "desc"
                            ? <path d="M4 10L0.5 5H7.5L4 10Z" fill="#D4AF37"/>
                            : <><path d="M4 0L7 3.5H1L4 0Z" fill="white"/><path d="M4 10L1 6.5H7L4 10Z" fill="white"/></>
                          }
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading
                ? [...Array(ROWS_PER_PAGE)].map((_, i) => <SkeletonRow key={i}/>)
                : error
                ? (
                  <tr><td colSpan={COLUMNS.length} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(229,80,80,0.75)", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>{error}</p>
                  </td></tr>
                )
                : pageData.length === 0
                ? (
                  <tr><td colSpan={COLUMNS.length} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.2)", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
                      No results{search ? <> for <span style={{ color: "rgba(212,175,55,0.65)" }}>"{search}"</span></> : ""}
                    </p>
                  </td></tr>
                )
                : pageData.map((c, i) => {
                  const h    = hovered === c.company_name;
                  const debtColor = getDebtHealthColor(c.debt, c.equity);
                  const deRatio   = Number(c.equity) > 0
                    ? (Number(c.debt) / Number(c.equity)).toFixed(2)
                    : "—";

                  return (
                    <tr key={c.company_name}
                      onMouseEnter={() => setHovered(c.company_name)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: h ? "rgba(212,175,55,0.03)" : "transparent",
                        transition: "background .14s",
                        animation: `fadeSlideUp 0.3s ${i * 0.025}s ease both`,
                      }}
                    >
                      {/* Company */}
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: `hsl(${(c.company_name?.charCodeAt(0) ?? 65) * 6 % 360}, 20%, 18%)`,
                            border: "1px solid rgba(255,255,255,0.07)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700,
                            color: "rgba(255,255,255,0.45)",
                            fontFamily: "'Syne', sans-serif",
                          }}>
                            {(c.company_name ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{
                              margin: 0, fontSize: 13,
                              color: h ? "#fff" : "rgba(255,255,255,0.78)",
                              fontFamily: "'Syne', sans-serif",
                              fontWeight: h ? 500 : 400,
                              transition: "color .14s",
                            }}>
                              {c.company_name}
                            </p>
                            {/* Market cap mini bar */}
                            <div style={{ marginTop: 5, width: 100 }}>
                              <MiniBar value={Number(c.market_cap) || 0} max={maxMktCap} color="#D4AF37"/>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Market Cap */}
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <span style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 18, fontWeight: 400,
                          color: h ? "#D4AF37" : "rgba(212,175,55,0.8)",
                          letterSpacing: "-0.01em",
                          transition: "color .14s",
                        }}>
                          {fmtRaw(c.market_cap)}
                        </span>
                      </td>

                      {/* Debt */}
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <span style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 17,
                          color: "rgba(229,80,80,0.75)",
                          letterSpacing: "-0.01em",
                        }}>
                          {fmtRaw(c.debt)}
                        </span>
                      </td>

                      {/* Equity */}
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <span style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 17,
                          color: "rgba(80,220,120,0.8)",
                          letterSpacing: "-0.01em",
                        }}>
                          {fmtRaw(c.equity)}
                        </span>
                      </td>

                      {/* D/E Ratio */}
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <span style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 17,
                          color: debtColor,
                          letterSpacing: "-0.01em",
                        }}>
                          {deRatio}{deRatio !== "—" ? "x" : ""}
                        </span>
                      </td>

                      {/* Health badge */}
                      <td style={{ padding: "16px" }}>
                        <span style={{
                          fontSize: 9, padding: "4px 10px", borderRadius: 6,
                          background: c.health.bg,
                          border: `1px solid ${c.health.border}`,
                          color: c.health.color,
                          fontFamily: "'Syne', sans-serif",
                          fontWeight: 700, letterSpacing: "0.1em",
                          whiteSpace: "nowrap",
                        }}>
                          {c.health.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && sorted.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 28px", borderTop: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap", gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: "'Syne', sans-serif" }}>
              Showing{" "}
              <span style={{ color: "rgba(255,255,255,0.45)" }}>
                {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, sorted.length)}
              </span>{" "}of{" "}
              <span style={{ color: "rgba(255,255,255,0.45)" }}>{sorted.length}</span>
            </p>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <PageBtn label="‹" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}/>
              {pageRange(page, totalPages).map((p, i) =>
                p === "…"
                  ? <span key={`e${i}`} style={{ color: "rgba(255,255,255,0.18)", fontSize: 12, padding: "0 4px" }}>…</span>
                  : <PageBtn key={p} label={p} onClick={() => setPage(p)} active={p === page}/>
              )}
              <PageBtn label="›" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}/>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}