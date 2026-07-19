import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const ROWS_PER_PAGE = 12;
const FONT_SANS  = "'Syne', sans-serif";
const FONT_SERIF = "'Cormorant Garamond', serif";

const COLUMNS = [
  { key: "company_name", label: "Company",    sortable: true  },
  { key: "industry",     label: "Industry",   sortable: true  },
  { key: "country",      label: "Country",    sortable: true  },
  { key: "sector",       label: "Sector",     sortable: true  },
  { key: "market_cap",   label: "Market Cap", sortable: true, numeric: true },
  { key: "_actions",     label: "",           sortable: false },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function formatCap(val) {
  const n = Number(val);
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
function fmtPrice(n) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtPct(n) {
  if (n == null) return "—";
  return `${Number(n).toFixed(2)}%`;
}

/* ═══════════════════════════════════════════════════════════
   SORT ICON
═══════════════════════════════════════════════════════════ */
function SortIcon({ dir }) {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="none" style={{ opacity: dir ? 0.9 : 0.2 }}>
      {dir === "asc"
        ? <path d="M4 0L7.5 5H0.5L4 0Z" fill="#D4AF37"/>
        : dir === "desc"
        ? <path d="M4 10L0.5 5H7.5L4 10Z" fill="#D4AF37"/>
        : <>
            <path d="M4 0L7 3.5H1L4 0Z" fill="white"/>
            <path d="M4 10L1 6.5H7L4 10Z" fill="white"/>
          </>
      }
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════ */
function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((col, i) => (
        <td key={col.key} style={{ padding: "16px" }}>
          <div style={{
            height: 11, borderRadius: 5,
            background: "rgba(255,255,255,0.055)",
            width: `${45 + (i * 11 % 40)}%`,
            animation: "shimmer 1.6s infinite",
          }}/>
        </td>
      ))}
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGINATION BUTTON
═══════════════════════════════════════════════════════════ */
function PageBtn({ label, onClick, disabled, active }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        minWidth: 32, height: 32, borderRadius: 8, padding: "0 6px",
        border: active
          ? "1px solid rgba(212,175,55,0.5)"
          : h && !disabled ? "1px solid rgba(255,255,255,0.13)" : "1px solid rgba(255,255,255,0.06)",
        background: active ? "rgba(212,175,55,0.12)" : h && !disabled ? "rgba(255,255,255,0.05)" : "transparent",
        color: active ? "#D4AF37" : disabled ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.5)",
        fontSize: 12, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_SANS, transition: "all .14s",
      }}
    >{label}</button>
  );
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total-4, total-3, total-2, total-1, total];
  return [1, "…", current-1, current, current+1, "…", total];
}

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  const color = type === "success" ? "#50DC78" : type === "error" ? "#E55050" : "#D4AF37";
  const bg    = type === "success" ? "rgba(80,220,120,0.08)" : type === "error" ? "rgba(229,80,80,0.08)" : "rgba(212,175,55,0.08)";
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 999,
      background: "rgba(10,12,18,0.97)", border: `1px solid ${color}40`,
      borderRadius: 14, padding: "14px 20px",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      animation: "fadeSlideUp 0.3s ease both",
      maxWidth: 360,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 12, color, fontFamily: FONT_SANS }}>{message}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONFIRM REMOVE DIALOG
