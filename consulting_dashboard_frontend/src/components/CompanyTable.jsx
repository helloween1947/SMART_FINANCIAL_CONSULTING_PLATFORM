import { useEffect, useState, useMemo } from "react";
import axios from "axios";

/* ─── Constants ─── */
const ROWS_PER_PAGE = 10;

const COLUMNS = [
  { key: "company_name", label: "Company",    sortable: true  },
  { key: "industry",     label: "Industry",   sortable: true  },
  { key: "country",      label: "Country",    sortable: true  },
  { key: "sector",       label: "Sector",     sortable: true  },
  { key: "market_cap",   label: "Market Cap", sortable: true, numeric: true },
];

/* ─── Helpers ─── */
function formatMarketCap(val) {
  const n = Number(val);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function SortIcon({ direction }) {
  if (!direction) return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ opacity: 0.25 }}>
      <path d="M5 1L8 4H2L5 1Z" fill="currentColor"/>
      <path d="M5 11L2 8H8L5 11Z" fill="currentColor"/>
    </svg>
  );
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ opacity: 0.85 }}>
      {direction === "asc"
        ? <path d="M5 1L9 6H1L5 1Z" fill="#D4AF37"/>
        : <path d="M5 11L1 6H9L5 11Z" fill="#D4AF37"/>
      }
    </svg>
  );
}

