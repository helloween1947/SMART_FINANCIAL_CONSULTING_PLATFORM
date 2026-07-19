import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const F     = "'Syne', sans-serif";
const FS    = "'Cormorant Garamond', serif";
const GOLD  = "#D4AF37";
const G10   = "rgba(212,175,55,0.10)";
const G30   = "rgba(212,175,55,0.30)";
const BG    = "rgba(255,255,255,0.025)";
const BD    = "rgba(255,255,255,0.07)";
const MUT   = "rgba(255,255,255,0.28)";
const TXT   = "rgba(255,255,255,0.8)";

const COLORS = [
  { hex: "#D4AF37", name: "Gold"   },
  { hex: "#5B9CF6", name: "Blue"   },
  { hex: "#50DC78", name: "Green"  },
  { hex: "#C084FC", name: "Purple" },
  { hex: "#E55050", name: "Red"    },
  { hex: "#FB923C", name: "Orange" },
  { hex: "#F472B6", name: "Pink"   },
  { hex: "#34D399", name: "Teal"   },
];

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmt$(v) {
  if (v == null) return "—";
  return `$${Number(v).toFixed(2)}`;
}
function fmtPct(v) {
  if (v == null) return "—";
  const n = Number(v);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/* ═══════════════════════ TOAST ═══════════════════════ */
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const color = type === "err" ? "#E55050" : type === "warn" ? "#FB923C" : "#50DC78";
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: "rgba(8,9,14,0.97)", border: `1px solid ${color}40`,
      borderRadius: 14, padding: "13px 18px",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      animation: "fadeSlideUp 0.3s ease both",
      fontFamily: F, fontSize: 12, color,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {msg}
    </div>
  );
}