═══════════════════════════════════════════════════════════ */
function ConfirmDialog({ company, onConfirm, onCancel, loading }) {
  return (
    <>
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)", zIndex: 300,
      }} />
      <div style={{
        position: "fixed", left: "50%", top: "50%",
        transform: "translate(-50%,-50%)",
        background: "rgba(10,12,18,0.99)",
        border: "1px solid rgba(229,80,80,0.2)",
        borderRadius: 18, padding: "32px 36px",
        zIndex: 301, width: "min(420px,90vw)",
        animation: "fadeSlideUp 0.25s ease both",
      }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%",
          background: "rgba(229,80,80,0.08)", border: "1px solid rgba(229,80,80,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 6h12M7 6V4h4v2M5 6l1 9h6l1-9" stroke="#E55050" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 style={{ fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 300, color: "#fff", margin: "0 0 8px" }}>
          Remove Company
        </h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: FONT_SANS, margin: "0 0 28px", lineHeight: 1.6 }}>
          Remove <strong style={{ color: "#fff" }}>{company.company_name}</strong> from your portfolio?
          This will permanently delete all its data from the database.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", borderRadius: 10, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: FONT_SANS,
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: "11px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
            background: "rgba(229,80,80,0.12)", border: "1px solid rgba(229,80,80,0.3)",
            color: "#E55050", fontSize: 12, fontFamily: FONT_SANS, fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Removing…" : "Yes, Remove"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD COMPANY MODAL
