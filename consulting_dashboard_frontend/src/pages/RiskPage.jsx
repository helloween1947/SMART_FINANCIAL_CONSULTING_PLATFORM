import { useEffect, useState, useMemo } from "react";
import API from "../services/api";

/* ─── Risk scoring — uses REAL API fields ─── */
function getRiskScore(company) {
  const debtEq  = Number(company.debt_to_equity_ratio) || 0;
  const liabRat = Number(company.liability_ratio)       || 0;

  // Debt/Equity: 0–1 = low, 1–2 = medium, 2–3 = high, 3+ = critical
  const debtScore = Math.min(debtEq / 4, 1) * 50;

  // Liability ratio: 0–0.4 = low, 0.4–0.6 = medium, 0.6–0.8 = high, 0.8+ = critical
  const liabScore = Math.min(liabRat / 1, 1) * 50;

  const score = Math.round(debtScore + liabScore);

  if (score <= 25) return { score, level: "LOW",      color: "#50DC78", bg: "rgba(80,220,120,0.08)",  border: "rgba(80,220,120,0.2)"  };
  if (score <= 45) return { score, level: "MEDIUM",   color: "#F0B429", bg: "rgba(240,180,41,0.08)",  border: "rgba(240,180,41,0.2)"  };
  if (score <= 65) return { score, level: "HIGH",     color: "#F07529", bg: "rgba(240,117,41,0.08)",  border: "rgba(240,117,41,0.2)"  };
  return                  { score, level: "CRITICAL", color: "#E55050", bg: "rgba(229,80,80,0.08)",   border: "rgba(229,80,80,0.2)"   };
}

function getVolatility(company) {
  const liabRat = Number(company.liability_ratio) || 0;
  const val = Math.round(Math.min(liabRat * 100, 100));
  const label =
    val <= 25 ? "Low" :
    val <= 45 ? "Low-Med" :
    val <= 60 ? "Medium" :
    val <= 75 ? "High" : "Extreme";
  return { val, label };
}

/* ─── Horizontal risk bar ─── */
function RiskBar({ value, color, max = 100 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), 200);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 2,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        width: `${width}%`,
        transition: "width 1.1s cubic-bezier(.4,0,.2,1)",
      }}/>
    </div>
  );
}

/* ─── Skeleton ─── */
function Skeleton({ w = "100%", h = 14, r = 6 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "rgba(255,255,255,0.055)", animation: "shimmer 1.6s infinite" }}/>
  );
}

/* ─── Summary metric tile ─── */
function MetricTile({ label, value, sub, color = "#D4AF37", delay = 0 }) {
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
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
      }}/>
      <p style={{
        fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.28)", marginBottom: 10,
        fontFamily: "'Syne', sans-serif",
      }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontFamily: "'Cormorant Garamond', serif",
        fontSize: 36, fontWeight: 300, color, letterSpacing: "-0.02em",
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Syne', sans-serif" }}>
          {sub}
        </p>
      )}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      }}/>
    </div>
  );
}

