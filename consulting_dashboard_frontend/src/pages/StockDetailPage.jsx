import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell,
  ReferenceLine,
} from "recharts";
import API from "../services/api";
import TradingViewChart from "../components/TradingViewChart";

/* ═══════════════════════ AI RECOMMENDATION PANEL ════════════════════════ */
const _AI_META = {
  "Strong Buy":  { color: "#50DC78", bg: "rgba(80,220,120,0.10)", glow: "rgba(80,220,120,0.25)" },
  "Buy":         { color: "#4ADE80", bg: "rgba(74,222,128,0.08)", glow: "rgba(74,222,128,0.20)" },
  "Hold":        { color: "#D4AF37", bg: "rgba(212,175,55,0.10)", glow: "rgba(212,175,55,0.22)" },
  "Sell":        { color: "#FB923C", bg: "rgba(251,146,60,0.10)", glow: "rgba(251,146,60,0.20)" },
  "Strong Sell": { color: "#E55050", bg: "rgba(229,80,80,0.10)",  glow: "rgba(229,80,80,0.25)"  },
};

function _MiniBar({ score }) {
  const pos = score >= 0;
  const pct = Math.min(100, Math.abs(score) / 10 * 100);
  const c = score >= 4 ? "#50DC78" : score >= 1.5 ? "#4ADE80" : score >= -1.5 ? "#D4AF37" : score >= -4 ? "#FB923C" : "#E55050";
  return (
    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", position: "relative" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "rgba(255,255,255,0.12)" }}/>
      {pos
        ? <div style={{ position: "absolute", left: "50%", width: `${pct / 2}%`, height: "100%", borderRadius: 2, background: c }}/>
        : <div style={{ position: "absolute", right: "50%", width: `${pct / 2}%`, height: "100%", borderRadius: 2, background: c }}/>
      }
    </div>
  );
}

