import { useEffect, useState, useMemo } from "react";
import { getCompanies } from "../services/companyService";

/* ─── Scoring engine ─── */
function computeScore(company, allCaps) {
  const cap = Number(company.market_cap) || 0;
  const max = Math.max(...allCaps, 1);
  const min = Math.min(...allCaps, 0);
  const normalized = (cap - min) / (max - min);

  const capScore       = normalized * 40;
  const sectorBonus    = getSectorBonus(company.sector);
  const countryBonus   = getCountryBonus(company.country);
  const diversityScore = 10;

  const total = Math.min(100, Math.round(capScore + sectorBonus + countryBonus + diversityScore));
  return total;
}

function getSectorBonus(sector) {
  const map = {
    "Technology": 20, "Healthcare": 18, "Financials": 16,
    "Consumer Discretionary": 14, "Industrials": 13,
    "Energy": 12, "Communication Services": 11,
    "Consumer Staples": 10, "Real Estate": 9,
    "Materials": 8, "Utilities": 7,
  };
  return map[sector] ?? 10;
}

function getCountryBonus(country) {
  const tier1 = ["United States", "Germany", "Japan", "United Kingdom", "Switzerland"];
  const tier2 = ["Canada", "France", "Australia", "South Korea", "Netherlands"];
  if (tier1.includes(country)) return 20;
  if (tier2.includes(country)) return 15;
  return 10;
}

function getSignal(score) {
  if (score >= 80) return { label: "STRONG BUY",  color: "#50DC78", bg: "rgba(80,220,120,0.1)",  border: "rgba(80,220,120,0.25)",  bar: "#50DC78" };
  if (score >= 65) return { label: "BUY",          color: "#34D399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)",   bar: "#34D399" };
  if (score >= 50) return { label: "HOLD",         color: "#F0B429", bg: "rgba(240,180,41,0.08)", border: "rgba(240,180,41,0.2)",   bar: "#F0B429" };
  if (score >= 35) return { label: "UNDERWEIGHT",  color: "#F07529", bg: "rgba(240,117,41,0.08)", border: "rgba(240,117,41,0.2)",   bar: "#F07529" };
  return                  { label: "SELL",         color: "#E55050", bg: "rgba(229,80,80,0.08)",  border: "rgba(229,80,80,0.22)",   bar: "#E55050" };
}

/* ─── Score arc ─── */
function ScoreArc({ score, color, size = 56 }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 300);
    return () => clearTimeout(t);
  }, [score]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4.5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="4.5"
        strokeDasharray={`${(animated/100)*circ} ${circ}`}
        strokeLinecap="round"
        strokeDashoffset={circ * 0.25}
        style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle"
        fill={color} style={{ fontSize: size * 0.22, fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
        {score}
      </text>
    </svg>
  );
}

/* ─── Mini factor bar ─── */
function FactorBar({ label, value, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 400); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Syne', sans-serif" }}>{value}%</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: color,
          width: `${w}%`,
          transition: "width 1s cubic-bezier(.4,0,.2,1)",
        }}/>
      </div>
    </div>
  );
}

/* ─── Skeleton ─── */
function Skel({ w = "100%", h = 13 }) {
  return <div style={{ width: w, height: h, borderRadius: 6, background: "rgba(255,255,255,0.055)", animation: "shimmer 1.6s infinite" }}/>;
}

/* ─── Skeleton card ─── */
function SkeletonCard() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "22px 24px",
    }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(255,255,255,0.055)", animation: "shimmer 1.6s infinite", flexShrink: 0 }}/>
        <div style={{ flex: 1 }}>
          <Skel w="55%" h={14}/>
          <div style={{ marginTop: 8 }}><Skel w="35%" h={10}/></div>
        </div>
        <div style={{ width: 60, height: 20, borderRadius: 6, background: "rgba(255,255,255,0.055)", animation: "shimmer 1.6s infinite" }}/>
      </div>
      <Skel w="100%" h={3}/>
      <div style={{ marginTop: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} style={{ marginBottom: 8 }}><Skel h={10}/></div>)}
      </div>
    </div>
  );
}