export default function RiskPage() {
  const [riskData, setRiskData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState("ALL");
  const [hovered, setHovered]   = useState(null);

  useEffect(() => {
    API.get("/risk-analysis")
      .then(res => {
        // ✅ Safe unwrap: handles bare array or axios {data:[]}
        const data = Array.isArray(res.data) ? res.data
                   : Array.isArray(res)      ? res
                   : [];
        setRiskData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load risk data.");
        setLoading(false);
      });
  }, []);

  /* ─── Enrich with computed risk + volatility ─── */
  const enriched = useMemo(() =>
    riskData.map(c => ({
      ...c,
      risk: getRiskScore(c),
      vol:  getVolatility(c),
    })),
    [riskData]
  );

  const filtered = useMemo(() =>
    filter === "ALL" ? enriched : enriched.filter(c => c.risk.level === filter),
    [enriched, filter]
  );

  const counts = useMemo(() => ({
    LOW:      enriched.filter(c => c.risk.level === "LOW").length,
    MEDIUM:   enriched.filter(c => c.risk.level === "MEDIUM").length,
    HIGH:     enriched.filter(c => c.risk.level === "HIGH").length,
    CRITICAL: enriched.filter(c => c.risk.level === "CRITICAL").length,
  }), [enriched]);

  const avgRisk = useMemo(() => {
    if (!enriched.length) return 0;
    return Math.round(enriched.reduce((s, c) => s + c.risk.score, 0) / enriched.length);
  }, [enriched]);

  const avgDebt = useMemo(() => {
    if (!enriched.length) return "—";
    const avg = enriched.reduce((s, c) => s + (Number(c.debt_to_equity_ratio) || 0), 0) / enriched.length;
    return avg.toFixed(2);
  }, [enriched]);

  const avgLiab = useMemo(() => {
    if (!enriched.length) return "—";
    const avg = enriched.reduce((s, c) => s + (Number(c.liability_ratio) || 0), 0) / enriched.length;
    return (avg * 100).toFixed(1) + "%";
  }, [enriched]);

  const FILTERS      = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const FILTER_COLORS = {
    ALL: "#D4AF37", LOW: "#50DC78",
    MEDIUM: "#F0B429", HIGH: "#F07529", CRITICAL: "#E55050",
  };

  return (
    <div>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 40, animation: "fadeSlideUp 0.6s ease both" }}>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(32px, 4vw, 52px)",
          fontWeight: 300, letterSpacing: "-0.03em",
          color: "#fff", margin: 0, lineHeight: 1,
        }}>
          Risk <span style={{ color: "#D4AF37" }}>Analysis</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
          Portfolio-wide exposure assessment using debt and liability ratios
        </p>
      </div>

      <div style={{
        height: 1, marginBottom: 36,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)",
      }}/>

      {/* ── Summary tiles ── */}
      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 16, marginBottom: 32,
        }}>
          <MetricTile label="Avg Risk Score"    value={avgRisk}         sub="out of 100"        color="#D4AF37" delay={0}   />
          <MetricTile label="Avg Debt/Equity"   value={avgDebt}         sub="portfolio mean"    color="#60A5FA" delay={0.05}/>
          <MetricTile label="Avg Liability"     value={avgLiab}         sub="portfolio mean"    color="#A78BFA" delay={0.1} />
          <MetricTile label="Low Risk"          value={counts.LOW}      sub="companies"         color="#50DC78" delay={0.15}/>
          <MetricTile label="Medium Risk"       value={counts.MEDIUM}   sub="companies"         color="#F0B429" delay={0.2} />
          <MetricTile label="High / Critical"   value={counts.HIGH + counts.CRITICAL} sub="require attention" color="#E55050" delay={0.25}/>
        </div>
      )}

      {/* ── Table card ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18, overflow: "hidden",
        animation: "fadeSlideUp 0.6s 0.2s ease both",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: -70, right: -70,
          width: 220, height: 220, borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(229,80,80,0.04) 0%, transparent 70%)",
        }}/>

        {/* Table header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 28px", gap: 14, flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{
            margin: 0, fontSize: 10, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.28)",
            fontFamily: "'Syne', sans-serif",
          }}>
            Risk Register — {filtered.length} entities
          </p>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map(f => {
              const active = filter === f;
              const col = FILTER_COLORS[f];
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 10,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  fontFamily: "'Syne', sans-serif", fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${active ? col + "55" : "rgba(255,255,255,0.07)"}`,
                  background: active ? col + "18" : "transparent",
                  color: active ? col : "rgba(255,255,255,0.35)",
                  transition: "all .16s",
                }}>
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Company", "Sector", "Debt / Equity", "Liability Ratio", "Risk Score", "Volatility", "Risk Level"].map(h => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                    fontFamily: "'Syne', sans-serif", fontWeight: 600,
                    color: "rgba(255,255,255,0.28)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading
                ? [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((__, j) => (
                        <td key={j} style={{ padding: "16px" }}>
                          <Skeleton w={`${40 + (i*7 + j*11) % 40}%`}/>
                        </td>
                      ))}
                    </tr>
                  ))
                : error
                ? (
                  <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(229,80,80,0.75)", fontSize: 13 }}>{error}</p>
                  </td></tr>
                )
                : filtered.length === 0
                ? (
                  <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                      No companies in this risk tier
                    </p>
                  </td></tr>
                )
                : filtered.map((c, i) => {
                  const h = hovered === c.company_id;
                  return (
                    <tr key={c.company_id}
                      onMouseEnter={() => setHovered(c.company_id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: h ? `${c.risk.color}08` : "transparent",
                        transition: "background .14s",
                        animation: `fadeSlideUp 0.3s ${i * 0.02}s ease both`,
                      }}
                    >
                      {/* Company */}
                      <td style={{ padding: "15px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                            background: `hsl(${(c.company_name?.charCodeAt(0) ?? 65) * 6 % 360}, 20%, 18%)`,
                            border: "1px solid rgba(255,255,255,0.07)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)",
                            fontFamily: "'Syne', sans-serif",
                          }}>
                            {(c.company_name ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{
                            fontSize: 13, color: h ? "#fff" : "rgba(255,255,255,0.78)",
                            fontFamily: "'Syne', sans-serif", transition: "color .14s",
                          }}>
                            {c.company_name}
                          </span>
                        </div>
                      </td>

                      {/* Sector */}
                      <td style={{ padding: "15px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'Syne', sans-serif" }}>
                        {c.sector ?? "—"}
                      </td>

                      {/* Debt / Equity — REAL field */}
                      <td style={{ padding: "15px 16px" }}>
                        <span style={{
                          fontFamily: "'Cormorant Garamond', serif", fontSize: 17,
                          color: Number(c.debt_to_equity_ratio) > 2
                            ? "#E55050"
                            : Number(c.debt_to_equity_ratio) > 1
                            ? "#F07529"
                            : "rgba(255,255,255,0.75)",
                        }}>
                          {Number(c.debt_to_equity_ratio).toFixed(2)}x
                        </span>
                      </td>

                      {/* Liability Ratio — REAL field */}
                      <td style={{ padding: "15px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 130 }}>
                          <span style={{
                            fontFamily: "'Cormorant Garamond', serif", fontSize: 16,
                            color: "rgba(255,255,255,0.7)", minWidth: 40,
                          }}>
                            {(Number(c.liability_ratio) * 100).toFixed(1)}%
                          </span>
                          <div style={{ flex: 1 }}>
                            <RiskBar
                              value={Number(c.liability_ratio) * 100}
                              color="rgba(96,165,250,0.7)"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Risk score (computed) */}
                      <td style={{ padding: "15px 16px", minWidth: 150 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 13, fontFamily: "'Cormorant Garamond', serif",
                            color: c.risk.color, minWidth: 24,
                          }}>
                            {c.risk.score}
                          </span>
                          <div style={{ flex: 1 }}>
                            <RiskBar value={c.risk.score} color={c.risk.color}/>
                          </div>
                        </div>
                      </td>

                      {/* Volatility */}
                      <td style={{ padding: "15px 16px", minWidth: 130 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 12, color: "rgba(255,255,255,0.45)",
                            fontFamily: "'Syne', sans-serif", minWidth: 22,
                          }}>
                            {c.vol.val}%
                          </span>
                          <div style={{ flex: 1 }}>
                            <RiskBar value={c.vol.val} color="rgba(255,255,255,0.3)"/>
                          </div>
                        </div>
                      </td>

                      {/* Risk level badge */}
                      <td style={{ padding: "15px 16px" }}>
                        <span style={{
                          fontSize: 10, padding: "4px 10px", borderRadius: 6,
                          background: c.risk.bg,
                          border: `1px solid ${c.risk.border}`,
                          color: c.risk.color,
                          fontFamily: "'Syne', sans-serif",
                          fontWeight: 600, letterSpacing: "0.1em",
                        }}>
                          {c.risk.level}
                        </span>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}