// app/ActivityChart.tsx
"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";

const LABELS = [
  "12 AM","1 AM","2 AM","3 AM","4 AM","5 AM",
  "6 AM","7 AM","8 AM","9 AM","10 AM","11 AM",
  "12 PM","1 PM","2 PM","3 PM","4 PM","5 PM",
  "6 PM","7 PM","8 PM","9 PM","10 PM","11 PM",
];

const SHOW_TICKS = new Set([0, 6, 12, 18]);

function CustomTooltip({ active, payload, isDark }: any) {
  if (!active || !payload?.length) return null;
  const { hour, count } = payload[0].payload;
  return (
    <div style={{
      background: isDark ? "rgba(18,18,20,0.9)" : "rgba(255,255,255,0.9)",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
      borderRadius: 14,
      padding: "10px 16px",
      backdropFilter: "blur(12px)",
      boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.08)",
    }}>
      <p style={{ color: isDark ? "#71717a" : "#a1a1aa", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{hour}</p>
      <p style={{ color: isDark ? "#ffffff" : "#09090b", fontSize: 20, fontWeight: 600, margin: "4px 0 0", letterSpacing: "-0.02em" }}>
        {count.toLocaleString("en-IN")}
        <span style={{ color: isDark ? "#52525b" : "#a1a1aa", fontSize: 12, fontWeight: 400, marginLeft: 4 }}>msgs</span>
      </p>
    </div>
  );
}

export default function ActivityChart({ hourlyData, isDark }: { hourlyData: number[]; isDark: boolean }) {
  const data = LABELS.map((hour, i) => ({ hour, count: hourlyData[i] ?? 0 }));
  const peak = Math.max(...data.map((d) => d.count));
  const axisColor = isDark ? "#a1a1aa" : "#71717a";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barCategoryGap="35%">
        <XAxis
          dataKey="hour"
          axisLine={false}
          tickLine={false}
          tick={({ x, y, payload }: any) => {
            if (!SHOW_TICKS.has(payload.index)) return <g />;
            return (
              <text x={x} y={y + 14} textAnchor="middle" fontSize={11} fill={axisColor} fontWeight={500} letterSpacing="0.05em">
                {payload.value}
              </text>
            );
          }}
        />
        <Tooltip
          content={(props: any) => <CustomTooltip {...props} isDark={isDark} />}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", radius: 6 }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.count === peak && peak > 0 ? "#3b82f6" : (isDark ? "#ffffff" : "#000000")}
              fillOpacity={entry.count === peak && peak > 0 ? 1 : 0.05}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}