/* ═══════════════════════ CONFIRM DIALOG ═══════════════════════ */
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, danger = false }) {
  const color = danger ? "#E55050" : GOLD;
  return (
    <>
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(5px)", zIndex: 400,
      }} />
      <div style={{
        position: "fixed", left: "50%", top: "50%",
        transform: "translate(-50%,-50%)",
        background: "rgba(10,12,18,0.99)", border: `1px solid ${color}30`,
        borderRadius: 18, padding: "32px 36px", zIndex: 401,
        width: "min(420px,90vw)", animation: "fadeSlideUp 0.25s ease both",
        fontFamily: F,
      }}>
        <h3 style={{ fontFamily: FS, fontSize: 26, fontWeight: 300, color: "#fff", margin: "0 0 10px" }}>{title}</h3>
        <p style={{ fontSize: 13, color: MUT, margin: "0 0 28px", lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", borderRadius: 10, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: MUT, fontSize: 12, fontFamily: F,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "11px", borderRadius: 10, cursor: "pointer",
            background: `${color}15`, border: `1px solid ${color}40`,
            color, fontSize: 12, fontFamily: F, fontWeight: 700,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════ CREATE / EDIT WATCHLIST MODAL ═══════════════════════ */
function WatchlistModal({ initial, onClose, onSave }) {
  const [name, setName]   = useState(initial?.name || "");
  const [desc, setDesc]   = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || COLORS[0].hex);
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState(null);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);

  const save = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setBusy(true); setErr(null);
    try {
      await onSave({ name: name.trim(), description: desc.trim() || null, color });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)", zIndex: 400,
      }} />
      <div style={{
        position: "fixed", left: "50%", top: "50%",
        transform: "translate(-50%,-50%)",
        background: "rgba(10,12,18,0.99)", border: `1px solid ${G30}`,
        borderRadius: 20, padding: "36px", zIndex: 401,
        width: "min(500px,94vw)", animation: "fadeSlideUp 0.28s ease both",
        fontFamily: F,
      }}>
        {/* Gold top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "20px 20px 0 0",
          background: `linear-gradient(90deg, ${GOLD}, rgba(212,175,55,0.1), transparent)` }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <h3 style={{ fontFamily: FS, fontSize: 28, fontWeight: 300, color: "#fff", margin: 0 }}>
            {initial ? "Edit Watchlist" : "New Watchlist"}
          </h3>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, width: 32, height: 32, cursor: "pointer",
            color: MUT, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Name */}
        <label style={{ display: "block", marginBottom: 6, fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: MUT }}>Name</label>
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()}
          placeholder="e.g. Tech Giants"
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: `1px solid ${G30}`, borderRadius: 12,
            padding: "11px 14px", color: "#fff", fontSize: 13, fontFamily: F,
            outline: "none", boxSizing: "border-box", marginBottom: 18,
            caretColor: GOLD,
          }} />

        {/* Description */}
        <label style={{ display: "block", marginBottom: 6, fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: MUT }}>Description (optional)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Brief description…"
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
            padding: "11px 14px", color: "#fff", fontSize: 13, fontFamily: F,
            outline: "none", boxSizing: "border-box", marginBottom: 22,
            caretColor: GOLD,
          }} />

        {/* Color picker */}
        <label style={{ display: "block", marginBottom: 12, fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: MUT }}>Accent Color</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          {COLORS.map(c => (
            <button key={c.hex} onClick={() => setColor(c.hex)} title={c.name} style={{
              width: 28, height: 28, borderRadius: "50%", background: c.hex,
              border: color === c.hex ? `2px solid #fff` : "2px solid transparent",
              cursor: "pointer", flexShrink: 0,
              boxShadow: color === c.hex ? `0 0 0 3px ${c.hex}50` : "none",
              transition: "all .15s",
            }} />
          ))}
        </div>

        {err && <p style={{ marginBottom: 14, fontSize: 12, color: "#E55050" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 11, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: MUT, fontSize: 12, fontFamily: F,
          }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{
            flex: 2, padding: "12px", borderRadius: 11, cursor: busy ? "not-allowed" : "pointer",
            background: G10, border: `1px solid ${G30}`,
            color: GOLD, fontSize: 12, fontFamily: F, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "Saving…" : initial ? "Save Changes" : "Create Watchlist"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════ ADD STOCK MODAL ═══════════════════════ */
function AddStockModal({ watchlistId, onClose, onAdded }) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [adding, setAdding]     = useState(null);
  const [err, setErr]           = useState(null);
  const debounce = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);

  const search = (q) => {
    setQuery(q);
    setErr(null);
    clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await API.get("/market-explorer/search", { params: { q } });
        setResults(Array.isArray(r.data) ? r.data.slice(0, 8) : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 380);
  };

  const add = async (sym, name) => {
    setAdding(sym); setErr(null);
    try {
      await API.post(`/watchlists/${watchlistId}/items`, { symbol: sym, company_name: name });
      onAdded(sym, name);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to add");
    } finally { setAdding(null); }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)", zIndex: 400,
      }} />
      <div style={{
        position: "fixed", left: "50%", top: "50%",
        transform: "translate(-50%,-50%)",
        background: "rgba(10,12,18,0.99)", border: `1px solid ${G30}`,
        borderRadius: 20, padding: "32px 36px", zIndex: 401,
        width: "min(520px,94vw)", animation: "fadeSlideUp 0.28s ease both",
        fontFamily: F,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "20px 20px 0 0",
          background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <h3 style={{ fontFamily: FS, fontSize: 26, fontWeight: 300, color: "#fff", margin: 0 }}>
            Add to <span style={{ color: GOLD }}>Watchlist</span>
          </h3>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, width: 32, height: 32, cursor: "pointer",
            color: MUT, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Search box */}
        <div style={{ position: "relative" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", opacity: 0.35,
          }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="white" strokeWidth="1.4"/>
            <path d="M9 9L12 12" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input ref={inputRef} value={query} onChange={e => search(e.target.value)}
            placeholder="Search symbol or company…"
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: `1px solid ${G30}`, borderRadius: 12,
              padding: "11px 14px 11px 36px", color: "#fff", fontSize: 13, fontFamily: F,
              outline: "none", boxSizing: "border-box", caretColor: GOLD,
            }} />
        </div>

        {/* Results */}
        {(results.length > 0 || loading) && (
          <div style={{
            marginTop: 10, background: "rgba(12,15,22,0.98)",
            border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 12, overflow: "hidden",
          }}>
            {loading && (
              <div style={{ padding: "12px 16px" }}>
                <div style={{ height: 10, borderRadius: 4, width: "40%",
                  background: "rgba(255,255,255,0.06)", animation: "shimmer 1.6s infinite" }} />
              </div>
            )}
            {results.map((r, i) => (
              <div key={r.symbol}
                onClick={() => !adding && add(r.symbol, r.description)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  cursor: adding ? "not-allowed" : "pointer",
                  background: adding === r.symbol ? G10 : "transparent",
                  transition: "background .12s",
                }}
                onMouseEnter={e => { if (!adding) e.currentTarget.style.background = G10; }}
                onMouseLeave={e => { if (adding !== r.symbol) e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.symbol}</span>
                  <span style={{ fontSize: 11, color: MUT, marginLeft: 8 }}>{r.description}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.type && <span style={{ fontSize: 8, color: "rgba(212,175,55,0.5)", letterSpacing: "0.12em" }}>{r.type}</span>}
                  {adding === r.symbol
                    ? <span style={{ fontSize: 10, color: GOLD }}>Adding…</span>
                    : <span style={{ fontSize: 11, color: GOLD }}>+ Add</span>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {err && (
          <div style={{ marginTop: 12, padding: "10px 14px",
            background: "rgba(229,80,80,0.06)", border: "1px solid rgba(229,80,80,0.2)",
            borderRadius: 10, fontSize: 12, color: "#E55050" }}>
            {err}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <p style={{ marginTop: 14, fontSize: 12, color: MUT, textAlign: "center" }}>
            No results for "{query}"
          </p>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════ WATCHLIST SIDEBAR ITEM ═══════════════════════ */
function WLItem({ wl, active, onClick, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "11px 14px", borderRadius: 12, cursor: "pointer",
        marginBottom: 4,
        background: active ? `${wl.color}12` : hov ? "rgba(255,255,255,0.03)" : "transparent",
        border: active ? `1px solid ${wl.color}30` : "1px solid transparent",
        transition: "all .15s", position: "relative",
      }}
    >
      {/* Color dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: wl.color, flexShrink: 0,
        boxShadow: active ? `0 0 6px ${wl.color}` : "none",
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: active ? 700 : 500,
          color: active ? "#fff" : TXT, fontFamily: F,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{wl.name}</p>
        <p style={{ margin: 0, fontSize: 9, color: MUT, fontFamily: F, marginTop: 1 }}>
          {wl.item_count ?? 0} stocks
          {wl.favorite_count > 0 ? ` · ★ ${wl.favorite_count}` : ""}
        </p>
      </div>

      {/* Action buttons — show on hover */}
      {(hov || active) && (
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{
            width: 22, height: 22, borderRadius: 6, border: "none",
            background: "rgba(255,255,255,0.07)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: MUT, fontSize: 10,
          }}>✎</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
            width: 22, height: 22, borderRadius: 6, border: "none",
            background: "rgba(229,80,80,0.1)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#E55050", fontSize: 12,
          }}>×</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ PRICE CHANGE BADGE ═══════════════════════ */
function ChangeBadge({ pct }) {
  if (pct == null) return <span style={{ color: MUT, fontFamily: F, fontSize: 12 }}>—</span>;
  const pos = pct >= 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: F,
      padding: "2px 7px", borderRadius: 5,
      background: pos ? "rgba(80,220,120,0.1)" : "rgba(229,80,80,0.1)",
      color: pos ? "#50DC78" : "#E55050",
    }}>
      {pos ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

/* ═══════════════════════ STOCK ROW ═══════════════════════ */
function StockRow({ item, watchlistId, onRemove, onFavoriteToggle, onNavigate, animDelay }) {
  const [hov, setHov] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleFavorite = async (e) => {
    e.stopPropagation();
    try {
      const r = await API.patch(`/watchlists/${watchlistId}/items/${item.symbol}/favorite`);
      onFavoriteToggle(item.symbol, r.data.is_favorite);
    } catch {}
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    setRemoving(true);
    try {
      await API.delete(`/watchlists/${watchlistId}/items/${item.symbol}`);
      onRemove(item.symbol);
    } catch { setRemoving(false); }
  };

  const pos = item.change_pct >= 0;

  return (
    <tr
      onClick={() => onNavigate(item.symbol)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hov ? "rgba(212,175,55,0.02)" : "transparent",
        cursor: "pointer", transition: "background .13s",
        animation: `fadeSlideUp 0.3s ${animDelay}s ease both`,
        opacity: removing ? 0.4 : 1,
      }}
    >
      {/* Favorite star */}
      <td style={{ padding: "14px 10px 14px 18px", width: 32 }}>
        <button onClick={handleFavorite} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 14, color: item.is_favorite ? GOLD : "rgba(255,255,255,0.15)",
          transition: "color .15s, transform .15s",
          transform: hov ? "scale(1.15)" : "scale(1)",
        }}>
          {item.is_favorite ? "★" : "☆"}
        </button>
      </td>

      {/* Symbol + name */}
      <td style={{ padding: "14px 12px" }}>
        <p style={{ margin: 0, fontFamily: F, fontSize: 13, fontWeight: 700,
          color: hov ? GOLD : "#fff", transition: "color .13s" }}>
          {item.symbol}
          {hov && <span style={{ fontSize: 9, color: "rgba(212,175,55,0.5)", marginLeft: 5 }}>↗</span>}
        </p>
        <p style={{ margin: 0, fontFamily: F, fontSize: 10, color: MUT, marginTop: 1 }}>
          {item.company_name}
        </p>
      </td>

      {/* Price */}
      <td style={{ padding: "14px 12px" }}>
        <span style={{ fontFamily: FS, fontSize: 20, fontWeight: 400,
          color: item.price == null ? MUT : "#fff" }}>
          {fmt$(item.price)}
        </span>
      </td>

      {/* Change */}
      <td style={{ padding: "14px 12px" }}>
        <ChangeBadge pct={item.change_pct} />
      </td>

      {/* Day change $ */}
      <td style={{ padding: "14px 12px" }}>
        <span style={{ fontFamily: F, fontSize: 11,
          color: item.change == null ? MUT : item.change >= 0 ? "#50DC78" : "#E55050" }}>
          {item.change == null ? "—" : `${item.change >= 0 ? "+" : ""}$${Math.abs(item.change).toFixed(2)}`}
        </span>
      </td>

      {/* 52W position bar */}
      <td style={{ padding: "14px 12px", minWidth: 100 }}>
        {item.price && item.high && item.low ? (() => {
          const pct = ((item.price - item.low) / (item.high - item.low)) * 100;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: MUT, width: 24, textAlign: "right" }}>
                {Math.round(pct)}%
              </span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  background: `linear-gradient(90deg, #5B9CF6, ${GOLD})`,
                }} />
              </div>
            </div>
          );
        })() : <span style={{ fontSize: 10, color: MUT }}>—</span>}
      </td>

      {/* Remove */}
      <td style={{ padding: "14px 18px 14px 8px", textAlign: "right" }}>
        <button
          onClick={handleRemove}
          disabled={removing}
          style={{
            background: hov ? "rgba(229,80,80,0.1)" : "transparent",
            border: hov ? "1px solid rgba(229,80,80,0.25)" : "1px solid transparent",
            borderRadius: 7, padding: "4px 9px", cursor: removing ? "wait" : "pointer",
            color: "#E55050", fontSize: 11, fontFamily: F,
            transition: "all .14s",
          }}
        >
          {removing ? "…" : "Remove"}
        </button>
      </td>
    </tr>
  );
}

