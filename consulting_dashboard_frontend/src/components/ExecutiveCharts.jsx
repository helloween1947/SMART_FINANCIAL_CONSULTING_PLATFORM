import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const COLORS = ["#D4AF37", "#60A5FA", "#50DC78", "#E55050", "#F0B429", "#A78BFA", "#F472B6", "#38BDF8"];

/* ── Shared custom tooltip ── */
function ChartTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,12,18,0.95)",
      border: "1px solid rgba(212,175,55,0.2)",
      borderRadius: 10, padding: "10px 14px",
      fontFamily: "'Syne', sans-serif",
    }}>
      {label && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4, letterSpacing: "0.08em" }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ margin: 0, fontSize: 13, color: p.color ?? "#D4AF37", fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>
          {p.name && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginRight: 6 }}>{p.name}</span>}
          {fmt ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function fmtB(n) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Number(n).toLocaleString()}`;
}

/* ── Panel wrapper ── */
function ChartPanel({ title, children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 18, overflow: "hidden",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: -50, right: -50, width: 150, height: 150,
        borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)",
      }}/>
      <div style={{
        padding: "18px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <p style={{
          margin: 0, fontSize: 10, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.28)",
          fontFamily: "'Syne', sans-serif",
        }}>
          {title}
        </p>
      </div>
      <div style={{ padding: "20px 24px 24px" }}>
        {children}
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)",
      }}/>
    </div>
  );
}

export default function ExecutiveCharts({ companies }) {
  if (!Array.isArray(companies) || companies.length === 0) return null;

  /* Top 8 by market cap for readability */
  const sorted    = [...companies].sort((a, b) => Number(b.market_cap) - Number(a.market_cap));
  const top8      = sorted.slice(0, 8);

  const pieData = top8.map(c => ({
    name:  c.company_name,
    value: Number(c.market_cap) || 0,
  }));

  const barData = top8.map(c => ({
    name:   c.company_name?.length > 10 ? c.company_name.slice(0, 10) + "…" : c.company_name,
    cap:    Number(c.market_cap) || 0,
    debt:   Number(c.debt)       || 0,
    equity: Number(c.equity)     || 0,
  }));

  /* Custom pie label */
  const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
    if (percent < 0.04) return null;
    const rad = Math.PI / 180;
    const x = cx + (outerRadius + 18) * Math.cos(-midAngle * rad);
    const y = cy + (outerRadius + 18) * Math.sin(-midAngle * rad);
    return (
      <text x={x} y={y} fill="rgba(255,255,255,0.45)" textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central" style={{ fontSize: 10, fontFamily: "'Syne', sans-serif" }}>
        {name?.slice(0, 12)}{name?.length > 12 ? "…" : ""} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: 20, marginBottom: 30,
      animation: "fadeSlideUp 0.6s 0.25s ease both",
    }}>

      {/* ── Portfolio Allocation Pie ── */}
      <ChartPanel title="Portfolio Allocation — Market Cap">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData} dataKey="value"
              outerRadius={105} innerRadius={42}
              paddingAngle={2}
              labelLine={false}
              label={renderPieLabel}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(0,0,0,0.3)" strokeWidth={1}/>
              ))}
            </Pie>
            <RTooltip content={<ChartTooltip fmt={fmtB}/>}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>

      {/* ── Market Cap vs Debt Bar ── */}
      <ChartPanel title="Market Cap vs Debt — Top Companies">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} barCategoryGap="28%" barGap={3}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/>
            <XAxis
              dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'Syne', sans-serif" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => fmtB(v)}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "'Syne', sans-serif" }}
              axisLine={false} tickLine={false} width={58}
            />
            <RTooltip content={<ChartTooltip fmt={fmtB}/>}/>
            <Bar dataKey="cap"  name="Market Cap" fill="#D4AF37" radius={[4,4,0,0]} maxBarSize={28}/>
            <Bar dataKey="debt" name="Debt"       fill="#E55050" radius={[4,4,0,0]} maxBarSize={28} fillOpacity={0.7}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

    </div>
  );
}