import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import API from "../services/api";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const C = {
  gold:    "#D4AF37",
  green:   "#50DC78",
  red:     "#E55050",
  amber:   "#F0B429",
  
  blue:    "#60A5FA",
  purple:  "#A78BFA",
  bg:      "#080A0E",
  card:    "rgba(255,255,255,0.02)",
  border:  "rgba(255,255,255,0.07)",
  text:    "#ffffff",
  muted:   "rgba(255,255,255,0.35)",
  faint:   "rgba(255,255,255,0.12)",
};

const FONT_SERIF = "'Cormorant Garamond', serif";
const FONT_SANS  = "'Syne', sans-serif";

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function fmtMCap(n) {
  if (!n && n !== 0) return "—";
  const v = Number(n);           // already in $M from Finnhub
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(2)}B`;
  return `$${v.toFixed(0)}M`;
}
function fmtPrice(n) {
  if (n == null || n === "") return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n, dec = 2) {
  if (n == null) return "—";
  return Number(n).toFixed(dec);
}
function fmtPct(n) {
  if (n == null) return "—";
  return `${Number(n).toFixed(2)}%`;
}

/* ═══════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════ */

function Skeleton({ w = "100%", h = 14, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.06)",
      animation: "shimmer 1.6s infinite",
    }} />
  );
}

/* ── Custom dark dropdown (replaces native <select>) ── */
function CustomSelect({ value, onChange, options, placeholder, minWidth = 140 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = value && value !== "ALL";

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const label = selected ? selected.label : placeholder;

  return (
    <div ref={ref} style={{ position: "relative", minWidth }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "10px 14px",
          background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${active ? "rgba(212,175,55,0.4)" : open ? "rgba(255,255,255,0.15)" : C.border}`,
          borderRadius: 12, color: active ? C.gold : C.muted,
          fontSize: 12, fontFamily: FONT_SANS, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          transition: "all .15s", whiteSpace: "nowrap",
        }}
      >
        <span>{label}</span>
        <svg width="9" height="6" viewBox="0 0 9 6" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>
          <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "rgba(12,15,22,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12, overflow: "hidden", zIndex: 200,
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          animation: "fadeSlideUp 0.15s ease both",
          maxHeight: 280, overflowY: "auto",
        }}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 12,
                fontFamily: FONT_SANS,
                color: opt.value === value ? C.gold : "rgba(255,255,255,0.65)",
                background: opt.value === value ? "rgba(212,175,55,0.08)" : "transparent",
                borderBottom: i < options.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                transition: "background .1s",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = "transparent"; }}
            >
              {opt.label}
              {opt.value === value && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1.5 4L4 6.5L8.5 1.5" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangePill({ value }) {
  const n = Number(value) || 0;
  const pos = n > 0, neg = n < 0;
  const color  = pos ? C.green : neg ? C.red : C.muted;
  const bg     = pos ? "rgba(80,220,120,0.1)" : neg ? "rgba(229,80,80,0.1)" : "rgba(255,255,255,0.05)";
  const border = pos ? "rgba(80,220,120,0.25)" : neg ? "rgba(229,80,80,0.25)" : C.faint;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      color, background: bg, border: `1px solid ${border}`,
      fontFamily: FONT_SANS, letterSpacing: "0.03em",
      whiteSpace: "nowrap",
    }}>
      {(pos || neg) && (
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
          {pos
            ? <path d="M3 0.5L5.5 4.5H0.5L3 0.5Z" fill="currentColor" />
            : <path d="M3 5.5L0.5 1.5H5.5L3 5.5Z" fill="currentColor" />
          }
        </svg>
      )}
      {pos ? "+" : ""}{fmtNum(value, 2)}%
    </span>
  );
}

