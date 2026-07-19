import { useEffect, useState, useMemo } from "react";
import { getCompanies } from "../services/companyService";

/* ─── Animated bar ─── */
function Bar({ value, max, color = "#D4AF37", delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW((value / max) * 100), delay + 150);
    return () => clearTimeout(t);
  }, [value, max, delay]);
  return (
    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.055)", overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 3,
        background: `linear-gradient(90deg, ${color}, ${color}99)`,
        width: `${w}%`,
        transition: "width 1s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 8px ${color}44`,
      }}/>
    </div>
  );
}

/* ─── Metric card ─── */
function StatCard({ label, value, sub, color = "#D4AF37", delay = 0 }) {
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
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
      }}/>
      <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 10, fontFamily: "'Syne', sans-serif" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 300, color, letterSpacing: "-0.02em" }}>
        {value}
      </p>
      {sub && <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif" }}>{sub}</p>}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
      }}/>
    </div>
  );
}

/* ─── Skeleton ─── */
function Skel({ w = "100%", h = 14 }) {
  return <div style={{ width: w, height: h, borderRadius: 6, background: "rgba(255,255,255,0.055)", animation: "shimmer 1.6s infinite" }}/>;
}

const SECTOR_COLORS = [
  "#D4AF37", "#50DC78", "#60A5FA", "#F07529",
  "#A78BFA", "#F0B429", "#34D399", "#F472B6",
  "#38BDF8", "#FB923C",
];

