import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import API from "../services/api";

/* ═══════════════════ CONSTANTS ═══════════════════════════ */
const F    = "'Syne', sans-serif";
const FS   = "'Cormorant Garamond', serif";
const GOLD = "#D4AF37";
const G10  = "rgba(212,175,55,0.10)";
const G30  = "rgba(212,175,55,0.30)";
const BG   = "rgba(255,255,255,0.025)";
const BD   = "rgba(255,255,255,0.07)";
const MUT  = "rgba(255,255,255,0.28)";
const TXT  = "rgba(255,255,255,0.8)";
const GRN  = "#50DC78";
const RED  = "#E55050";

const PIE_COLORS = [
  "#D4AF37","#5B9CF6","#50DC78","#C084FC","#FB923C",
  "#F472B6","#34D399","#60A5FA","#FCD34D","#A78BFA","#E55050","#4ADE80",
];

const SECTOR_COLOR = {
  "Technology":            "#5B9CF6",
  "Semiconductors":        "#C084FC",
  "Software":              "#818CF8",
  "Healthcare":            "#50DC78",
  "Financial Services":    "#D4AF37",
  "Consumer Cyclical":     "#FB923C",
  "Communication Services":"#34D399",
  "Energy":                "#F59E0B",
  "Utilities":             "#60A5FA",
  "Basic Materials":       "#FCD34D",
  "Industrials":           "#A3A3A3",
  "Real Estate":           "#F472B6",
  "Other":                 "#6B7280",
};

/* ═══════════════════ FORMATTERS ══════════════════════════ */
const fmt$ = (v, d = 2) => {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Number(v).toFixed(d)}`;
};
const fmtPct = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
};
const plColor = (v) => (v == null ? MUT : v >= 0 ? GRN : RED);

/* ═══════════════════ TOAST ═══════════════════════════════ */
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const c = type === "err" ? RED : type === "warn" ? "#FB923C" : GRN;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: "rgba(8,9,14,0.97)", border: `1px solid ${c}40`,
      borderRadius: 14, padding: "12px 18px",
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: F, fontSize: 12, color: c,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      animation: "fadeUp 0.3s ease both",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      {msg}
    </div>
  );
}

/* ═══════════════════ KPI CARD ═══════════════════════════ */
function KPICard({ label, value, subValue, color, icon }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: BG, border: `1px solid ${BD}`,
      borderRadius: 16, padding: "18px 20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color || GOLD}80, transparent)`,
      }} />
      <p style={{ margin: "0 0 8px", fontSize: 9, letterSpacing: "0.2em",
        textTransform: "uppercase", color: MUT, fontFamily: F }}>{label}</p>
      <p style={{ margin: 0, fontFamily: FS, fontSize: "clamp(20px,2.5vw,28px)",
        fontWeight: 300, color: color || "#fff", letterSpacing: "-0.02em" }}>{value}</p>
      {subValue && (
        <p style={{ margin: "4px 0 0", fontFamily: F, fontSize: 11, color: MUT }}>{subValue}</p>
      )}
    </div>
  );
}

