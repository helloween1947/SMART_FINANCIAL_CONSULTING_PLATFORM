import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

/* ══════════════════════ CONSTANTS ══════════════════════════ */
const F    = "'Syne', sans-serif";
const FS   = "'Cormorant Garamond', serif";
const GOLD = "#D4AF37";
const G10  = "rgba(212,175,55,0.10)";
const G30  = "rgba(212,175,55,0.30)";
const BG   = "rgba(255,255,255,0.025)";
const BD   = "rgba(255,255,255,0.07)";
const MUT  = "rgba(255,255,255,0.28)";
const TXT  = "rgba(255,255,255,0.82)";
const GREEN = "#50DC78";
const RED   = "#E55050";

const SECTORS = [
  "Technology","Communication Services","Financial Services","Healthcare",
  "Energy","Consumer Staples","Consumer Discretionary",
  "Industrials","Real Estate","Utilities","Materials",
];

const COUNTRY_FLAGS = { US:"🇺🇸", TW:"🇹🇼", NL:"🇳🇱", DE:"🇩🇪", JP:"🇯🇵", CN:"🇨🇳", IE:"🇮🇪", DK:"🇩🇰" };

/* ── Preset Filters ── */
const PRESETS = [
  { id:"value",    label:"Value Stocks",  icon:"💎",
    desc:"Low P/E, solid fundamentals",
    filters:{ max_pe:18, max_de:1.0, min_roe:10 } },
  { id:"growth",   label:"High Growth",   icon:"🚀",
    desc:"Strong revenue momentum",
    filters:{ min_rev_growth:15, min_roe:10 } },
  { id:"dividend", label:"Income",        icon:"💰",
    desc:"High dividend yield payers",
    filters:{ min_div:2.5 } },
  { id:"quality",  label:"Quality",       icon:"⭐",
    desc:"High ROE, low debt",
    filters:{ min_roe:20, max_de:0.5 } },
  { id:"largecap", label:"Mega Cap",      icon:"🏦",
    desc:"Market cap over $100B",
    filters:{ min_mktcap:100 } },
  { id:"lowrisk",  label:"Low Beta",      icon:"🛡️",
    desc:"Defensive, low volatility",
    filters:{ max_de:0.7, min_div:1 } },
];

/* ══════════════════════ HELPERS ════════════════════════════ */
const fmt$ = v => {
  if (v == null) return "—";
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
  return `$${v.toFixed(1)}B`;
};
const fmtX  = v => v == null ? "—" : `${v.toFixed(2)}×`;
const fmtPct= v => v == null ? "—" : `${v.toFixed(1)}%`;
const fmtNum= v => v == null ? "—" : v.toFixed(2);

function scoreColor(v, low, mid, high, invert = false) {
  if (v == null) return MUT;
  if (!invert) return v >= high ? GREEN : v >= mid ? GOLD : v <= low ? RED : TXT;
  return v <= low ? GREEN : v <= mid ? GOLD : v >= high ? RED : TXT;
}

/* ══════════════════════ RANK SCORE BAR ════════════════════ */
function RankBar({ score }) {
  const c = score >= 70 ? GREEN : score >= 50 ? GOLD : score >= 35 ? "#FB923C" : RED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 48, height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%",
          borderRadius: 2, background: c, transition: "width .5s ease" }}/>
      </div>
      <span style={{ fontFamily: FS, fontSize: 13, color: c, minWidth: 30 }}>
        {score}
      </span>
    </div>
  );
}

/* ══════════════════════ FILTER SLIDER ══════════════════════ */
function FilterRange({ label, unit = "", name, val, onChange, min, max, step = 1 }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: F, fontSize: 9, letterSpacing: "0.14em",
          textTransform: "uppercase", color: MUT }}>{label}</span>
        {val !== "" && <span style={{ fontFamily: FS, fontSize: 13, color: GOLD }}>
          {unit}{val}
        </span>}
      </div>
      <input type="range" min={min} max={max} step={step}
        value={val === "" ? min : val}
        onChange={e => onChange(name, e.target.value)}
        style={{ width: "100%", accentColor: GOLD, cursor: "pointer" }}/>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontFamily: F, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{unit}{min}</span>
        <span style={{ fontFamily: F, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{unit}{max}</span>
      </div>
    </div>
  );
}

