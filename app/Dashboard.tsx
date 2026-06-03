// app/Dashboard.tsx
"use client";
import { useState } from "react";
import { MessageSquare, Users, Calendar, Zap, TrendingUp, Sun, Moon } from "lucide-react";
import dynamic from "next/dynamic";

const ActivityChart = dynamic(() => import("./ActivityChart"), { ssr: false });

interface DashboardProps { data: any; }

function StatCard({ icon: Icon, label, value, sub, accent = false, isDark }: {
  icon: any; label: string; value: string | number; sub?: string; accent?: boolean; isDark: boolean;
}) {
  return (
    <div className={`flex flex-col gap-4 p-5 rounded-2xl border transition-colors duration-300 ${
      isDark
        ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
        : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
    }`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
          accent ? "bg-blue-500/10" : isDark ? "bg-white/[0.04]" : "bg-zinc-100"
        }`}>
          <Icon size={14} strokeWidth={2} className={accent ? "text-blue-400" : isDark ? "text-zinc-500" : "text-zinc-400"} />
        </div>
      </div>
      <div>
        <div className={`text-3xl font-semibold tracking-tight leading-none ${isDark ? "text-white" : "text-zinc-900"}`}>{value}</div>
        {sub && <div className={`text-xs mt-2 font-medium ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ data }: DashboardProps) {
  const [isDark, setIsDark] = useState(true);
  const s = data?.stats ?? {};
  const userStats: Array<{ sender: string; messageCount: number }> = s.userStats ?? [];
  const topCount = userStats[0]?.messageCount ?? 1;

  const fmt = (d: string) => {
    if (!d) return "—";
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const hourNum = parseInt(String(s.busiestHour ?? "0").split(":")[0]);
  const formatHour = (h: number) => h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
  const busiestTime = s.busiestHour ? `${s.busiestDay ?? ""} ${formatHour(hourNum)}`.trim() : "—";
  const hourlyData: number[] = s.hourlyStats?.length === 24 ? s.hourlyStats : Array(24).fill(0);

  // theme shorthands
  const mainBg    = isDark ? "bg-[#09090b]"  : "bg-[#fcfcfd]";
  const cardBg    = isDark ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]";
  const headText  = isDark ? "text-white"     : "text-zinc-900";
  const mutedText = isDark ? "text-zinc-500"  : "text-zinc-400";
  const subText   = isDark ? "text-zinc-600"  : "text-zinc-400";
  const pill      = isDark ? "bg-white/[0.04] border-white/5" : "bg-zinc-100 border-zinc-200";
  const divot     = isDark ? "bg-white/[0.04]" : "bg-zinc-100";
  const scrollbar = isDark ? "#27272a transparent" : "#e4e4e7 transparent";
  const toggleBg  = isDark
    ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-zinc-300"
    : "bg-white border-zinc-200 shadow-[0_2px_8px_rgb(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgb(0,0,0,0.08)] text-zinc-600";

  return (
    <div className={`min-h-screen ${mainBg} p-6 md:p-10 font-sans transition-colors duration-300`}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <span className={`text-xs font-medium uppercase tracking-widest ${mutedText}`}>VibeCheck Analytics</span>
          </div>
          <h1 className={`text-2xl font-semibold tracking-tight ${headText}`}>Chat Analysis</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className={`border rounded-xl px-4 py-2 ${pill}`}>
            <span className={`text-xs font-medium ${mutedText}`}>
              {fmt(s.firstMessage)}
              <span className={`mx-2 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>→</span>
              {fmt(s.lastMessage)}
            </span>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${toggleBg}`}
            aria-label="Toggle theme"
          >
            {isDark
              ? <Sun size={15} strokeWidth={2} />
              : <Moon size={15} strokeWidth={2} />
            }
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={MessageSquare} label="Total Messages"
          value={s.totalMessages?.toLocaleString("en-IN") ?? "—"}
          sub={s.avgPerUser ? `${Math.round(s.avgPerUser).toLocaleString()} avg per member` : undefined}
          accent isDark={isDark} />
        <StatCard icon={Users} label="Active Members"
          value={s.totalUsers ?? "—"} sub="unique senders" isDark={isDark} />
        <StatCard icon={Calendar} label="Days Active"
          value={s.daysActive ?? "—"}
          sub={s.totalMessages && s.daysActive ? `${Math.round(s.totalMessages / s.daysActive)} msgs / day` : undefined}
          isDark={isDark} />
        <StatCard icon={Zap} label="Peak Time"
          value={busiestTime} sub="highest activity window" isDark={isDark} />
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

        {/* Leaderboard */}
        <div className={`rounded-2xl border p-5 flex flex-col transition-colors duration-300 ${cardBg}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-sm font-semibold ${headText}`}>Leaderboard</h2>
              <p className={`text-xs mt-0.5 ${subText}`}>By message volume</p>
            </div>
            <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${pill}`}>
              <TrendingUp size={11} className="text-blue-400" />
              <span className={`text-xs font-medium ${mutedText}`}>{userStats.length}</span>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-4 pr-1"
            style={{ maxHeight: 420, scrollbarWidth: "thin", scrollbarColor: scrollbar }}>
            {userStats.slice(0, 50).map((u, i) => {
              const pct = Math.round((u.messageCount / topCount) * 100);
              return (
                <div key={u.sender} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-semibold w-5 text-center shrink-0 tabular-nums ${
                        i === 0 ? "text-blue-400" : isDark ? "text-zinc-600" : "text-zinc-400"
                      }`}>{i + 1}</span>
                      <span className={`text-sm font-medium truncate transition-colors ${
                        isDark ? "text-zinc-300 group-hover:text-white" : "text-zinc-600 group-hover:text-zinc-900"
                      }`}>{u.sender}</span>
                    </div>
                    <span className={`text-xs font-medium font-mono shrink-0 ml-2 tabular-nums ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {u.messageCount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.04]" : "bg-zinc-100"}`}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: i === 0
                          ? "linear-gradient(90deg,#3b82f6,#60a5fa)"
                          : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Chart */}
        <div className={`md:col-span-2 rounded-2xl border p-5 flex flex-col transition-colors duration-300 ${cardBg}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-sm font-semibold ${headText}`}>Activity by Hour</h2>
              <p className={`text-xs mt-0.5 ${subText}`}>Message frequency across the day</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className={`text-xs font-medium ${subText}`}>Peak hour</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />
                <span className={`text-xs font-medium ${subText}`}>Normal</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ActivityChart hourlyData={hourlyData} isDark={isDark} />
          </div>
        </div>

      </div>
    </div>
  );
}