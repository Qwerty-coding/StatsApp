import React, { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";

interface ActivityChartProps {
  hourlyData: number[];
  weeklyData: { name: string; value: number }[];
  monthlyData: { name: string; value: number }[]; // <-- Added prop
  isDark: boolean;
}

const formatHour = (h: number) => {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
};

const SHOW_TICKS = new Set([0, 6, 12, 18]);

export default function ActivityChart({ hourlyData, weeklyData, monthlyData, isDark }: ActivityChartProps) {
  // Upgraded toggle state to handle all 3 views
  const [viewMode, setViewMode] = useState<"hourly" | "weekly" | "monthly">("hourly");

  // Format the 3 data types
  const hourlyFormatted = hourlyData.map((count, index) => ({
    label: formatHour(index),
    count,
    index,
  }));

  const weeklyFormatted = weeklyData.map((d, index) => ({
    label: d.name,
    count: d.value,
    index,
  }));

  const monthlyFormatted = monthlyData.map((d, index) => ({
    label: d.name,
    count: d.value,
    index,
  }));

  // Map the active array based on toggle state
  const activeData = 
    viewMode === "hourly" ? hourlyFormatted : 
    viewMode === "weekly" ? weeklyFormatted : 
    monthlyFormatted;
    
  const maxCount = Math.max(...activeData.map(d => d.count), 0);

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Absolute Toggle Switch Container */}
      <div className="absolute -top-12 right-0 z-10 flex">
        <div className={`flex items-center rounded-full p-0.5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
          <button
            onClick={() => setViewMode("hourly")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
              viewMode === "hourly"
                ? isDark ? "bg-white/15 text-white" : "bg-white text-zinc-900 shadow-sm"
                : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            24 Hours
          </button>
          <button
            onClick={() => setViewMode("weekly")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
              viewMode === "weekly"
                ? isDark ? "bg-white/15 text-white" : "bg-white text-zinc-900 shadow-sm"
                : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Days
          </button>
          {/* New Months Button */}
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
              viewMode === "monthly"
                ? isDark ? "bg-white/15 text-white" : "bg-white text-zinc-900 shadow-sm"
                : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Months
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activeData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload }: any) => {
                if (viewMode === "hourly" && !SHOW_TICKS.has(payload.index)) return <g />;
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
                        {payload[0].payload.label}
                      </p>
                      <p className="text-lg font-semibold">
                        {payload[0].value.toLocaleString("en-IN")} messages
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {activeData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.count === maxCount && maxCount > 0 
                    ? "#3b82f6" 
                    : (isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)")
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}