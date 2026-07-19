import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, Building2,
  ArrowUpRight, Sparkles, Target, AlertTriangle,
  BarChart3, PieChart, SlidersHorizontal, Globe,
  Activity, Newspaper, ChevronRight, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import API from "../services/api";

/* ═══════════════════════ DESIGN TOKENS ═══════════════════════════════════ */
const PANEL  = "#161616";
const BORDER = "rgba(255,255,255,0.05)";
const BORDER_S="rgba(255,255,255,0.09)";
const ACCENT = "#C8A44D";
const A10    = "rgba(200,164,77,0.08)";
const A20    = "rgba(200,164,77,0.20)";
const TEXT   = "#F5F3EF";
const T50    = "rgba(245,243,239,0.50)";
const T25    = "rgba(245,243,239,0.22)";
const T12    = "rgba(245,243,239,0.10)";
const SUCCESS= "#4ADE80";
const DANGER = "#F87171";
const WARN   = "#FBBF24";
const F_SERIF= "'Playfair Display', Georgia, serif";
const F_SANS = "'Inter', 'Space Grotesk', system-ui, sans-serif";
const F_MONO = "'IBM Plex Mono', monospace";

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

/* ─── Animated counter ───────────────────────────────────────────────────── */
function AnimNum({ to, prefix="", suffix="", decimals=0, dur=1400 }) {
  const [v, setV] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, dur]);
  const s = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return <>{prefix}{s}{suffix}</>;
}

/* ─── Mini sparkline ─────────────────────────────────────────────────────── */
function Spark({ data, color, w=80, h=36 }) {
  if (!data?.length) return null;
  const mn = Math.min(...data), mx = Math.max(...data), span = mx - mn || 1;
  const pts = data.map((v,i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - mn) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const id = `sg${color.replace(/[^a-z0-9]/gi,"")}`;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.18}/>
          <stop offset="100%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <polygon fill={`url(#${id})`} points={`0,${h} ${pts} ${w},${h}`}/>
      <polyline fill="none" stroke={color} strokeWidth="1.5"
        points={pts} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KPICard({ title, value, prefix="", suffix="", decimals=0,
  change, changeLbl, spark, icon:Icon, iconColor=ACCENT,
  children, style={} }) {

  const [hov, setHov] = useState(false);
  const up   = change > 0;
  const down = change < 0;
  const sparkColor = up ? SUCCESS : down ? DANGER : T50;

  return (
    <motion.div
      initial={{ opacity:0, y:12 }}
      animate={{ opacity:1, y:0 }}
      whileHover={{ y:-2 }}
      transition={{ type:"spring", stiffness:300, damping:28 }}
      onHoverStart={() => setHov(true)} onHoverEnd={() => setHov(false)}
      style={{
        background:PANEL, borderRadius:16,
        padding:"22px 24px",
        border:`1px solid ${hov ? BORDER_S : BORDER}`,
        boxShadow: hov ? "0 8px 32px rgba(0,0,0,0.45)" : "none",
        transition:"border-color .2s, box-shadow .2s",
        position:"relative", overflow:"hidden", ...style,
      }}>
      {/* Top shimmer on hover */}
      <div style={{ position:"absolute", top:0, left:24, right:24, height:1,
        background:`linear-gradient(90deg,transparent,${iconColor}45,transparent)`,
        opacity: hov ? 1 : 0, transition:"opacity .2s" }}/>

      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:11, color:T25, fontFamily:F_SANS,
          fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase" }}>
          {title}
        </p>
        {Icon && (
          <div style={{ width:30, height:30, borderRadius:9,
            background:`${iconColor}12`, border:`1px solid ${iconColor}20`,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon size={13} color={iconColor}/>
          </div>
        )}
      </div>

      {value != null && (
        <p style={{ margin:"0 0 10px", fontFamily:F_SERIF, fontSize:28,
          fontWeight:500, color:TEXT, letterSpacing:"-0.02em", lineHeight:1.1 }}>
          <AnimNum to={value} prefix={prefix} suffix={suffix} decimals={decimals}/>
        </p>
      )}

      {children}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop: value != null ? 0 : 4 }}>
        {change != null && (
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4,
              padding:"3px 8px", borderRadius:6, fontFamily:F_MONO, fontSize:10, fontWeight:600,
              background: up ? "rgba(74,222,128,0.10)" : down ? "rgba(248,113,113,0.10)" : "rgba(255,255,255,0.05)",
              color: up ? SUCCESS : down ? DANGER : T50 }}>
              {up ? <TrendingUp size={10}/> : down ? <TrendingDown size={10}/> : <Minus size={10}/>}
              {Math.abs(change).toFixed(1)}%
            </div>
            {changeLbl && <span style={{ fontSize:10, color:T25, fontFamily:F_SANS }}>{changeLbl}</span>}
          </div>
        )}
        {spark && <Spark data={spark} color={sparkColor}/>}
      </div>
    </motion.div>
  );
}