═══════════════════════════════════════════════════════════ */
function AddCompanyModal({ onClose, onAdded }) {
  const [query, setQuery]         = useState("");
  const [suggestions, setSugs]    = useState([]);
  const [sugLoading, setSugLoad]  = useState(false);
  const [preview, setPreview]     = useState(null);
  const [prevLoading, setPrevLoad]= useState(false);
  const [prevError, setPrevError] = useState(null);
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleQueryChange = (val) => {
    setQuery(val);
    setPreview(null);
    setPrevError(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSugs([]); return; }
    debounceRef.current = setTimeout(() => {
      setSugLoad(true);
      API.get("/market-explorer/search", { params: { q: val } })
        .then(r => setSugs(Array.isArray(r.data) ? r.data.slice(0, 8) : []))
        .catch(() => setSugs([]))
        .finally(() => setSugLoad(false));
    }, 400);
  };

  const selectSymbol = (sym, desc) => {
    setQuery(`${sym} — ${desc}`);
    setSugs([]);
    setPrevError(null);
    setPrevLoad(true);
    API.get(`/companies/preview/${sym}`)
      .then(r => setPreview(r.data))
      .catch(e => setPrevError(e?.response?.data?.detail || "Symbol not found on Finnhub."))
      .finally(() => setPrevLoad(false));
  };

  const handleAdd = () => {
    if (!preview) return;
    setAdding(true);
    setAddError(null);
    API.post("/companies", { symbol: preview.symbol })
      .then(() => { onAdded(preview.name); onClose(); })
      .catch(e => setAddError(e?.response?.data?.detail || "Failed to add company."))
      .finally(() => setAdding(false));
  };

  const pos = preview?.change_pct > 0;

  return (
    <>
      {/* Scrollable overlay — click backdrop to close */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
          zIndex: 300,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflowY: "auto",
          padding: "32px 16px",
          boxSizing: "border-box",
        }}
      >
        {/* Modal panel — stop click bubbling to backdrop */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "rgba(10,12,18,0.99)",
            border: "1px solid rgba(212,175,55,0.15)",
            borderRadius: 20, padding: "32px 36px",
            width: "min(560px, 95vw)",
            animation: "fadeSlideUp 0.28s ease both",
            flexShrink: 0,
            marginBottom: 32,
          }}
        >
        {/* Gold top accent */}
        <div style={{ height: 2, margin: "-32px -36px 28px",
          background: "linear-gradient(90deg, #D4AF37, rgba(212,175,55,0.2), transparent)" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontFamily: FONT_SERIF, fontSize: 30, fontWeight: 300, color: "#fff", margin: "0 0 4px" }}>
              Add to <span style={{ color: "#D4AF37" }}>Portfolio</span>
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT_SANS }}>
              Search a symbol — Finnhub will enrich it automatically
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.4)", flexShrink: 0,
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                     pointerEvents: "none", opacity: 0.35 }}>
            <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.4"/>
            <path d="M10 10L13 13" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Type symbol or company name… e.g. NVDA, Nvidia"
            onChange={e => handleQueryChange(e.target.value)}
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 12, padding: "12px 14px 12px 40px",
              color: "#fff", fontSize: 13, fontFamily: FONT_SANS,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Autocomplete suggestions */}
        {(suggestions.length > 0 || sugLoading) && (
          <div style={{
            background: "rgba(12,15,22,0.98)", border: "1px solid rgba(212,175,55,0.15)",
            borderRadius: 12, overflow: "hidden", marginBottom: 20,
          }}>
            {sugLoading && (
              <div style={{ padding: "12px 16px" }}>
                <div style={{ height: 10, borderRadius: 4, width: "50%",
                  background: "rgba(255,255,255,0.06)", animation: "shimmer 1.6s infinite" }} />
              </div>
            )}
            {suggestions.map((s, i) => (
              <div key={i}
                onClick={() => selectSymbol(s.symbol, s.description)}
                style={{
                  padding: "11px 16px", cursor: "pointer",
                  borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: "background .12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT_SANS }}>{s.symbol}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONT_SANS, marginLeft: 8 }}>{s.description}</span>
                </div>
                {s.type && (
                  <span style={{ fontSize: 8, color: "rgba(212,175,55,0.5)", fontFamily: FONT_SANS,
                                 letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.type}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Loading preview */}
        {prevLoading && (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
              style={{ animation: "spin 1.1s linear infinite" }}>
              <circle cx="11" cy="11" r="9" stroke="rgba(212,175,55,0.2)" strokeWidth="2"/>
              <path d="M11 2a9 9 0 0 1 9 9" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: FONT_SANS }}>
              Fetching from Finnhub…
            </p>
          </div>
        )}

        {/* Preview error */}
        {prevError && (
          <div style={{
            background: "rgba(229,80,80,0.06)", border: "1px solid rgba(229,80,80,0.2)",
            borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#E55050", fontFamily: FONT_SANS }}>{prevError}</p>
          </div>
        )}

        {/* Preview card */}
        {preview && !prevLoading && (
          <div style={{
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(212,175,55,0.15)",
            borderRadius: 14, padding: "20px 22px", marginBottom: 22,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -40, right: -40, width: 120, height: 120,
              borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)",
            }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)" }} />

            {/* Company identity row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              {preview.logo
                ? <img src={preview.logo} alt={preview.symbol}
                    style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain",
                             background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} />
                : <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#D4AF37", fontFamily: FONT_SANS,
                  }}>{(preview.name || preview.symbol).slice(0, 2).toUpperCase()}</div>
              }
              <div>
                <p style={{ margin: 0, fontFamily: FONT_SANS, fontWeight: 600, fontSize: 15, color: "#fff" }}>
                  {preview.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: FONT_SANS, letterSpacing: "0.06em" }}>
                  {preview.symbol} · {preview.exchange} · {preview.country}
                </p>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <p style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 300,
                            color: pos ? "#50DC78" : "#E55050" }}>
                  {fmtPrice(preview.price)}
                </p>
                <p style={{ margin: 0, fontSize: 11, fontFamily: FONT_SANS,
                            color: pos ? "#50DC78" : "#E55050" }}>
                  {pos ? "+" : ""}{fmtPct(preview.change_pct)}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "Sector",    val: preview.sector || "—" },
                { label: "Mkt Cap",   val: formatCap((preview.market_cap_m || 0) * 1_000_000) },
                { label: "P/E",       val: preview.pe_ratio != null ? Number(preview.pe_ratio).toFixed(1) : "—" },
                { label: "ROE",       val: preview.roe != null ? fmtPct(preview.roe) : "—" },
                { label: "Beta",      val: preview.beta != null ? Number(preview.beta).toFixed(2) : "—" },
                { label: "52W High",  val: fmtPrice(preview["52w_high"]) },
              ].map(({ label, val }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{ margin: 0, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                               color: "rgba(255,255,255,0.25)", fontFamily: FONT_SANS }}>{label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontFamily: FONT_SANS, color: "rgba(255,255,255,0.8)" }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add error */}
        {addError && (
          <div style={{
            background: "rgba(229,80,80,0.06)", border: "1px solid rgba(229,80,80,0.2)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#E55050", fontFamily: FONT_SANS }}>{addError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 11, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: FONT_SANS,
          }}>Cancel</button>
          <button onClick={handleAdd} disabled={!preview || adding} style={{
            flex: 2, padding: "12px", borderRadius: 11,
            cursor: preview && !adding ? "pointer" : "not-allowed",
            background: preview ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${preview ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.08)"}`,
            color: preview ? "#D4AF37" : "rgba(255,255,255,0.2)",
            fontSize: 12, fontFamily: FONT_SANS, fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase",
            opacity: adding ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {adding ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6"/>
                </svg>
                Adding…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Add to Portfolio
              </>
            )}
          </button>
        </div>
        </div>  {/* end modal panel */}
      </div>  {/* end overlay wrapper */}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function CompaniesPage() {
  const [companies, setCompanies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState("market_cap");
  const [sortDir, setSortDir]       = useState("desc");
  const [page, setPage]             = useState(1);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [focused, setFocused]       = useState(false);

  // Modal state
  const [showAdd, setShowAdd]           = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving]         = useState(false);

  // Toast
  const [toast, setToast]   = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const loadCompanies = useCallback(() => {
    setLoading(true);
    API.get("/companies")
      .then(res => {
        const raw  = res.data;
        const data = Array.isArray(raw)        ? raw          // bare array
                   : Array.isArray(raw?.value) ? raw.value    // {value:[...], Count:N}
                   : Array.isArray(raw?.data)  ? raw.data     // {data:[...]}
                   : [];
        setCompanies(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load company data.");
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleRemove = () => {
    if (!removeTarget) return;
    setRemoving(true);
    API.delete(`/companies/${removeTarget.company_id}`)
      .then(() => {
        showToast(`${removeTarget.company_name} removed from portfolio.`, "success");
        setRemoveTarget(null);
        loadCompanies();
      })
      .catch(e => {
        showToast(e?.response?.data?.detail || "Failed to remove company.", "error");
        setRemoveTarget(null);
      })
      .finally(() => setRemoving(false));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return companies;
    return companies.filter(c =>
      [c.company_name, c.industry, c.country, c.sector].some(v => v?.toLowerCase().includes(q))
    );
  }, [companies, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const isNum = sortKey === "market_cap";
    const cmp = isNum
      ? Number(a[sortKey]) - Number(b[sortKey])
      : String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
    return sortDir === "asc" ? cmp : -cmp;
  }), [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const pageData   = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "market_cap" ? "desc" : "asc"); }
    setPage(1);
  };

  const navigate = useNavigate();

  return (
    <div>
      {/* ── Modals ── */}
      {showAdd && (
        <AddCompanyModal
          onClose={() => setShowAdd(false)}
          onAdded={(name) => {
            showToast(`${name} added to portfolio!`, "success");
            loadCompanies();
          }}
        />
      )}
      {removeTarget && (
        <ConfirmDialog
          company={removeTarget}
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
          loading={removing}
        />
      )}
      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}

      {/* ── Page header ── */}
      <div style={{ marginBottom: 40, animation: "fadeSlideUp 0.6s ease both" }}>
        <h2 style={{
          fontFamily: FONT_SERIF,
          fontSize: "clamp(32px, 4vw, 52px)",
          fontWeight: 300, letterSpacing: "-0.03em",
          color: "#fff", margin: 0, lineHeight: 1,
        }}>
          Company <span style={{ color: "#D4AF37" }}>Intelligence</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em", fontFamily: FONT_SANS }}>
          Portfolio of tracked enterprises — add or remove companies in real time
        </p>
      </div>

      <div style={{
        height: 1, marginBottom: 32,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)",
        animation: "fadeSlideUp 0.6s 0.05s ease both",
      }}/>

      {/* ── Table card ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18, overflow: "hidden",
        animation: "fadeSlideUp 0.6s 0.1s ease both",
        position: "relative",
      }}>
        {/* Corner glow */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 260, height: 260, borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)",
        }}/>

        {/* ── Header bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 28px", flexWrap: "wrap", gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{
              margin: 0, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.28)",
              fontFamily: FONT_SANS,
            }}>Portfolio</p>
            {!loading && (
              <span style={{
                fontSize: 10, padding: "2px 9px", borderRadius: 20,
                background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)",
                color: "rgba(212,175,55,0.75)", letterSpacing: "0.06em", fontFamily: FONT_SANS,
              }}>
                {sorted.length} {sorted.length === 1 ? "company" : "companies"}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                style={{ position: "absolute", left: 11, pointerEvents: "none", opacity: focused ? 0.65 : 0.3, transition: "opacity .2s" }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="white" strokeWidth="1.4"/>
                <path d="M9 9L11.5 11.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                type="text" value={search} placeholder="Search portfolio…"
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                style={{
                  background: focused ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${focused ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 10, padding: "8px 28px 8px 32px",
                  color: "#fff", fontSize: 12, fontFamily: FONT_SANS,
                  outline: "none", width: 200, transition: "all .18s",
                  caretColor: "#D4AF37",
                }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} style={{
                  position: "absolute", right: 9,
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", fontSize: 15, padding: 0,
                }}>×</button>
              )}
            </div>

            {/* Add Company button */}
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)",
                color: "#D4AF37", fontSize: 11, fontFamily: FONT_SANS,
                fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                transition: "all .18s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(212,175,55,0.18)";
                e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(212,175,55,0.1)";
                e.currentTarget.style.borderColor = "rgba(212,175,55,0.3)";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add Company
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => col.sortable && handleSort(col.key)} style={{
                    padding: "13px 16px", textAlign: col.numeric ? "right" : "left",
                    fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                    fontFamily: FONT_SANS, fontWeight: 600,
                    color: sortKey === col.key ? "rgba(212,175,55,0.85)" : "rgba(255,255,255,0.28)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: sortKey === col.key ? "rgba(212,175,55,0.035)" : "transparent",
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none", whiteSpace: "nowrap",
                    transition: "color .18s",
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {col.label}
                      {col.sortable && <SortIcon dir={sortKey === col.key ? sortDir : null}/>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading
                ? [...Array(ROWS_PER_PAGE)].map((_, i) => <SkeletonRow key={i}/>)
                : error
                ? (
                  <tr><td colSpan={COLUMNS.length} style={{ padding: "48px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "rgba(229,80,80,0.75)", fontSize: 13, fontFamily: FONT_SANS }}>{error}</p>
                  </td></tr>
                )
                : pageData.length === 0
                ? (
                  <tr><td colSpan={COLUMNS.length} style={{ padding: "60px 0", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M2 14L7 9l4 4 5-7" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.25)", fontSize: 14, fontFamily: FONT_SERIF, fontWeight: 300 }}>
                        {search ? `No results for "${search}"` : "Portfolio is empty"}
                      </p>
                      {!search && (
                        <button onClick={() => setShowAdd(true)} style={{
                          padding: "8px 18px", borderRadius: 10, cursor: "pointer",
                          background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)",
                          color: "#D4AF37", fontSize: 11, fontFamily: FONT_SANS,
                          letterSpacing: "0.1em", textTransform: "uppercase",
                        }}>+ Add Your First Company</button>
                      )}
                    </div>
                  </td></tr>
                )
                : pageData.map((c, i) => {
                    const hov = hoveredRow === c.company_id;
                    return (
                      <tr key={c.company_id}
                        onMouseEnter={() => setHoveredRow(c.company_id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => c.finnhub_symbol && navigate(`/company/${c.finnhub_symbol}`)}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: hov ? "rgba(212,175,55,0.025)" : "transparent",
                          transition: "background .14s",
                          animation: `fadeSlideUp 0.3s ${i * 0.025}s ease both`,
                          cursor: c.finnhub_symbol ? "pointer" : "default",
                        }}
                      >
                        {/* Company name */}
                        <td style={{ padding: "15px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                              background: `hsl(${(c.company_name?.charCodeAt(0) ?? 65) * 6 % 360}, 20%, 18%)`,
                              border: "1px solid rgba(255,255,255,0.07)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)",
                              fontFamily: FONT_SANS,
                            }}>
                              {(c.company_name ?? "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span style={{
                                fontSize: 13, fontFamily: FONT_SANS,
                                color: hov ? "#D4AF37" : "rgba(255,255,255,0.78)",
                                fontWeight: hov ? 600 : 400, transition: "color .14s",
                                textDecoration: hov && c.finnhub_symbol ? "underline" : "none",
                                textUnderlineOffset: 3,
                              }}>{c.company_name}</span>
                              {c.finnhub_symbol && hov && (
                                <span style={{ fontSize: 9, color: "rgba(212,175,55,0.6)", fontFamily: FONT_SANS,
                                  marginLeft: 6, letterSpacing: "0.08em" }}>{c.finnhub_symbol} ↗</span>
                              )}
                              {c.founded_year && !hov && (
                                <span style={{ display: "block", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: FONT_SANS }}>
                                  Est. {c.founded_year}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Industry */}
                        <td style={{ padding: "15px 16px" }}>
                          <span style={{
                            fontSize: 11, padding: "3px 9px", borderRadius: 5,
                            background: "rgba(255,255,255,0.055)",
                            color: "rgba(255,255,255,0.6)", fontFamily: FONT_SANS,
                          }}>{c.industry || "—"}</span>
                        </td>

                        {/* Country */}
                        <td style={{ padding: "15px 16px", fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: FONT_SANS }}>
                          {c.country || "—"}
                        </td>

                        {/* Sector */}
                        <td style={{ padding: "15px 16px", fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: FONT_SANS }}>
                          {c.sector || "—"}
                        </td>

                        {/* Market cap */}
                        <td style={{ padding: "15px 16px", textAlign: "right" }}>
                          <span style={{
                            fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 400,
                            color: hov ? "#D4AF37" : "rgba(212,175,55,0.8)",
                            transition: "color .14s",
                          }}>{formatCap(c.market_cap)}</span>
                        </td>

                        {/* Remove action */}
                        <td style={{ padding: "15px 16px", textAlign: "center" }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRemoveTarget(c); }}
                            title="Remove from portfolio"
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "5px 12px", borderRadius: 8,
                              background: "rgba(229,80,80,0.08)",
                              border: "1px solid rgba(229,80,80,0.3)",
                              cursor: "pointer",
                              color: "#E55050",
                              fontSize: 10, fontFamily: FONT_SANS,
                              fontWeight: 600, letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              transition: "all .18s", whiteSpace: "nowrap",
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "rgba(229,80,80,0.16)";
                              e.currentTarget.style.borderColor = "rgba(229,80,80,0.5)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "rgba(229,80,80,0.08)";
                              e.currentTarget.style.borderColor = "rgba(229,80,80,0.3)";
                            }}
                          >
                            <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
                              <path d="M1 3h8M3.5 3V1.5h3V3M2.5 3l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && sorted.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 28px", borderTop: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap", gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: FONT_SANS }}>
              Showing{" "}
              <span style={{ color: "rgba(255,255,255,0.45)" }}>
                {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, sorted.length)}
              </span>{" "}of{" "}
              <span style={{ color: "rgba(255,255,255,0.45)" }}>{sorted.length}</span>
            </p>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <PageBtn label="‹" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}/>
              {pageRange(page, totalPages).map((p, i) =>
                p === "…"
                  ? <span key={`e${i}`} style={{ color: "rgba(255,255,255,0.18)", fontSize: 12, padding: "0 4px" }}>…</span>
                  : <PageBtn key={p} label={p} onClick={() => setPage(p)} active={p === page}/>
              )}
              <PageBtn label="›" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}