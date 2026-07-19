import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell,
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

const RATING_META = {
  "Strong Buy":  { color: "#50DC78", bg: "rgba(80,220,120,0.10)",  glow: "rgba(80,220,120,0.25)",  icon: "▲▲", needle: 0.92 },
  "Buy":         { color: "#4ADE80", bg: "rgba(74,222,128,0.08)",  glow: "rgba(74,222,128,0.20)",  icon: "▲",  needle: 0.72 },
  "Hold":        { color: "#D4AF37", bg: "rgba(212,175,55,0.10)",  glow: "rgba(212,175,55,0.22)",  icon: "●",  needle: 0.50 },
  "Sell":        { color: "#FB923C", bg: "rgba(251,146,60,0.10)",  glow: "rgba(251,146,60,0.22)",  icon: "▼",  needle: 0.28 },
  "Strong Sell": { color: "#E55050", bg: "rgba(229,80,80,0.10)",   glow: "rgba(229,80,80,0.25)",   icon: "▼▼", needle: 0.08 },
};

const SIGNAL_ICONS = {
  "Valuation":         "◈",
  "Growth":            "⟳",
  "Financial Health":  "⬡",
  "Momentum":          "⟶",
  "Analyst Consensus": "⊕",
  "Risk / Volatility": "◬",
};

/* ══════════════════════ SCORE GAUGE (SVG speedometer) ══════ */
function ScoreGauge({ score, rating }) {
  const meta = RATING_META[rating] || RATING_META["Hold"];
  const CX = 130, CY = 120, R = 90, THICK = 14;

  // Arc from 180° → 0° (top half of circle)
  const arc = (fromDeg, toDeg, r) => {
    const toR = (d) => (d * Math.PI) / 180;
    const x1 = CX + r * Math.cos(toR(fromDeg));
    const y1 = CY - r * Math.sin(toR(fromDeg));
    const x2 = CX + r * Math.cos(toR(toDeg));
    const y2 = CY - r * Math.sin(toR(toDeg));
    const large = fromDeg - toDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  // Segment arcs (each 36°)
  const segs = [
    { from: 180, to: 144, color: "#E55050" },
    { from: 144, to: 108, color: "#FB923C" },
    { from: 108, to:  72, color: "#D4AF37" },
    { from:  72, to:  36, color: "#4ADE80" },
    { from:  36, to:   0, color: "#50DC78" },
  ];

  // Needle position: score -10..+10 → angle 180°..0°
  const norm = Math.max(0, Math.min(1, (score + 10) / 20));
  const needleDeg = 180 - norm * 180;
  const needleRad = (needleDeg * Math.PI) / 180;
  const nTipX = CX + (R - 8) * Math.cos(needleRad);
  const nTipY = CY - (R - 8) * Math.sin(needleRad);
  const nBackX = CX + 18 * Math.cos(needleRad + Math.PI);
  const nBackY = CY - 18 * Math.sin(needleRad + Math.PI);

  return (
    <svg width="260" height="150" viewBox="0 0 260 150" style={{ overflow: "visible" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background arcs */}
      {segs.map(s => (
        <path key={s.from} d={arc(s.from, s.to, R)}
          stroke={s.color} strokeWidth={THICK} fill="none" opacity="0.12" strokeLinecap="butt"/>
      ))}

      {/* Colored fill up to score */}
      {segs.map(s => {
        const segNormFrom = (180 - s.from) / 180;
        const segNormTo   = (180 - s.to)   / 180;
        if (norm <= segNormFrom) return null;
        const clipTo = Math.min(norm, segNormTo);
        const clipAngle = s.from - (clipTo * 180);
        return (
          <path key={"f"+s.from} d={arc(s.from, Math.max(s.to, clipAngle), R)}
            stroke={s.color} strokeWidth={THICK} fill="none" opacity="0.85"
            strokeLinecap="butt" filter="url(#glow)"/>
        );
      })}

      {/* Tick marks */}
      {[-10,-5,0,5,10].map(v => {
        const a = 180 - ((v + 10) / 20) * 180;
        const r1 = R + THICK / 2 + 4, r2 = R + THICK / 2 + 10;
        const aR = (a * Math.PI) / 180;
        return (
          <g key={v}>
            <line x1={CX + r1 * Math.cos(aR)} y1={CY - r1 * Math.sin(aR)}
              x2={CX + r2 * Math.cos(aR)} y2={CY - r2 * Math.sin(aR)}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
            <text x={CX + (r2 + 8) * Math.cos(aR)} y={CY - (r2 + 8) * Math.sin(aR)}
              textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.22)" fontSize="8" fontFamily={F}>{v}</text>
          </g>
        );
      })}

      {/* Needle */}
      <line x1={nBackX} y1={nBackY} x2={nTipX} y2={nTipY}
        stroke={meta.color} strokeWidth="2.5" strokeLinecap="round"
        filter="url(#glow)"/>
      <circle cx={CX} cy={CY} r="7" fill="rgba(10,12,18,1)" stroke={meta.color} strokeWidth="2"/>
      <circle cx={CX} cy={CY} r="3" fill={meta.color}/>

      {/* Score text */}
      <text x={CX} y={CY + 26} textAnchor="middle"
        fill={meta.color} fontSize="26" fontFamily={FS} fontWeight="300">
        {score.toFixed(1)}
      </text>
      <text x={CX} y={CY + 40} textAnchor="middle"
        fill={MUT} fontSize="8" fontFamily={F} letterSpacing="2">OUT OF 10</text>
    </svg>
  );
}

/* ══════════════════════ CONFIDENCE RING ════════════════════ */
function ConfidenceRing({ value }) {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
      <circle cx="45" cy="45" r={r} fill="none"
        stroke={value >= 70 ? "#50DC78" : value >= 45 ? GOLD : "#FB923C"}
        strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 1s ease" }}/>
      <text x="45" y="42" textAnchor="middle" fill="#fff" fontSize="16" fontFamily={FS} fontWeight="300">
        {value}%
      </text>
      <text x="45" y="54" textAnchor="middle" fill={MUT} fontSize="7" fontFamily={F} letterSpacing="1">
        CONFIDENCE
      </text>
    </svg>
  );
}