function AIRecommendationPanel({ symbol, navigate }) {
  const [rec, setRec]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true); setErr(null);
    API.get(`/ai/recommendation/${symbol}`)
      .then(r => setRec(r.data))
      .catch(e => setErr(e?.response?.data?.detail || "AI analysis unavailable"))
      .finally(() => setLoading(false));
  }, [symbol]);

  const _BG="_rgba(255,255,255,0.025)".replace("_",""); const _BD="rgba(255,255,255,0.07)";
  const _MUT="rgba(255,255,255,0.28)"; const _GOLD="#D4AF37";
  const _G10="rgba(212,175,55,0.10)"; const _G30="rgba(212,175,55,0.30)";
  const _FS="'Cormorant Garamond',serif"; const _F="'Syne',sans-serif";

  if (loading) return (
    <div style={{ display:"flex", gap:16, marginBottom:36 }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ flex:i===0?"0 0 190px":1, height:200,
          borderRadius:14, background:"rgba(255,255,255,0.025)",
          animation:`shimmer 1.6s ${i*0.1}s infinite` }}/>
      ))}
    </div>
  );

  if (err || !rec) return (
    <div style={{ marginBottom:36, padding:"24px", background:"rgba(255,255,255,0.025)",
      border:`1px solid rgba(255,255,255,0.07)`, borderRadius:14,
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
      <p style={{ margin:0, fontFamily:_F, fontSize:12, color:_MUT }}>
        {err || "AI analysis requires backend restart to activate"}
      </p>
      <button onClick={()=>navigate("/ai-engine")} style={{
        padding:"8px 18px", borderRadius:10, cursor:"pointer",
        background:_G10, border:`1px solid ${_G30}`,
        color:_GOLD, fontSize:11, fontFamily:_F, fontWeight:700, whiteSpace:"nowrap",
      }}>Open AI Engine ↗</button>
    </div>
  );

  const meta = _AI_META[rec.rating] || _AI_META["Hold"];
  const norm = (rec.score + 10) / 20;
  const circ = 2 * Math.PI * 30;

  return (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:36 }}>
      {/* Rating + mini gauge */}
      <div style={{ flex:"0 0 auto", minWidth:180, background:meta.bg,
        border:`1px solid ${meta.color}35`, borderRadius:18, padding:"24px 20px",
        display:"flex", flexDirection:"column", alignItems:"center",
        boxShadow:`0 0 40px ${meta.glow}` }}>
        <svg width="120" height="72" viewBox="0 0 120 72" style={{ marginBottom:6 }}>
          <path d="M12 66 A50 50 0 0 1 108 66" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round"/>
          <path d="M12 66 A50 50 0 0 1 108 66" fill="none" stroke={meta.color}
            strokeWidth="8" strokeLinecap="round" opacity="0.85"
            strokeDasharray={`${norm*157} 157`}/>
          <text x="60" y="60" textAnchor="middle" fill={meta.color} fontSize="20" fontFamily={_FS} fontWeight="300">
            {rec.score>0?"+":""}{rec.score.toFixed(1)}
          </text>
        </svg>
        <p style={{ margin:"0 0 2px", fontFamily:_F, fontSize:13, fontWeight:800,
          letterSpacing:"0.1em", color:meta.color, textAlign:"center" }}>{rec.rating}</p>
        <p style={{ margin:"0 0 14px", fontSize:8, color:_MUT, fontFamily:_F, letterSpacing:"0.14em" }}>AI RATING</p>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
            <circle cx="22" cy="22" r="16" fill="none" stroke={meta.color} strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${rec.confidence/100*circ*1.067} ${circ*1.067}`}
              strokeDashoffset={circ*1.067/4}/>
            <text x="22" y="26" textAnchor="middle" fill="#fff" fontSize="10" fontFamily={_FS}>{rec.confidence}%</text>
          </svg>
          <div>
            <p style={{ margin:0, fontSize:8, color:_MUT, fontFamily:_F, letterSpacing:"0.1em" }}>CONFIDENCE</p>
            <p style={{ margin:0, fontSize:10, color:meta.color, fontFamily:_F, fontWeight:700 }}>
              {rec.confidence>=70?"High":rec.confidence>=45?"Medium":"Low"}
            </p>
          </div>
        </div>
      </div>

      {/* Signal bars */}
      <div style={{ flex:1, minWidth:220, background:"rgba(255,255,255,0.025)",
        border:`1px solid rgba(255,255,255,0.07)`, borderRadius:18, padding:"20px" }}>
        <p style={{ margin:"0 0 14px", fontSize:9, letterSpacing:"0.18em",
          textTransform:"uppercase", color:_MUT, fontFamily:_F }}>Signal Breakdown</p>
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
          {rec.signals.map(s=>{
            const c=s.score>=4?"#50DC78":s.score>=1.5?"#4ADE80":s.score>=-1.5?_GOLD:s.score>=-4?"#FB923C":"#E55050";
            return (
              <div key={s.name}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:_F, fontSize:9, color:"rgba(255,255,255,0.5)" }}>{s.name}</span>
                  <span style={{ fontFamily:_F, fontSize:10, color:c, fontWeight:700 }}>
                    {s.score>0?"+":""}{s.score.toFixed(1)}
                  </span>
                </div>
                <_MiniBar score={s.score} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary + link */}
      <div style={{ flex:1.5, minWidth:240, background:"rgba(255,255,255,0.025)",
        border:`1px solid rgba(255,255,255,0.07)`, borderRadius:18, padding:"20px",
        display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
        <div>
          <p style={{ margin:"0 0 10px", fontSize:9, letterSpacing:"0.18em",
            textTransform:"uppercase", color:_MUT, fontFamily:_F }}>◈ AI Analysis</p>
          <p style={{ margin:0, fontFamily:_F, fontSize:12, lineHeight:1.8,
            color:"rgba(255,255,255,0.72)" }}
            dangerouslySetInnerHTML={{ __html: rec.summary
              .replace(/\*\*(.+?)\*\*/g,`<strong style="color:#fff">$1</strong>`)
              .slice(0,400)+(rec.summary.length>400?"…":"")
            }}/>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={()=>navigate("/ai-engine")} style={{
            flex:1, padding:"10px", borderRadius:12, cursor:"pointer",
            background:_G10, border:`1px solid ${_G30}`,
            color:_GOLD, fontSize:10, fontFamily:_F, fontWeight:700,
            letterSpacing:"0.08em", textTransform:"uppercase",
          }}>Full AI Analysis ↗</button>
          <div style={{ padding:"10px 12px", borderRadius:12,
            background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
            fontSize:8, color:_MUT, fontFamily:_F, display:"flex", alignItems:"center" }}>
            ⚠ Not financial advice
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const FONT_SANS  = "'Syne', sans-serif";
const FONT_SERIF = "'Cormorant Garamond', serif";
const GOLD       = "#D4AF37";
const GOLD_DIM   = "rgba(212,175,55,0.55)";
const BG         = "rgba(255,255,255,0.025)";
const BORDER     = "rgba(255,255,255,0.07)";
const MUTED      = "rgba(255,255,255,0.3)";
const TEXT       = "rgba(255,255,255,0.8)";

const SECTIONS = [
  { id: "chart",          label: "Chart" },
  { id: "overview",       label: "Overview" },
  { id: "financial",      label: "Financial Health" },
  { id: "valuation",      label: "Valuation" },
  { id: "risk",           label: "Risk Analysis" },
  { id: "ai",             label: "AI Recommendation" },
  { id: "news",           label: "News" },
  { id: "competitors",    label: "Competitors" },
];

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmt$(v, decimals = 2) {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(decimals)}M`;
  return `$${n.toFixed(decimals)}`;
}
function fmtPct(v)  { return v == null ? "—" : `${Number(v).toFixed(2)}%`; }
function fmtX(v)    { return v == null ? "—" : `${Number(v).toFixed(2)}×`; }
function fmtNum(v)  { return v == null ? "—" : Number(v).toFixed(2); }
function fmtPrice(v){ return v == null ? "—" : `$${Number(v).toFixed(2)}`; }
function epochToDate(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ═══════════════════════ MICRO-COMPONENTS ═══════════════════════ */

function Sk({ w = "100%", h = 14, r = 6 }) {
  return <div style={{ width: w, height: h, borderRadius: r,
    background: "rgba(255,255,255,0.06)", animation: "shimmer 1.6s infinite" }} />;
}

function SectionDivider({ label }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ height: 1, marginBottom: 14,
        background: "linear-gradient(90deg, rgba(212,175,55,0.35), rgba(255,255,255,0.04) 55%, transparent)" }} />
      <p style={{ margin: 0, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.28)", fontFamily: FONT_SANS }}>{label}</p>
    </div>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT_SANS }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: FONT_SANS, fontWeight: 600,
        color: highlight || TEXT }}>{value}</span>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: "16px 18px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color || GOLD}, transparent)` }} />
      <p style={{ margin: "0 0 8px", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.28)", fontFamily: FONT_SANS }}>{label}</p>
      <p style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 300,
        color: color || "#fff", letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 10, color: MUTED, fontFamily: FONT_SANS }}>{sub}</p>}
    </div>
  );
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,12,18,0.97)", border: "1px solid rgba(212,175,55,0.2)",
      borderRadius: 10, padding: "10px 14px", fontFamily: FONT_SANS, fontSize: 12,
      boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
      <p style={{ margin: "0 0 4px", color: MUTED, fontSize: 10 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color || GOLD, fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════ ANALYST BAR ═══════════════════════ */
function AnalystBar({ analyst }) {
  const { strong_buy = 0, buy = 0, hold = 0, sell = 0, strong_sell = 0, total = 0 } = analyst || {};
  if (!total) return <p style={{ color: MUTED, fontSize: 12, fontFamily: FONT_SANS }}>No analyst data available.</p>;
  const segs = [
    { label: "Strong Buy", count: strong_buy, color: "#50DC78" },
    { label: "Buy",        count: buy,        color: "#7BC86C" },
    { label: "Hold",       count: hold,       color: "#FB923C" },
    { label: "Sell",       count: sell,       color: "#E87050" },
    { label: "Strong Sell",count: strong_sell,color: "#E55050" },
  ];
  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 10, marginBottom: 14, gap: 1 }}>
        {segs.map(s => s.count > 0 && (
          <div key={s.label} style={{ flex: s.count, background: s.color, transition: "flex .3s" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
            <span style={{ fontSize: 10, color: MUTED, fontFamily: FONT_SANS }}>
              {s.label}: <strong style={{ color: TEXT }}>{s.count}</strong>
            </span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: FONT_SANS }}>
          ({total} analysts · {analyst?.period})
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════ 52W RANGE BAR ═══════════════════════ */
function RangeBar({ low, high, current }) {
  if (!low || !high || !current) return null;
  const pct = Math.min(Math.max(((current - low) / (high - low)) * 100, 0), 100);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: "relative", height: 6, borderRadius: 99,
        background: "rgba(255,255,255,0.08)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: `linear-gradient(90deg, rgba(212,175,55,0.4), ${GOLD})`,
          borderRadius: 99, transition: "width 1s ease" }} />
        <div style={{ position: "absolute", top: -3, left: `${pct}%`, transform: "translateX(-50%)",
          width: 12, height: 12, borderRadius: "50%", background: GOLD,
          boxShadow: "0 0 8px rgba(212,175,55,0.6)", border: "2px solid rgba(10,12,18,0.9)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: MUTED, fontFamily: FONT_SANS }}>52W Low: {fmtPrice(low)}</span>
        <span style={{ fontSize: 10, color: MUTED, fontFamily: FONT_SANS }}>52W High: {fmtPrice(high)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════ NEWS CARD ═══════════════════════ */
function NewsCard({ item }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12,
        padding: "16px 18px", cursor: "pointer", transition: "all .18s" }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(212,175,55,0.04)";
          e.currentTarget.style.borderColor = "rgba(212,175,55,0.2)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = BG;
          e.currentTarget.style.borderColor = BORDER;
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          {item.image && (
            <img src={item.image} alt="" style={{ width: 64, height: 64, borderRadius: 8,
              objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#fff",
              fontFamily: FONT_SANS, lineHeight: 1.4 }}>{item.headline}</p>
            {item.summary && (
              <p style={{ margin: "0 0 8px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
                lineHeight: 1.5 }}>{item.summary}</p>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                color: GOLD_DIM, fontFamily: FONT_SANS }}>{item.source}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: FONT_SANS }}>
                {epochToDate(item.datetime)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

/* ═══════════════════════ PEER ROW ═══════════════════════ */
function PeerRow({ peer, navigate }) {
  const pos = peer.change_pct > 0;
  const neg = peer.change_pct < 0;
  return (
    <div onClick={() => navigate(`/company/${peer.symbol}`)}
      style={{ display: "flex", alignItems: "center", padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`, cursor: "pointer", transition: "background .15s" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.04)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center", marginRight: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)",
          fontFamily: FONT_SANS }}>{peer.symbol.slice(0, 3)}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, color: "#fff", fontFamily: FONT_SANS, fontWeight: 600 }}>{peer.symbol}</p>
        <p style={{ margin: 0, fontSize: 10, color: MUTED, fontFamily: FONT_SANS }}>{peer.name}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ margin: "0 0 2px", fontSize: 14, fontFamily: FONT_SERIF, color: "#fff" }}>
          {fmtPrice(peer.price)}
        </p>
        <p style={{ margin: 0, fontSize: 11, fontFamily: FONT_SANS, fontWeight: 600,
          color: pos ? "#50DC78" : neg ? "#E55050" : MUTED }}>
          {peer.change_pct != null ? `${pos ? "+" : ""}${fmtNum(peer.change_pct)}%` : "—"}
        </p>
      </div>
      <div style={{ textAlign: "right", marginLeft: 24, minWidth: 80 }}>
        <p style={{ margin: "0 0 2px", fontSize: 9, color: MUTED, fontFamily: FONT_SANS, letterSpacing: "0.12em" }}>MKT CAP</p>
        <p style={{ margin: 0, fontSize: 12, fontFamily: FONT_SANS, color: TEXT }}>
          {peer.market_cap ? fmt$(peer.market_cap * 1e6, 2) : "—"}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function StockDetailPage() {
  const { symbol }   = useParams();
  const navigate     = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [active, setActive]   = useState("overview");
  const sectionRefs           = useRef({});

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setData(null);
    setError(null);
    API.get(`/stock/${symbol.toUpperCase()}`)
      .then(r => setData(r.data))
      .catch(() => setError(`Could not load data for ${symbol.toUpperCase()}.`))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Scroll-spy
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { threshold: 0.35 });
    Object.values(sectionRefs.current).forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [data]);

  const scrollTo = (id) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pos = data?.change_pct > 0;
  const neg = data?.change_pct < 0;
  const changeColor = pos ? "#50DC78" : neg ? "#E55050" : MUTED;

  /* ── Loading ── */
  if (loading) return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <Sk w={56} h={56} r={14} />
        <div style={{ flex: 1 }}>
          <Sk w="35%" h={18} r={6} />
          <div style={{ marginTop: 8 }}><Sk w="20%" h={12} r={4} /></div>
        </div>
        <Sk w={120} h={40} r={10} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <Sk key={i} h={90} r={12} />)}
      </div>
      <Sk h={280} r={16} />
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 16 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="rgba(229,80,80,0.4)" strokeWidth="1.5"/>
        <path d="M20 12v10M20 28v2" stroke="#E55050" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <p style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 22, color: "rgba(255,255,255,0.5)" }}>{error}</p>
      <button onClick={() => navigate(-1)} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 10,
        background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: MUTED,
        cursor: "pointer", fontFamily: FONT_SANS, fontSize: 12 }}>
        ← Go Back
      </button>
    </div>
  );

  /* ── Valuation chart data ── */
  const valuationData = [
    { metric: "P/E",       value: data?.pe        },
    { metric: "P/B",       value: data?.pb        },
    { metric: "P/S",       value: data?.ps        },
    { metric: "EV/EBITDA", value: data?.ev_ebitda },
  ].filter(d => d.value != null).map(d => ({ ...d, value: +Number(d.value).toFixed(2) }));

  /* ── Margin radar data ── */
  const marginData = [
    { metric: "Gross Margin",  value: Math.max(0, data?.gross_margin  ?? 0) },
    { metric: "Op Margin",     value: Math.max(0, data?.op_margin     ?? 0) },
    { metric: "Net Margin",    value: Math.max(0, data?.net_margin    ?? 0) },
    { metric: "ROE",           value: Math.max(0, data?.roe           ?? 0) },
    { metric: "ROA",           value: Math.max(0, data?.roa           ?? 0) },
  ];

  const ai = data?.ai_rec || {};

  return (
    <div style={{ position: "relative" }}>

      {/* ══════════════════ STICKY NAV ══════════════════ */}
      <div style={{ position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,9,14,0.92)", backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${BORDER}`, marginBottom: 36,
        marginLeft: -28, marginRight: -28, padding: "0 28px",
        display: "flex", alignItems: "center", gap: 4 }}>
        {/* Back button */}
        <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 5,
          padding: "14px 12px 14px 0", background: "none", border: "none", cursor: "pointer",
          color: MUTED, fontSize: 11, fontFamily: FONT_SANS, marginRight: 12, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        {/* Section tabs */}
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => scrollTo(s.id)} style={{
            padding: "14px 12px", background: "none", border: "none", cursor: "pointer",
            fontSize: 10, fontFamily: FONT_SANS, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: active === s.id ? 700 : 400,
            color: active === s.id ? GOLD : "rgba(255,255,255,0.35)",
            borderBottom: active === s.id ? `2px solid ${GOLD}` : "2px solid transparent",
            transition: "all .18s", whiteSpace: "nowrap",
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ HERO HEADER ══════════════════ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
        {/* Logo */}
        <div style={{ width: 64, height: 64, borderRadius: 14,
          background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {data?.logo
            ? <img src={data.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
                onError={e => { e.target.style.display = "none"; }} />
            : <span style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: FONT_SANS }}>
                {symbol?.slice(0, 2)}
              </span>
          }
        </div>

        {/* Name & meta */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 300, color: "#fff", letterSpacing: "-0.025em" }}>
              {data?.name}
            </h1>
            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: "rgba(212,175,55,0.1)", border: `1px solid rgba(212,175,55,0.25)`,
              color: GOLD, fontFamily: FONT_SANS, letterSpacing: "0.12em" }}>
              {symbol?.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[data?.exchange, data?.sector, data?.country, data?.currency].filter(Boolean).map((v, i) => (
              <span key={i} style={{ fontSize: 10, color: MUTED, fontFamily: FONT_SANS,
                padding: "2px 0", borderRight: i < 3 ? `1px solid rgba(255,255,255,0.1)` : "none",
                paddingRight: i < 3 ? 12 : 0 }}>{v}</span>
            ))}
            {data?.weburl && (
              <a href={data.weburl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: GOLD_DIM, fontFamily: FONT_SANS, textDecoration: "none" }}>
                {data.weburl.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
              </a>
            )}
          </div>
        </div>

        {/* Live price */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: "0 0 4px", fontFamily: FONT_SERIF, fontSize: "clamp(32px,5vw,52px)",
            fontWeight: 300, color: "#fff", letterSpacing: "-0.03em" }}>
            {fmtPrice(data?.price)}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: changeColor, fontFamily: FONT_SANS }}>
              {pos ? "+" : ""}{fmtNum(data?.change_pct)}%
            </span>
            <span style={{ fontSize: 12, color: changeColor, fontFamily: FONT_SANS }}>
              ({pos ? "+" : ""}{fmtPrice(data?.change)})
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: FONT_SANS,
            letterSpacing: "0.1em" }}>LIVE · FINNHUB</p>
        </div>
      </div>

      {/* ── Top KPI strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))",
        gap: 12, marginBottom: 40 }}>
        {[
          { label: "Market Cap",   value: fmt$(data?.market_cap, 2) },
          { label: "Enterprise Val", value: data?.ev ? fmt$(data.ev, 2) : "—" },
          { label: "Revenue TTM",  value: data?.revenue_ttm ? fmt$(data.revenue_ttm * 1e6, 2) : "—" },
          { label: "Dividend Yield", value: fmtPct(data?.div_yield) },
          { label: "Beta",         value: fmtNum(data?.beta) },
          { label: "EPS (Annual)", value: fmtPrice(data?.eps) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ margin: "0 0 6px", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              color: MUTED, fontFamily: FONT_SANS }}>{label}</p>
            <p style={{ margin: 0, fontFamily: FONT_SANS, fontSize: 16, fontWeight: 700, color: "#fff" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ══════════════════ SECTION 0: TRADINGVIEW CHART ══════════════════ */}
      <section id="chart" ref={el => sectionRefs.current.chart = el}
        style={{ marginBottom: 36 }}>
        <SectionDivider label="0 · Interactive Price Chart" />
        <TradingViewChart
          symbol={symbol?.toUpperCase()}
          exchange={data?.exchange || ""}
        />
      </section>

      {/* ══════════════════ SECTION 1: OVERVIEW ══════════════════ */}
      <section id="overview" ref={el => sectionRefs.current.overview = el}>

        <SectionDivider label="1 · Overview" />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>

          {/* Quote details */}
          <div style={{ flex: "1", minWidth: 260, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "22px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: TEXT,
              fontFamily: FONT_SANS, letterSpacing: "0.05em" }}>Today's Trading</p>
            {[
              { label: "Open",        value: fmtPrice(data?.open) },
              { label: "Day High",    value: fmtPrice(data?.high),  highlight: "#50DC78" },
              { label: "Day Low",     value: fmtPrice(data?.low),   highlight: "#E55050" },
              { label: "Prev Close",  value: fmtPrice(data?.prev_close) },
            ].map(r => <StatRow key={r.label} {...r} />)}

            <p style={{ margin: "20px 0 10px", fontSize: 12, fontWeight: 600, color: TEXT,
              fontFamily: FONT_SANS, letterSpacing: "0.05em" }}>52-Week Range</p>
            <RangeBar low={data?.w52_low} high={data?.w52_high} current={data?.price} />
          </div>

          {/* Company facts */}
          <div style={{ flex: "1", minWidth: 260, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "22px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: TEXT,
              fontFamily: FONT_SANS, letterSpacing: "0.05em" }}>Company Facts</p>
            {[
              { label: "Exchange",      value: data?.exchange || "—" },
              { label: "Sector",        value: data?.sector   || "—" },
              { label: "Country",       value: data?.country  || "—" },
              { label: "Currency",      value: data?.currency || "—" },
              { label: "IPO Date",      value: data?.ipo      || "—" },
              { label: "Shares Out.",   value: data?.shares ? `${Number(data.shares).toLocaleString()}M` : "—" },
              { label: "Market Cap",    value: fmt$(data?.market_cap, 2) },
            ].map(r => <StatRow key={r.label} {...r} />)}
          </div>

          {/* Dividend */}
          <div style={{ flex: "1", minWidth: 240, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "22px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: TEXT,
              fontFamily: FONT_SANS, letterSpacing: "0.05em" }}>Dividend & Cash Return</p>
            {[
              { label: "Dividend Yield",    value: fmtPct(data?.div_yield) },
              { label: "Dividend per Share",value: fmtPrice(data?.div_per_sh) },
              { label: "Payout Ratio",      value: fmtPct(data?.payout_ratio) },
              { label: "Free Cash Flow/Sh", value: fmtPrice(data?.fcf_ps) },
            ].map(r => <StatRow key={r.label} {...r} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════ SECTION 2: FINANCIAL HEALTH ══════════════════ */}
      <section id="financial" ref={el => sectionRefs.current.financial = el}>
        <SectionDivider label="2 · Financial Health" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 14, marginBottom: 24 }}>
          <MetricCard label="Gross Margin"   value={fmtPct(data?.gross_margin)}  color="#50DC78" />
          <MetricCard label="Op. Margin"     value={fmtPct(data?.op_margin)}     color="#7BC86C" />
          <MetricCard label="Net Margin"     value={fmtPct(data?.net_margin)}    color="#D4AF37" />
          <MetricCard label="ROE"            value={fmtPct(data?.roe)}           color="#5B9CF6" />
          <MetricCard label="ROA"            value={fmtPct(data?.roa)}           color="#C084FC" />
          <MetricCard label="Current Ratio"  value={fmtX(data?.curr_ratio)}      color="#FB923C" />
          <MetricCard label="Quick Ratio"    value={fmtX(data?.quick_ratio)}     color="#F472B6" />
        </div>

        {/* Margin Radar */}
        {marginData.some(d => d.value > 0) && (
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14,
            padding: "24px", marginBottom: 36 }}>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
              letterSpacing: "0.15em", textTransform: "uppercase" }}>Profitability Radar</p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={marginData} cx="50%" cy="50%" outerRadius={90}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="metric"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: FONT_SANS }} />
                <Radar name="%" dataKey="value" stroke={GOLD} fill={GOLD} fillOpacity={0.15} strokeWidth={1.5} />
                <Tooltip content={<DarkTooltip />} formatter={v => `${v}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ══════════════════ SECTION 3: VALUATION ══════════════════ */}
      <section id="valuation" ref={el => sectionRefs.current.valuation = el}>
        <SectionDivider label="3 · Valuation" />
        <div style={{ display: "flex", gap: 16, marginBottom: 36, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 280, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
              letterSpacing: "0.15em", textTransform: "uppercase" }}>Valuation Multiples</p>
            {valuationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={valuationData} barCategoryGap="35%"
                  margin={{ top: 4, right: 20, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: TEXT, fontSize: 11, fontFamily: FONT_SANS }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: MUTED, fontSize: 10, fontFamily: FONT_SANS }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                  <ReferenceLine y={15} stroke="rgba(80,220,120,0.3)" strokeDasharray="3 3" />
                  <ReferenceLine y={25} stroke="rgba(251,146,60,0.3)" strokeDasharray="3 3" />
                  <Bar dataKey="value" name="Multiple" radius={[5,5,0,0]} maxBarSize={44}>
                    {valuationData.map((d, i) => (
                      <Cell key={i} fill={`rgba(212,175,55,${0.5 + i * 0.15})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: MUTED, fontSize: 12, fontFamily: FONT_SANS }}>Valuation data unavailable.</p>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 240, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
              letterSpacing: "0.15em", textTransform: "uppercase" }}>Key Ratios</p>
            {[
              { label: "P/E Ratio",      value: fmtX(data?.pe) },
              { label: "P/B Ratio",      value: fmtX(data?.pb) },
              { label: "P/S Ratio",      value: fmtX(data?.ps) },
              { label: "EV/EBITDA",      value: fmtX(data?.ev_ebitda) },
              { label: "EPS (Annual)",   value: fmtPrice(data?.eps) },
              { label: "Book Value/Sh",  value: fmtPrice(data?.book_value) },
            ].map(r => <StatRow key={r.label} {...r} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════ SECTION 4: RISK ANALYSIS ══════════════════ */}
      <section id="risk" ref={el => sectionRefs.current.risk = el}>
        <SectionDivider label="4 · Risk Analysis" />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
          <div style={{ flex: 1, minWidth: 240, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
              letterSpacing: "0.15em", textTransform: "uppercase" }}>Market Risk</p>
            {[
              { label: "Beta",           value: fmtNum(data?.beta),
                highlight: data?.beta > 1.5 ? "#E55050" : data?.beta < 0.8 ? "#50DC78" : TEXT },
              { label: "52W High",       value: fmtPrice(data?.w52_high),  highlight: "#50DC78" },
              { label: "52W Low",        value: fmtPrice(data?.w52_low),   highlight: "#E55050" },
              { label: "Price vs 52W H", value: data?.price && data?.w52_high
                  ? `${(((data.price / data.w52_high) - 1) * 100).toFixed(1)}%` : "—",
                highlight: data?.price >= data?.w52_high * 0.95 ? "#50DC78" : "#E55050" },
            ].map(r => <StatRow key={r.label} {...r} />)}
          </div>

          <div style={{ flex: 1, minWidth: 240, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
              letterSpacing: "0.15em", textTransform: "uppercase" }}>Balance Sheet Risk</p>
            {[
              { label: "Debt / Equity",   value: fmtX(data?.debt_equity),
                highlight: data?.debt_equity > 1 ? "#E55050" : data?.debt_equity < 0.3 ? "#50DC78" : TEXT },
              { label: "Current Ratio",   value: fmtX(data?.curr_ratio),
                highlight: data?.curr_ratio > 2 ? "#50DC78" : data?.curr_ratio < 1 ? "#E55050" : TEXT },
              { label: "Quick Ratio",     value: fmtX(data?.quick_ratio),
                highlight: data?.quick_ratio > 1 ? "#50DC78" : "#E55050" },
              { label: "Free Cash Flow/Sh", value: fmtPrice(data?.fcf_ps),
                highlight: data?.fcf_ps > 0 ? "#50DC78" : "#E55050" },
            ].map(r => <StatRow key={r.label} {...r} />)}
          </div>

          {/* Analyst consensus */}
          <div style={{ flex: 2, minWidth: 280, background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: MUTED, fontFamily: FONT_SANS,
              letterSpacing: "0.15em", textTransform: "uppercase" }}>Analyst Consensus</p>
            <AnalystBar analyst={data?.analyst} />
          </div>
        </div>
      </section>

      {/* ══════════════════ SECTION 5: AI RECOMMENDATION ══════════════════ */}
      <section id="ai" ref={el => sectionRefs.current.ai = el}>
        <SectionDivider label="5 · AI Recommendation" />
        <AIRecommendationPanel symbol={symbol} navigate={navigate} />
      </section>

      {/* ══════════════════ SECTION 6: NEWS ══════════════════ */}
      <section id="news" ref={el => sectionRefs.current.news = el}>
        <SectionDivider label="6 · Latest News" />
        {(data?.news || []).length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, marginBottom: 36 }}>
            <p style={{ margin: 0, color: MUTED, fontSize: 12, fontFamily: FONT_SANS }}>
              No recent news found for {symbol?.toUpperCase()}.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
            {data.news.map((item, i) => <NewsCard key={i} item={item} />)}
          </div>
        )}
      </section>

      {/* ══════════════════ SECTION 7: COMPETITORS ══════════════════ */}
      <section id="competitors" ref={el => sectionRefs.current.competitors = el}>
        <SectionDivider label="7 · Peer Comparison" />
        {(data?.peers || []).length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 14, marginBottom: 40 }}>
            <p style={{ margin: 0, color: MUTED, fontSize: 12, fontFamily: FONT_SANS }}>
              No peer data available.
            </p>
          </div>
        ) : (
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14,
            overflow: "hidden", marginBottom: 40 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`,
              display: "flex", gap: 8 }}>
              {["Symbol / Company", "", "", "Price", "Change", "Market Cap"].map((h, i) => (
                <span key={i} style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: MUTED, fontFamily: FONT_SANS,
                  flex: [0, 0, 1, 0, 0, 0][i] || 1,
                  minWidth: [54, 0, 0, 80, 80, 100][i],
                  textAlign: i >= 3 ? "right" : "left" }}>{h}</span>
              ))}
            </div>
            {data.peers.map((peer, i) => <PeerRow key={i} peer={peer} navigate={navigate} />)}
          </div>
        )}
      </section>

    </div>
  );
}
