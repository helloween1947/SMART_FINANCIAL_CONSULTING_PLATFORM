import { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
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

const SENT_META = {
  "Bullish":          { color: "#50DC78", bg: "rgba(80,220,120,0.10)",  border: "rgba(80,220,120,0.25)"  },
  "Slightly Bullish": { color: "#4ADE80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.20)"  },
  "Neutral":          { color: "#D4AF37", bg: "rgba(212,175,55,0.10)",  border: "rgba(212,175,55,0.25)"  },
  "Slightly Bearish": { color: "#FB923C", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.25)"  },
  "Bearish":          { color: "#E55050", bg: "rgba(229,80,80,0.10)",   border: "rgba(229,80,80,0.25)"   },
};

const CATEGORIES = [
  { id: "general", label: "Market News" },
  { id: "merger",  label: "M&A" },
  { id: "forex",   label: "Forex" },
  { id: "crypto",  label: "Crypto" },
];

const POPULAR_STOCKS = ["AAPL","NVDA","MSFT","TSLA","GOOGL","META","AMZN","JPM","NFLX","AMD"];

/* ══════════════════════ HELPERS ════════════════════════════ */
function timeAgo(isoStr) {
  if (!isoStr) return "";
  const h = (Date.now() - new Date(isoStr).getTime()) / 3_600_000;
  if (h < 1)   return `${Math.round(h * 60)}m ago`;
  if (h < 24)  return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function scoreBar(score) {
  // -1 to +1 → position on bar
  const norm = (score + 1) / 2; // 0 to 1
  const c = score >= 0.35 ? "#50DC78" : score >= 0.12 ? "#4ADE80" :
            score >= -0.12 ? GOLD : score >= -0.35 ? "#FB923C" : "#E55050";
  return { norm, color: c };
}

/* ══════════════════════ SENTIMENT GAUGE ═══════════════════ */
function SentimentGauge({ score, label, color, articleCount }) {
  const norm = (score + 1) / 2;
  const R = 70, CX = 90, CY = 85;
  const startAngle = Math.PI;
  const sweepAngle = norm * Math.PI;
  const endAngle = Math.PI - sweepAngle;
  const x1 = CX + R * Math.cos(startAngle);
  const y1 = CY - R * Math.sin(startAngle);
  const x2 = CX + R * Math.cos(endAngle);
  const y2 = CY - R * Math.sin(endAngle);
  const needleAngle = Math.PI - norm * Math.PI;
  const nx = CX + (R - 10) * Math.cos(needleAngle);
  const ny = CY - (R - 10) * Math.sin(needleAngle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="180" height="110" viewBox="0 0 180 110" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#E55050"/>
            <stop offset="25%"  stopColor="#FB923C"/>
            <stop offset="50%"  stopColor="#D4AF37"/>
            <stop offset="75%"  stopColor="#4ADE80"/>
            <stop offset="100%" stopColor="#50DC78"/>
          </linearGradient>
          <filter id="ng"><feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* BG arc */}
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round"/>
        {/* Colored arc */}
        <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${sweepAngle > Math.PI / 2 ? 0 : 0} 1 ${x2} ${y2}`}
          fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}/>
        {/* Labels */}
        {[[-10,"Bear"],[0,"Neut"],[10,"Bull"]].map(([v, lbl]) => {
          const a = Math.PI - ((v + 10) / 20) * Math.PI;
          const lx = CX + (R + 18) * Math.cos(a);
          const ly = CY - (R + 18) * Math.sin(a);
          return <text key={v} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.18)" fontSize="7" fontFamily={F}>{lbl}</text>;
        })}
        {/* Needle */}
        <line x1={CX} y1={CY} x2={nx} y2={ny}
          stroke={color} strokeWidth="2" strokeLinecap="round" filter="url(#ng)"/>
        <circle cx={CX} cy={CY} r="5" fill="rgba(10,12,18,1)" stroke={color} strokeWidth="1.5"/>
        <circle cx={CX} cy={CY} r="2" fill={color}/>
        {/* Score */}
        <text x={CX} y={CY + 22} textAnchor="middle" fill={color}
          fontSize="18" fontFamily={FS} fontWeight="300">
          {score >= 0 ? "+" : ""}{score.toFixed(2)}
        </text>
        <text x={CX} y={CY + 34} textAnchor="middle"
          fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily={F} letterSpacing="1">
          SENTIMENT
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: -4 }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color,
          letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontFamily: F, fontSize: 9, color: MUT }}>{articleCount} articles analyzed</span>
      </div>
    </div>
  );
}

/* ══════════════════════ DISTRIBUTION PIE ══════════════════ */
function DistPie({ dist }) {
  const data = [
    { name: "Bullish",  value: dist.bullish, color: "#50DC78" },
    { name: "Neutral",  value: dist.neutral, color: GOLD },
    { name: "Bearish",  value: dist.bearish, color: "#E55050" },
  ].filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie data={data} cx="50%" cy="65%" innerRadius={38} outerRadius={58}
          paddingAngle={3} dataKey="value" strokeWidth={0}>
          {data.map(d => <Cell key={d.name} fill={d.color} fillOpacity={0.85}/>)}
        </Pie>
        <Tooltip
          contentStyle={{ background: "rgba(10,12,18,0.97)", border: `1px solid ${BD}`,
            borderRadius: 10, fontFamily: F, fontSize: 11 }}
          itemStyle={{ color: TXT }}
          formatter={(v, n) => [`${v} articles`, n]}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ══════════════════════ DIGEST PANEL ══════════════════════ */
function DigestPanel({ digest, name }) {
  if (!digest) return null;
  const meta = SENT_META[digest.overall_label] || SENT_META["Neutral"];
  const dist = digest.distribution || {};
  const total = (dist.bullish || 0) + (dist.neutral || 0) + (dist.bearish || 0);

  return (
    <div style={{
      background: BG, border: `1px solid ${BD}`, borderRadius: 20,
      padding: "26px 30px", marginBottom: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Top stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${meta.color}90, rgba(255,255,255,0.04) 60%, transparent)` }}/>
      {/* Glow */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 240, height: 180,
        background: `radial-gradient(ellipse, ${meta.color}12 0%, transparent 70%)`,
        pointerEvents: "none" }}/>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "start" }}>

        {/* Gauge */}
        <SentimentGauge
          score={digest.overall_score}
          label={digest.overall_label}
          color={meta.color}
          articleCount={digest.article_count || total}/>

        {/* Summary text */}
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: MUT, fontFamily: F }}>
            ◈ AI Market Digest{name ? ` — ${name}` : ""}
          </p>
          <p style={{ margin: "0 0 14px", fontFamily: F, fontSize: 13, lineHeight: 1.85,
            color: TXT }}
            dangerouslySetInnerHTML={{ __html: digest.summary
              .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#fff;font-weight:700">$1</strong>`) }}
          />
          {/* Score bar */}
          <div style={{ height: 6, borderRadius: 3,
            background: "linear-gradient(90deg,#E55050,#FB923C 25%,#D4AF37 50%,#4ADE80 75%,#50DC78)",
            position: "relative", marginBottom: 6, opacity: 0.5 }}/>
          <div style={{ position: "relative", height: 0 }}>
            <div style={{
              position: "absolute",
              left: `${((digest.overall_score + 1) / 2) * 100}%`,
              top: -16, width: 8, height: 8, borderRadius: "50%",
              background: meta.color, transform: "translateX(-50%)",
              boxShadow: `0 0 8px ${meta.color}`,
            }}/>
          </div>
        </div>

        {/* Pie + counts */}
        <div style={{ minWidth: 140 }}>
          <DistPie dist={dist}/>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
            {[["Bullish", "#50DC78", dist.bullish], ["Neutral", GOLD, dist.neutral],
              ["Bearish", "#E55050", dist.bearish]].map(([lbl, c, v]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }}/>
                  <span style={{ fontFamily: F, fontSize: 9, color: MUT }}>{lbl}</span>
                </div>
                <span style={{ fontFamily: FS, fontSize: 14, color: c }}>
                  {v || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ NEWS CARD ══════════════════════════ */
function NewsCard({ article, expanded, onToggle }) {
  const meta = SENT_META[article.sentiment_label] || SENT_META["Neutral"];
  const { color: barColor } = scoreBar(article.sentiment_score);

  return (
    <div
      onClick={onToggle}
      style={{
        background: BG, border: `1px solid ${expanded ? meta.border : BD}`,
        borderRadius: 16, overflow: "hidden", cursor: "pointer",
        transition: "all .2s ease",
        boxShadow: expanded ? `0 0 24px ${meta.color}18` : "none",
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.borderColor = BD; }}
    >
      {/* Sentiment top bar */}
      <div style={{ height: 3, background: meta.color, opacity: 0.7 }}/>

      <div style={{ padding: "16px 18px" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            {/* Source + time */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: 9, color: MUT, fontFamily: F,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {article.source}
              </span>
              <span style={{ width: 2, height: 2, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)" }}/>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: F }}>
                {timeAgo(article.timestamp)}
              </span>
              {article.related && (
                <>
                  <span style={{ width: 2, height: 2, borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)" }}/>
                  <span style={{ fontSize: 9, color: GOLD, fontFamily: F,
                    fontWeight: 700 }}>{article.related}</span>
                </>
              )}
            </div>
            {/* Headline */}
            <h4 style={{ margin: 0, fontFamily: FS, fontSize: 15, fontWeight: 400,
              color: "#fff", lineHeight: 1.4,
              display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2,
              WebkitBoxOrient: "vertical", overflow: expanded ? "visible" : "hidden" }}>
              {article.headline}
            </h4>
          </div>

          {/* Sentiment badge */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4 }}>
            <div style={{
              padding: "4px 10px", borderRadius: 20,
              background: meta.bg, border: `1px solid ${meta.border}`,
              whiteSpace: "nowrap",
            }}>
              <span style={{ fontFamily: F, fontSize: 9, color: meta.color,
                fontWeight: 700, letterSpacing: "0.08em" }}>
                {article.sentiment_label}
              </span>
            </div>
            <span style={{ fontFamily: FS, fontSize: 13, color: meta.color }}>
              {article.sentiment_score >= 0 ? "+" : ""}{article.sentiment_score.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.05)",
          position: "relative", marginBottom: expanded ? 14 : 0 }}>
          <div style={{ position: "absolute", left: "50%", top: 0, width: 1,
            height: "100%", background: "rgba(255,255,255,0.1)" }}/>
          <div style={{
            position: "absolute",
            left: article.sentiment_score >= 0 ? "50%" : `${(1 + article.sentiment_score) / 2 * 100}%`,
            width: `${Math.abs(article.sentiment_score) / 2 * 100}%`,
            height: "100%", borderRadius: 2, background: barColor,
          }}/>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div style={{ animation: "fadeUp 0.25s ease both" }}>
            {article.summary && (
              <p style={{ margin: "0 0 14px", fontFamily: F, fontSize: 12,
                lineHeight: 1.7, color: MUT }}>
                {article.summary}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${BD}`,
                  color: MUT, fontFamily: F }}>{article.category}</span>
              </div>
              {article.url && (
                <a href={article.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 10, color: GOLD, fontFamily: F,
                    textDecoration: "none", fontWeight: 700 }}>
                  Read Full Article ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════ LOADING SKELETON ════════════════════ */
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 16,
          padding: "18px", animation: `shimmer 1.6s ${i * 0.08}s infinite` }}>
          <div style={{ height: 8, width: "25%", borderRadius: 4,
            background: "rgba(255,255,255,0.06)", marginBottom: 10 }}/>
          <div style={{ height: 12, width: "80%", borderRadius: 4,
            background: "rgba(255,255,255,0.06)", marginBottom: 6 }}/>
          <div style={{ height: 12, width: "60%", borderRadius: 4,
            background: "rgba(255,255,255,0.06)" }}/>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════ MAIN PAGE ══════════════════════════ */
export default function NewsPage() {
  const [mode,       setMode]       = useState("market");   // "market" | "stock"
  const [category,   setCategory]   = useState("general");
  const [symbol,     setSymbol]     = useState("");
  const [inputSym,   setInputSym]   = useState("");
  const [filter,     setFilter]     = useState("all");       // all|bullish|neutral|bearish
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [days,       setDays]       = useState(7);
  const inputRef = useRef(null);

  const fetchNews = useCallback(async (opts = {}) => {
    setLoading(true); setData(null); setExpandedId(null);
    try {
      const m   = opts.mode     ?? mode;
      const cat = opts.category ?? category;
      const sym = opts.symbol   ?? symbol;
      const d   = opts.days     ?? days;

      let url, params;
      if (m === "market") {
        url = `/news/market`; params = { category: cat, limit: 40 };
      } else {
        if (!sym) { setLoading(false); return; }
        url = `/news/stock/${sym}`; params = { days: d, limit: 30 };
      }
      const r = await API.get(url, { params });
      setData(r.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mode, category, symbol, days]);

  // Auto-fetch market news on mount
  useEffect(() => { fetchNews({ mode: "market" }); }, []); // eslint-disable-line

  const switchCategory = (cat) => {
    setCategory(cat); setMode("market");
    fetchNews({ mode: "market", category: cat });
  };

  const searchStock = () => {
    const s = inputSym.trim().toUpperCase();
    if (!s) return;
    setSymbol(s); setMode("stock");
    fetchNews({ mode: "stock", symbol: s });
  };

  const switchToMarket = () => {
    setMode("market"); setSymbol(""); setInputSym("");
    fetchNews({ mode: "market", category });
  };

  // Filter articles
  const articles = data?.articles || [];
  const filtered = articles.filter(a => {
    if (filter === "all")     return true;
    if (filter === "bullish") return a.sentiment_score >= 0.12;
    if (filter === "bearish") return a.sentiment_score <= -0.12;
    if (filter === "neutral") return a.sentiment_score > -0.12 && a.sentiment_score < 0.12;
    return true;
  });

  const bullCount = articles.filter(a => a.sentiment_score >= 0.12).length;
  const bearCount = articles.filter(a => a.sentiment_score <= -0.12).length;
  const neutCount = articles.length - bullCount - bearCount;

  return (
    <div style={{ animation: "fadeUp 0.45s ease both" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: FS, fontSize: "clamp(30px,4vw,50px)",
          fontWeight: 300, letterSpacing: "-0.03em", color: "#fff", margin: 0 }}>
          News <span style={{ color: GOLD }}>Intelligence</span>
        </h2>
        <p style={{ marginTop: 8, fontSize: 12, color: MUT, fontFamily: F }}>
          Live headlines · AI-scored sentiment · Morningstar-style digest
        </p>
      </div>

      <div style={{ height: 1, marginBottom: 26,
        background: "linear-gradient(90deg,rgba(212,175,55,0.45),rgba(255,255,255,0.04) 50%,transparent)" }}/>

      {/* ── MODE + SEARCH BAR ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>

        {/* Stock search */}
        <div style={{ display: "flex", flex: 1, minWidth: 260,
          borderRadius: 12, border: `1px solid ${G30}`,
          background: "rgba(10,12,18,0.8)", overflow: "hidden" }}>
          <div style={{ display:"flex", alignItems:"center", paddingLeft:14 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="rgba(212,175,55,0.5)" strokeWidth="1.4"/>
              <path d="M11 11L14 14" stroke="rgba(212,175,55,0.5)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            ref={inputRef}
            value={inputSym}
            onChange={e => setInputSym(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && searchStock()}
            placeholder="Search stock news: AAPL, NVDA…"
            style={{ flex: 1, background: "none", border: "none", outline: "none",
              padding: "12px 12px", color: "#fff", fontSize: 12, fontFamily: F,
              caretColor: GOLD, letterSpacing: "0.05em" }}
          />
          <button onClick={searchStock} style={{
            padding: "0 18px", background: G10,
            border: "none", borderLeft: `1px solid ${G30}`,
            color: GOLD, fontSize: 10, fontFamily: F, fontWeight: 700,
            cursor: "pointer", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Search
          </button>
        </div>

        {/* Market mode button */}
        <button onClick={switchToMarket} style={{
          padding: "0 18px", borderRadius: 12, cursor: "pointer",
          background: mode === "market" ? G10 : "rgba(255,255,255,0.03)",
          border: `1px solid ${mode === "market" ? G30 : BD}`,
          color: mode === "market" ? GOLD : MUT,
          fontSize: 10, fontFamily: F, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>Market News</button>

        {/* Days selector (stock mode) */}
        {mode === "stock" && (
          <select value={days} onChange={e => {
            const d = Number(e.target.value); setDays(d);
            fetchNews({ days: d });
          }} style={{
            padding: "0 14px", borderRadius: 12,
            background: "rgba(10,12,18,0.9)", border: `1px solid ${BD}`,
            color: MUT, fontSize: 11, fontFamily: F, cursor: "pointer",
          }}>
            {[3, 7, 14, 30].map(d => (
              <option key={d} value={d}>Past {d} days</option>
            ))}
          </select>
        )}

        {/* Refresh */}
        <button onClick={() => fetchNews()} style={{
          padding: "0 16px", borderRadius: 12, cursor: "pointer",
          background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`,
          color: MUT, fontSize: 10, fontFamily: F,
        }} title="Refresh">⟳ Refresh</button>
      </div>

      {/* ── CATEGORY TABS (market mode) ── */}
      {mode === "market" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => switchCategory(c.id)} style={{
              padding: "6px 16px", borderRadius: 20, cursor: "pointer",
              background: category === c.id ? G10 : "rgba(255,255,255,0.03)",
              border: `1px solid ${category === c.id ? G30 : BD}`,
              color: category === c.id ? GOLD : MUT,
              fontSize: 10, fontFamily: F, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              transition: "all .14s",
            }}>{c.label}</button>
          ))}
        </div>
      )}

      {/* ── POPULAR STOCKS (market mode) ── */}
      {mode === "market" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: MUT, fontFamily: F,
            letterSpacing: "0.12em", textTransform: "uppercase" }}>Stock News:</span>
          {POPULAR_STOCKS.map(s => (
            <button key={s} onClick={() => {
              setInputSym(s); setSymbol(s); setMode("stock");
              fetchNews({ mode: "stock", symbol: s });
            }} style={{
              padding: "3px 10px", borderRadius: 8, cursor: "pointer",
              background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`,
              color: MUT, fontSize: 10, fontFamily: F, transition: "all .14s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G30; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BD; e.currentTarget.style.color = MUT; }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* ── DIGEST PANEL ── */}
      {!loading && data?.digest && (
        <DigestPanel
          digest={data.digest}
          name={mode === "stock" ? (data.name || symbol) : null}
        />
      )}

      {/* ── FILTER TABS ── */}
      {!loading && articles.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, alignItems: "center",
          flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: MUT, fontFamily: F,
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginRight: 4 }}>Filter:</span>
          {[
            { id: "all",     label: `All (${articles.length})`,   color: "#fff"     },
            { id: "bullish", label: `Bullish (${bullCount})`,      color: "#50DC78"  },
            { id: "neutral", label: `Neutral (${neutCount})`,      color: GOLD       },
            { id: "bearish", label: `Bearish (${bearCount})`,      color: "#E55050"  },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: "5px 14px", borderRadius: 20, cursor: "pointer",
              background: filter === f.id ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${filter === f.id ? "rgba(255,255,255,0.15)" : BD}`,
              color: filter === f.id ? f.color : MUT,
              fontSize: 10, fontFamily: F, fontWeight: filter === f.id ? 700 : 400,
              transition: "all .13s",
            }}>{f.label}</button>
          ))}

          <span style={{ marginLeft: "auto", fontSize: 10, color: MUT, fontFamily: F }}>
            {filtered.length} articles
          </span>
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && <Skeleton/>}

      {/* ── NO DATA ── */}
      {!loading && !data && (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%",
            background: G10, border: `1px solid ${G30}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 10h16M4 14h10" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontFamily: FS, fontSize: 24, fontWeight: 300, color: TXT, margin: "0 0 8px" }}>
            Enter a stock symbol or browse market news
          </p>
          <p style={{ fontFamily: F, fontSize: 11, color: MUT }}>
            AI-powered sentiment analysis across headlines
          </p>
        </div>
      )}

      {/* ── NEWS GRID ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 10 }}>
          {filtered.map(a => (
            <NewsCard
              key={a.id || a.headline}
              article={a}
              expanded={expandedId === (a.id || a.headline)}
              onToggle={() => setExpandedId(
                expandedId === (a.id || a.headline) ? null : (a.id || a.headline)
              )}
            />
          ))}
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!loading && data && filtered.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center",
          background: BG, border: `1px solid ${BD}`, borderRadius: 16 }}>
          <p style={{ margin: 0, fontFamily: F, fontSize: 12, color: MUT }}>
            No {filter !== "all" ? filter : ""} articles found
            {mode === "stock" ? ` for ${symbol} in the past ${days} days` : ""}.
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