/* ─── Company score card ─── */
function ScoreCard({ company, rank, delay = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered]   = useState(false);
  const sig = getSignal(company.score);

  const capFactor    = Math.round(Math.min(100, (Math.log10(Math.max(Number(company.market_cap), 1)) / 12) * 100));
  const sectorFactor = Math.round((getSectorBonus(company.sector) / 20) * 100);
  const countryFactor= Math.round((getCountryBonus(company.country) / 20) * 100);

  const rankColor = rank === 1 ? "#D4AF37" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : "rgba(255,255,255,0.2)";
  const rankLabel = rank === 1 ? "①" : rank === 2 ? "②" : rank === 3 ? "③" : `#${rank}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? sig.bg : "rgba(255,255,255,0.02)",
        border: hovered ? `1px solid ${sig.border}` : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "22px 24px",
        transition: "background .2s, border .2s, transform .22s, box-shadow .22s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? `0 16px 40px ${sig.color}12` : "none",
        position: "relative", overflow: "hidden",
        animation: `fadeSlideUp 0.4s ${delay}s ease both`,
        cursor: "default",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: hovered ? `linear-gradient(90deg, transparent, ${sig.color}70, transparent)` : "transparent",
        transition: "background .2s",
      }}/>

      <div style={{
        position: "absolute", top: 16, right: 16,
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: rank <= 3 ? 20 : 13,
        color: rankColor, fontWeight: 400,
      }}>
        {rankLabel}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <ScoreArc score={company.score} color={sig.color}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 14, fontWeight: 500,
            color: hovered ? "#fff" : "rgba(255,255,255,0.85)",
            fontFamily: "'Syne', sans-serif",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            transition: "color .18s",
          }}>
            {company.company_name}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne', sans-serif" }}>
            {company.sector} · {company.country}
          </p>
          <p style={{ margin: "6px 0 0", fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: "rgba(212,175,55,0.75)" }}>
            {Number(company.market_cap) >= 1e9
              ? `$${(Number(company.market_cap)/1e9).toFixed(1)}B`
              : `$${Number(company.market_cap).toLocaleString()}`}
          </p>
        </div>
        <span style={{
          fontSize: 9, padding: "5px 10px", borderRadius: 6,
          background: sig.bg, border: `1px solid ${sig.border}`,
          color: sig.color, fontFamily: "'Syne', sans-serif",
          fontWeight: 700, letterSpacing: "0.1em",
          whiteSpace: "nowrap", marginTop: -20,
        }}>
          {sig.label}
        </span>
      </div>

      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginBottom: 16 }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: `linear-gradient(90deg, ${sig.color}, ${sig.color}66)`,
          width: `${company.score}%`,
          transition: "width 1s 0.5s cubic-bezier(.4,0,.2,1)",
          boxShadow: `0 0 6px ${sig.color}44`,
        }}/>
      </div>

      <button onClick={() => setExpanded(e => !e)} style={{
        display: "flex", alignItems: "center", gap: 5,
        background: "none", border: "none", cursor: "pointer",
        color: "rgba(255,255,255,0.25)", fontSize: 10,
        fontFamily: "'Syne', sans-serif", letterSpacing: "0.1em",
        textTransform: "uppercase", padding: 0, transition: "color .14s",
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {expanded ? "Hide factors" : "Show factors"}
      </button>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <FactorBar label="Market Cap Weight" value={capFactor}     color={sig.bar}/>
          <FactorBar label="Sector Strength"   value={sectorFactor}  color={sig.bar}/>
          <FactorBar label="Country Risk"       value={countryFactor} color={sig.bar}/>
          <FactorBar label="Diversification"    value={60}            color={sig.bar}/>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─── */
export default function RecommendationPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState("ALL");
  const [search, setSearch]       = useState("");
  const [focused, setFocused]     = useState(false);

  useEffect(() => {
    getCompanies()
      .then(res => {
        // ✅ FIX: getCompanies() may return the array directly OR wrapped in {data:[]}
        const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setCompanies(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load investment data.");
        setLoading(false);
      });
  }, []);

  const allCaps = useMemo(() => companies.map(c => Number(c.market_cap) || 0), [companies]);

  const scored = useMemo(() =>
    companies
      .map(c => ({ ...c, score: computeScore(c, allCaps) }))
      .sort((a, b) => b.score - a.score),
    [companies, allCaps]
  );

  const SIGNALS = ["ALL", "STRONG BUY", "BUY", "HOLD", "UNDERWEIGHT", "SELL"];

  const filtered = useMemo(() => {
    let list = scored;
    if (filter !== "ALL") list = list.filter(c => getSignal(c.score).label === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        [c.company_name, c.sector, c.country, c.industry].some(v => v?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [scored, filter, search]);

  const signalCounts = useMemo(() => {
    const map = {};
    scored.forEach(c => {
      const lbl = getSignal(c.score).label;
      map[lbl] = (map[lbl] || 0) + 1;
    });
    return map;
  }, [scored]);

  const SIGNAL_COLORS = {
    "ALL": "#D4AF37",
    "STRONG BUY": "#50DC78",
    "BUY": "#34D399",
    "HOLD": "#F0B429",
    "UNDERWEIGHT": "#F07529",
    "SELL": "#E55050",
  };

  const avgScore = useMemo(() =>
    scored.length ? Math.round(scored.reduce((s,c) => s+c.score, 0) / scored.length) : 0,
    [scored]
  );

  return (
    <div>

      {/* Header */}
      <div style={{ marginBottom: 40, animation: "fadeSlideUp 0.6s ease both" }}>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(32px, 4vw, 52px)",
          fontWeight: 300, letterSpacing: "-0.03em",
          color: "#fff", margin: 0, lineHeight: 1,
        }}>
          Investment <span style={{ color: "#D4AF37" }}>Scores</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
          AI-weighted composite scoring with buy · hold · sell signals
        </p>
      </div>

      <div style={{
        height: 1, marginBottom: 32,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)",
      }}/>

      {/* Summary tiles */}
      {!loading && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14, marginBottom: 28, animation: "fadeSlideUp 0.5s 0.05s ease both",
        }}>
          {[
            { label: "Avg Score",  value: avgScore,                                                         color: "#D4AF37" },
            { label: "Strong Buy", value: signalCounts["STRONG BUY"] || 0,                                  color: "#50DC78" },
            { label: "Buy",        value: signalCounts["BUY"] || 0,                                         color: "#34D399" },
            { label: "Hold",       value: signalCounts["HOLD"] || 0,                                        color: "#F0B429" },
            { label: "Sell/Under", value: (signalCounts["SELL"] || 0) + (signalCounts["UNDERWEIGHT"] || 0), color: "#E55050" },
          ].map((t, i) => (
            <div key={t.label} style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "18px 20px",
              position: "relative", overflow: "hidden",
              animation: `fadeSlideUp 0.4s ${i*0.05}s ease both`,
            }}>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${t.color}50, transparent)`,
              }}/>
              <p style={{ margin: "0 0 8px", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif" }}>
                {t.label}
              </p>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: t.color }}>
                {t.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12, marginBottom: 24,
        animation: "fadeSlideUp 0.5s 0.1s ease both",
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SIGNALS.map(sig => {
            const active = filter === sig;
            const col = SIGNAL_COLORS[sig];
            return (
              <button key={sig} onClick={() => setFilter(sig)} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 10,
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontFamily: "'Syne', sans-serif", fontWeight: 600, cursor: "pointer",
                border: `1px solid ${active ? col+"55" : "rgba(255,255,255,0.07)"}`,
                background: active ? col+"18" : "transparent",
                color: active ? col : "rgba(255,255,255,0.3)",
                transition: "all .15s",
              }}>
                {sig}{sig !== "ALL" && !loading && (
                  <span style={{ opacity: 0.6 }}> ({signalCounts[sig] || 0})</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ position: "absolute", left: 11, pointerEvents: "none", opacity: focused ? 0.6 : 0.28, transition: "opacity .18s" }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="white" strokeWidth="1.4"/>
            <path d="M9 9L11.5 11.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input type="text" value={search} placeholder="Search companies…"
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={{
              background: focused ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${focused ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 10, padding: "8px 28px 8px 32px",
              color: "#fff", fontSize: 12, fontFamily: "'Syne', sans-serif",
              outline: "none", width: 220,
              transition: "background .18s, border .18s", caretColor: "#D4AF37",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 9,
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.3)", fontSize: 15, padding: 0,
            }}>×</button>
          )}
        </div>
      </div>

      {!loading && (
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.22)",
          marginBottom: 20, fontFamily: "'Syne', sans-serif",
          animation: "fadeIn 0.3s ease both",
        }}>
          Showing <span style={{ color: "rgba(255,255,255,0.45)" }}>{filtered.length}</span> companies
        </p>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {[...Array(9)].map((_, i) => <SkeletonCard key={i}/>)}
        </div>
      ) : error ? (
        <div style={{
          padding: "48px", borderRadius: 16, textAlign: "center",
          background: "rgba(229,80,80,0.05)", border: "1px solid rgba(229,80,80,0.18)",
        }}>
          <p style={{ margin: 0, color: "rgba(229,80,80,0.75)", fontSize: 13 }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.2)", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
            No companies match your filters
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map((company, i) => (
            <ScoreCard
              key={company.company_id}
              company={company}
              rank={scored.indexOf(company) + 1}
              delay={Math.min(i * 0.03, 0.3)}
            />
          ))}
        </div>
      )}
    </div>
  );
}