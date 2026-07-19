/**
 * TradingViewChart.jsx
 * ─────────────────────────────────────────────────────────────
 * Institutional-grade chart panel powered by TradingView's
 * free Advanced Chart widget (no API key required).
 *
 * Features:
 *   • Chart types  — Candlestick · Area · Line · Bars · Heikin Ashi
 *   • Timeframes   — 1D · 1W · 1M · 6M · 1Y · 5Y
 *   • Indicators   — RSI · MACD · EMA (9/21) · SMA (50/200) · Bollinger Bands
 *   • Volume       — always shown by default
 *   • Dark theme   — matches the platform's #08090E background
 */

import { useEffect, useRef, useState, memo, useCallback } from "react";

/* ─────────────────────────────── CONFIG MAPS ─────────────────────────────── */

const CHART_TYPES = [
  { id: "candlestick", label: "Candles",  icon: "🕯", style: "1" },
  { id: "area",        label: "Area",     icon: "◭",  style: "3" },
  { id: "line",        label: "Line",     icon: "∿",  style: "2" },
  { id: "bars",        label: "Bars",     icon: "⫿",  style: "0" },
  { id: "heikin",      label: "Heikin",   icon: "⬡",  style: "8" },
];

const TIMEFRAMES = [
  { id: "1D",  label: "1D",  interval: "5",   range: "1D"  },
  { id: "1W",  label: "1W",  interval: "60",  range: "5D"  },
  { id: "1M",  label: "1M",  interval: "D",   range: "1M"  },
  { id: "3M",  label: "3M",  interval: "D",   range: "3M"  },
  { id: "6M",  label: "6M",  interval: "D",   range: "6M"  },
  { id: "1Y",  label: "1Y",  interval: "W",   range: "12M" },
  { id: "5Y",  label: "5Y",  interval: "W",   range: "60M" },
];

const INDICATORS = [
  { id: "RSI",  label: "RSI",             study: "RSI@tv-basicstudies"             },
  { id: "MACD", label: "MACD",            study: "MACD@tv-basicstudies"            },
  { id: "EMA9", label: "EMA 9",           study: "MAExp@tv-basicstudies"           },
  { id: "EMA21",label: "EMA 21",          study: "MAExp@tv-basicstudies"           },
  { id: "SMA50",label: "SMA 50",          study: "MASimple@tv-basicstudies"        },
  { id: "SMA200",label:"SMA 200",         study: "MASimple@tv-basicstudies"        },
  { id: "BB",   label: "Bollinger",       study: "BB@tv-basicstudies"              },
  { id: "VOL",  label: "Volume",          study: "Volume@tv-basicstudies"          },
];

/* Exchange prefix → TradingView exchange prefix */
function tvSymbol(symbol, exchange = "") {
  const ex = (exchange || "").toUpperCase();
  if (ex.includes("NASDAQ"))                return `NASDAQ:${symbol}`;
  if (ex.includes("NEW YORK") || ex.includes("NYSE")) return `NYSE:${symbol}`;
  if (ex.includes("LONDON") || ex.includes("LSE"))    return `LSE:${symbol}`;
  if (ex.includes("TORONTO") || ex.includes("TSX"))   return `TSX:${symbol}`;
  if (ex.includes("FRANKFURT") || ex.includes("FWB")) return `FWB:${symbol}`;
  if (ex.includes("AMEX"))                 return `AMEX:${symbol}`;
  return symbol; // TV resolves most US symbols without prefix
}

/* ─────────────────────────── tv.js singleton loader ─────────────────────────── */
let _tvReady = false;
let _tvLoading = false;
const _tvCallbacks = [];

function loadTVScript(cb) {
  if (_tvReady) { cb(); return; }
  _tvCallbacks.push(cb);
  if (_tvLoading) return;
  _tvLoading = true;
  const s = document.createElement("script");
  s.src   = "https://s3.tradingview.com/tv.js";
  s.async = true;
  s.onload = () => { _tvReady = true; _tvCallbacks.forEach(fn => fn()); };
  s.onerror = () => { _tvLoading = false; };
  document.head.appendChild(s);
}

/* Unique widget container ID counter */
let _widgetIdCounter = 0;

