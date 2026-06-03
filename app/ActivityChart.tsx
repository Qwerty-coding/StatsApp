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
  const bg = isDark ? "#111111" : "#ffffff";
  const border = isDark ? "#ffffff" : "#000000";
  const color = isDark ? "#ffffff" : "#000000";
  return (
    <div style={{
      background: bg,
      border: `3px solid ${border}`,
      boxShadow: `4px 4px 0px 0px ${border}`,
      padding: "8px 14px",
      borderRadius: 0,
    }}>
      <p style={{ color, fontSize: 11, fontWeight: 900, textTransform: "uppercase", margin: 0, letterSpacing: 1 }}>{hour}</p>
      <p style={{ color, fontSize: 22, fontWeight: 900, margin: "2px 0 0", fontFamily: "monospace" }}>
        {count.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

export default function ActivityChart({ hourlyData, isDark }: { hourlyData: number[]; isDark: boolean }) {
  const data = LABELS.map((hour, i) => ({ hour, count: hourlyData[i] ?? 0 }));
  const peak = Math.max(...data.map((d) => d.count));
  const axisColor = isDark ? "#ffffff" : "#000000";
  const barDefault = isDark ? "#ffffff" : "#000000";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%">
        <XAxis
          dataKey="hour"
          axisLine={{ stroke: axisColor, strokeWidth: 2 }}
          tickLine={false}
          tick={({ x, y, payload }: any) => {
            if (!SHOW_TICKS.has(payload.index)) return <g />;
            return (
              <text
                x={x} y={y + 14}
                textAnchor="middle"
                fontSize={11}
                fill={axisColor}
                fontWeight={900}
                style={{ textTransform: "uppercase", letterSpacing: 1 }}
              >
                {payload.value}
              </text>
            );
          }}
        />
        <Tooltip
          content={(props: any) => <CustomTooltip {...props} isDark={isDark} />}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
        />
        <Bar dataKey="count" radius={0}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.count === peak && peak > 0 ? "#ffc900" : barDefault} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}