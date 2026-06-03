import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";

interface ActivityChartProps {
  hourlyData: number[];
  isDark: boolean;
}

const formatHour = (h: number) => {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
};

export default function ActivityChart({ hourlyData, isDark }: ActivityChartProps) {
  const data = hourlyData.map((count, index) => ({
    hour: formatHour(index),
    count,
    index,
  }));

  // Find the absolute highest message count
  const maxCount = Math.max(...hourlyData);
  
  // Only show these times on the X-Axis so it doesn't look crowded
  const SHOW_TICKS = new Set([0, 6, 12, 18]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          axisLine={false}
          tickLine={false}
          tick={({ x, y, payload }: any) => {
            if (!SHOW_TICKS.has(payload.index)) return <g />;
            return (
              <text x={x} y={y + 16} textAnchor="middle" fill={isDark ? "#a1a1aa" : "#71717a"} className="text-xs font-medium">
                {payload.value}
              </text>
            );
          }}
        />
        <Tooltip
          cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
          content={({ active, payload }: any) => {
            if (active && payload && payload.length) {
              return (
                <div className={`p-3 rounded-xl border backdrop-blur-md ${
                  isDark 
                    ? "bg-[#121214]/90 border-white/10 text-white" 
                    : "bg-white/90 border-zinc-200 text-zinc-900 shadow-lg"
                }`}>
                  <p className={`text-xs font-medium mb-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {payload[0].payload.hour}
                  </p>
                  <p className="text-lg font-semibold">
                    {payload[0].value} messages
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              // Bulletproof color assignment: Solid blue for peak, transparent white/black for the rest
              fill={entry.count === maxCount && maxCount > 0 
                ? "#3b82f6" 
                : (isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)")
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}