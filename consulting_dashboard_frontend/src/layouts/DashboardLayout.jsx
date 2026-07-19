import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Newspaper, Star, PieChart,
  Sparkles, SlidersHorizontal, Search, Bell, Settings,
  ChevronLeft, ChevronRight, Building2,
  User, ArrowUpRight, AlertTriangle,
  BarChart3, Target, TrendingUp, Activity,
  Briefcase, BookOpen, Globe, Layers, Gauge
} from "lucide-react";

/* ═══════════════════════ DESIGN TOKENS ════════════════════════════════════ */
const BG      = "#090909";
const PANEL   = "#161616";
const BORDER  = "rgba(255,255,255,0.05)";
const BORDER_S= "rgba(255,255,255,0.09)";
const ACCENT  = "#C8A44D";
const A10     = "rgba(200,164,77,0.08)";
const A20     = "rgba(200,164,77,0.18)";
const TEXT    = "#F5F3EF";
const T50     = "rgba(245,243,239,0.52)";
const T25     = "rgba(245,243,239,0.22)";
const SUCCESS = "#4ADE80";
const F_SERIF = "'Playfair Display', Georgia, serif";
const F_SANS  = "'Inter', 'Space Grotesk', system-ui, sans-serif";
const F_MONO  = "'IBM Plex Mono', monospace";
const W_FULL  = 240;
const W_SLIM  = 64;

/* ═══════════════════════ NAVIGATION ═══════════════════════════════════════ */
const NAV_GROUPS = [
  {
    label: "Intelligence",
    items: [
      { path: "/dashboard",        label: "Overview",        Icon: LayoutDashboard  },
      { path: "/ai-engine",        label: "AI Engine",       Icon: Sparkles         },
      { path: "/screener",         label: "Screener",        Icon: SlidersHorizontal},
      { path: "/investment-score", label: "Recommendations", Icon: Target           },
      { path: "/benchmark",        label: "Benchmark",       Icon: BarChart3        },
    ],
  },
  {
    label: "Markets",
    items: [
      { path: "/news",             label: "News Feed",       Icon: Newspaper        },
      { path: "/watchlist",        label: "Watchlist",       Icon: Star             },
      { path: "/live-market",      label: "Live Market",     Icon: Activity         },
      { path: "/companies",        label: "Companies",       Icon: Building2        },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { path: "/portfolio",        label: "Portfolio",       Icon: PieChart         },
      { path: "/risk-analysis",    label: "Risk Analysis",   Icon: AlertTriangle    },
    ],
  },
  {
    label: "Reports",
    items: [
      { path: "/executive-summary", label: "Executive Brief", Icon: Briefcase       },
    ],
  },
];

const BREADCRUMB_MAP = {
  "/":                  "Overview",
  "/dashboard":         "Overview",
  "/ai-engine":         "AI Engine",
  "/screener":          "Screener",
  "/investment-score":  "Recommendations",
  "/benchmark":         "Benchmark",
  "/news":              "News Intelligence",
  "/watchlist":         "Watchlist",
  "/live-market":       "Live Market",
  "/companies":         "Companies",
  "/portfolio":         "Portfolio Tracker",
  "/risk-analysis":     "Risk Analysis",
  "/executive-summary": "Executive Brief",
};

const RECENT_TICKERS = ["AAPL","NVDA","MSFT","TSLA","JPM"];

const COMMAND_ITEMS = [
  ...NAV_GROUPS.flatMap(g => g.items).map(i => ({ group: "Navigate", ...i })),
  { group:"Research", label:"Apple (AAPL)",    path:"/company/AAPL",  Icon: Building2 },
  { group:"Research", label:"NVIDIA (NVDA)",   path:"/company/NVDA",  Icon: Building2 },
  { group:"Research", label:"Microsoft (MSFT)",path:"/company/MSFT",  Icon: Building2 },
  { group:"Research", label:"Tesla (TSLA)",    path:"/company/TSLA",  Icon: Building2 },
  { group:"Research", label:"Amazon (AMZN)",   path:"/company/AMZN",  Icon: Building2 },
  { group:"Research", label:"JPMorgan (JPM)",  path:"/company/JPM",   Icon: Building2 },
  { group:"Research", label:"Meta (META)",     path:"/company/META",  Icon: Building2 },
  { group:"Research", label:"Alphabet (GOOGL)",path:"/company/GOOGL", Icon: Building2 },
];

