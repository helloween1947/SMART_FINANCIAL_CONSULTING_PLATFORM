import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

export default function KPIChart({ data }) {

  const chartData = [
    {
      name: "Market Cap",
      value: data.avg_market_cap / 1000000000
    },
    {
      name: "Highest",
      value: data.highest_market_cap / 1000000000
    },
    {
      name: "Lowest",
      value: data.lowest_market_cap / 1000000000
    }
  ];

  return (
    <div
      style={{
        marginTop: 40,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 30
      }}
    >
      <h2
        style={{
          color: "#d4af37",
          marginBottom: 20,
          fontWeight: 400
        }}
      >
        Market Cap Analysis
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />

          <XAxis dataKey="name" stroke="#aaa" />

          <YAxis stroke="#aaa" />

          <Tooltip />

          <Bar
            dataKey="value"
            fill="#d4af37"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}