/* ─── Recharts tooltip ───────────────────────────────────────────────────── */
function CT({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#141414", border:`1px solid ${BORDER_S}`,
      borderRadius:10, padding:"10px 14px",
      boxShadow:"0 8px 24px rgba(0,0,0,0.6)" }}>
      <p style={{ margin:"0 0 5px", fontSize:10, color:T25, fontFamily:F_SANS,
        letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin:0, fontSize:13, color:TEXT,
          fontFamily:F_MONO, fontWeight:600 }}>
          {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/* ─── Static data ────────────────────────────────────────────────────────── */
const TIMELINE = [
  { m:"Jan", sp: 4800, nq: 15200 }, { m:"Feb", sp: 4920, nq: 15800 },
  { m:"Mar", sp: 5100, nq: 16200 }, { m:"Apr", sp: 5050, nq: 15900 },
  { m:"May", sp: 5280, nq: 16800 }, { m:"Jun", sp: 5450, nq: 17400 },
  { m:"Jul", sp: 5624, nq: 18100 },
];

const SECTORS = [
  { name:"Technology",   v:31, c:"#6366F1" },
  { name:"Healthcare",   v:13, c:"#10B981" },
  { name:"Financials",   v:13, c:"#3B82F6" },
  { name:"Cons. Disc.",  v:10, c:"#F97316" },
  { name:"Industrials",  v: 9, c:"#6B7280" },
  { name:"Energy",       v: 5, c:"#F59E0B" },
  { name:"Other",        v:19, c:"#292929" },
];

const AI_SIGNALS = [
  { ticker:"NVDA", label:"Strong Buy",  color:SUCCESS,
    note:"Record AI-chip orders; forward P/E compressing on revenue beat" },
  { ticker:"GILD", label:"Value Buy",   color:ACCENT,
    note:"P/E at 5-year low; HIV pipeline catalyst Q3 2026" },
  { ticker:"TSLA", label:"Risk Watch",  color:DANGER,
    note:"Volume divergence detected; analyst price target cuts clustering" },
  { ticker:"MSFT", label:"Earnings",    color:WARN,
    note:"Azure guidance next week will set the cloud-sector tone" },
];

const COMPANIES = [
  { sym:"AAPL",  name:"Apple Inc",      cap:"$3.4T", chg:+1.2, sec:"Tech"    },
  { sym:"NVDA",  name:"NVIDIA Corp",    cap:"$2.9T", chg:+3.8, sec:"Tech"    },
  { sym:"MSFT",  name:"Microsoft",      cap:"$2.8T", chg:+0.7, sec:"Tech"    },
  { sym:"GOOGL", name:"Alphabet",       cap:"$2.1T", chg:-0.4, sec:"Comm"    },
  { sym:"AMZN",  name:"Amazon",         cap:"$1.9T", chg:+2.1, sec:"Retail"  },
  { sym:"META",  name:"Meta Platforms", cap:"$1.5T", chg:+1.6, sec:"Comm"    },
  { sym:"LLY",   name:"Eli Lilly",      cap:"$0.7T", chg:+0.3, sec:"Health"  },
  { sym:"JPM",   name:"JPMorgan",       cap:"$0.6T", chg:-0.8, sec:"Finance" },
];

const MKT_PULSE = [
  { l:"S&P 500", v:"5,624", c:+0.82 },
  { l:"NASDAQ",  v:"18,371",c:+1.14 },
  { l:"DOW",     v:"42,180",c:+0.31 },
  { l:"VIX",     v:"13.4",  c:-4.20 },
  { l:"10Y",     v:"4.28%", c:null  },
  { l:"Gold",    v:"$3,214",c:+0.60 },
];

const SPARKS = {
  A: [42,45,41,48,52,49,54,51,58,62,60,65],
  B: [88,82,86,78,82,80,85,88,84,90,87,92],
  C: [4,7,5,9,8,12,10,12],
};

/* ─── Section header ─────────────────────────────────────────────────────── */
function SH({ title, sub, action, onAction }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between",
      alignItems:"baseline", marginBottom:18 }}>
      <div>
        <h3 style={{ margin:0, fontFamily:F_SERIF, fontSize:19, fontWeight:500,
          color:TEXT, letterSpacing:"-0.02em" }}>{title}</h3>
        {sub && <p style={{ margin:"2px 0 0", fontSize:11, color:T25,
          fontFamily:F_SANS }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background:"none", border:"none",
          cursor:"pointer", color:ACCENT, fontSize:11, fontFamily:F_SANS,
          display:"flex", alignItems:"center", gap:4, padding:"4px 0" }}>
          {action}<ArrowUpRight size={12}/>
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════ PAGE ═══════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    API.get("/stock/quote/AAPL").then(r => setQuote(r.data)).catch(() => {});
  }, []);

  const now     = new Date();
  const dateFmt = now.toLocaleDateString("en-US",
    { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  const aaplPx  = quote?.price ?? 211.4;
  const aaplChg = quote?.change_pct ?? 1.2;

  return (
    <div style={{ maxWidth:1480, margin:"0 auto" }}>

      {/* ────────────── HERO ────────────── */}
      <motion.section
        initial={{ opacity:0, y:16 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:.5, ease:[.16,1,.3,1] }}
        style={{ marginBottom:48 }}>

        {/* Date / live badge */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:SUCCESS,
            boxShadow:`0 0 8px ${SUCCESS}90`, animation:"pulse 2s infinite" }}/>
          <span style={{ fontFamily:F_MONO, fontSize:10, color:T25,
            letterSpacing:"0.12em", textTransform:"uppercase" }}>{dateFmt}</span>
        </div>

        <h1 style={{ fontFamily:F_SERIF,
          fontSize:"clamp(34px,4.5vw,58px)",
          fontWeight:500, color:TEXT, letterSpacing:"-0.03em",
          lineHeight:1.08, margin:"0 0 10px" }}>
          {getGreeting()},
          <span style={{ background:`linear-gradient(135deg,${ACCENT},#8a6828)`,
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            backgroundClip:"text", marginLeft:12 }}>Analyst.</span>
        </h1>

        <p style={{ margin:"0 0 30px", fontSize:14, color:T50,
          fontFamily:F_SANS, lineHeight:1.6, maxWidth:520 }}>
          Intelligence Platform is live · 85 tracked securities · AI signals active.
        </p>

        {/* Market pulse strip */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {MKT_PULSE.map(m => (
            <div key={m.l} style={{ display:"flex", alignItems:"center", gap:10,
              padding:"7px 14px", borderRadius:9,
              background:"rgba(255,255,255,0.025)", border:`1px solid ${BORDER}` }}>
              <span style={{ fontFamily:F_SANS, fontSize:9, color:T25,
                letterSpacing:"0.1em", textTransform:"uppercase" }}>{m.l}</span>
              <span style={{ fontFamily:F_MONO, fontSize:12, color:TEXT, fontWeight:600 }}>
                {m.v}
              </span>
              {m.c != null && (
                <span style={{ fontFamily:F_MONO, fontSize:10, fontWeight:700,
                  color: m.c >= 0 ? SUCCESS : DANGER }}>
                  {m.c >= 0 ? "+" : ""}{m.c}%
                </span>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* ────────────── KPI BENTO ────────────── */}
      <section style={{ marginBottom:48 }}>
        <SH title="Key Metrics" sub="Live data · refreshes automatically"
          action="Portfolio Detail" onAction={() => navigate("/portfolio")}/>

        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(12,1fr)", gap:10 }}>

          {/* Portfolio value — 4 cols */}
          <div style={{ gridColumn:"span 4" }}>
            <KPICard title="Portfolio Value" value={284750} prefix="$"
              change={8.4} changeLbl="this month" spark={SPARKS.B}
              icon={BarChart3} iconColor={SUCCESS}>
              <div style={{ margin:"12px 0 10px", paddingTop:12,
                borderTop:`1px solid ${BORDER}` }}>
                <div style={{ display:"flex", gap:24 }}>
                  {[{l:"Unrealised P&L",v:"+$23,840"},{l:"Positions",v:"8"}].map(r=>(
                    <div key={r.l}>
                      <p style={{ margin:0, fontSize:9, color:T25, fontFamily:F_SANS,
                        textTransform:"uppercase", letterSpacing:"0.1em" }}>{r.l}</p>
                      <p style={{ margin:0, fontSize:13, color:T50,
                        fontFamily:F_MONO, fontWeight:600 }}>{r.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </KPICard>
          </div>

          {/* Tracked */}
          <div style={{ gridColumn:"span 2" }}>
            <KPICard title="Universe" value={85} suffix=" stocks"
              change={6.3} changeLbl="vs last week" spark={SPARKS.C}
              icon={Building2} iconColor={ACCENT}/>
          </div>

          {/* AI Signals */}
          <div style={{ gridColumn:"span 2" }}>
            <KPICard title="AI Signals" icon={Sparkles} iconColor="#A78BFA"
              spark={[4,7,5,9,8,12,10,12]}>
              <p style={{ margin:"0 0 10px", fontFamily:F_SERIF, fontSize:28,
                fontWeight:500, color:TEXT, letterSpacing:"-0.02em" }}>12</p>
              <div style={{ display:"flex", gap:6 }}>
                {[["4","Buy",SUCCESS],["2","Sell",DANGER],["6","Hold",WARN]].map(([n,l,c])=>(
                  <div key={l} style={{ flex:1, textAlign:"center",
                    padding:"3px 0", borderRadius:6, background:`${c}10` }}>
                    <p style={{ margin:0, fontFamily:F_MONO, fontSize:12,
                      fontWeight:700, color:c }}>{n}</p>
                    <p style={{ margin:0, fontFamily:F_SANS, fontSize:9, color:T25 }}>{l}</p>
                  </div>
                ))}
              </div>
            </KPICard>
          </div>

          {/* AAPL live */}
          <div style={{ gridColumn:"span 2" }}>
            <KPICard title="AAPL · Live" value={aaplPx} prefix="$" decimals={2}
              change={aaplChg} changeLbl="today" spark={SPARKS.A}
              icon={TrendingUp} iconColor={aaplChg >= 0 ? SUCCESS : DANGER}/>
          </div>

          {/* VIX gauge */}
          <div style={{ gridColumn:"span 2" }}>
            <KPICard title="Market Risk" icon={Activity} iconColor={WARN}>
              <p style={{ margin:"0 0 8px", fontFamily:F_SERIF, fontSize:24,
                fontWeight:500, color:TEXT, letterSpacing:"-0.02em" }}>
                Low Risk
              </p>
              <div style={{ height:4, borderRadius:2,
                background:"rgba(255,255,255,0.06)", overflow:"hidden",
                marginBottom:4 }}>
                <div style={{ height:"100%", width:"26%", borderRadius:2,
                  background:SUCCESS, transition:"width 1s ease" }}/>
              </div>
              <p style={{ margin:0, fontFamily:F_MONO, fontSize:10, color:T25 }}>
                VIX 13.4 · Low volatility regime
              </p>
            </KPICard>
          </div>
        </div>
      </section>

      {/* ────────────── CHARTS ────────────── */}
      <section style={{ display:"grid", gridTemplateColumns:"1fr 300px",
        gap:10, marginBottom:48 }}>

        {/* Index chart */}
        <motion.div
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:.15, duration:.5, ease:[.16,1,.3,1] }}
          style={{ background:PANEL, border:`1px solid ${BORDER}`,
            borderRadius:16, padding:"24px 24px 16px" }}>
          <SH title="Index Performance" sub="S&P 500 · NASDAQ · YTD 2026"
            action="Full Chart" onAction={() => navigate("/live-market")}/>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={TIMELINE} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22}/>
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.16}/>
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="m" tick={{ fontFamily:F_MONO, fontSize:10, fill:T25 }}
                axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontFamily:F_MONO, fontSize:9, fill:T25 }}
                axisLine={false} tickLine={false}
                tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<CT/>}/>
              <Area dataKey="sp" name="S&P 500" stroke={ACCENT} strokeWidth={1.5}
                fill="url(#g1)" dot={false} activeDot={{ r:4, fill:ACCENT }}/>
              <Area dataKey="nq" name="NASDAQ" stroke="#6366F1" strokeWidth={1.5}
                fill="url(#g2)" dot={false} activeDot={{ r:4, fill:"#6366F1" }}/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:16, marginTop:8 }}>
            {[{c:ACCENT,l:"S&P 500"},{c:"#6366F1",l:"NASDAQ"}].map(({c,l})=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:16, height:2, borderRadius:99, background:c }}/>
                <span style={{ fontSize:10, color:T25, fontFamily:F_SANS }}>{l}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sector donut */}
        <motion.div
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:.22, duration:.5, ease:[.16,1,.3,1] }}
          style={{ background:PANEL, border:`1px solid ${BORDER}`,
            borderRadius:16, padding:"24px" }}>
          <SH title="Sector Mix" sub="S&P 500 weight"/>
          <ResponsiveContainer width="100%" height={160}>
            <RechartsPie>
              <Pie data={SECTORS} cx="50%" cy="50%"
                innerRadius={50} outerRadius={72}
                paddingAngle={2} dataKey="v" strokeWidth={0}>
                {SECTORS.map((d,i) => <Cell key={i} fill={d.c} fillOpacity={0.9}/>)}
              </Pie>
              <Tooltip
                contentStyle={{ background:"#141414", border:`1px solid ${BORDER_S}`,
                  borderRadius:10, fontFamily:F_MONO, fontSize:12, color:TEXT }}
                formatter={(v,n) => [`${v}%`, n]}/>
            </RechartsPie>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:4 }}>
            {SECTORS.slice(0,6).map(d => (
              <div key={d.name} style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{ width:6, height:6, borderRadius:2,
                    background:d.c, flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:T50, fontFamily:F_SANS,
                    maxWidth:110, overflow:"hidden", textOverflow:"ellipsis",
                    whiteSpace:"nowrap" }}>{d.name}</span>
                </div>
                <span style={{ fontFamily:F_MONO, fontSize:11, color:T25,
                  fontWeight:600 }}>{d.v}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ────────────── TABLE + AI PANEL ────────────── */}
      <section style={{ display:"grid", gridTemplateColumns:"1fr 288px",
        gap:10, marginBottom:48 }}>

        {/* Company table */}
        <motion.div
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:.28, duration:.5, ease:[.16,1,.3,1] }}
          style={{ background:PANEL, border:`1px solid ${BORDER}`,
            borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${BORDER}` }}>
            <SH title="Top Companies" sub="By market capitalisation"
              action="Screener" onAction={() => navigate("/screener")}/>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  {["#","Company","Sector","Market Cap","Today"].map((h,i) => (
                    <th key={h} style={{ padding:"9px 20px",
                      textAlign: i >= 3 ? "right" : "left",
                      fontFamily:F_SANS, fontSize:9, color:T25,
                      fontWeight:700, letterSpacing:"0.12em",
                      textTransform:"uppercase",
                      borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPANIES.map((co,i) => (
                  <tr key={co.sym}
                    onClick={() => navigate(`/company/${co.sym}`)}
                    style={{ cursor:"pointer", transition:"background .12s" }}
                    onMouseEnter={e => e.currentTarget.style.background=A10}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"11px 20px", fontFamily:F_MONO,
                      fontSize:11, color:T25 }}>{i+1}</td>
                    <td style={{ padding:"11px 8px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:30, height:30, borderRadius:8,
                          flexShrink:0, background:"rgba(255,255,255,0.04)",
                          border:`1px solid ${BORDER_S}`,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontFamily:F_MONO, fontSize:8,
                            color:T50, fontWeight:700 }}>{co.sym.slice(0,2)}</span>
                        </div>
                        <div>
                          <p style={{ margin:0, fontFamily:F_SANS, fontSize:12,
                            fontWeight:700, color:TEXT }}>{co.sym}</p>
                          <p style={{ margin:0, fontFamily:F_SANS, fontSize:10,
                            color:T25 }}>{co.name}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"11px 8px" }}>
                      <span style={{ padding:"2px 8px", borderRadius:6,
                        background:"rgba(255,255,255,0.04)",
                        border:`1px solid ${BORDER}`,
                        fontFamily:F_SANS, fontSize:9,
                        fontWeight:600, color:T50 }}>{co.sec}</span>
                    </td>
                    <td style={{ padding:"11px 20px", textAlign:"right",
                      fontFamily:F_MONO, fontSize:12, color:TEXT,
                      fontWeight:700 }}>{co.cap}</td>
                    <td style={{ padding:"11px 20px", textAlign:"right" }}>
                      <span style={{ fontFamily:F_MONO, fontSize:11,
                        fontWeight:700, color: co.chg >= 0 ? SUCCESS : DANGER }}>
                        {co.chg >= 0 ? "+" : ""}{co.chg}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"10px 20px", borderTop:`1px solid ${BORDER}` }}>
            <p style={{ margin:0, fontSize:9, color:T25, fontFamily:F_SANS }}>
              Click any row to open company detail · Showing top 8 by market cap
            </p>
          </div>
        </motion.div>

        {/* AI Insights */}
        <motion.div
          initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }}
          transition={{ delay:.32, duration:.5, ease:[.16,1,.3,1] }}
          style={{ background:PANEL, border:`1px solid ${BORDER}`,
            borderRadius:16, overflow:"hidden",
            display:"flex", flexDirection:"column" }}>

          <div style={{ padding:"18px 20px 14px",
            borderBottom:`1px solid ${BORDER}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:8,
                background:"rgba(167,139,250,0.12)",
                border:"1px solid rgba(167,139,250,0.2)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Sparkles size={12} color="#A78BFA"/>
              </div>
              <p style={{ margin:0, fontFamily:F_SERIF, fontSize:15,
                fontWeight:500, color:TEXT }}>AI Signals</p>
            </div>
            <p style={{ margin:"3px 0 0", fontSize:10, color:T25,
              fontFamily:F_SANS }}>Refreshed · 4 active signals</p>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"10px" }}>
            {AI_SIGNALS.map((s,i) => (
              <motion.div key={i}
                initial={{ opacity:0, y:8 }}
                animate={{ opacity:1, y:0 }}
                transition={{ delay:.4 + i * .08 }}
                onClick={() => navigate(`/company/${s.ticker}`)}
                whileHover={{ scale:1.01 }}
                style={{ padding:"12px", borderRadius:10, marginBottom:8,
                  background:`${s.color}08`,
                  border:`1px solid ${s.color}18`,
                  cursor:"pointer", transition:"border-color .15s" }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:5 }}>
                  <span style={{ fontFamily:F_MONO, fontSize:13,
                    fontWeight:700, color:s.color }}>{s.ticker}</span>
                  <span style={{ fontFamily:F_SANS, fontSize:8,
                    fontWeight:700, color:s.color,
                    letterSpacing:"0.12em", textTransform:"uppercase",
                    opacity:.85 }}>{s.label}</span>
                </div>
                <p style={{ margin:0, fontSize:11, color:T50,
                  fontFamily:F_SANS, lineHeight:1.5 }}>{s.note}</p>
              </motion.div>
            ))}
          </div>

          <div style={{ padding:"12px", borderTop:`1px solid ${BORDER}` }}>
            <button onClick={() => navigate("/ai-engine")} style={{ width:"100%",
              padding:"9px", borderRadius:10, cursor:"pointer",
              background:A10, border:`1px solid rgba(200,164,77,0.2)`,
              color:ACCENT, fontSize:11, fontFamily:F_SANS, fontWeight:700,
              letterSpacing:"0.08em", textTransform:"uppercase",
              display:"flex", alignItems:"center", justifyContent:"center",
              gap:6, transition:"background .15s" }}
              onMouseEnter={e => e.currentTarget.style.background=A20}
              onMouseLeave={e => e.currentTarget.style.background=A10}>
              <Sparkles size={12}/> Full AI Engine
            </button>
          </div>
        </motion.div>
      </section>

      {/* ────────────── QUICK ACTIONS ────────────── */}
      <motion.section
        initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:.42, duration:.5 }}
        style={{ marginBottom:32 }}>
        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { label:"Screener",    sub:"Filter 85+ stocks",   Icon:SlidersHorizontal, path:"/screener",   c:"#6366F1" },
            { label:"AI Engine",   sub:"Get signals & recs",  Icon:Sparkles,          path:"/ai-engine",  c:"#A78BFA" },
            { label:"News Feed",   sub:"Market intelligence", Icon:Newspaper,         path:"/news",       c:"#60A5FA" },
            { label:"Portfolio",   sub:"Track performance",   Icon:PieChart,          path:"/portfolio",  c:SUCCESS   },
          ].map(q => (
            <button key={q.label} onClick={() => navigate(q.path)}
              style={{ padding:"16px", borderRadius:12,
                background:"rgba(255,255,255,0.02)",
                border:`1px solid ${BORDER}`, cursor:"pointer",
                display:"flex", alignItems:"center", gap:12,
                textAlign:"left", transition:"all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background=`${q.c}08`; e.currentTarget.style.borderColor=`${q.c}25`; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor=BORDER; }}>
              <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
                background:`${q.c}12`, border:`1px solid ${q.c}20`,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <q.Icon size={15} color={q.c}/>
              </div>
              <div>
                <p style={{ margin:0, fontFamily:F_SANS, fontSize:12,
                  fontWeight:700, color:TEXT }}>{q.label}</p>
                <p style={{ margin:0, fontFamily:F_SANS, fontSize:10,
                  color:T25 }}>{q.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>
    </div>
  );
}