function SectorBadge({ label }) {
  const palette = {
    "Technology":          { c: C.blue,   bg: "rgba(96,165,250,0.08)"  },
    "Energy":              { c: C.amber,  bg: "rgba(240,180,41,0.08)"  },
    "Healthcare":          { c: C.green,  bg: "rgba(80,220,120,0.08)"  },
    "Financials":          { c: C.gold,   bg: "rgba(212,175,55,0.08)"  },
    "Consumer Cyclical":   { c: C.purple, bg: "rgba(167,139,250,0.08)" },
    "Industrials":         { c: "#F97316",bg: "rgba(249,115,22,0.08)"  },
    "Communication Services": { c: "#22D3EE", bg: "rgba(34,211,238,0.08)" },
    "Consumer Defensive":  { c: C.green,  bg: "rgba(80,220,120,0.08)"  },
    "Real Estate":         { c: C.amber,  bg: "rgba(240,180,41,0.08)"  },
    "Utilities":           { c: C.muted,  bg: "rgba(255,255,255,0.06)" },
    "Basic Materials":     { c: "#A3E635",bg: "rgba(163,230,53,0.08)"  },
  };
  const style = palette[label] || { c: C.muted, bg: "rgba(255,255,255,0.05)" };
  return (
    <span style={{
      fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
      fontFamily: FONT_SANS, fontWeight: 700,
      color: style.c, background: style.bg,
      border: `1px solid ${style.c}25`,
      padding: "2px 7px", borderRadius: 4,
      whiteSpace: "nowrap",
    }}>{label || "Other"}</span>
  );
}

function SortIcon({ active, dir }) {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ marginLeft: 4, flexShrink: 0 }}>
      <path d="M4 1L7 4.5H1L4 1Z"
        fill={active && dir === "asc" ? C.gold : "rgba(255,255,255,0.2)"} />
      <path d="M4 11L1 7.5H7L4 11Z"
        fill={active && dir === "desc" ? C.gold : "rgba(255,255,255,0.2)"} />
    </svg>
  );
}

function LogoCell({ logo, name, symbol }) {
  const [err, setErr] = useState(false);
  const initials = (name || symbol || "?").slice(0, 2).toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {logo && !err
        ? <img src={logo} alt={symbol} onError={() => setErr(true)}
            style={{ width: 26, height: 26, borderRadius: 6, objectFit: "contain",
                     background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}` }} />
        : <div style={{
            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
            background: `rgba(212,175,55,0.1)`, border: `1px solid rgba(212,175,55,0.2)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: C.gold, fontFamily: FONT_SANS,
          }}>{initials}</div>
      }
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT_SANS, lineHeight: 1.2 }}>
          {symbol}
        </div>
        {name && (
          <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_SANS, marginTop: 1,
                        maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricTile({ label, value, sub, color = C.gold, delay = 0 }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: "20px 22px",
      animation: `fadeSlideUp 0.5s ${delay}s ease both`,
      position: "relative", overflow: "hidden", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: -36, right: -36, width: 100, height: 100,
        borderRadius: "50%", pointerEvents: "none",
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      }} />
      <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.28)", marginBottom: 8, fontFamily: FONT_SANS }}>
        {label}
      </p>
      <p style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 30, fontWeight: 300,
                  color, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: "5px 0 0", fontSize: 10, color: "rgba(255,255,255,0.28)", fontFamily: FONT_SANS }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAIL DRAWER