/* ═══════════════════ ADD/EDIT HOLDING MODAL ════════════════ */
function HoldingModal({ portfolioId, initial, onClose, onSaved }) {
  const [sym,     setSym]     = useState(initial?.symbol || "");
  const [qty,     setQty]     = useState(initial?.quantity?.toString() || "");
  const [price,   setPrice]   = useState(initial?.buy_price?.toString() || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState(null);
  const [selName, setSelName] = useState(initial?.company_name || "");
  const [selSec,  setSelSec]  = useState(initial?.sector || "");
  const debRef  = useRef(null);
  const inputRef = useRef(null);
  const isEdit  = !!initial;
  useEffect(() => { if (!isEdit) inputRef.current?.focus(); }, []);

  const search = (q) => {
    setSym(q); setSelName(""); setSelSec(""); setErr(null);
    clearTimeout(debRef.current);
    if (!q.trim()) { setResults([]); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await API.get("/market-explorer/search", { params: { q } });
        setResults(Array.isArray(r.data) ? r.data.slice(0, 7) : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  };

  const select = (r) => {
    setSym(r.symbol); setSelName(r.description || r.symbol);
    setResults([]);
  };

  const costBasis = () => {
    const q = parseFloat(qty), p = parseFloat(price);
    if (isNaN(q) || isNaN(p)) return null;
    return q * p;
  };

  const save = async () => {
    if (!sym.trim())         { setErr("Enter a stock symbol"); return; }
    if (!qty || parseFloat(qty) <= 0)   { setErr("Enter a valid quantity"); return; }
    if (!price || parseFloat(price) <= 0) { setErr("Enter a valid buy price"); return; }
    setBusy(true); setErr(null);
    try {
      if (isEdit) {
        await API.put(`/portfolios/${portfolioId}/holdings/${initial.symbol}`, {
          quantity: parseFloat(qty), buy_price: parseFloat(price),
        });
        onSaved("updated");
      } else {
        await API.post(`/portfolios/${portfolioId}/holdings`, {
          symbol: sym.trim().toUpperCase(),
          quantity: parseFloat(qty),
          buy_price: parseFloat(price),
          company_name: selName || undefined,
          sector: selSec || undefined,
        });
        onSaved("added");
      }
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Something went wrong");
    } finally { setBusy(false); }
  };

  const cb = costBasis();

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",
        backdropFilter:"blur(6px)",zIndex:400,
      }}/>
      <div style={{
        position:"fixed",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
        background:"rgba(10,12,18,0.99)",border:`1px solid ${G30}`,
        borderRadius:20,padding:"36px",zIndex:401,
        width:"min(540px,95vw)",fontFamily:F,
        animation:"fadeUp 0.28s ease both",
      }}>
        <div style={{ position:"absolute",top:0,left:0,right:0,height:2,
          borderRadius:"20px 20px 0 0",
          background:`linear-gradient(90deg,${GOLD},rgba(212,175,55,0.1),transparent)` }}/>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28 }}>
          <div>
            <h3 style={{ fontFamily:FS,fontSize:30,fontWeight:300,color:"#fff",margin:0 }}>
              {isEdit ? "Edit Position" : "Add Position"}
            </h3>
            <p style={{ margin:"4px 0 0",fontSize:11,color:MUT }}>
              {isEdit ? `${initial.symbol} · ${initial.company_name}` : "Search and enter trade details"}
            </p>
          </div>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:8,width:32,height:32,cursor:"pointer",
            color:MUT,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",
          }}>×</button>
        </div>

        {/* Symbol search (only for new) */}
        {!isEdit && (
          <div style={{ marginBottom:18 }}>
            <label style={{ display:"block",marginBottom:6,fontSize:10,letterSpacing:"0.18em",
              textTransform:"uppercase",color:MUT }}>Stock Symbol</label>
            <div style={{ position:"relative" }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{
                position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
                pointerEvents:"none",opacity:0.35,
              }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="white" strokeWidth="1.4"/>
                <path d="M9 9L12 12" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                value={sym}
                onChange={e => search(e.target.value)}
                placeholder="e.g. AAPL, NVDA, TSLA…"
                style={{
                  width:"100%",background:"rgba(255,255,255,0.04)",
                  border:`1px solid ${G30}`,borderRadius:12,
                  padding:"11px 14px 11px 36px",color:"#fff",fontSize:13,fontFamily:F,
                  outline:"none",boxSizing:"border-box",caretColor:GOLD,
                }}/>
            </div>
            {(results.length > 0 || loading) && (
              <div style={{
                marginTop:6,background:"rgba(12,15,22,0.99)",
                border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,overflow:"hidden",
              }}>
                {loading && <div style={{ padding:"12px 16px",fontSize:11,color:MUT }}>Searching…</div>}
                {results.map((r, i) => (
                  <div key={r.symbol} onClick={() => select(r)} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 16px",cursor:"pointer",
                    borderBottom:i<results.length-1?"1px solid rgba(255,255,255,0.04)":"none",
                    transition:"background .1s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background=G10}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}
                  >
                    <div>
                      <span style={{ fontSize:12,fontWeight:700,color:"#fff" }}>{r.symbol}</span>
                      <span style={{ fontSize:10,color:MUT,marginLeft:8 }}>{r.description}</span>
                    </div>
                    <span style={{ fontSize:9,color:"rgba(212,175,55,0.5)" }}>{r.type}</span>
                  </div>
                ))}
              </div>
            )}
            {selName && (
              <p style={{ marginTop:6,fontSize:11,color:GOLD,fontFamily:F }}>
                ✓ {selName}
              </p>
            )}
          </div>
        )}

        {/* Quantity + Price */}
        <div style={{ display:"flex",gap:14,marginBottom:22 }}>
          <div style={{ flex:1 }}>
            <label style={{ display:"block",marginBottom:6,fontSize:10,letterSpacing:"0.18em",
              textTransform:"uppercase",color:MUT }}>Quantity</label>
            <input
              type="number" min="0" step="any"
              value={qty} onChange={e => setQty(e.target.value)}
              placeholder="e.g. 10"
              style={{
                width:"100%",background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,
                padding:"11px 14px",color:"#fff",fontSize:13,fontFamily:F,
                outline:"none",boxSizing:"border-box",caretColor:GOLD,
              }}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ display:"block",marginBottom:6,fontSize:10,letterSpacing:"0.18em",
              textTransform:"uppercase",color:MUT }}>Buy Price ($)</label>
            <input
              type="number" min="0" step="any"
              value={price} onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 150.00"
              style={{
                width:"100%",background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,
                padding:"11px 14px",color:"#fff",fontSize:13,fontFamily:F,
                outline:"none",boxSizing:"border-box",caretColor:GOLD,
              }}/>
          </div>
        </div>

        {/* Cost basis preview */}
        {cb !== null && (
          <div style={{
            marginBottom:22,padding:"12px 16px",borderRadius:12,
            background:G10,border:`1px solid ${G30}`,
            display:"flex",justifyContent:"space-between",alignItems:"center",
          }}>
            <span style={{ fontSize:11,color:MUT,fontFamily:F }}>Estimated Cost Basis</span>
            <span style={{ fontSize:16,fontFamily:FS,color:GOLD,fontWeight:400 }}>
              {fmt$(cb)}
            </span>
          </div>
        )}

        {err && (
          <div style={{
            marginBottom:16,padding:"10px 14px",
            background:"rgba(229,80,80,0.07)",border:"1px solid rgba(229,80,80,0.2)",
            borderRadius:10,fontSize:12,color:RED,
          }}>{err}</div>
        )}

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{
            flex:1,padding:"12px",borderRadius:11,cursor:"pointer",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            color:MUT,fontSize:12,fontFamily:F,
          }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{
            flex:2,padding:"12px",borderRadius:11,
            cursor:busy?"not-allowed":"pointer",
            background:G10,border:`1px solid ${G30}`,
            color:GOLD,fontSize:12,fontFamily:F,fontWeight:700,
            letterSpacing:"0.1em",textTransform:"uppercase",
            opacity:busy?0.6:1,
          }}>
            {busy ? "Saving…" : isEdit ? "Update Position" : "Add Position"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════ CUSTOM PIE TOOLTIP ════════════════════ */
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background:"rgba(10,12,18,0.97)",border:`1px solid ${BD}`,
      borderRadius:10,padding:"10px 14px",fontFamily:F,
    }}>
      <p style={{ margin:0,fontSize:12,fontWeight:700,color:"#fff" }}>{d.name}</p>
      <p style={{ margin:"4px 0 0",fontSize:11,color:GOLD }}>
        {fmt$(d.value)} · {d.payload.pct?.toFixed(1)}%
      </p>
    </div>
  );
}