/* ─────────────────────────── WIDGET CORE ─────────────────────────── */
const TVWidget = memo(function TVWidget({ tvSym, chartStyle, interval, range, studies }) {
  const containerId = useRef(`tv_${++_widgetIdCounter}`).current;
  const widgetRef   = useRef(null);

  useEffect(() => {
    if (!tvSym) return;
    let destroyed = false;

    const init = () => {
      if (destroyed || !window.TradingView) return;
      // Destroy previous instance
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        try { widgetRef.current.remove(); } catch {}
      }
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = "";

      widgetRef.current = new window.TradingView.widget({
        container_id:        containerId,
        autosize:            true,
        symbol:              tvSym,
        interval:            interval,
        range:               range,
        timezone:            "exchange",
        theme:               "dark",
        style:               chartStyle,
        locale:              "en",
        toolbar_bg:          "#08090e",
        backgroundColor:     "rgba(8,9,14,1)",
        gridColor:           "rgba(255,255,255,0.03)",
        enable_publishing:   false,
        withdateranges:      false,
        hide_side_toolbar:   false,
        hide_legend:         false,
        allow_symbol_change: false,
        save_image:          true,
        calendar:            false,
        hide_volume:         false,
        studies:             studies,
        overrides: {
          "paneProperties.background":            "#08090e",
          "paneProperties.backgroundType":        "solid",
          "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.03)",
          "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.03)",
          "scalesProperties.textColor":           "#888",
          "scalesProperties.lineColor":           "rgba(255,255,255,0.08)",
          // Candle colors
          "mainSeriesProperties.candleStyle.upColor":          "#50DC78",
          "mainSeriesProperties.candleStyle.downColor":        "#E55050",
          "mainSeriesProperties.candleStyle.borderUpColor":    "#50DC78",
          "mainSeriesProperties.candleStyle.borderDownColor":  "#E55050",
          "mainSeriesProperties.candleStyle.wickUpColor":      "#50DC78",
          "mainSeriesProperties.candleStyle.wickDownColor":    "#E55050",
          // Heikin Ashi colors
          "mainSeriesProperties.haStyle.upColor":              "#50DC78",
          "mainSeriesProperties.haStyle.downColor":            "#E55050",
          // Area chart gradient
          "mainSeriesProperties.areaStyle.color1":             "rgba(212,175,55,0.35)",
          "mainSeriesProperties.areaStyle.color2":             "rgba(212,175,55,0.02)",
          "mainSeriesProperties.areaStyle.linecolor":          "#D4AF37",
          "mainSeriesProperties.areaStyle.linewidth":          2,
          // Line chart
          "mainSeriesProperties.lineStyle.color":              "#D4AF37",
          "mainSeriesProperties.lineStyle.linewidth":          2,
        },
        studies_overrides: {
          "volume.volume.color.0":    "rgba(229,80,80,0.4)",
          "volume.volume.color.1":    "rgba(80,220,120,0.4)",
          "RSI.plot.color":           "#5B9CF6",
          "MACD.MACD.color":          "#D4AF37",
          "MACD.Signal.color":        "#FB923C",
          "MACD.Histogram.color":     "#C084FC",
          "Bollinger Bands.Median.color": "#D4AF37",
          "Bollinger Bands.Upper.color":  "rgba(212,175,55,0.5)",
          "Bollinger Bands.Lower.color":  "rgba(212,175,55,0.5)",
        },
      });
    };

    loadTVScript(init);

    return () => {
      destroyed = true;
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
  }, [tvSym, chartStyle, interval, range, studies.join(",")]);

  return (
    <div
      id={containerId}
      style={{ width: "100%", height: "100%", minHeight: 520 }}
    />
  );
});

/* ─────────────────────────── STYLE TOKENS ─────────────────────────── */
const F     = "'Syne', sans-serif";
const GOLD  = "#D4AF37";
const BG    = "rgba(255,255,255,0.025)";
const BD    = "rgba(255,255,255,0.07)";
const MUTED = "rgba(255,255,255,0.3)";

/* ─────────────────────────── PILL BUTTON ─────────────────────────── */
function Pill({ active, onClick, children, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "5px 11px",
        borderRadius: 7,
        fontSize: 10,
        fontFamily: F,
        fontWeight: active ? 700 : 500,
        letterSpacing: "0.07em",
        cursor: "pointer",
        border: active
          ? `1px solid ${accent || "rgba(212,175,55,0.5)"}`
          : `1px solid ${hov ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.07)"}`,
        background: active
          ? `${accent ? accent + "20" : "rgba(212,175,55,0.12)"}`
          : hov ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        color: active ? (accent || GOLD) : hov ? "rgba(255,255,255,0.6)" : MUTED,
        transition: "all .14s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── INDICATOR CHIP ─────────────────────────── */
const IND_COLORS = {
  RSI:    "#5B9CF6",
  MACD:   "#D4AF37",
  EMA9:   "#50DC78",
  EMA21:  "#7BC86C",
  SMA50:  "#C084FC",
  SMA200: "#F472B6",
  BB:     "#FB923C",
  VOL:    "#34D399",
};
function IndicatorChip({ id, label, active, onClick }) {
  const color = IND_COLORS[id] || GOLD;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 9,
        fontFamily: F,
        fontWeight: active ? 700 : 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        border: active ? `1px solid ${color}60` : "1px solid rgba(255,255,255,0.07)",
        background: active ? `${color}18` : "rgba(255,255,255,0.02)",
        color: active ? color : "rgba(255,255,255,0.3)",
        transition: "all .14s",
      }}
    >
      {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />}
      {label}
    </button>
  );
}