/* ══════════════════════ COLUMN HEADER ══════════════════════ */
function ColHead({ col, label, sortBy, sortDir, onSort, align = "right" }) {
  const active = sortBy === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding: "12px 14px", textAlign: align, cursor: "pointer",
      fontFamily: F, fontSize: 9, letterSpacing: "0.14em",
      textTransform: "uppercase", whiteSpace: "nowrap",
      color: active ? GOLD : MUT,
      background: active ? "rgba(212,175,55,0.06)" : "transparent",
      userSelect: "none", transition: "all .12s",
    }}>
      {label} {active ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );
}

/* ══════════════════════ LOADING SKELETON ════════════════════ */
function TableSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, i) => (
        <tr key={i}>
          {[...Array(11)].map((_, j) => (
            <td key={j} style={{ padding: "12px 14px" }}>
              <div style={{ height: 10, borderRadius: 3, width: j === 1 ? 120 : 50,
                background: "rgba(255,255,255,0.05)",
                animation: `shimmer 1.6s ${i * 0.05 + j * 0.02}s infinite` }}/>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ══════════════════════ MAIN PAGE ══════════════════════════ */
export default function ScreenerPage() {
  const navigate = useNavigate();
  const [filters,  setFilters]  = useState({});
  const [sector,   setSector]   = useState("");
  const [country,  setCountry]  = useState("");
  const [sortBy,   setSortBy]   = useState("rank_score");
  const [sortDir,  setSortDir]  = useState("desc");
  const [results,  setResults]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [cacheAge, setCacheAge] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [hasRun,   setHasRun]   = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [filterOpen, setFilterOpen] = useState(true);

  const runScreener = useCallback(async (extraFilters = {}, sb = sortBy, sd = sortDir) => {
    setLoading(true); setHasRun(true);
    try {
      const params = {
        sort_by: sb, sort_dir: sd, limit: 80,
        ...(sector  ? { sector }  : {}),
        ...(country ? { country } : {}),
        ...filters, ...extraFilters,
      };
      // Remove empty string values
      Object.keys(params).forEach(k => {
        if (params[k] === "" || params[k] === null || params[k] === undefined) delete params[k];
      });
      const r = await API.get("/screener/run", { params });
      setResults(r.data.results || []);
      setTotal(r.data.total || 0);
      setCacheAge(r.data.cache_age_min);
      setFetchedAt(r.data.fetched_at);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sector, country, sortBy, sortDir]);

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setFilters(preset.filters);
    setSector(""); setCountry("");
    runScreener(preset.filters);
  };

  const clearAll = () => {
    setFilters({}); setSector(""); setCountry(""); setActivePreset(null);
  };

  const handleSort = (col) => {
    const newDir = sortBy === col && sortDir === "desc" ? "asc" : "desc";
    setSortBy(col); setSortDir(newDir);
    if (hasRun) runScreener({}, col, newDir);
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const F_VALS = filters;

  const exportCSV = () => {
    const header = "Rank,Symbol,Company,Sector,Country,Score,Market Cap (B),P/E,D/E,Div Yield%,Rev Growth%,ROE%,Net Margin%,Beta\n";
    const rows = results.map((r, i) =>
      `${i+1},${r.symbol},"${r.name}",${r.sector},${r.country},${r.rank_score},${r.market_cap??''},${r.pe??''},${r.de??''},${r.div_yield??''},${r.rev_growth??''},${r.roe??''},${r.net_margin??''},${r.beta??''}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `screener_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const SECTOR_COLORS = {
    "Technology": "#6366F1", "Communication Services": "#8B5CF6",
    "Financial Services": "#3B82F6", "Healthcare": "#10B981",
    "Energy": "#F59E0B", "Consumer Staples": "#84CC16",
    "Consumer Discretionary": "#F97316", "Industrials": "#6B7280",
    "Real Estate": "#EC4899", "Utilities": "#14B8A6", "Materials": "#A78BFA",
  };

  return (
    <div style={{ animation: "fadeUp 0.45s ease both" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: FS, fontSize: "clamp(28px,4vw,48px)",
            fontWeight: 300, letterSpacing: "-0.03em", color: "#fff", margin: 0 }}>
            Stock <span style={{ color: GOLD }}>Screener</span>
          </h2>
          <p style={{ marginTop: 6, fontSize: 11, color: MUT, fontFamily: F }}>
            Filter 85+ global stocks across 11 sectors · Live Finnhub data · AI-ranked results
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cacheAge !== null && (
            <span style={{ fontSize: 9, color: MUT, fontFamily: F }}>
              Data cached: {cacheAge}m ago
            </span>
          )}
          {results.length > 0 && (
            <button onClick={exportCSV} style={{
              padding: "7px 16px", borderRadius: 10, cursor: "pointer",
              background: G10, border: `1px solid ${G30}`,
              color: GOLD, fontSize: 10, fontFamily: F, fontWeight: 700,
            }}>↓ Export CSV</button>
          )}
        </div>
      </div>

      <div style={{ height: 1, marginBottom: 24,
        background: "linear-gradient(90deg,rgba(212,175,55,0.45),rgba(255,255,255,0.04) 50%,transparent)" }}/>

      {/* ── PRESET BUTTONS ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => applyPreset(p)} title={p.desc} style={{
            padding: "8px 16px", borderRadius: 12, cursor: "pointer",
            background: activePreset === p.id ? G10 : "rgba(255,255,255,0.03)",
            border: `1px solid ${activePreset === p.id ? G30 : BD}`,
            color: activePreset === p.id ? GOLD : MUT,
            fontSize: 11, fontFamily: F, fontWeight: activePreset === p.id ? 700 : 400,
            display: "flex", alignItems: "center", gap: 6, transition: "all .14s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = G30; e.currentTarget.style.color = GOLD; }}
            onMouseLeave={e => {
              if (activePreset !== p.id) {
                e.currentTarget.style.borderColor = BD;
                e.currentTarget.style.color = MUT;
              }
            }}>
            <span>{p.icon}</span> {p.label}
          </button>
        ))}
        <button onClick={clearAll} style={{
          padding: "8px 14px", borderRadius: 12, cursor: "pointer",
          background: "rgba(255,255,255,0.02)", border: `1px solid ${BD}`,
          color: MUT, fontSize: 10, fontFamily: F, marginLeft: "auto",
        }}>✕ Clear All</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: filterOpen ? "260px 1fr" : "0px 1fr",
        gap: filterOpen ? 20 : 0, transition: "all .3s ease" }}>

        {/* ══════ FILTER PANEL ══════ */}
        <div style={{ overflow: filterOpen ? "visible" : "hidden" }}>
          <div style={{ background: BG, border: `1px solid ${BD}`,
            borderRadius: 18, padding: "20px 18px", position: "sticky", top: 20 }}>

            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: 9, letterSpacing: "0.2em",
                textTransform: "uppercase", color: MUT, fontFamily: F }}>◈ Filters</p>
              <button onClick={() => setFilterOpen(false)} style={{
                background: "none", border: "none", color: MUT, cursor: "pointer",
                fontSize: 14, padding: 0 }}>←</button>
            </div>

            {/* Sector */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 6px", fontSize: 9, letterSpacing: "0.14em",
                textTransform: "uppercase", color: MUT, fontFamily: F }}>Sector</p>
              <select value={sector} onChange={e => setSector(e.target.value)} style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
                color: sector ? TXT : MUT, fontSize: 11, fontFamily: F, cursor: "pointer",
              }}>
                <option value="">All Sectors</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Country */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ margin: "0 0 6px", fontSize: 9, letterSpacing: "0.14em",
                textTransform: "uppercase", color: MUT, fontFamily: F }}>Country</p>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
                color: country ? TXT : MUT, fontSize: 11, fontFamily: F, cursor: "pointer",
              }}>
                <option value="">All Countries</option>
                {["US","TW","NL","DE","JP","CN","IE"].map(c => (
                  <option key={c} value={c}>{COUNTRY_FLAGS[c]} {c}</option>
                ))}
              </select>
            </div>

            <div style={{ height: 1, background: BD, marginBottom: 16 }}/>

            {/* Valuation */}
            <p style={{ margin: "0 0 12px", fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", color: GOLD, fontFamily: F }}>Valuation</p>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 5px", fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>P/E Ratio Range</p>
              <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                <input type="number" placeholder="Min" value={F_VALS.min_pe || ""}
                  onChange={e => handleFilterChange("min_pe", e.target.value)}
                  style={{ flex: 1, minWidth: 0, width: 0, padding: "6px 8px", borderRadius: 8,
                    background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
                    color: TXT, fontSize: 11, fontFamily: F, outline: "none",
                    boxSizing: "border-box" }}/>
                <input type="number" placeholder="Max" value={F_VALS.max_pe || ""}
                  onChange={e => handleFilterChange("max_pe", e.target.value)}
                  style={{ flex: 1, minWidth: 0, width: 0, padding: "6px 8px", borderRadius: 8,
                    background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
                    color: TXT, fontSize: 11, fontFamily: F, outline: "none",
                    boxSizing: "border-box" }}/>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 5px", fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Market Cap (Billions $)</p>
              <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                <input type="number" placeholder="Min" value={F_VALS.min_mktcap || ""}
                  onChange={e => handleFilterChange("min_mktcap", e.target.value)}
                  style={{ flex: 1, minWidth: 0, width: 0, padding: "6px 8px", borderRadius: 8,
                    background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
                    color: TXT, fontSize: 11, fontFamily: F, outline: "none",
                    boxSizing: "border-box" }}/>
                <input type="number" placeholder="Max" value={F_VALS.max_mktcap || ""}
                  onChange={e => handleFilterChange("max_mktcap", e.target.value)}
                  style={{ flex: 1, minWidth: 0, width: 0, padding: "6px 8px", borderRadius: 8,
                    background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
                    color: TXT, fontSize: 11, fontFamily: F, outline: "none",
                    boxSizing: "border-box" }}/>
              </div>
            </div>

            <div style={{ height: 1, background: BD, marginBottom: 16 }}/>

            {/* Financial Health */}
            <p style={{ margin: "0 0 12px", fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", color: GOLD, fontFamily: F }}>Financial Health</p>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 5px", fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Max Debt / Equity</p>
              <input type="number" step="0.1" placeholder="e.g. 1.5" value={F_VALS.max_de || ""}
                onChange={e => handleFilterChange("max_de", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 8, background: "rgba(10,12,18,0.9)",
                  border: `1px solid ${BD}`, color: TXT, fontSize: 11, fontFamily: F,
                  outline: "none", boxSizing: "border-box" }}/>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 5px", fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Min ROE %</p>
              <input type="number" placeholder="e.g. 15" value={F_VALS.min_roe || ""}
                onChange={e => handleFilterChange("min_roe", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 8, background: "rgba(10,12,18,0.9)",
                  border: `1px solid ${BD}`, color: TXT, fontSize: 11, fontFamily: F,
                  outline: "none", boxSizing: "border-box" }}/>
            </div>

            <div style={{ height: 1, background: BD, marginBottom: 16 }}/>

            {/* Growth & Income */}
            <p style={{ margin: "0 0 12px", fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", color: GOLD, fontFamily: F }}>Growth & Income</p>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 5px", fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Min Revenue Growth 3Y %</p>
              <input type="number" placeholder="e.g. 10" value={F_VALS.min_rev_growth || ""}
                onChange={e => handleFilterChange("min_rev_growth", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 8, background: "rgba(10,12,18,0.9)",
                  border: `1px solid ${BD}`, color: TXT, fontSize: 11, fontFamily: F,
                  outline: "none", boxSizing: "border-box" }}/>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 5px", fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Min Dividend Yield %</p>
              <input type="number" step="0.1" placeholder="e.g. 2.5" value={F_VALS.min_div || ""}
                onChange={e => handleFilterChange("min_div", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 8, background: "rgba(10,12,18,0.9)",
                  border: `1px solid ${BD}`, color: TXT, fontSize: 11, fontFamily: F,
                  outline: "none", boxSizing: "border-box" }}/>
            </div>

            {/* Run Button */}
            <button onClick={() => { setActivePreset(null); runScreener(); }} style={{
              width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer",
              background: `linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))`,
              border: `1px solid ${G30}`,
              color: GOLD, fontSize: 12, fontFamily: F, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              boxShadow: "0 0 20px rgba(212,175,55,0.15)",
              transition: "all .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))`}
            >
              ⟨ Run Screener ⟩
            </button>
          </div>
        </div>

        {/* ══════ RESULTS PANEL ══════ */}
        <div>
          {/* Results header */}
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!filterOpen && (
                <button onClick={() => setFilterOpen(true)} style={{
                  padding: "6px 14px", borderRadius: 10, cursor: "pointer",
                  background: G10, border: `1px solid ${G30}`,
                  color: GOLD, fontSize: 10, fontFamily: F }}>
                  ☰ Filters
                </button>
              )}
              {hasRun && !loading && (
                <span style={{ fontFamily: F, fontSize: 11, color: MUT }}>
                  <strong style={{ color: TXT }}>{total}</strong> stocks matched
                </span>
              )}
            </div>
          </div>

          {/* Empty / initial state */}
          {!hasRun && !loading && (
            <div style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 20,
              padding: "60px 40px", textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%",
                background: G10, border: `1px solid ${G30}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px", fontSize: 24 }}>🔍</div>
              <p style={{ fontFamily: FS, fontSize: 26, fontWeight: 300, color: TXT, margin: "0 0 10px" }}>
                Configure filters and run the screener
              </p>
              <p style={{ fontFamily: F, fontSize: 11, color: MUT, margin: "0 0 24px" }}>
                Or use a preset above to get started instantly
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {PRESETS.slice(0, 4).map(p => (
                  <button key={p.id} onClick={() => applyPreset(p)} style={{
                    padding: "8px 16px", borderRadius: 12, cursor: "pointer",
                    background: G10, border: `1px solid ${G30}`,
                    color: GOLD, fontSize: 11, fontFamily: F }}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results table */}
          {(hasRun || loading) && (
            <div style={{ background: BG, border: `1px solid ${BD}`,
              borderRadius: 18, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BD}` }}>
                      <th style={{ padding: "12px 14px", textAlign: "left",
                        fontFamily: F, fontSize: 9, color: MUT, letterSpacing: "0.14em",
                        textTransform: "uppercase", whiteSpace: "nowrap" }}>#</th>
                      <th style={{ padding: "12px 14px", textAlign: "left",
                        fontFamily: F, fontSize: 9, color: MUT, letterSpacing: "0.14em",
                        textTransform: "uppercase" }}>Company</th>
                      <th style={{ padding: "12px 14px", textAlign: "left",
                        fontFamily: F, fontSize: 9, color: MUT, letterSpacing: "0.14em",
                        textTransform: "uppercase" }}>Sector</th>
                      <ColHead col="rank_score"  label="Score"       sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="market_cap"  label="Mkt Cap"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="pe"          label="P/E"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="de"          label="D/E"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="div_yield"   label="Div %"       sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="rev_growth"  label="Rev Gr%"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="roe"         label="ROE%"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                      <ColHead col="net_margin"  label="Net Mgn%"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort}/>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <TableSkeleton/> : results.map((r, i) => (
                      <tr key={r.symbol}
                        onClick={() => navigate(`/company/${r.symbol}`)}
                        style={{
                          borderBottom: `1px solid rgba(255,255,255,0.04)`,
                          cursor: "pointer", transition: "background .12s",
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"}
                      >
                        {/* Rank */}
                        <td style={{ padding: "11px 14px", fontFamily: FS,
                          fontSize: 16, color: "rgba(255,255,255,0.2)" }}>{i + 1}</td>

                        {/* Company */}
                        <td style={{ padding: "11px 14px", minWidth: 160 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8,
                              background: `${SECTOR_COLORS[r.sector] || "#6B7280"}18`,
                              border: `1px solid ${SECTOR_COLORS[r.sector] || "#6B7280"}30`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0 }}>
                              <span style={{ fontFamily: F, fontSize: 8, fontWeight: 800,
                                color: SECTOR_COLORS[r.sector] || "#6B7280" }}>
                                {r.symbol.slice(0, 3)}
                              </span>
                            </div>
                            <div>
                              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700,
                                color: "#fff" }}>{r.symbol}</div>
                              <div style={{ fontFamily: F, fontSize: 9, color: MUT,
                                maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>{r.name}</div>
                            </div>
                          </div>
                        </td>

                        {/* Sector badge */}
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontFamily: F, fontSize: 7 }}>
                              {COUNTRY_FLAGS[r.country] || "🌐"}
                            </span>
                            <span style={{
                              padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap",
                              background: `${SECTOR_COLORS[r.sector] || "#6B7280"}15`,
                              border: `1px solid ${SECTOR_COLORS[r.sector] || "#6B7280"}30`,
                              fontFamily: F, fontSize: 8, fontWeight: 600,
                              color: SECTOR_COLORS[r.sector] || "#6B7280",
                            }}>
                              {r.sector.replace(" Services","").replace(" Discretionary","")}
                            </span>
                          </div>
                        </td>

                        {/* Score */}
                        <td style={{ padding: "11px 14px", textAlign: "right" }}>
                          <RankBar score={r.rank_score}/>
                        </td>

                        {/* Market Cap */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14, color: TXT }}>
                          {fmt$(r.market_cap)}
                        </td>

                        {/* P/E */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14,
                          color: scoreColor(r.pe, 10, 20, 35, true) }}>
                          {fmtX(r.pe)}
                        </td>

                        {/* D/E */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14,
                          color: scoreColor(r.de, 0.3, 1.0, 2.5, true) }}>
                          {fmtX(r.de)}
                        </td>

                        {/* Dividend Yield */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14,
                          color: r.div_yield > 0 ? GREEN : MUT }}>
                          {fmtPct(r.div_yield)}
                        </td>

                        {/* Revenue Growth */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14,
                          color: scoreColor(r.rev_growth, 0, 8, 20) }}>
                          {r.rev_growth != null
                            ? <span>{r.rev_growth > 0 ? "+" : ""}{r.rev_growth.toFixed(1)}%</span>
                            : "—"}
                        </td>

                        {/* ROE */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14,
                          color: scoreColor(r.roe, 5, 15, 25) }}>
                          {fmtPct(r.roe)}
                        </td>

                        {/* Net Margin */}
                        <td style={{ padding: "11px 14px", textAlign: "right",
                          fontFamily: FS, fontSize: 14,
                          color: scoreColor(r.net_margin, 0, 10, 25) }}>
                          {fmtPct(r.net_margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              {!loading && results.length > 0 && (
                <div style={{ padding: "12px 20px", borderTop: `1px solid ${BD}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: F, fontSize: 9, color: MUT }}>
                    Click any row to open company detail
                  </span>
                  <span style={{ fontFamily: F, fontSize: 9, color: "rgba(255,255,255,0.15)" }}>
                    {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleTimeString()}` : ""}
                  </span>
                </div>
              )}

              {!loading && results.length === 0 && hasRun && (
                <div style={{ padding: "50px", textAlign: "center" }}>
                  <p style={{ fontFamily: FS, fontSize: 22, color: MUT, margin: "0 0 8px" }}>
                    No stocks match these filters
                  </p>
                  <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                    Try relaxing the criteria or use a preset
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4 }
        input[type=number] { -moz-appearance: textfield }
        select option { background: #0a0c12; }
      `}</style>
    </div>
  );
}