═══════════════════════════════════════════════════════════ */
function DetailDrawer({ row, onClose }) {
  if (!row) return null;
  const pos = row.change_pct > 0;
  const priceColor = pos ? C.green : row.change_pct < 0 ? C.red : C.muted;

  const Field = ({ label, val }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: `1px solid ${C.faint}` }}>
      <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_SANS, letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontFamily: FONT_SANS, fontWeight: 500 }}>{val}</span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)", zIndex: 200,
      }} />
      {/* Panel */}
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0,
        width: "min(480px, 95vw)", background: "rgba(10,12,18,0.98)",
        borderLeft: `1px solid rgba(212,175,55,0.15)`,
        zIndex: 201, overflowY: "auto",
        animation: "slideInRight 0.28s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Gold top accent */}
        <div style={{ height: 2, flexShrink: 0, background: "linear-gradient(90deg, #D4AF37, rgba(212,175,55,0.2), transparent)" }} />

        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${C.faint}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <LogoCell logo={row.logo} name={row.name} symbol={row.symbol} />
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
              borderRadius: 8, width: 32, height: 32, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", color: C.muted,
              flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_SERIF, fontSize: 42, fontWeight: 300,
                           color: priceColor, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {fmtPrice(row.price)}
            </span>
            <ChangePill value={row.change_pct} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: C.muted, fontFamily: FONT_SANS }}>
            {row.exchange} · {row.currency} · <SectorBadge label={row.sector} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: "20px 28px", flex: 1 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
                      color: "rgba(212,175,55,0.5)", fontFamily: FONT_SANS, marginBottom: 4 }}>
            Market Data
          </p>
          <Field label="Market Cap"   val={fmtMCap(row.market_cap)} />
          <Field label="Open"         val={fmtPrice(row.open)} />
          <Field label="Day High"     val={fmtPrice(row.high)} />
          <Field label="Day Low"      val={fmtPrice(row.low)} />
          <Field label="Prev Close"   val={fmtPrice(row.prev_close)} />
          <Field label="52W High"     val={fmtPrice(row["52w_high"])} />
          <Field label="52W Low"      val={fmtPrice(row["52w_low"])} />

          <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
                      color: "rgba(212,175,55,0.5)", fontFamily: FONT_SANS,
                      marginTop: 20, marginBottom: 4 }}>
            Fundamentals
          </p>
          <Field label="P/E Ratio"    val={fmtNum(row.pe_ratio)} />
          <Field label="EPS"          val={fmtNum(row.eps)} />
          <Field label="Revenue TTM"  val={fmtMCap(row.revenue_ttm)} />
          <Field label="Gross Margin" val={fmtPct(row.gross_margin)} />
          <Field label="Debt / Equity" val={fmtNum(row.debt_equity)} />
          <Field label="ROE"          val={fmtPct(row.roe)} />
          <Field label="Beta"         val={fmtNum(row.beta)} />
        </div>

        {row.weburl && (
          <div style={{ padding: "16px 28px", borderTop: `1px solid ${C.faint}` }}>
            <a href={row.weburl} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, color: C.gold, fontFamily: FONT_SANS,
              textDecoration: "none", letterSpacing: "0.08em",
              opacity: 0.8,
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M2 9L9 2M9 2H4M9 2V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {row.weburl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   AUTOCOMPLETE DROPDOWN
═══════════════════════════════════════════════════════════ */
function SearchDropdown({ results, onSelect, loading }) {
  if (!results.length && !loading) return null;
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
      background: "rgba(10,12,18,0.98)", border: `1px solid rgba(212,175,55,0.2)`,
      borderRadius: 12, overflow: "hidden", zIndex: 100,
      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
    }}>
      {loading && (
        <div style={{ padding: "14px 16px" }}>
          <Skeleton w="60%" h={12} r={4} />
        </div>
      )}
      {results.map((r, i) => (
        <div key={i} onClick={() => onSelect(r.symbol)}
          style={{
            padding: "11px 16px", cursor: "pointer", display: "flex",
            justifyContent: "space-between", alignItems: "center",
            borderBottom: i < results.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
            transition: "background .12s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.06)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT_SANS }}>{r.symbol}</span>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_SANS, marginLeft: 8 }}>{r.description}</span>
          </div>
          {r.type && (
            <span style={{ fontSize: 8, color: C.muted, fontFamily: FONT_SANS,
                           letterSpacing: "0.1em", textTransform: "uppercase" }}>{r.type}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COLUMN DEFINITIONS
═══════════════════════════════════════════════════════════ */
const COLUMNS = [
  { key: "symbol",     label: "Company",    sortable: true,  w: "2fr",   render: (r) => <LogoCell logo={r.logo} name={r.name} symbol={r.symbol} /> },
  { key: "sector",     label: "Sector",     sortable: false, w: "1.3fr", render: (r) => <SectorBadge label={r.sector} /> },
  { key: "price",      label: "Price",      sortable: true,  w: "1fr",
    render: (r) => <span style={{ fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 300, color: C.text }}>{fmtPrice(r.price)}</span> },
  { key: "change_pct", label: "Change %",   sortable: true,  w: "1fr",   render: (r) => <ChangePill value={r.change_pct} /> },
  { key: "market_cap", label: "Mkt Cap",    sortable: true,  w: "1fr",
    render: (r) => <span style={{ fontSize: 12, fontFamily: FONT_SANS, color: "rgba(255,255,255,0.7)" }}>{fmtMCap(r.market_cap)}</span> },
  { key: "pe_ratio",   label: "P/E",        sortable: true,  w: "0.7fr",
    render: (r) => <span style={{ fontSize: 12, fontFamily: FONT_SANS, color: C.muted }}>{fmtNum(r.pe_ratio)}</span> },
  { key: "revenue_ttm",label: "Revenue",    sortable: true,  w: "1fr",
    render: (r) => <span style={{ fontSize: 12, fontFamily: FONT_SANS, color: C.muted }}>{fmtMCap(r.revenue_ttm)}</span> },
  { key: "debt_equity",label: "D/E",        sortable: true,  w: "0.7fr",
    render: (r) => <span style={{ fontSize: 12, fontFamily: FONT_SANS, color: C.muted }}>{fmtNum(r.debt_equity)}</span> },
  { key: "beta",       label: "Beta",       sortable: true,  w: "0.6fr",
    render: (r) => <span style={{ fontSize: 12, fontFamily: FONT_SANS, color: C.muted }}>{fmtNum(r.beta)}</span> },
];

const GRID = COLUMNS.map(c => c.w).join(" ");

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function LiveMarketPage() {
  // ── Data state ──────────────────────────────────────────
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [sectors, setSectors]     = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [cacheWarming, setCacheWarming] = useState(false);
  const [cacheAge, setCacheAge]   = useState(null);
  const pollRef                   = useRef(null);

  // ── Filter / sort / page state ──────────────────────────
  const [query, setQuery]         = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sector, setSector]       = useState("ALL");
  const [country, setCountry]     = useState("ALL");
  const [sortBy, setSortBy]       = useState("market_cap");
  const [sortDir, setSortDir]     = useState("desc");
  const [page, setPage]           = useState(1);
  const perPage                   = 20;

  // ── Autocomplete state ──────────────────────────────────
  const [suggestions, setSuggestions]   = useState([]);
  const [acLoading, setAcLoading]       = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef                        = useRef(null);

  // ── Detail drawer ───────────────────────────────────────
  const [detail, setDetail] = useState(null);

  // ── Inject CSS keyframes ─────────────────────────────────
  useEffect(() => {
    if (document.getElementById("mex-styles")) return;
    const s = document.createElement("style");
    s.id = "mex-styles";
    s.innerHTML = `
      @keyframes slideInRight { from{transform:translateX(60px);opacity:0} to{transform:translateX(0);opacity:1} }
      input[type=range] { -webkit-appearance:none; appearance:none; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#D4AF37; cursor:pointer; }
    `;
    document.head.appendChild(s);
  }, []);

  // ── Debounce search query ────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 500);
    return () => clearTimeout(t);
  }, [query]);

  // ── Autocomplete fetch ────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    setAcLoading(true);
    API.get("/market-explorer/search", { params: { q: query } })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setAcLoading(false));
  }, [query]);

  // ── Main data fetch ──────────────────────────────────────
  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const params = {
      page, per_page: perPage,
      sort_by: sortBy, sort_dir: sortDir,
    };
    if (debouncedQ.trim())  params.q       = debouncedQ.trim();
    if (sector  !== "ALL") params.sector  = sector;
    if (country !== "ALL") params.country = country;

    API.get("/market-explorer", { params })
      .then(res => {
        const d = res.data;
        const fetched = Array.isArray(d.data) ? d.data : [];
        setRows(fetched);
        setTotal(d.total ?? 0);
        setCacheWarming(d.refreshing ?? false);
        setCacheAge(d.cache_age_s ?? null);
        if (d.sectors?.length)   setSectors(d.sectors);
        if (d.countries?.length) setCountries(d.countries);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load market data. Check the backend is running on port 8001.");
      })
      .finally(() => setLoading(false));
  }, [debouncedQ, sector, country, sortBy, sortDir, page, perPage]);

  useEffect(() => { setPage(1); }, [debouncedQ, sector, country, sortBy, sortDir]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Auto-poll while cache is warming ─────────────────────
  useEffect(() => {
    if (cacheWarming) {
      pollRef.current = setInterval(() => fetchData(true), 4000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [cacheWarming, fetchData]);

  // ── Close dropdown on outside click ─────────────────────
  useEffect(() => {
    const handler = e => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Sort handler ─────────────────────────────────────────
  const handleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  // ── KPI aggregates from current result set ────────────────
  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const gainers = rows.filter(r => r.change_pct > 0).length;
    const losers  = rows.filter(r => r.change_pct < 0).length;
    const topG    = [...rows].sort((a,b) => b.change_pct - a.change_pct)[0];
    const topL    = [...rows].sort((a,b) => a.change_pct - b.change_pct)[0];
    return { gainers, losers, topG, topL, total };
  }, [rows, total]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  /* ── RENDER ── */
  return (
    <div style={{ animation: "fadeSlideUp 0.5s ease both", minHeight: "80vh" }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: C.green, animation: "pulseGold 2s infinite",
          }} />
          <p style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
                      color: "rgba(212,175,55,0.6)", fontFamily: FONT_SANS, margin: 0 }}>
            Global Market Explorer
          </p>
        </div>
        <h2 style={{
          fontFamily: FONT_SERIF,
          fontSize: "clamp(30px, 4vw, 50px)", fontWeight: 300,
          letterSpacing: "-0.03em", color: C.text, margin: 0, lineHeight: 1,
        }}>
          Market <span style={{ color: C.gold }}>Intelligence</span>
        </h2>
        <p style={{
          marginTop: 10, fontSize: 13, color: C.muted,
          letterSpacing: "0.03em", fontFamily: FONT_SANS,
        }}>
          Real-time quotes · Fundamental data · 48 major equities powered by Finnhub
        </p>
      </div>

      {/* ── Search + Filters row ── */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 24,
        flexWrap: "wrap", alignItems: "flex-start",
      }}>

        {/* ── Search bar ── */}
        <div ref={searchRef} style={{ position: "relative", flex: "1 1 320px" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                     pointerEvents: "none", opacity: 0.35 }}>
            <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.4"/>
            <path d="M10 10L13 13" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={query}
            placeholder="Search company or symbol… e.g. Apple, TSLA"
            onChange={e => setQuery(e.target.value)}
            onFocus={() => suggestions.length && setShowDropdown(true)}
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: `1px solid ${query ? "rgba(212,175,55,0.35)" : C.border}`,
              borderRadius: 12, padding: "12px 14px 12px 42px",
              color: C.text, fontSize: 13, fontFamily: FONT_SANS,
              outline: "none", transition: "all .2s", boxSizing: "border-box",
            }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setSuggestions([]); setShowDropdown(false); }} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.muted,
              padding: 4, display: "flex",
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <SearchDropdown
            results={suggestions} loading={acLoading}
            onSelect={sym => { setQuery(sym); setShowDropdown(false); }}
          />
        </div>

        <CustomSelect
          value={sector}
          onChange={setSector}
          minWidth={160}
          placeholder="All Sectors"
          options={[
            { value: "ALL", label: "All Sectors" },
            ...sectors.map(s => ({ value: s, label: s })),
          ]}
        />

        <CustomSelect
          value={country}
          onChange={setCountry}
          minWidth={140}
          placeholder="All Countries"
          options={[
            { value: "ALL", label: "All Countries" },
            ...countries.map(c => ({ value: c, label: c })),
          ]}
        />

        {/* ── Refresh button ── */}
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "rgba(212,175,55,0.08)", border: `1px solid rgba(212,175,55,0.25)`,
            borderRadius: 12, padding: "12px 18px", color: C.gold, cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11, fontFamily: FONT_SANS, letterSpacing: "0.12em",
            textTransform: "uppercase", fontWeight: 600, opacity: loading ? 0.5 : 1,
            display: "flex", alignItems: "center", gap: 7, transition: "all .18s",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
            <path d="M10 6a4 4 0 1 1-1.17-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── KPI tiles ── */}
      {kpis && !loading && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14, marginBottom: 24,
        }}>
          <MetricTile label="Instruments" value={kpis.total} sub="in result set" color={C.gold}  delay={0} />
          <MetricTile label="Gainers"     value={kpis.gainers}
            sub={kpis.topG ? `Led by ${kpis.topG.symbol}` : ""}   color={C.green} delay={0.05} />
          <MetricTile label="Losers"      value={kpis.losers}
            sub={kpis.topL ? `Worst ${kpis.topL.symbol}` : ""}    color={C.red}   delay={0.1} />
          <MetricTile label="Top Gainer"
            value={kpis.topG ? `+${fmtNum(kpis.topG.change_pct)}%` : "—"}
            sub={kpis.topG?.symbol ?? ""}  color={C.amber} delay={0.15} />
        </div>
      )}

      {/* ── Cache warming banner ── */}
      {cacheWarming && !error && (
        <div style={{
          background: "rgba(212,175,55,0.05)",
          border: "1px solid rgba(212,175,55,0.2)",
          borderRadius: 14, padding: "14px 22px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* Animated spinner */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
            style={{ animation: "spin 1.2s linear infinite", flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="rgba(212,175,55,0.2)" strokeWidth="2"/>
            <path d="M9 2a7 7 0 0 1 7 7" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: C.gold, fontFamily: FONT_SANS, fontWeight: 600 }}>
              Fetching live Finnhub data — {rows.length} symbols loaded so far
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 10, color: C.muted, fontFamily: FONT_SANS }}>
              The cache is warming. The table updates automatically every 4 seconds until complete.
            </p>
          </div>
          {rows.length > 0 && (
            <span style={{
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: C.green, fontFamily: FONT_SANS, fontWeight: 600,
              background: "rgba(80,220,120,0.08)", border: "1px solid rgba(80,220,120,0.2)",
              padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap",
            }}>Live partial data</span>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: "rgba(229,80,80,0.06)", border: "1px solid rgba(229,80,80,0.2)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3L18 17H2L10 3Z" stroke="#E55050" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M10 8v4M10 14v.5" stroke="#E55050" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(229,80,80,0.9)", fontFamily: FONT_SANS }}>
            {error}
          </p>
        </div>
      )}


      {/* ── Table card ── */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, overflow: "hidden", position: "relative",
      }}>
        {/* Corner glow */}
        <div style={{
          position: "absolute", top: -80, right: -80, width: 260, height: 260,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)",
        }} />

        {/* Column headers */}
        <div style={{
          display: "grid", gridTemplateColumns: GRID,
          padding: "14px 24px",
          borderBottom: `1px solid rgba(255,255,255,0.05)`,
        }}>
          {COLUMNS.map(col => (
            <div key={col.key}
              onClick={() => col.sortable && handleSort(col.key)}
              style={{
                display: "flex", alignItems: "center",
                fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
                color: sortBy === col.key ? C.gold : "rgba(255,255,255,0.22)",
                fontFamily: FONT_SANS, fontWeight: 700,
                cursor: col.sortable ? "pointer" : "default",
                userSelect: "none", transition: "color .15s",
              }}
            >
              {col.label}
              {col.sortable && <SortIcon active={sortBy === col.key} dir={sortDir} />}
            </div>
          ))}
        </div>

        {/* ── Loading skeleton rows ── */}
        {loading && (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: GRID,
              padding: "16px 24px",
              borderBottom: `1px solid rgba(255,255,255,0.03)`,
              gap: 8,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Skeleton w={26} h={26} r={6} />
                <div><Skeleton w={60} h={12} r={4} /><div style={{marginTop:4}}><Skeleton w={100} h={9} r={3} /></div></div>
              </div>
              {[1,2,3,4,5,6,7,8].map(j => <Skeleton key={j} w="65%" h={12} r={4} />)}
            </div>
          ))
        )}

        {/* ── Empty state ── */}
        {!loading && rows.length === 0 && (
          <div style={{
            padding: "64px 28px", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "rgba(212,175,55,0.06)", border: `1px solid rgba(212,175,55,0.15)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 16L7 10l4 4 5-7 2 3" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 300, color: "rgba(255,255,255,0.4)", margin: 0 }}>
              No results found
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: FONT_SANS }}>
              Try a different symbol, sector, or country filter.
            </p>
          </div>
        )}

        {/* ── Data rows ── */}
        {!loading && rows.map((row, idx) => (
          <div
            key={row.symbol}
            onClick={() => setDetail(row)}
            style={{
              display: "grid", gridTemplateColumns: GRID,
              padding: "15px 24px", cursor: "pointer",
              borderBottom: `1px solid rgba(255,255,255,0.03)`,
              background: detail?.symbol === row.symbol
                ? "rgba(212,175,55,0.06)"
                : "transparent",
              transition: "background .14s",
              alignItems: "center",
            }}
            onMouseEnter={e => {
              if (detail?.symbol !== row.symbol)
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
            }}
            onMouseLeave={e => {
              if (detail?.symbol !== row.symbol)
                e.currentTarget.style.background = "transparent";
            }}
          >
            {COLUMNS.map(col => (
              <div key={col.key} style={{ overflow: "hidden" }}>
                {col.render(row)}
              </div>
            ))}
          </div>
        ))}

        {/* ── Footer / Pagination ── */}
        {!loading && rows.length > 0 && (
          <div style={{
            padding: "16px 24px",
            borderTop: `1px solid rgba(255,255,255,0.05)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: FONT_SANS, letterSpacing: "0.08em" }}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total} instruments
            </span>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <PagBtn disabled={page === 1} onClick={() => setPage(1)}>«</PagBtn>
              <PagBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</PagBtn>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <PagBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PagBtn>
                );
              })}
              <PagBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</PagBtn>
              <PagBtn disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</PagBtn>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "pulseGold 2s infinite" }} />
              <span style={{ fontSize: 10, color: "rgba(80,220,120,0.7)", fontFamily: FONT_SANS,
                             letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Finnhub Live
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      <DetailDrawer row={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ── Pagination button ── */
function PagBtn({ children, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 8, cursor: disabled ? "default" : "pointer",
        background: active ? "rgba(212,175,55,0.15)" : "transparent",
        border: `1px solid ${active ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.07)"}`,
        color: active ? C.gold : disabled ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)",
        fontSize: 12, fontFamily: FONT_SANS, fontWeight: active ? 600 : 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .15s",
      }}
    >{children}</button>
  );
}