/* ══════════════════════ SIGNAL CARD ════════════════════════ */
function SignalCard({ sig, delay }) {
  const pos = sig.score >= 0;
  const pct = Math.min(100, Math.abs(sig.score) / 10 * 100);
  const color = sig.score >= 5  ? "#50DC78"
              : sig.score >= 2  ? "#4ADE80"
              : sig.score >= -2 ? GOLD
              : sig.score >= -5 ? "#FB923C"
              : "#E55050";

  return (
    <div style={{
      background: BG, border: `1px solid ${BD}`, borderRadius: 16,
      padding: "18px 20px", position: "relative", overflow: "hidden",
      animation: `fadeUp 0.4s ${delay}s ease both`,
    }}>
      {/* Colored top stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}80, transparent)` }}/>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 9, letterSpacing: "0.18em",
            textTransform: "uppercase", color: MUT, fontFamily: F }}>
            {SIGNAL_ICONS[sig.name] || "◆"} &nbsp;{sig.name}
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: FS, fontSize: 28, fontWeight: 300, color,
              lineHeight: 1 }}>
              {sig.score > 0 ? "+" : ""}{sig.score.toFixed(1)}
            </span>
            <span style={{ fontSize: 10, color: MUT, fontFamily: F }}>/10</span>
          </div>
        </div>
        <span style={{
          fontSize: 9, padding: "3px 9px", borderRadius: 20, fontFamily: F,
          background: `${color}15`, border: `1px solid ${color}30`,
          color, fontWeight: 700, letterSpacing: "0.08em",
        }}>
          {sig.weight}% weight
        </span>
      </div>

      {/* Score bar */}
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginBottom: 10,
        position: "relative" }}>
        {/* Center line */}
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1,
          height: "100%", background: "rgba(255,255,255,0.15)" }}/>
        {/* Bar */}
        {pos ? (
          <div style={{ position: "absolute", left: "50%", width: `${pct / 2}%`,
            height: "100%", borderRadius: 2, background: color, transition: "width 0.8s ease" }}/>
        ) : (
          <div style={{ position: "absolute", right: "50%", width: `${pct / 2}%`,
            height: "100%", borderRadius: 2, background: color, transition: "width 0.8s ease" }}/>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11, color: MUT, fontFamily: F, lineHeight: 1.5 }}>
        {sig.detail}
      </p>
    </div>
  );
}