/* ═══════════════════════ SKELETON ROW ═══════════════════════ */
function SkeletonRow({ i }) {
  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      {[32, 120, 70, 60, 50, 90, 60].map((w, j) => (
        <td key={j} style={{ padding: "14px 12px" }}>
          <div style={{
            height: 10, borderRadius: 4, width: `${w}px`,
            background: "rgba(255,255,255,0.055)",
            animation: `shimmer 1.6s ${i * 0.08}s infinite`,
          }} />
        </td>
      ))}
    </tr>
  );
}

/* ═══════════════════════ EMPTY WATCHLIST ═══════════════════════ */
function EmptyState({ onAdd }) {
  return (
    <div style={{
      textAlign: "center", padding: "64px 24px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: G10, border: `1px solid ${G30}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4v14M4 11h14" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ fontFamily: FS, fontSize: 22, fontWeight: 300, color: TXT, margin: 0 }}>
        This watchlist is empty
      </p>
      <p style={{ fontFamily: F, fontSize: 11, color: MUT, margin: 0 }}>
        Search and add stocks to track them here
      </p>
      <button onClick={onAdd} style={{
        marginTop: 4, padding: "9px 20px", borderRadius: 10, cursor: "pointer",
        background: G10, border: `1px solid ${G30}`,
        color: GOLD, fontSize: 11, fontFamily: F, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
      }}>+ Add Stock</button>
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function WatchlistPage() {
  const navigate = useNavigate();

  const [watchlists,        setWatchlists]        = useState([]);
  const [selectedId,        setSelectedId]         = useState(null);
  const [items,             setItems]              = useState([]);
  const [loadingWL,         setLoadingWL]          = useState(true);
  const [loadingItems,      setLoadingItems]        = useState(false);
  const [showCreate,        setShowCreate]          = useState(false);
  const [editTarget,        setEditTarget]          = useState(null);
  const [deleteTarget,      setDeleteTarget]        = useState(null);
  const [showAddStock,      setShowAddStock]        = useState(false);
  const [favOnly,           setFavOnly]             = useState(false);
  const [toast,             setToast]              = useState(null);
  const [sortKey,           setSortKey]            = useState("symbol");
  const [sortDir,           setSortDir]            = useState("asc");

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  /* Load all watchlists */
  const loadWatchlists = useCallback(async () => {
    setLoadingWL(true);
    try {
      const r = await API.get("/watchlists");
      setWatchlists(r.data);
      if (!selectedId && r.data.length > 0) setSelectedId(r.data[0].watchlist_id);
    } catch { showToast("Failed to load watchlists", "err"); }
    finally { setLoadingWL(false); }
  }, [selectedId, showToast]);

  useEffect(() => { loadWatchlists(); }, []);

  /* Load items for selected watchlist */
  const loadItems = useCallback(async (id) => {
    if (!id) return;
    setLoadingItems(true);
    setItems([]);
    try {
      const r = await API.get(`/watchlists/${id}/items`);
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch { showToast("Failed to load stocks", "err"); }
    finally { setLoadingItems(false); }
  }, [showToast]);

  useEffect(() => { if (selectedId) loadItems(selectedId); }, [selectedId]);

  /* Sort items */
  const sorted = [...items].sort((a, b) => {
    // Favorites always first
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    let va = a[sortKey], vb = b[sortKey];
    if (va == null) va = sortDir === "asc" ? Infinity : -Infinity;
    if (vb == null) vb = sortDir === "asc" ? Infinity : -Infinity;
    if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === "asc" ? va - vb : vb - va;
  });
  const visible = favOnly ? sorted.filter(i => i.is_favorite) : sorted;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* Callbacks */
  const handleCreateWL = async (data) => {
    const r = await API.post("/watchlists", data);
    showToast(`"${data.name}" created`);
    await loadWatchlists();
    setSelectedId(r.data.watchlist_id);
  };

  const handleEditWL = async (data) => {
    await API.put(`/watchlists/${editTarget.watchlist_id}`, data);
    showToast(`Watchlist renamed`);
    setEditTarget(null);
    await loadWatchlists();
  };

  const handleDeleteWL = async () => {
    await API.delete(`/watchlists/${deleteTarget.watchlist_id}`);
    showToast(`"${deleteTarget.name}" deleted`, "warn");
    setDeleteTarget(null);
    const remaining = watchlists.filter(w => w.watchlist_id !== deleteTarget.watchlist_id);
    setWatchlists(remaining);
    setSelectedId(remaining[0]?.watchlist_id || null);
  };

  const handleStockAdded = (sym, name) => {
    showToast(`${sym} added`);
    loadItems(selectedId);
    setWatchlists(prev => prev.map(w =>
      w.watchlist_id === selectedId ? { ...w, item_count: (w.item_count || 0) + 1 } : w
    ));
  };

  const handleRemove = (sym) => {
    setItems(prev => prev.filter(i => i.symbol !== sym));
    showToast(`${sym} removed`, "warn");
    setWatchlists(prev => prev.map(w =>
      w.watchlist_id === selectedId ? { ...w, item_count: Math.max(0, (w.item_count || 1) - 1) } : w
    ));
  };

  const handleFavToggle = (sym, isFav) => {
    setItems(prev => prev.map(i => i.symbol === sym ? { ...i, is_favorite: isFav } : i));
    setWatchlists(prev => prev.map(w => {
      if (w.watchlist_id !== selectedId) return w;
      const delta = isFav ? 1 : -1;
      return { ...w, favorite_count: Math.max(0, (w.favorite_count || 0) + delta) };
    }));
  };

  const selectedWL = watchlists.find(w => w.watchlist_id === selectedId);

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span style={{ opacity: 0.2, fontSize: 8 }}>⇅</span>;
    return <span style={{ fontSize: 8, color: GOLD }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const thStyle = (k) => ({
    padding: "12px 12px", textAlign: "left",
    fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
    fontFamily: F, fontWeight: 600, userSelect: "none",
    color: sortKey === k ? "rgba(212,175,55,0.85)" : MUT,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer", whiteSpace: "nowrap",
  });

  return (
    <div style={{ animation: "fadeSlideUp 0.5s ease both" }}>
      {/* Modals */}
      {showCreate  && <WatchlistModal onClose={() => setShowCreate(false)}  onSave={handleCreateWL} />}
      {editTarget  && <WatchlistModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleEditWL} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Watchlist"
          body={`Delete "${deleteTarget.name}" and all its ${deleteTarget.item_count} stocks? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteWL}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {showAddStock && selectedId && (
        <AddStockModal
          watchlistId={selectedId}
          onClose={() => setShowAddStock(false)}
          onAdded={handleStockAdded}
        />
      )}
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Page header */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{
          fontFamily: FS, fontSize: "clamp(32px,4vw,52px)",
          fontWeight: 300, letterSpacing: "-0.03em", color: "#fff", margin: 0, lineHeight: 1,
        }}>
          My <span style={{ color: GOLD }}>Watchlists</span>
        </h2>
        <p style={{ marginTop: 10, fontSize: 13, color: MUT, fontFamily: F, letterSpacing: "0.04em" }}>
          Track and monitor your selected securities across custom lists
        </p>
      </div>

      <div style={{ height: 1, marginBottom: 32,
        background: "linear-gradient(90deg, rgba(212,175,55,0.45), rgba(255,255,255,0.04) 50%, transparent)" }} />

      {/* Main layout: sidebar + content */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* ── LEFT SIDEBAR: Watchlist list ── */}
        <div style={{
          width: 230, flexShrink: 0,
          background: BG, border: `1px solid ${BD}`,
          borderRadius: 18, padding: "18px 14px",
          position: "sticky", top: 20,
        }}>
          {/* Sidebar header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px" }}>
            <p style={{ margin: 0, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
              color: MUT, fontFamily: F }}>Watchlists</p>
            <span style={{
              fontSize: 9, padding: "1px 7px", borderRadius: 10,
              background: G10, border: `1px solid ${G30}`,
              color: "rgba(212,175,55,0.7)", fontFamily: F,
            }}>{watchlists.length}</span>
          </div>

          {/* Watchlist items */}
          {loadingWL ? (
            [1, 2, 3].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 12, marginBottom: 4,
                background: "rgba(255,255,255,0.03)", animation: "shimmer 1.6s infinite" }} />
            ))
          ) : watchlists.length === 0 ? (
            <p style={{ fontFamily: F, fontSize: 11, color: MUT, textAlign: "center", padding: "16px 0" }}>
              No watchlists yet
            </p>
          ) : (
            watchlists.map(wl => (
              <WLItem
                key={wl.watchlist_id}
                wl={wl}
                active={selectedId === wl.watchlist_id}
                onClick={() => setSelectedId(wl.watchlist_id)}
                onEdit={() => setEditTarget(wl)}
                onDelete={() => setDeleteTarget(wl)}
              />
            ))
          )}

          {/* Create new */}
          <button onClick={() => setShowCreate(true)} style={{
            width: "100%", marginTop: 10, padding: "10px",
            borderRadius: 12, cursor: "pointer",
            background: G10, border: `1px solid ${G30}`,
            color: GOLD, fontSize: 11, fontFamily: F, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all .15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,175,55,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = G10; }}
          >
            <span style={{ fontSize: 14 }}>+</span> New Watchlist
          </button>
        </div>

        {/* ── RIGHT PANEL: Stocks table ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedWL ? (
            <div style={{ textAlign: "center", padding: "80px 24px",
              background: BG, border: `1px solid ${BD}`, borderRadius: 18 }}>
              <p style={{ fontFamily: FS, fontSize: 24, fontWeight: 300, color: MUT }}>
                Select a watchlist
              </p>
            </div>
          ) : (
            <div style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 18, overflow: "hidden" }}>

              {/* Panel header */}
              <div style={{
                padding: "20px 24px", borderBottom: `1px solid ${BD}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%",
                    background: selectedWL.color, boxShadow: `0 0 8px ${selectedWL.color}` }} />
                  <div>
                    <h3 style={{ fontFamily: FS, fontSize: 24, fontWeight: 300, color: "#fff", margin: 0 }}>
                      {selectedWL.name}
                    </h3>
                    {selectedWL.description && (
                      <p style={{ margin: 0, fontSize: 11, color: MUT, fontFamily: F }}>
                        {selectedWL.description}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, padding: "2px 9px", borderRadius: 20,
                    background: `${selectedWL.color}15`, border: `1px solid ${selectedWL.color}30`,
                    color: selectedWL.color, fontFamily: F,
                  }}>
                    {visible.length} stocks
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Favorites filter */}
                  <button onClick={() => setFavOnly(f => !f)} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "7px 12px", borderRadius: 9, cursor: "pointer",
                    background: favOnly ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${favOnly ? G30 : "rgba(255,255,255,0.08)"}`,
                    color: favOnly ? GOLD : MUT, fontSize: 11, fontFamily: F,
                    transition: "all .15s",
                  }}>
                    ★ Favorites
                  </button>

                  {/* Refresh */}
                  <button onClick={() => loadItems(selectedId)} style={{
                    padding: "7px 12px", borderRadius: 9, cursor: "pointer",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    color: MUT, fontSize: 11, fontFamily: F, transition: "all .15s",
                  }}>↻ Refresh</button>

                  {/* Add stock */}
                  <button onClick={() => setShowAddStock(true)} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 9, cursor: "pointer",
                    background: G10, border: `1px solid ${G30}`,
                    color: GOLD, fontSize: 11, fontFamily: F, fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    transition: "all .15s",
                  }}>
                    + Add Stock
                  </button>
                </div>
              </div>

              {/* Table */}
              {loadingItems ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} i={i} />)}</tbody>
                </table>
              ) : visible.length === 0 ? (
                <EmptyState onAdd={() => setShowAddStock(true)} />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle("_fav"), cursor: "default", width: 40 }} />
                        <th style={thStyle("symbol")} onClick={() => handleSort("symbol")}>
                          Symbol <SortIcon k="symbol" />
                        </th>
                        <th style={thStyle("price")} onClick={() => handleSort("price")}>
                          Price <SortIcon k="price" />
                        </th>
                        <th style={thStyle("change_pct")} onClick={() => handleSort("change_pct")}>
                          Change % <SortIcon k="change_pct" />
                        </th>
                        <th style={thStyle("change")} onClick={() => handleSort("change")}>
                          Change $ <SortIcon k="change" />
                        </th>
                        <th style={{ ...thStyle("_bar"), cursor: "default" }}>
                          Day Range
                        </th>
                        <th style={{ ...thStyle("_rm"), cursor: "default", textAlign: "right", paddingRight: 18 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item, i) => (
                        <StockRow
                          key={item.symbol}
                          item={item}
                          watchlistId={selectedId}
                          animDelay={i * 0.03}
                          onRemove={handleRemove}
                          onFavoriteToggle={handleFavToggle}
                          onNavigate={(sym) => navigate(`/company/${sym}`)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              {!loadingItems && visible.length > 0 && (
                <div style={{ padding: "12px 24px", borderTop: `1px solid ${BD}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontFamily: F, fontSize: 10, color: MUT }}>
                    Click any row to open stock detail page · ★ to favorite
                  </p>
                  <p style={{ margin: 0, fontFamily: F, fontSize: 10, color: MUT }}>
                    {items.filter(i => i.is_favorite).length} favorited · {items.length} total
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