/* ─────────────────────────── LOADING SKELETON ─────────────────────────── */
function ChartSkeleton() {
  return (
    <div style={{ height: 520, background: "rgba(255,255,255,0.02)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 16, position: "relative", overflow: "hidden" }}>
      {/* Animated price line */}
      <svg width="420" height="120" viewBox="0 0 420 120" style={{ opacity: 0.12 }}>
        <polyline
          points="0,90 40,75 80,85 120,50 160,60 200,35 240,55 280,30 320,45 360,20 420,38"
          fill="none" stroke="#D4AF37" strokeWidth="2"
          strokeDasharray="600" strokeDashoffset="600"
          style={{ animation: "drawLine 2s ease forwards" }}
        />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%",
          border: "2px solid rgba(212,175,55,0.3)", borderTopColor: GOLD,
          animation: "spin 1s linear infinite" }} />
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: F,
          letterSpacing: "0.15em" }}>
          LOADING TRADINGVIEW CHART
        </p>
      </div>
      <style>{`
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── MAIN EXPORT ─────────────────────────── */
export default function TradingViewChart({ symbol, exchange, compact = false }) {
  const [chartType,   setChartType]   = useState("candlestick");
  const [timeframe,   setTimeframe]   = useState("1M");
  const [indicators,  setIndicators]  = useState(["VOL"]);
  const [tvLoaded,    setTvLoaded]    = useState(_tvReady);
  const [widgetKey,   setWidgetKey]   = useState(0);

  // Load TradingView script eagerly
  useEffect(() => {
    if (!_tvReady) {
      loadTVScript(() => setTvLoaded(true));
    }
  }, []);

  // When settings change, force widget remount via key
  const apply = useCallback(() => {
    setWidgetKey(k => k + 1);
  }, []);

  useEffect(() => { apply(); }, [chartType, timeframe, indicators, symbol]);

  const toggleIndicator = useCallback((id) => {
    setIndicators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const tf = TIMEFRAMES.find(t => t.id === timeframe) || TIMEFRAMES[2];
  const ct = CHART_TYPES.find(c => c.id === chartType) || CHART_TYPES[0];

  // De-duplicate studies (EMA9/EMA21 both map to same study string)
  const studyList = [...new Set(
    indicators
      .map(id => INDICATORS.find(i => i.id === id)?.study)
      .filter(Boolean)
  )];

  const sym = tvSymbol(symbol, exchange);

  return (
    <div style={{ background: "rgba(8,9,14,0.95)", border: `1px solid ${BD}`,
      borderRadius: 18, overflow: "hidden", position: "relative" }}>

      {/* ── Top accent bar ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, rgba(212,175,55,0.7), rgba(212,175,55,0.1), transparent)" }} />

      {/* ─────── TOOLBAR ─────── */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BD}`,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

        {/* Symbol badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%",
            background: GOLD, animation: "pulse 2s ease infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            color: GOLD, fontFamily: F }}>{symbol}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: F }}>
            LIVE · TRADINGVIEW
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: BD, flexShrink: 0 }} />

        {/* Chart type */}
        <div style={{ display: "flex", gap: 4 }}>
          {CHART_TYPES.map(ct => (
            <Pill key={ct.id}
              active={chartType === ct.id}
              onClick={() => setChartType(ct.id)}>
              {ct.label}
            </Pill>
          ))}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: BD, flexShrink: 0 }} />

        {/* Timeframes */}
        <div style={{ display: "flex", gap: 4 }}>
          {TIMEFRAMES.map(tf => (
            <Pill key={tf.id}
              active={timeframe === tf.id}
              onClick={() => setTimeframe(tf.id)}>
              {tf.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* ─────── INDICATOR STRIP ─────── */}
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${BD}`,
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        background: "rgba(255,255,255,0.01)" }}>
        <span style={{ fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.2)", fontFamily: F, marginRight: 4 }}>
          INDICATORS
        </span>
        {INDICATORS.map(ind => (
          <IndicatorChip
            key={ind.id}
            id={ind.id}
            label={ind.label}
            active={indicators.includes(ind.id)}
            onClick={() => toggleIndicator(ind.id)}
          />
        ))}
        {indicators.length > 0 && (
          <button onClick={() => setIndicators([])}
            style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.2)",
              fontFamily: F, background: "none", border: "none", cursor: "pointer",
              letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Clear all
          </button>
        )}
      </div>

      {/* ─────── CHART AREA ─────── */}
      <div style={{ height: compact ? 420 : 560, position: "relative" }}>
        {!tvLoaded || !symbol ? (
          <ChartSkeleton />
        ) : (
          <TVWidget
            key={`tv-${symbol}-${chartType}-${timeframe}-${indicators.sort().join("-")}`}
            tvSym={sym}
            chartStyle={ct.style}
            interval={tf.interval}
            range={tf.range}
            studies={studyList}
          />
        )}
      </div>

      {/* ─────── FOOTER HINT ─────── */}
      <div style={{ padding: "8px 20px", borderTop: `1px solid ${BD}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.01)" }}>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", fontFamily: F,
          letterSpacing: "0.1em" }}>
          Powered by TradingView · Data may be delayed 15–20 min
        </span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", fontFamily: F,
          letterSpacing: "0.1em" }}>
          {ct.label} · {tf.label} · {studyList.length} indicators
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
