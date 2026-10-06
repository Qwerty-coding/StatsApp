"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Donut chart color palette — cycles through named slices, last slot is "Others"
export const DONUT_COLORS = ["#3b82f6", "#a855f7", "#10b981", "#f97316", "#f43f5e", "#4b5563"];

interface LeaderboardProps {
  userStats: { sender: string; messageCount: number }[];
  totalMessages: number;
  isDark: boolean;
  view: "list" | "chart";
  /** Open the member dossier for a sender. */
  onSelectMember?: (sender: string) => void;
}

export default function Leaderboard({ userStats, totalMessages, isDark, view, onSelectMember }: LeaderboardProps) {
  if (view === "list") {
    return <LeaderboardList userStats={userStats} isDark={isDark} onSelectMember={onSelectMember} />;
  }
  return <LeaderboardChart userStats={userStats} totalMessages={totalMessages} isDark={isDark} />;
}

function LeaderboardList({
  userStats,
  isDark,
  onSelectMember,
}: {
  userStats: { sender: string; messageCount: number }[];
  isDark: boolean;
  onSelectMember?: (sender: string) => void;
}) {
  const topCount = userStats[0]?.messageCount ?? 1;

  return (
    <div className="overflow-y-auto space-y-4 pr-2" style={{ maxHeight: 420 }}>
      {userStats.slice(0, 50).map((u, i) => {
        const pct = Math.round((u.messageCount / topCount) * 100);
        return (
          <div
            key={u.sender}
            className={`group rounded-lg -mx-1 px-1 ${onSelectMember ? "cursor-pointer" : ""}`}
            onClick={() => onSelectMember?.(u.sender)}
            role={onSelectMember ? "button" : undefined}
            title={onSelectMember ? `Open ${u.sender}'s dossier` : undefined}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-sm font-medium w-5 text-center ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {i + 1}
                </span>
                <span className={`text-sm truncate font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                  {u.sender}
                </span>
              </div>
              <span className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {u.messageCount.toLocaleString("en-IN")}
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
              <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardChart({
  userStats,
  totalMessages,
  isDark,
}: {
  userStats: { sender: string; messageCount: number }[];
  totalMessages: number;
  isDark: boolean;
}) {
  // Donut chart data: top 5 individuals + aggregated "Others"
  const pieData = useMemo(() => {
    if (!userStats.length || !totalMessages) return [];
    const top5 = userStats.slice(0, 5).map((u) => ({
      name: u.sender,
      value: u.messageCount,
      pct: ((u.messageCount / totalMessages) * 100).toFixed(1),
    }));
    const rest = userStats.slice(5);
    if (rest.length > 0) {
      const othersTotal = rest.reduce((sum, u) => sum + u.messageCount, 0);
      top5.push({
        name: "Others",
        value: othersTotal,
        pct: ((othersTotal / totalMessages) * 100).toFixed(1),
      });
    }
    return top5;
  }, [userStats, totalMessages]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Donut chart */}
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={DONUT_COLORS[index] ?? DONUT_COLORS[DONUT_COLORS.length - 1]}
                />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: { name: string; value: number; pct: string }; fill?: string }> }) => {
                if (active && payload && payload.length && payload[0].payload) {
                  const item = payload[0].payload;
                  return (
                    <div className={`px-3 py-2 rounded-xl border text-xs backdrop-blur-md ${
                      isDark
                        ? "bg-[#121214]/90 border-white/10 text-white"
                        : "bg-white/90 border-zinc-200 text-zinc-900 shadow-lg"
                    }`}>
                      <p className={`font-semibold mb-0.5 truncate max-w-[160px] ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                        {item.name}
                      </p>
                      <p className={isDark ? "text-zinc-400" : "text-zinc-500"}>
                        {item.value.toLocaleString("en-IN")} messages
                        <span className="ml-1 font-semibold" style={{ color: payload[0].fill }}>
                          ({item.pct}%)
                        </span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 160 }}>
        {pieData.map((entry, index) => (
          <div key={entry.name} className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                style={{ background: DONUT_COLORS[index] ?? DONUT_COLORS[DONUT_COLORS.length - 1] }}
              />
              <span className={`text-xs truncate ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {entry.name}
              </span>
            </div>
            <span className={`text-xs font-semibold flex-shrink-0 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {entry.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