export default function BenchmarkPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [sortBy, setSortBy]       = useState("totalCap");
  const [hovered, setHovered]     = useState(null);

  useEffect(() => {
    getCompanies()
      .then(res => {
        // Handle all common API response shapes
        const data = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res)
          ? res
          : [];
        console.log("API RESPONSE (resolved):", data);
        setCompanies(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load benchmark data.");
        setLoading(false);
      });
  }, []);

  /* ─── Sector aggregation ─── */
  const sectorData = useMemo(() => {
    if (!Array.isArray(companies)) return [];
    const map = {};
    companies.forEach(c => {
      const key = c.sector || "Unknown";
      if (!map[key]) map[key] = { sector: key, companies: [], totalCap: 0, avgCap: 0, count: 0 };
      map[key].companies.push(c);
      map[key].totalCap += Number(c.market_cap) || 0;
      map[key].count++;
    });
    return Object.values(map).map(s => ({
      ...s,
      avgCap: s.totalCap / s.count,
    })).sort((a, b) => b[sortBy] - a[sortBy]);
  }, [companies, sortBy]);

  const industryData = useMemo(() => {
    if (!Array.isArray(companies)) return [];
    const map = {};
    companies.forEach(c => {
      const key = c.industry || "Unknown";
      if (!map[key]) map[key] = { industry: key, count: 0, totalCap: 0 };
      map[key].count++;
      map[key].totalCap += Number(c.market_cap) || 0;
    });
    return Object.values(map).sort((a, b) => b.totalCap - a.totalCap).slice(0, 8);
  }, [companies]);

  const maxCap = useMemo(() => Math.max(...sectorData.map(s => s.totalCap), 1), [sectorData]);
  const maxInd = useMemo(() => Math.max(...industryData.map(i => i.totalCap), 1), [industryData]);

  function fmtCap(n) {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  }

  const totalMktCap    = useMemo(() => (Array.isArray(companies) ? companies : []).reduce((s, c) => s + (Number(c.market_cap) || 0), 0), [companies]);
  const uniqueSectors  = useMemo(() => new Set((Array.isArray(companies) ? companies : []).map(c => c.sector)).size, [companies]);
  const uniqueCountries = useMemo(() => new Set((Array.isArray(companies) ? companies : []).map(c => c.country)).size, [companies]);

  if (error) {
    return (
      <div style={{ padding: 40, color: "rgba(255,80,80,0.8)", fontFamily: "'Syne', sans-serif", fontSize: 13 }}>
        {error}
      </div>
    );
  }

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
          Portfolio <span style={{ color: "#D4AF37" }}>Benchmark</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
          Sector and industry comparative performance analysis
        </p>
      </div>

      <div style={{
        height: 1, marginBottom: 32,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)",
      }}/>

      {/* Summary row */}
      {!loading && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16, marginBottom: 32,
        }}>
          <StatCard label="Total Market Cap"  value={fmtCap(totalMktCap)} sub="across portfolio"  color="#D4AF37" delay={0}/>
          <StatCard label="Companies Tracked" value={companies.length}    sub="active entities"   color="#60A5FA" delay={0.05}/>
          <StatCard label="Sectors Covered"   value={uniqueSectors}       sub="distinct sectors"  color="#50DC78" delay={0.1}/>
          <StatCard label="Countries"         value={uniqueCountries}     sub="geographic spread" color="#A78BFA" delay={0.15}/>
        </div>
      )}

      {/* Two-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeSlideUp 0.6s 0.2s ease both" }}>

        {/* ── Sector breakdown ── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, overflow: "hidden",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: -60, right: -60, width: 180, height: 180,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)",
          }}/>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif" }}>
              Sector Breakdown
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[["totalCap", "Total Cap"], ["avgCap", "Avg Cap"], ["count", "Count"]].map(([k, l]) => (
                <button key={k} onClick={() => setSortBy(k)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 10,
                  letterSpacing: "0.08em", fontFamily: "'Syne', sans-serif",
                  cursor: "pointer",
                  border: `1px solid ${sortBy === k ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.07)"}`,
                  background: sortBy === k ? "rgba(212,175,55,0.1)" : "transparent",
                  color: sortBy === k ? "#D4AF37" : "rgba(255,255,255,0.3)",
                  transition: "all .14s",
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "16px 24px 20px", maxHeight: 420, overflowY: "auto" }}>
            {loading
              ? [...Array(7)].map((_, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Skel w="40%" h={11}/>
                      <Skel w="20%" h={11}/>
                    </div>
                    <Skel h={6}/>
                  </div>
                ))
              : sectorData.map((s, i) => {
                  const color  = SECTOR_COLORS[i % SECTOR_COLORS.length];
                  const barVal = sortBy === "count" ? s.count : s[sortBy];
                  const barMax = sortBy === "count" ? Math.max(...sectorData.map(x => x.count), 1) : maxCap;
                  const h      = hovered === s.sector;
                  return (
                    <div key={s.sector}
                      onMouseEnter={() => setHovered(s.sector)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        marginBottom: 18, padding: "10px 12px", borderRadius: 10,
                        background: h ? "rgba(255,255,255,0.03)" : "transparent",
                        transition: "background .14s", cursor: "default",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                          <span style={{ fontSize: 12, color: h ? "#fff" : "rgba(255,255,255,0.7)", fontFamily: "'Syne', sans-serif", transition: "color .14s" }}>
                            {s.sector}
                          </span>
                          <span style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 4,
                            background: "rgba(255,255,255,0.05)",
                            color: "rgba(255,255,255,0.35)",
                            fontFamily: "'Syne', sans-serif",
                          }}>
                            {s.count}
                          </span>
                        </div>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color, letterSpacing: "-0.01em" }}>
                          {sortBy === "count" ? s.count : fmtCap(s[sortBy])}
                        </span>
                      </div>
                      <Bar value={barVal} max={barMax} color={color} delay={i * 50}/>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* ── Industry ranking ── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, overflow: "hidden",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", bottom: -60, left: -60, width: 180, height: 180,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)",
          }}/>

          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif" }}>
              Top Industries by Market Cap
            </p>
          </div>

          <div style={{ padding: "16px 24px 20px" }}>
            {loading
              ? [...Array(8)].map((_, i) => (
                  <div key={i} style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Skel w="45%" h={11}/>
                      <Skel w="22%" h={11}/>
                    </div>
                    <Skel h={6}/>
                  </div>
                ))
              : industryData.map((ind, i) => {
                  const color = SECTOR_COLORS[(i + 3) % SECTOR_COLORS.length];
                  const rank  = i + 1;
                  return (
                    <div key={ind.industry} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 10, fontFamily: "'Cormorant Garamond', serif",
                            fontWeight: 500, color: rank <= 3 ? "#D4AF37" : "rgba(255,255,255,0.2)",
                            minWidth: 16,
                          }}>
                            {rank <= 3 ? ["①", "②", "③"][rank - 1] : `${rank}`}
                          </span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'Syne', sans-serif" }}>
                            {ind.industry}
                          </span>
                          <span style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 4,
                            background: "rgba(255,255,255,0.05)",
                            color: "rgba(255,255,255,0.3)",
                            fontFamily: "'Syne', sans-serif",
                          }}>
                            {ind.count}
                          </span>
                        </div>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color, letterSpacing: "-0.01em" }}>
                          {fmtCap(ind.totalCap)}
                        </span>
                      </div>
                      <Bar value={ind.totalCap} max={maxInd} color={color} delay={i * 60}/>
                    </div>
                  );
                })
            }
          </div>
        </div>

      </div>

      {/* ── Company table ── */}
      {!loading && companies.length > 0 && (
        <div style={{
          marginTop: 28,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, overflow: "hidden",
          animation: "fadeSlideUp 0.6s 0.3s ease both",
        }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif" }}>
              All Companies
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Company", "Sector", "Market Cap"].map(col => (
                    <th key={col} style={{
                      padding: "12px 24px", textAlign: "left",
                      fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                      color: "rgba(255,255,255,0.28)", fontFamily: "'Syne', sans-serif", fontWeight: 400,
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr key={company.company_id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background .12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "13px 24px", fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "'Syne', sans-serif" }}>
                      {company.company_name}
                    </td>
                    <td style={{ padding: "13px 24px", fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'Syne', sans-serif" }}>
                      {company.sector}
                    </td>
                    <td style={{ padding: "13px 24px", fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: "#D4AF37", letterSpacing: "-0.01em" }}>
                      {fmtCap(Number(company.market_cap) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