/* ══════════════════════ KEY METRICS TABLE ══════════════════ */
function MetricsTable({ km }) {
  const fmt = (v, suffix = "", prefix = "") => {
    if (v == null) return <span style={{ color: MUT }}>—</span>;
    return <span style={{ color: "#fff" }}>{prefix}{typeof v === "number" ? v.toFixed(2) : v}{suffix}</span>;
  };
  const fmtM = (v) => {
    if (!v) return <span style={{ color: MUT }}>—</span>;
    const abs = Math.abs(v);
    const str = abs >= 1e6 ? `$${(v/1e6).toFixed(1)}T` : abs >= 1e3 ? `$${(v/1e3).toFixed(1)}B` : `$${v.toFixed(0)}M`;
    return <span style={{ color: "#fff" }}>{str}</span>;
  };

  const rows = [
    ["Current Price",    fmt(km.price,         "", "$")],
    ["P/E Ratio",        fmt(km.pe,            "x")],
    ["P/B Ratio",        fmt(km.pb,            "x")],
    ["Debt / Equity",    fmt(km.debt_equity,   "x")],
    ["Net Margin",       fmt(km.net_margin,    "%")],
    ["ROE",              fmt(km.roe,           "%")],
    ["Revenue Growth",   fmt(km.revenue_growth,"%")],
    ["EPS Growth",       fmt(km.eps_growth,    "%")],
    ["Beta",             fmt(km.beta)],
    ["Dividend Yield",   fmt(km.div_yield,     "%")],
    ["52W High",         fmt(km["52w_high"],    "", "$")],
    ["52W Low",          fmt(km["52w_low"],     "", "$")],
    ["Market Cap",       fmtM(km.market_cap)],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px",
      background: BD, borderRadius: 12, overflow: "hidden" }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{ background: "rgba(8,9,14,0.95)", padding: "11px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: F, fontSize: 10, color: MUT, letterSpacing: "0.04em" }}>{label}</span>
          <span style={{ fontFamily: FS, fontSize: 14 }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════ ANALYST HISTORY CHART ══════════════ */
function AnalystChart({ history }) {
  if (!history || history.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: 140, color: MUT, fontFamily: F, fontSize: 11 }}>
      No analyst data available
    </div>
  );

  const data = [...history].reverse().map(h => ({
    period: h.period?.slice(0, 7) || "",
    "Strong Buy": h.strongBuy,
    "Buy": h.buy,
    "Hold": h.hold,
    "Sell": h.sell,
    "Strong Sell": h.strongSell,
  }));

  const COLORS = {
    "Strong Buy": "#50DC78", "Buy": "#4ADE80",
    "Hold": GOLD, "Sell": "#FB923C", "Strong Sell": "#E55050",
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="period" tick={{ fill: MUT, fontSize: 9, fontFamily: F }}
          axisLine={false} tickLine={false}/>
        <YAxis tick={{ fill: MUT, fontSize: 9, fontFamily: F }}
          axisLine={false} tickLine={false}/>
        <Tooltip
          contentStyle={{ background: "rgba(10,12,18,0.97)", border: `1px solid ${BD}`,
            borderRadius: 10, fontFamily: F, fontSize: 11 }}
          cursor={{ fill: "rgba(255,255,255,0.02)" }}
          itemStyle={{ color: TXT }}/>
        {Object.entries(COLORS).map(([k, c]) => (
          <Bar key={k} dataKey={k} stackId="a" fill={c} radius={[0, 0, 0, 0]}/>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ══════════════════════ RADAR CHART ════════════════════════ */
function SignalRadar({ signals }) {
  const data = signals.map(s => ({
    subject: s.name.split(" ")[0],
    score:   Math.max(0, s.score + 10), // shift to 0-20 for display
    fullMark: 20,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(255,255,255,0.07)" radialLines={false}/>
        <PolarAngleAxis dataKey="subject"
          tick={{ fill: MUT, fontSize: 9, fontFamily: F }}/>
        <Radar name="Score" dataKey="score" fill={GOLD} stroke={GOLD}
          fillOpacity={0.15} strokeWidth={1.5}/>
        <Tooltip
          contentStyle={{ background: "rgba(10,12,18,0.97)", border: `1px solid ${BD}`,
            borderRadius: 10, fontFamily: F, fontSize: 11 }}
          formatter={v => [`${(v - 10).toFixed(1)}/10`]}
          labelFormatter={l => l}
          itemStyle={{ color: GOLD }}/>
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ══════════════════════ LOADING SKELETON ════════════════════ */
function LoadingSkeleton() {
  const bar = (w, h = 10, delay = 0) => (
    <div style={{ height: h, borderRadius: 4, width: w,
      background: "rgba(255,255,255,0.055)",
      animation: `shimmer 1.6s ${delay}s infinite`, marginBottom: 10 }}/>
  );
  return (
    <div style={{ animation: "fadeUp 0.3s ease both" }}>
      <div style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 20, padding: 28, marginBottom: 20 }}>
        {bar("40%", 14)}
        {bar("20%", 8, 0.1)}
        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          <div style={{ flex: 1 }}>{bar("100%", 120, 0.2)}</div>
          <div style={{ flex: 2 }}>{bar("100%", 120, 0.3)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((d, i) => (
          <div key={i} style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 16, padding: 20 }}>
            {bar("50%", 8, d)}{bar("80%", 14, d + 0.05)}{bar("100%", 8, d + 0.1)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════ POPULAR TICKERS ════════════════════ */
const POPULAR = [
  "AAPL","MSFT","NVDA","GOOGL","AMZN","TSLA","META","JPM","V","JNJ",
];

/* ══════════════════════ MAIN PAGE ══════════════════════════ */
export default function AIEnginePage() {
  const navigate = useNavigate();
  const [query,   setQuery]   = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const inputRef = useRef(null);

  const analyze = useCallback(async (sym) => {
    const s = (sym || query).trim().toUpperCase();
    if (!s) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await API.get(`/ai/recommendation/${s}`);
      setResult(r.data);
      setQuery(s);
    } catch (e) {
      setError(e?.response?.data?.detail || `Symbol "${s}" not found`);
    } finally { setLoading(false); }
  }, [query]);

  const meta = result ? (RATING_META[result.rating] || RATING_META["Hold"]) : null;

  return (
    <div style={{ animation: "fadeUp 0.5s ease both" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: FS, fontSize: "clamp(32px,4vw,52px)",
          fontWeight: 300, letterSpacing: "-0.03em", color: "#fff", margin: 0, lineHeight: 1 }}>
          AI Investment <span style={{ color: GOLD }}>Engine</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: MUT, fontFamily: F }}>
          Multi-factor fundamental analysis · Morningstar-style recommendations · Powered by live market data
        </p>
      </div>

      <div style={{ height: 1, marginBottom: 32,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)" }}/>

      {/* ── SEARCH BAR ── */}
      <div style={{ maxWidth: 680, margin: "0 auto 40px", textAlign: "center" }}>
        <p style={{ margin: "0 0 16px", fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase", color: MUT, fontFamily: F }}>
          Enter any stock symbol to generate an AI analysis
        </p>
        <div style={{ display: "flex", gap: 0, borderRadius: 16,
          border: `1px solid ${G30}`, background: "rgba(10,12,18,0.8)",
          overflow: "hidden", boxShadow: `0 0 40px ${G10}` }}>
          <div style={{ display: "flex", alignItems: "center", paddingLeft: 18 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="rgba(212,175,55,0.5)" strokeWidth="1.4"/>
              <path d="M11 11L14 14" stroke="rgba(212,175,55,0.5)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="AAPL, NVDA, MSFT, TSLA…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              padding: "16px 18px", color: "#fff", fontSize: 15, fontFamily: F,
              caretColor: GOLD, letterSpacing: "0.06em",
            }}
          />
          <button onClick={() => analyze()} disabled={loading || !query.trim()} style={{
            padding: "0 28px", background: G10, border: "none",
            borderLeft: `1px solid ${G30}`, cursor: loading ? "wait" : "pointer",
            color: GOLD, fontSize: 11, fontFamily: F, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase",
            opacity: (!query.trim() || loading) ? 0.5 : 1,
            transition: "all .15s",
          }}>
            {loading ? "Analyzing…" : "Analyze ▶"}
          </button>
        </div>

        {/* Popular tickers */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.12em", color: MUT, fontFamily: F,
            alignSelf: "center" }}>POPULAR:</span>
          {POPULAR.map(s => (
            <button key={s} onClick={() => { setQuery(s); analyze(s); }} style={{
              padding: "4px 10px", borderRadius: 8, cursor: "pointer",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              color: MUT, fontSize: 10, fontFamily: F, transition: "all .14s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G30; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = MUT; }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ maxWidth: 680, margin: "0 auto 24px", padding: "14px 20px",
          background: "rgba(229,80,80,0.07)", border: "1px solid rgba(229,80,80,0.25)",
          borderRadius: 14, textAlign: "center", fontFamily: F, fontSize: 12, color: "#E55050" }}>
          {error}
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && <LoadingSkeleton />}

      {/* ══════════ RESULT ══════════ */}
      {result && meta && !loading && (
        <div style={{ animation: "fadeUp 0.5s ease both" }}>

          {/* ── HERO: Rating + Gauge + Summary ── */}
          <div style={{
            background: BG, border: `1px solid ${BD}`, borderRadius: 22,
            padding: "30px 34px", marginBottom: 22, position: "relative", overflow: "hidden",
          }}>
            {/* Glow blob behind gauge */}
            <div style={{ position: "absolute", top: 0, right: 80, width: 300, height: 200,
              background: `radial-gradient(ellipse, ${meta.glow} 0%, transparent 70%)`,
              pointerEvents: "none" }}/>

            {/* Top line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
              borderRadius: "22px 22px 0 0",
              background: `linear-gradient(90deg, ${meta.color}90, rgba(255,255,255,0.05), transparent)` }}/>

            {/* Company info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <h3 style={{ fontFamily: FS, fontSize: "clamp(22px,3vw,36px)", fontWeight: 300,
                    color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>{result.name}</h3>
                  <button onClick={() => navigate(`/company/${result.symbol}`)} style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 8,
                    background: G10, border: `1px solid ${G30}`, color: GOLD, cursor: "pointer",
                    fontFamily: F, letterSpacing: "0.08em",
                  }}>View Detail ↗</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    color: MUT, fontFamily: F }}>{result.symbol}</span>
                  <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    color: MUT, fontFamily: F }}>{result.sector}</span>
                  {result.exchange && (
                    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      color: MUT, fontFamily: F }}>{result.exchange}</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 10, color: MUT, fontFamily: F, textAlign: "right" }}>
                <p style={{ margin: 0 }}>Analysis generated</p>
                <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.4)" }}>
                  {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Gauge + Rating badge + Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 32,
              alignItems: "center", flexWrap: "wrap" }}>

              {/* Gauge */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <ScoreGauge score={result.score} rating={result.rating}/>
                <p style={{ margin: "4px 0 0", fontSize: 9, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: MUT, fontFamily: F }}>Composite Score</p>
              </div>

              {/* Rating badge + confidence */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{
                  padding: "14px 26px", borderRadius: 18,
                  background: meta.bg, border: `1px solid ${meta.color}35`,
                  textAlign: "center",
                  boxShadow: `0 0 30px ${meta.glow}`,
                }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: meta.color,
                    fontFamily: F, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {meta.icon} &nbsp;AI Rating
                  </p>
                  <p style={{ margin: 0, fontFamily: FS, fontSize: 32, fontWeight: 300,
                    color: meta.color, letterSpacing: "-0.02em" }}>
                    {result.rating}
                  </p>
                </div>
                <ConfidenceRing value={result.confidence}/>
              </div>

              {/* Summary text */}
              <div style={{ padding: "0 8px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 9, letterSpacing: "0.2em",
                  textTransform: "uppercase", color: MUT, fontFamily: F }}>◈ AI Analysis</p>
                <p style={{
                  margin: 0, fontFamily: F, fontSize: 13, lineHeight: 1.8,
                  color: TXT,
                }}
                  dangerouslySetInnerHTML={{ __html: result.summary.replace(/\*\*(.+?)\*\*/g,
                    `<strong style="color:#fff;font-weight:700">$1</strong>`) }}
                />
              </div>
            </div>
          </div>

          {/* ── SIGNAL CARDS (6) ── */}
          <p style={{ margin: "0 0 14px", fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: MUT, fontFamily: F }}>Signal Breakdown</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
            {result.signals.map((s, i) => (
              <SignalCard key={s.name} sig={s} delay={i * 0.06}/>
            ))}
          </div>

          {/* ── BOTTOM ROW: Metrics + Analyst Chart + Radar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 18 }}>

            {/* Key Metrics */}
            <div style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 18,
              padding: "22px 22px" }}>
              <p style={{ margin: "0 0 16px", fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", color: MUT, fontFamily: F }}>Key Metrics</p>
              <MetricsTable km={result.key_metrics}/>
            </div>

            {/* Analyst Consensus History */}
            <div style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 18,
              padding: "22px 22px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", color: MUT, fontFamily: F }}>Analyst Consensus History</p>
              <p style={{ margin: "0 0 14px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: F }}>
                Last 4 reporting periods
              </p>
              <AnalystChart history={result.analyst_history}/>
              {result.analyst_history.length > 0 && (() => {
                const h = result.analyst_history[0];
                const tot = h.total || 1;
                const bullPct = ((h.strongBuy + h.buy) / tot * 100).toFixed(0);
                const bearPct = ((h.sell + h.strongSell) / tot * 100).toFixed(0);
                return (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontFamily: FS, fontSize: 20, color: "#50DC78" }}>{bullPct}%</p>
                      <p style={{ margin: 0, fontSize: 9, color: MUT, fontFamily: F }}>Bullish</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontFamily: FS, fontSize: 20, color: GOLD }}>{h.hold}</p>
                      <p style={{ margin: 0, fontSize: 9, color: MUT, fontFamily: F }}>Hold</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontFamily: FS, fontSize: 20, color: "#E55050" }}>{bearPct}%</p>
                      <p style={{ margin: 0, fontSize: 9, color: MUT, fontFamily: F }}>Bearish</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Signal Radar */}
            <div style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 18,
              padding: "22px 22px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", color: MUT, fontFamily: F }}>Factor Radar</p>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: F }}>
                Multi-dimensional profile
              </p>
              <SignalRadar signals={result.signals}/>

              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {result.signals.map(s => {
                  const c = s.score >= 5 ? "#50DC78" : s.score >= 2 ? "#4ADE80" :
                            s.score >= -2 ? GOLD : s.score >= -5 ? "#FB923C" : "#E55050";
                  return (
                    <div key={s.name} style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: MUT, fontFamily: F }}>
                        {s.name}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: F, color: c, fontWeight: 700 }}>
                        {s.score > 0 ? "+" : ""}{s.score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p style={{ marginTop: 20, fontSize: 10, color: "rgba(255,255,255,0.18)",
            fontFamily: F, textAlign: "center", lineHeight: 1.6 }}>
            ⚠ This analysis is generated algorithmically using public market data. It is not financial advice.
            Past performance does not guarantee future results. Always conduct your own due diligence.
          </p>
        </div>
      )}

      {/* Empty prompt */}
      {!result && !loading && !error && (
        <div style={{ textAlign: "center", padding: "60px 24px", animation: "fadeUp 0.5s ease both" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%",
            background: G10, border: `1px solid ${G30}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke={GOLD} strokeWidth="1.4"/>
              <path d="M14 9v6M14 17v1.5" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontFamily: FS, fontSize: 28, fontWeight: 300, color: TXT, margin: "0 0 8px" }}>
            Enter a stock symbol above
          </p>
          <p style={{ fontFamily: F, fontSize: 12, color: MUT }}>
            Our AI engine analyses 6 key dimensions: Valuation · Growth · Financial Health ·
            Momentum · Analyst Consensus · Risk
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
      `}</style>
    </div>
  );
}