/* ─── Skeleton row ─── */
function SkeletonRow({ i }) {
  return (
    <tr>
      {COLUMNS.map((col) => (
        <td key={col.key} style={{ padding: "18px 16px" }}>
          <div
            style={{
              height: 12,
              borderRadius: 6,
              background: "rgba(255,255,255,0.06)",
              width: col.numeric ? "60%" : `${55 + ((i * 13 + col.key.length * 7) % 35)}%`,
              animation: `shimmer 1.6s ${i * 0.08}s infinite`,
            }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ─── Main component ─── */
export default function CompanyTable() {
  const [companies, setCompanies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState("market_cap");
  const [sortDir, setSortDir]       = useState("desc");
  const [page, setPage]             = useState(1);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [focusSearch, setFocusSearch] = useState(false);

  useEffect(() => {
    /* Inject keyframe styles once */
    if (!document.getElementById("ct-styles")) {
      const s = document.createElement("style");
      s.id = "ct-styles";
      s.innerHTML = `
        @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
      `;
      document.head.appendChild(s);
    }

    axios.get("http://127.0.0.1:8000/companies")
      .then((res) => { setCompanies(res.data); setLoading(false); })
      .catch((err) => { console.error(err); setError("Failed to load company data."); setLoading(false); });

    /* Cleanup injected styles on unmount */
    return () => {
      const styleEl = document.getElementById("ct-styles");
      if (styleEl) document.head.removeChild(styleEl);
    };
  }, []);

  /* ─── Derived data ─── */
  const filtered = useMemo(() => {
    const q = String(search).toLowerCase().trim();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.company_name, c.industry, c.country, c.sector]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [companies, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const isNum = sortKey === "market_cap";
      const cmp = isNum
        ? Number(av) - Number(bv)
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const pageData   = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "market_cap" ? "desc" : "asc"); }
    setPage(1);
  }

  function handleSearch(e) { setSearch(e.target.value); setPage(1); }

  /* ─── Render ─── */
  return (
    <div
      style={{
        marginTop: 48,
        background: "rgba(255,255,255,0.022)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        overflow: "hidden",
        animation: "fadeIn 0.6s 0.4s ease both",
        position: "relative",
      }}
    >
      {/* ── Top corner glow ── */}
      <div style={{
        position: "absolute", top: -80, right: -80,
        width: 260, height: 260, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)",
      }} />

      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 28px", flexWrap: "wrap", gap: 16,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {/* Left: label + count */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <p style={{
            margin: 0, fontSize: 11, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
            fontFamily: "'Syne', sans-serif",
          }}>
            Company Intelligence
          </p>
          {!loading && (
            <span style={{
              fontSize: 11, padding: "2px 9px",
              background: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 20, color: "rgba(212,175,55,0.8)",
              fontFamily: "'Syne', sans-serif",
              letterSpacing: "0.06em",
            }}>
              {sorted.length.toLocaleString()} records
            </span>
          )}
        </div>

        {/* Right: search */}
        <div style={{
          position: "relative", display: "flex", alignItems: "center",
        }}>
          {/* search icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ position: "absolute", left: 12, opacity: focusSearch ? 0.7 : 0.35, transition: "opacity .2s", pointerEvents: "none" }}>
            <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search companies, sectors…"
            value={search}
            onChange={handleSearch}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            style={{
              background: focusSearch ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.035)",
              border: focusSearch
                ? "1px solid rgba(212,175,55,0.35)"
                : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "9px 14px 9px 34px",
              color: "#fff",
              fontSize: 13,
              fontFamily: "'Syne', sans-serif",
              outline: "none",
              width: 260,
              transition: "background .2s, border .2s",
              caretColor: "#D4AF37",
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setPage(1); }}
              style={{
                position: "absolute", right: 10,
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.35)", fontSize: 16, lineHeight: 1,
                padding: 0,
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 900,
            borderCollapse: "collapse",
            color: "#fff",
          }}
        >
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    textAlign: col.numeric ? "right" : "left",
                    padding: "14px 16px",
                    fontSize: 11,
                    color: sortKey === col.key ? "rgba(212,175,55,0.9)" : "rgba(255,255,255,0.35)",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontFamily: "'Syne', sans-serif",
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    transition: "color .2s",
                    background: sortKey === col.key
                      ? "rgba(212,175,55,0.04)"
                      : "transparent",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {col.label}
                    {col.sortable && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading
              ? [...Array(ROWS_PER_PAGE)].map((_, i) => <SkeletonRow key={i} i={i} />)
              : error
              ? (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(229,80,80,0.8)", fontSize: 13 }}>{error}</p>
                  </td>
                </tr>
              )
              : pageData.length === 0
              ? (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                      No results for <span style={{ color: "rgba(212,175,55,0.7)" }}>"{search}"</span>
                    </p>
                  </td>
                </tr>
              )
              : pageData.map((company, i) => {
                const isHovered = hoveredRow === company.company_id;
                return (
                  <tr
                    key={company.company_id}
                    onMouseEnter={() => setHoveredRow(company.company_id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.045)",
                      background: isHovered
                        ? "rgba(212,175,55,0.04)"
                        : "transparent",
                      transition: "background .15s",
                      animation: `fadeRow 0.35s ${i * 0.03}s ease both`,
                    }}
                  >
                    {/* Company name */}
                    <td style={{ padding: "18px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Avatar initials */}
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: `hsl(${(company.company_name?.charCodeAt(0) ?? 65) * 5 % 360}, 25%, 20%)`,
                          border: "1px solid rgba(255,255,255,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 600,
                          color: "rgba(255,255,255,0.55)",
                          fontFamily: "'Syne', sans-serif",
                        }}>
                          {(company.company_name ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{
                          fontSize: 14,
                          color: isHovered ? "#ffffff" : "rgba(255,255,255,0.82)",
                          fontWeight: isHovered ? 500 : 400,
                          fontFamily: "'Syne', sans-serif",
                          transition: "color .15s",
                        }}>
                          {company.company_name}
                        </span>
                      </div>
                    </td>

                    {/* Industry */}
                    <td style={{ padding: "18px 16px" }}>
                      <span style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.65)",
                        fontFamily: "'Syne', sans-serif",
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                      }}>
                        {company.industry}
                      </span>
                    </td>

                    {/* Country */}
                    <td style={{ padding: "18px 16px", fontSize: 13, color: "rgba(255,255,255,0.65)", fontFamily: "'Syne', sans-serif" }}>
                      {company.country}
                    </td>

                    {/* Sector */}
                    <td style={{ padding: "18px 16px", fontSize: 13, color: "rgba(255,255,255,0.65)", fontFamily: "'Syne', sans-serif" }}>
                      {company.sector}
                    </td>

                    {/* Market cap */}
                    <td style={{ padding: "18px 16px", textAlign: "right" }}>
                      <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 18,
                        fontWeight: 400,
                        color: isHovered ? "#D4AF37" : "rgba(212,175,55,0.85)",
                        letterSpacing: "-0.01em",
                        transition: "color .15s",
                      }}>
                        {formatMarketCap(company.market_cap)}
                      </span>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>

      {/* ── Footer: pagination ── */}
      {!loading && !error && sorted.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          flexWrap: "wrap", gap: 12,
        }}>
          {/* Info */}
          <p style={{
            margin: 0, fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            fontFamily: "'Syne', sans-serif",
          }}>
            Showing{" "}
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, sorted.length)}
            </span>{" "}
            of{" "}
            <span style={{ color: "rgba(255,255,255,0.5)" }}>{sorted.length}</span>
          </p>

          {/* Page buttons */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <PageBtn
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              label="‹"
            />
            {getPageRange(page, totalPages).map((p, i) =>
              p === "…"
                ? <span key={`e${i}`} style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "0 4px" }}>…</span>
                : <PageBtn key={p} onClick={() => setPage(p)} active={p === page} label={p} />
            )}
            <PageBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              label="›"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Pagination button ─── */
function PageBtn({ onClick, disabled, active, label }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 32, height: 32, borderRadius: 8,
        border: active
          ? "1px solid rgba(212,175,55,0.5)"
          : hover && !disabled
          ? "1px solid rgba(255,255,255,0.15)"
          : "1px solid rgba(255,255,255,0.07)",
        background: active
          ? "rgba(212,175,55,0.12)"
          : hover && !disabled
          ? "rgba(255,255,255,0.06)"
          : "transparent",
        color: active
          ? "#D4AF37"
          : disabled
          ? "rgba(255,255,255,0.15)"
          : "rgba(255,255,255,0.55)",
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
        transition: "all .15s",
        fontFamily: "'Syne', sans-serif",
        padding: "0 6px",
      }}
    >
      {label}
    </button>
  );
}

/* ─── Page range helper ─── */
function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}