/* ═══════════════════ SECTOR EXPOSURE BARS ══════════════════ */
function SectorExposure({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.pct));
  return (
    <div style={{
      background:BG, border:`1px solid ${BD}`, borderRadius:18,
      padding:"22px 26px",
    }}>
      <p style={{ margin:"0 0 20px",fontSize:10,letterSpacing:"0.18em",
        textTransform:"uppercase",color:MUT,fontFamily:F }}>Sector Exposure</p>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {data.map(d => {
          const color = SECTOR_COLOR[d.sector] || SECTOR_COLOR["Other"];
          return (
            <div key={d.sector}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:color,flexShrink:0 }}/>
                  <span style={{ fontFamily:F,fontSize:12,color:TXT }}>{d.sector}</span>
                </div>
                <div style={{ display:"flex",gap:16 }}>
                  <span style={{ fontFamily:FS,fontSize:15,color:"#fff" }}>{fmt$(d.value)}</span>
                  <span style={{ fontFamily:F,fontSize:11,color:color,minWidth:40,textAlign:"right" }}>
                    {d.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div style={{ height:4,borderRadius:2,background:"rgba(255,255,255,0.05)" }}>
                <div style={{
                  height:"100%",borderRadius:2,
                  width:`${(d.pct/max)*100}%`,
                  background:`linear-gradient(90deg,${color}90,${color})`,
                  transition:"width 0.6s ease",
                }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════ SKELETON ══════════════════════════════ */
function SkeletonRow() {
  return (
    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
      {[80,120,60,70,70,80,80,70,70,60,50].map((w,i) => (
        <td key={i} style={{ padding:"13px 12px" }}>
          <div style={{ height:10,borderRadius:4,width:`${w}px`,
            background:"rgba(255,255,255,0.05)",animation:"shimmer 1.6s infinite" }}/>
        </td>
      ))}
    </tr>
  );
}

/* ═══════════════════ MAIN PAGE ═════════════════════════════ */
export default function PortfolioPage() {
  const navigate = useNavigate();

  const [portfolios,  setPortfolios]  = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [loadingPF,   setLoadingPF]   = useState(true);
  const [loadingSum,  setLoadingSum]  = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editHolding, setEditHolding] = useState(null);
  const [toast,       setToast]       = useState(null);
  const [sortKey,     setSortKey]     = useState("symbol");
  const [sortDir,     setSortDir]     = useState("asc");
  const [newPFName,   setNewPFName]   = useState("");
  const [showNewPF,   setShowNewPF]   = useState(false);

  const showToast = useCallback((msg, type="ok") => setToast({ msg, type, key: Date.now() }), []);

  /* Load portfolios */
  const loadPortfolios = useCallback(async () => {
    setLoadingPF(true);
    try {
      const r = await API.get("/portfolios");
      setPortfolios(r.data);
      if (!selectedId && r.data.length > 0) setSelectedId(r.data[0].portfolio_id);
    } catch { showToast("Failed to load portfolios", "err"); }
    finally { setLoadingPF(false); }
  }, [selectedId, showToast]);

  useEffect(() => { loadPortfolios(); }, []);

  /* Load summary */
  const loadSummary = useCallback(async (id) => {
    if (!id) return;
    setLoadingSum(true); setSummary(null);
    try {
      const r = await API.get(`/portfolios/${id}/summary`);
      setSummary(r.data);
    } catch { showToast("Failed to load portfolio data", "err"); }
    finally { setLoadingSum(false); }
  }, [showToast]);

  useEffect(() => { if (selectedId) loadSummary(selectedId); }, [selectedId]);

  /* Create portfolio */
  const createPF = async () => {
    if (!newPFName.trim()) return;
    try {
      const r = await API.post("/portfolios", { name: newPFName.trim() });
      showToast(`"${newPFName.trim()}" created`);
      setNewPFName(""); setShowNewPF(false);
      await loadPortfolios();
      setSelectedId(r.data.portfolio_id);
    } catch (e) { showToast(e?.response?.data?.detail || "Error", "err"); }
  };

  /* Delete portfolio */
  const deletePF = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This removes all holdings.`)) return;
    try {
      await API.delete(`/portfolios/${id}`);
      showToast(`"${name}" deleted`, "warn");
      const rest = portfolios.filter(p => p.portfolio_id !== id);
      setPortfolios(rest);
      setSelectedId(rest[0]?.portfolio_id || null);
    } catch { showToast("Failed to delete", "err"); }
  };

  /* Remove holding */
  const removeHolding = async (sym) => {
    if (!window.confirm(`Remove ${sym} from portfolio?`)) return;
    try {
      await API.delete(`/portfolios/${selectedId}/holdings/${sym}`);
      showToast(`${sym} removed`, "warn");
      loadSummary(selectedId);
    } catch { showToast("Failed to remove", "err"); }
  };

  /* Sort holdings */
  const handleSort = (k) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const sorted = [...(summary?.holdings || [])].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (va == null) va = sortDir === "asc" ? Infinity : -Infinity;
    if (vb == null) vb = sortDir === "asc" ? Infinity : -Infinity;
    if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const S = summary?.summary;
  const SortIcon = ({ k }) => sortKey !== k
    ? <span style={{ opacity:0.18,fontSize:8 }}>⇅</span>
    : <span style={{ fontSize:8,color:GOLD }}>{sortDir==="asc"?"▲":"▼"}</span>;

  const th = (k) => ({
    padding:"11px 10px", fontSize:9, letterSpacing:"0.14em",
    textTransform:"uppercase", fontFamily:F, fontWeight:600,
    color: sortKey===k ? "rgba(212,175,55,0.9)" : MUT,
    borderBottom:`1px solid rgba(255,255,255,0.06)`,
    cursor:"pointer", whiteSpace:"nowrap", textAlign:"left",
    userSelect:"none",
  });

  return (
    <div style={{ animation:"fadeUp 0.5s ease both" }}>
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Modals */}
      {showAdd && selectedId && (
        <HoldingModal
          portfolioId={selectedId}
          onClose={() => setShowAdd(false)}
          onSaved={(msg) => { showToast(`Position ${msg}`); loadSummary(selectedId); }}
        />
      )}
      {editHolding && (
        <HoldingModal
          portfolioId={selectedId}
          initial={editHolding}
          onClose={() => setEditHolding(null)}
          onSaved={(msg) => { showToast(`Position ${msg}`); setEditHolding(null); loadSummary(selectedId); }}
        />
      )}

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom:32 }}>
        <h2 style={{
          fontFamily:FS, fontSize:"clamp(32px,4vw,52px)",
          fontWeight:300, letterSpacing:"-0.03em", color:"#fff", margin:0, lineHeight:1,
        }}>
          Portfolio <span style={{ color:GOLD }}>Tracker</span>
        </h2>
        <p style={{ marginTop:10,fontSize:13,color:MUT,fontFamily:F }}>
          Track positions, unrealized P/L, sector exposure and allocation
        </p>
      </div>

      <div style={{ height:1,marginBottom:30,
        background:"linear-gradient(90deg,rgba(212,175,55,0.45),rgba(255,255,255,0.04) 50%,transparent)" }}/>

      {/* ── PORTFOLIO TABS ── */}
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:28,flexWrap:"wrap" }}>
        {loadingPF
          ? <div style={{ height:34,width:140,borderRadius:10,background:"rgba(255,255,255,0.05)",animation:"shimmer 1.6s infinite" }}/>
          : portfolios.map(p => (
              <div key={p.portfolio_id} style={{ display:"flex",alignItems:"center",gap:0 }}>
                <button onClick={() => setSelectedId(p.portfolio_id)} style={{
                  padding:"7px 16px",borderRadius: p.portfolio_id===selectedId && portfolios.length>1 ? "10px 0 0 10px" : 10,
                  cursor:"pointer",fontFamily:F,fontSize:12,
                  background: p.portfolio_id===selectedId ? G10 : "rgba(255,255,255,0.03)",
                  border: `1px solid ${p.portfolio_id===selectedId ? G30 : "rgba(255,255,255,0.07)"}`,
                  borderRight: p.portfolio_id===selectedId && portfolios.length>1 ? "none" : undefined,
                  color: p.portfolio_id===selectedId ? GOLD : MUT,
                  fontWeight: p.portfolio_id===selectedId ? 700 : 400,
                  transition:"all .15s",
                }}>
                  {p.name}
                  <span style={{ marginLeft:6,fontSize:9,color:MUT }}>{p.holding_count}</span>
                </button>
                {p.portfolio_id===selectedId && portfolios.length>1 && (
                  <button onClick={() => deletePF(p.portfolio_id, p.name)} style={{
                    padding:"7px 8px",borderRadius:"0 10px 10px 0",cursor:"pointer",
                    background:"rgba(229,80,80,0.07)",
                    border:"1px solid rgba(229,80,80,0.2)", borderLeft:"none",
                    color:RED,fontSize:12,
                  }}>×</button>
                )}
              </div>
            ))
        }

        {/* New portfolio input */}
        {showNewPF ? (
          <div style={{ display:"flex",gap:6 }}>
            <input
              autoFocus
              value={newPFName} onChange={e=>setNewPFName(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") createPF(); if(e.key==="Escape") setShowNewPF(false); }}
              placeholder="Portfolio name…"
              style={{
                padding:"6px 12px",borderRadius:10,fontFamily:F,fontSize:12,
                background:"rgba(255,255,255,0.04)",
                border:`1px solid ${G30}`,color:"#fff",
                outline:"none",caretColor:GOLD,width:160,
              }}/>
            <button onClick={createPF} style={{
              padding:"6px 12px",borderRadius:10,cursor:"pointer",
              background:G10,border:`1px solid ${G30}`,
              color:GOLD,fontSize:11,fontFamily:F,
            }}>Create</button>
            <button onClick={()=>setShowNewPF(false)} style={{
              padding:"6px 10px",borderRadius:10,cursor:"pointer",
              background:"transparent",border:"1px solid rgba(255,255,255,0.07)",
              color:MUT,fontSize:12,
            }}>×</button>
          </div>
        ) : (
          <button onClick={()=>setShowNewPF(true)} style={{
            padding:"7px 14px",borderRadius:10,cursor:"pointer",
            background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
            color:MUT,fontSize:12,fontFamily:F,transition:"all .15s",
          }}
            onMouseEnter={e=>{ e.currentTarget.style.color="#fff"; e.currentTarget.style.borderColor="rgba(255,255,255,0.2)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.color=MUT; e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; }}
          >+ New Portfolio</button>
        )}

        <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
          <button onClick={() => loadSummary(selectedId)} style={{
            padding:"7px 13px",borderRadius:10,cursor:"pointer",
            background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
            color:MUT,fontSize:11,fontFamily:F,transition:"all .15s",
          }}>↻ Refresh</button>
          <button onClick={()=>setShowAdd(true)} disabled={!selectedId} style={{
            padding:"7px 18px",borderRadius:10,cursor:"pointer",
            background:G10,border:`1px solid ${G30}`,
            color:GOLD,fontSize:11,fontFamily:F,fontWeight:700,
            letterSpacing:"0.08em",textTransform:"uppercase",
            opacity:selectedId?1:0.4,
          }}>+ Add Position</button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{ display:"flex",gap:14,flexWrap:"wrap",marginBottom:28 }}>
        {loadingSum ? (
          [...Array(5)].map((_,i) => (
            <div key={i} style={{ flex:1,minWidth:130,height:88,borderRadius:16,
              background:"rgba(255,255,255,0.03)",animation:"shimmer 1.6s infinite" }}/>
          ))
        ) : S ? (
          <>
            <KPICard label="Portfolio Value"  value={fmt$(S.total_value)}  color="#5B9CF6" />
            <KPICard label="Total Invested"   value={fmt$(S.total_cost)}   color={GOLD} />
            <KPICard label="Unrealized P/L"   value={fmt$(S.total_pl)}
              subValue={fmtPct(S.total_pl_pct)} color={plColor(S.total_pl)} />
            <KPICard label="Return"           value={fmtPct(S.total_pl_pct)} color={plColor(S.total_pl)} />
            <KPICard label="Daily P/L"        value={fmt$(S.daily_pl)}     color={plColor(S.daily_pl)} />
          </>
        ) : (
          <div style={{ flex:1,padding:"30px 24px",background:BG,border:`1px solid ${BD}`,borderRadius:16,
            textAlign:"center" }}>
            <p style={{ fontFamily:FS,fontSize:20,color:MUT,margin:0 }}>
              {portfolios.length===0 ? "Create a portfolio to get started" : "Select a portfolio"}
            </p>
          </div>
        )}
      </div>

      {summary && summary.holdings.length > 0 && (
        <>
          {/* ── HOLDINGS TABLE ── */}
          <div style={{ background:BG,border:`1px solid ${BD}`,borderRadius:18,marginBottom:24,overflow:"hidden" }}>
            <div style={{ padding:"18px 24px",borderBottom:`1px solid ${BD}`,
              display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <p style={{ margin:0,fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:MUT,fontFamily:F }}>
                Holdings · {sorted.length} positions
              </p>
              <p style={{ margin:0,fontSize:10,color:MUT,fontFamily:F }}>
                Click ✎ to edit · Click symbol to view detail
              </p>
            </div>

            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",minWidth:860 }}>
                <thead>
                  <tr>
                    {[
                      ["symbol",       "Symbol"],
                      ["quantity",     "Qty"],
                      ["buy_price",    "Buy Price"],
                      ["current_price","Curr Price"],
                      ["cost_basis",   "Cost Basis"],
                      ["current_value","Curr Value"],
                      ["pl",           "P/L $"],
                      ["pl_pct",       "P/L %"],
                      ["daily_pl",     "Daily P/L"],
                      ["allocation_pct","Alloc %"],
                    ].map(([k,l]) => (
                      <th key={k} style={th(k)} onClick={() => handleSort(k)}>
                        {l} <SortIcon k={k}/>
                      </th>
                    ))}
                    <th style={{ ...th("_act"),cursor:"default" }} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, i) => (
                    <tr key={h.symbol}
                      style={{
                        borderBottom:"1px solid rgba(255,255,255,0.04)",
                        transition:"background .12s",
                        animation:`fadeUp 0.3s ${i*0.04}s ease both`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(212,175,55,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    >
                      <td style={{ padding:"13px 10px" }}>
                        <button onClick={()=>navigate(`/company/${h.symbol}`)} style={{
                          background:"none",border:"none",cursor:"pointer",
                          fontFamily:F,fontSize:13,fontWeight:700,color:GOLD,
                          padding:0,textDecoration:"underline",textUnderlineOffset:3,
                        }}>{h.symbol}</button>
                        <p style={{ margin:0,fontSize:9,color:MUT,marginTop:2,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          {h.company_name}
                        </p>
                      </td>
                      <td style={{ padding:"13px 10px",fontFamily:F,fontSize:12,color:TXT }}>{h.quantity}</td>
                      <td style={{ padding:"13px 10px",fontFamily:FS,fontSize:15,color:TXT }}>{fmt$(h.buy_price)}</td>
                      <td style={{ padding:"13px 10px",fontFamily:FS,fontSize:15,color:"#fff" }}>
                        {h.current_price ? fmt$(h.current_price) : <span style={{color:MUT}}>—</span>}
                      </td>
                      <td style={{ padding:"13px 10px",fontFamily:FS,fontSize:14,color:MUT }}>{fmt$(h.cost_basis)}</td>
                      <td style={{ padding:"13px 10px",fontFamily:FS,fontSize:15,color:"#fff",fontWeight:400 }}>
                        {h.current_value ? fmt$(h.current_value) : <span style={{color:MUT}}>—</span>}
                      </td>
                      <td style={{ padding:"13px 10px",fontFamily:FS,fontSize:15,color:plColor(h.pl) }}>
                        {h.pl != null ? `${h.pl>=0?"+":""}${fmt$(h.pl)}` : "—"}
                      </td>
                      <td style={{ padding:"13px 10px" }}>
                        {h.pl_pct != null ? (
                          <span style={{
                            fontSize:11,fontWeight:700,fontFamily:F,
                            padding:"2px 7px",borderRadius:5,
                            background: h.pl_pct>=0 ? "rgba(80,220,120,0.1)" : "rgba(229,80,80,0.1)",
                            color: plColor(h.pl_pct),
                          }}>
                            {h.pl_pct>=0?"▲":"▼"} {Math.abs(h.pl_pct).toFixed(2)}%
                          </span>
                        ) : <span style={{color:MUT,fontSize:12}}>—</span>}
                      </td>
                      <td style={{ padding:"13px 10px",fontFamily:F,fontSize:11,color:plColor(h.daily_pl) }}>
                        {h.daily_pl != null ? `${h.daily_pl>=0?"+":""}${fmt$(h.daily_pl)}` : "—"}
                      </td>
                      <td style={{ padding:"13px 10px" }}>
                        {h.allocation_pct != null ? (
                          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                            <div style={{ width:44,height:4,borderRadius:2,background:"rgba(255,255,255,0.05)" }}>
                              <div style={{ height:"100%",borderRadius:2,width:`${Math.min(100,h.allocation_pct)}%`,
                                background:`linear-gradient(90deg,#5B9CF6,${GOLD})` }}/>
                            </div>
                            <span style={{ fontSize:10,fontFamily:F,color:TXT }}>{h.allocation_pct.toFixed(1)}%</span>
                          </div>
                        ) : <span style={{color:MUT,fontSize:12}}>—</span>}
                      </td>
                      <td style={{ padding:"13px 12px",textAlign:"right" }}>
                        <div style={{ display:"flex",gap:4,justifyContent:"flex-end" }}>
                          <button onClick={()=>setEditHolding(h)} style={{
                            padding:"4px 8px",borderRadius:7,cursor:"pointer",
                            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                            color:MUT,fontSize:11,fontFamily:F,
                          }}>✎</button>
                          <button onClick={()=>removeHolding(h.symbol)} style={{
                            padding:"4px 8px",borderRadius:7,cursor:"pointer",
                            background:"rgba(229,80,80,0.07)",border:"1px solid rgba(229,80,80,0.2)",
                            color:RED,fontSize:11,fontFamily:F,
                          }}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── CHARTS ROW ── */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18,marginBottom:24 }}>

            {/* Allocation Pie */}
            <div style={{ background:BG,border:`1px solid ${BD}`,borderRadius:18,padding:"22px 18px" }}>
              <p style={{ margin:"0 0 16px",fontSize:10,letterSpacing:"0.18em",
                textTransform:"uppercase",color:MUT,fontFamily:F }}>Allocation by Stock</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={summary.allocation}
                    dataKey="value"
                    nameKey="symbol"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={88}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {summary.allocation.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.9}/>
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip/>}/>
                  <Legend
                    iconType="circle" iconSize={7}
                    formatter={v => <span style={{ color:TXT,fontSize:10,fontFamily:F }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Sector Pie */}
            <div style={{ background:BG,border:`1px solid ${BD}`,borderRadius:18,padding:"22px 18px" }}>
              <p style={{ margin:"0 0 16px",fontSize:10,letterSpacing:"0.18em",
                textTransform:"uppercase",color:MUT,fontFamily:F }}>Sector Distribution</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={summary.sector_exposure}
                    dataKey="value"
                    nameKey="sector"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={88}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {summary.sector_exposure.map((d, i) => (
                      <Cell key={i} fill={SECTOR_COLOR[d.sector] || PIE_COLORS[i % PIE_COLORS.length]} opacity={0.9}/>
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip/>}/>
                  <Legend
                    iconType="circle" iconSize={7}
                    formatter={v => <span style={{ color:TXT,fontSize:10,fontFamily:F }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* P/L by Position Bar */}
            <div style={{ background:BG,border:`1px solid ${BD}`,borderRadius:18,padding:"22px 18px" }}>
              <p style={{ margin:"0 0 16px",fontSize:10,letterSpacing:"0.18em",
                textTransform:"uppercase",color:MUT,fontFamily:F }}>P/L by Position (%)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[...summary.holdings].filter(h=>h.pl_pct!=null).sort((a,b)=>b.pl_pct-a.pl_pct)}
                  layout="vertical"
                  margin={{ top:0,right:8,left:0,bottom:0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                  <XAxis type="number" tickFormatter={v=>`${v>0?"+":""}${v.toFixed(0)}%`}
                    tick={{ fill:MUT,fontSize:9,fontFamily:F }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="symbol" width={40}
                    tick={{ fill:TXT,fontSize:10,fontFamily:F }} axisLine={false} tickLine={false}/>
                  <Tooltip
                    cursor={{ fill:"rgba(255,255,255,0.03)" }}
                    formatter={(v,_,{payload:p}) => [`${v>=0?"+":""}${v.toFixed(2)}%`, p.symbol]}
                    contentStyle={{ background:"rgba(10,12,18,0.97)",border:`1px solid ${BD}`,borderRadius:10,fontFamily:F,fontSize:11 }}
                    labelStyle={{ display:"none" }}
                    itemStyle={{ color:TXT }}
                  />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
                  <Bar dataKey="pl_pct" radius={[0,4,4,0]}>
                    {[...summary.holdings].filter(h=>h.pl_pct!=null).sort((a,b)=>b.pl_pct-a.pl_pct)
                      .map((h, i) => (
                        <Cell key={i} fill={h.pl_pct >= 0 ? GRN : RED} opacity={0.8}/>
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── SECTOR EXPOSURE ── */}
          <SectorExposure data={summary.sector_exposure}/>
        </>
      )}

      {/* Empty state */}
      {summary && summary.holdings.length === 0 && (
        <div style={{
          background:BG,border:`1px solid ${BD}`,borderRadius:18,
          textAlign:"center",padding:"72px 24px",
        }}>
          <div style={{
            width:60,height:60,borderRadius:"50%",
            background:G10,border:`1px solid ${G30}`,
            display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontFamily:FS,fontSize:26,fontWeight:300,color:TXT,margin:"0 0 10px" }}>
            No positions yet
          </p>
          <p style={{ fontFamily:F,fontSize:12,color:MUT,margin:"0 0 20px" }}>
            Add your first stock position to start tracking performance
          </p>
          <button onClick={()=>setShowAdd(true)} style={{
            padding:"10px 24px",borderRadius:12,cursor:"pointer",
            background:G10,border:`1px solid ${G30}`,
            color:GOLD,fontSize:12,fontFamily:F,fontWeight:700,
            letterSpacing:"0.1em",textTransform:"uppercase",
          }}>+ Add Position</button>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%,100% { opacity:0.5; }
          50%      { opacity:1; }
        }
      `}</style>
    </div>
  );
}