/* ═══════════════════════ LIVE CLOCK ════════════════════════════════════════ */
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <span style={{ fontFamily: F_MONO, fontSize: 11, color: T25, letterSpacing: "0.04em" }}>
      {t.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12: false })}
    </span>
  );
}

/* ═══════════════════════ COMMAND PALETTE ════════════════════════════════════ */
function CommandPalette({ onClose }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const filtered = q
    ? COMMAND_ITEMS.filter(i => i.label.toLowerCase().includes(q.toLowerCase()))
    : COMMAND_ITEMS;

  const grouped = filtered.reduce((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {});

  const go = (path) => { navigate(path); onClose(); };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "14vh",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 580, background: "#131313",
          border: `1px solid ${BORDER_S}`, borderRadius: 18,
          boxShadow: "0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Input */}
        <div style={{ display:"flex", alignItems:"center", gap:12,
          padding:"16px 20px", borderBottom:`1px solid ${BORDER}` }}>
          <Search size={16} color={T25}/>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search pages, companies, modules…"
            style={{ flex:1, background:"none", border:"none", outline:"none",
              color:TEXT, fontSize:15, fontFamily:F_SANS, caretColor:ACCENT }}/>
          <kbd style={{ padding:"2px 7px", borderRadius:5,
            background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER_S}`,
            fontSize:10, color:T25, fontFamily:F_MONO }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 440, overflowY:"auto", paddingBottom:8 }}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p style={{ padding:"12px 20px 5px", fontSize:10, color:T25,
                fontFamily:F_SANS, letterSpacing:"0.12em",
                textTransform:"uppercase", fontWeight:600, margin:0 }}>{group}</p>
              {items.map(item => (
                <button key={item.path} onClick={() => go(item.path)}
                  style={{ width:"100%", display:"flex", alignItems:"center",
                    gap:12, padding:"10px 20px", background:"none", border:"none",
                    cursor:"pointer", color:T50, transition:"all .12s", textAlign:"left" }}
                  onMouseEnter={e => { e.currentTarget.style.background=A10; e.currentTarget.style.color=TEXT; }}
                  onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color=T50; }}
                >
                  <item.Icon size={14} color="currentColor" style={{ flexShrink:0 }}/>
                  <span style={{ fontSize:13, fontFamily:F_SANS }}>{item.label}</span>
                  <ArrowUpRight size={12} style={{ marginLeft:"auto", opacity:0.35 }}/>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ padding:"40px 20px", textAlign:"center",
              color:T25, fontSize:13, fontFamily:F_SANS }}>
              No results for "<strong style={{color:T50}}>{q}</strong>"
            </p>
          )}
        </div>

        {/* Hints */}
        <div style={{ padding:"10px 20px", borderTop:`1px solid ${BORDER}`,
          display:"flex", gap:20, alignItems:"center" }}>
          {[["↩","Select"],["↑↓","Navigate"],["ESC","Close"]].map(([k,l]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <kbd style={{ padding:"1px 6px", borderRadius:4,
                background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER_S}`,
                fontSize:10, color:T25, fontFamily:F_MONO }}>{k}</kbd>
              <span style={{ fontSize:10, color:T25, fontFamily:F_SANS }}>{l}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════ NAV ITEM ══════════════════════════════════════════ */
function NavItem({ path, label, Icon, collapsed }) {
  return (
    <NavLink to={path} style={{ textDecoration:"none", display:"block" }} end={path === "/dashboard"}>
      {({ isActive }) => (
        <motion.div
          whileHover={{ x: collapsed ? 0 : 2 }}
          transition={{ type:"spring", stiffness:400, damping:30 }}
          title={collapsed ? label : undefined}
          style={{
            display:"flex", alignItems:"center",
            gap:10, margin:"1px 8px",
            padding: collapsed ? "10px 0" : "9px 14px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius:10, cursor:"pointer", position:"relative",
            background: isActive ? A10 : "transparent",
            transition:"background .15s, color .15s",
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background="transparent"; }}
        >
          {isActive && (
            <motion.div layoutId="nav-pill"
              style={{ position:"absolute", left:0, top:"18%", bottom:"18%",
                width:2.5, borderRadius:99, background:ACCENT,
                boxShadow:`0 0 10px ${ACCENT}60` }}
              transition={{ type:"spring", stiffness:400, damping:30 }}/>
          )}
          <Icon size={15} style={{ color: isActive ? ACCENT : T50, flexShrink:0,
            transition:"color .15s" }}/>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:"auto" }}
                exit={{ opacity:0, width:0 }} transition={{ duration:.17 }}
                style={{ fontSize:13, fontFamily:F_SANS, fontWeight:500,
                  color: isActive ? ACCENT : T50, whiteSpace:"nowrap",
                  overflow:"hidden", transition:"color .15s" }}>
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </NavLink>
  );
}

/* ═══════════════════════ SIDEBAR ════════════════════════════════════════════ */
function Sidebar({ collapsed, setCollapsed, openCmd }) {
  const navigate = useNavigate();
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? W_SLIM : W_FULL }}
      transition={{ type:"spring", stiffness:340, damping:32 }}
      style={{
        height:"100vh", flexShrink:0,
        background:"rgba(10,10,10,0.98)",
        borderRight:`1px solid ${BORDER}`,
        display:"flex", flexDirection:"column",
        overflow:"hidden", position:"relative", zIndex:40,
      }}
    >
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center",
        justifyContent: collapsed ? "center" : "space-between",
        padding: collapsed ? "18px 0" : "18px 16px",
        borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <motion.div
            whileHover={{ scale: 1.04 }}
            style={{ width:32, height:32, borderRadius:9, flexShrink:0,
              background:`linear-gradient(135deg,${ACCENT},#8a6828)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 0 18px rgba(200,164,77,0.28)`,
              cursor:"pointer" }}
            onClick={() => navigate("/dashboard")}
          >
            <span style={{ fontFamily:F_SERIF, fontSize:13, fontWeight:700,
              color:"#000", letterSpacing:"-0.02em" }}>CI</span>
          </motion.div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                exit={{ opacity:0, x:-8 }} transition={{ duration:.18 }}>
                <p style={{ margin:0, fontFamily:F_SERIF, fontSize:13,
                  fontWeight:600, color:TEXT, lineHeight:1.2 }}>Intelligence</p>
                <p style={{ margin:0, fontFamily:F_SANS, fontSize:9, color:T25,
                  letterSpacing:"0.16em", textTransform:"uppercase" }}>Platform</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{ background:"none",
            border:"none", cursor:"pointer", padding:4, color:T25,
            borderRadius:6, display:"flex", transition:"color .15s" }}
            onMouseEnter={e => e.currentTarget.style.color=T50}
            onMouseLeave={e => e.currentTarget.style.color=T25}>
            <ChevronLeft size={14}/>
          </button>
        )}

        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{
            position:"absolute", right:-9, top:"50%", transform:"translateY(-50%)",
            width:18, height:18, borderRadius:"50%",
            background:"#1e1e1e", border:`1px solid ${BORDER_S}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", color:T25, zIndex:50 }}>
            <ChevronRight size={10}/>
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: collapsed ? "8px 0" : "10px 12px", flexShrink:0,
        display:"flex", justifyContent: collapsed ? "center" : "flex-start" }}>
        {collapsed ? (
          <button onClick={openCmd} title="Search ⌘K"
            style={{ background:"none", border:"none", cursor:"pointer",
              padding:10, color:T25, borderRadius:8, display:"flex" }}>
            <Search size={15}/>
          </button>
        ) : (
          <button onClick={openCmd} style={{ width:"100%", display:"flex",
            alignItems:"center", gap:8, padding:"8px 10px", borderRadius:9,
            background:"rgba(255,255,255,0.03)", border:`1px solid ${BORDER}`,
            cursor:"pointer", color:T25, transition:"all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=BORDER_S; e.currentTarget.style.color=T50; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=BORDER; e.currentTarget.style.color=T25; }}>
            <Search size={12}/>
            <span style={{ flex:1, textAlign:"left", fontSize:12, fontFamily:F_SANS }}>Search…</span>
            <kbd style={{ padding:"1px 5px", borderRadius:3,
              background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`,
              fontSize:9, color:T25, fontFamily:F_MONO }}>⌘K</kbd>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"2px 0" }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom:2 }}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  style={{ padding:"12px 22px 4px", fontSize:9, fontFamily:F_SANS,
                    color:T25, letterSpacing:"0.18em", textTransform:"uppercase",
                    fontWeight:700, margin:0 }}>
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {group.items.map(item => (
              <NavItem key={item.path} {...item} collapsed={collapsed}/>
            ))}
          </div>
        ))}

        {/* Recent Tickers */}
        {!collapsed && (
          <div style={{ marginTop:6, padding:"0 8px" }}>
            <p style={{ padding:"12px 14px 4px", fontSize:9, fontFamily:F_SANS,
              color:T25, letterSpacing:"0.18em", textTransform:"uppercase",
              fontWeight:700, margin:0 }}>Recent</p>
            {RECENT_TICKERS.map(sym => (
              <NavLink key={sym} to={`/company/${sym}`}
                style={{ textDecoration:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"7px 14px", margin:"1px 0", borderRadius:8,
                  cursor:"pointer", color:T25, transition:"all .12s" }}
                  onMouseEnter={e => { e.currentTarget.style.background=A10; e.currentTarget.style.color=ACCENT; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=T25; }}>
                  <div style={{ width:20, height:20, borderRadius:5,
                    background:"rgba(255,255,255,0.05)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:7, fontFamily:F_MONO, fontWeight:700,
                    color:T50, flexShrink:0 }}>{sym.slice(0,2)}</div>
                  <span style={{ fontSize:12, fontFamily:F_SANS, fontWeight:500 }}>{sym}</span>
                  <ArrowUpRight size={10} style={{ marginLeft:"auto", opacity:.45 }}/>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User */}
      <div style={{ borderTop:`1px solid ${BORDER}`, flexShrink:0,
        padding: collapsed ? "14px 0" : "14px 12px",
        display:"flex", justifyContent: collapsed ? "center" : "flex-start" }}>
        {collapsed ? (
          <div style={{ width:34, height:34, borderRadius:10,
            background:"rgba(255,255,255,0.04)", border:`1px solid ${BORDER_S}`,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <User size={14} color={T50}/>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%" }}>
            <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
              background:`linear-gradient(135deg,#22201c,#16140f)`,
              border:`1px solid rgba(200,164,77,0.18)`,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:F_SERIF, fontSize:13, color:ACCENT, fontWeight:600 }}>A</span>
            </div>
            <div style={{ flex:1, overflow:"hidden" }}>
              <p style={{ margin:0, fontSize:12, fontWeight:600, color:TEXT,
                fontFamily:F_SANS, whiteSpace:"nowrap", overflow:"hidden",
                textOverflow:"ellipsis" }}>Analyst</p>
              <p style={{ margin:0, fontSize:10, color:T25, fontFamily:F_SANS }}>
                Senior · Intelligence Platform
              </p>
            </div>
            <button style={{ background:"none", border:"none", cursor:"pointer",
              padding:4, color:T25, transition:"color .15s" }}
              onMouseEnter={e => e.currentTarget.style.color=T50}
              onMouseLeave={e => e.currentTarget.style.color=T25}>
              <Settings size={13}/>
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

/* ═══════════════════════ HEADER ═════════════════════════════════════════════ */
function Header({ openCmd }) {
  const location = useLocation();

  const getLabel = () => {
    const p = location.pathname;
    if (p.startsWith("/company/")) {
      const sym = p.split("/")[2]?.toUpperCase() || "";
      return { crumb: "Company Detail", title: sym };
    }
    const label = BREADCRUMB_MAP[p] || "Overview";
    return { crumb: null, title: label };
  };
  const { crumb, title } = getLabel();

  return (
    <header style={{
      height:56, display:"flex", alignItems:"center",
      padding:"0 28px", flexShrink:0,
      background:"rgba(9,9,9,0.90)",
      backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
      borderBottom:`1px solid ${BORDER}`,
      position:"sticky", top:0, zIndex:30, gap:20,
    }}>
      {/* Breadcrumb */}
      <div style={{ display:"flex", alignItems:"center", gap:7, flex:1, minWidth:0 }}>
        <span style={{ fontSize:10, color:T25, fontFamily:F_SANS,
          letterSpacing:"0.14em", textTransform:"uppercase", fontWeight:600,
          whiteSpace:"nowrap" }}>CI Platform</span>
        <ChevronRight size={11} color={T25}/>
        {crumb && (
          <><span style={{ fontSize:10, color:T25, fontFamily:F_SANS }}>{crumb}</span>
          <ChevronRight size={11} color={T25}/></>
        )}
        <span style={{ fontSize:13, color:TEXT, fontFamily:F_SANS, fontWeight:600,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</span>
      </div>

      {/* Search trigger */}
      <button onClick={openCmd} style={{
        display:"flex", alignItems:"center", gap:10, padding:"7px 16px",
        background:"rgba(255,255,255,0.035)", border:`1px solid ${BORDER}`,
        borderRadius:10, cursor:"pointer", color:T25,
        minWidth:230, transition:"all .15s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor=BORDER_S; e.currentTarget.style.color=T50; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor=BORDER; e.currentTarget.style.color=T25; }}>
        <Search size={12}/>
        <span style={{ flex:1, textAlign:"left", fontSize:12, fontFamily:F_SANS }}>
          Search companies, pages…
        </span>
        <kbd style={{ padding:"1px 6px", borderRadius:4,
          background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER_S}`,
          fontSize:9, color:T25, fontFamily:F_MONO, whiteSpace:"nowrap" }}>⌘ K</kbd>
      </button>

      {/* Right */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        {/* Live */}
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px",
          borderRadius:8, background:"rgba(74,222,128,0.07)",
          border:"1px solid rgba(74,222,128,0.14)" }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:SUCCESS,
            boxShadow:`0 0 6px ${SUCCESS}80`,
            animation:"pulse 2s ease-in-out infinite" }}/>
          <span style={{ fontSize:10, color:SUCCESS, fontFamily:F_MONO,
            letterSpacing:"0.08em", fontWeight:700 }}>LIVE</span>
        </div>

        <LiveClock/>

        <button style={{ background:"none", border:"none", cursor:"pointer",
          padding:8, color:T25, borderRadius:8, position:"relative",
          display:"flex", transition:"color .15s" }}
          onMouseEnter={e => e.currentTarget.style.color=T50}
          onMouseLeave={e => e.currentTarget.style.color=T25}
          title="Notifications">
          <Bell size={15}/>
          <div style={{ position:"absolute", top:6, right:6, width:5, height:5,
            borderRadius:"50%", background:ACCENT,
            boxShadow:`0 0 5px ${ACCENT}` }}/>
        </button>

        <div style={{ width:30, height:30, borderRadius:9, flexShrink:0,
          background:`linear-gradient(135deg,#22201c,#16140f)`,
          border:`1px solid rgba(200,164,77,0.2)`,
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <span style={{ fontFamily:F_SERIF, fontSize:12, color:ACCENT, fontWeight:700 }}>A</span>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════ LAYOUT ═════════════════════════════════════════════ */
export default function DashboardLayout() {
  const [collapsed,   setCollapsed]   = useState(false);
  const [cmdOpen,     setCmdOpen]     = useState(false);
  const location = useLocation();

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div style={{ display:"flex", height:"100vh", background:BG, overflow:"hidden" }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}
        openCmd={() => setCmdOpen(true)}/>

      <div style={{ flex:1, display:"flex", flexDirection:"column",
        overflow:"hidden", minWidth:0 }}>
        <Header openCmd={() => setCmdOpen(true)}/>
        <main
          key={location.pathname}
          className="page-enter"
          style={{ flex:1, overflowY:"auto", overflowX:"hidden",
            padding:"32px 36px" }}>
          <Outlet/>
        </main>
      </div>

      <AnimatePresence>
        {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)}/>}
      </AnimatePresence>
    </div>
  );
}