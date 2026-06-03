// app/Dashboard.tsx
"use client";
import { useState } from "react";
import { MessageSquare, Users, Calendar, Zap } from "lucide-react";
import dynamic from "next/dynamic";

const ActivityChart = dynamic(() => import("./ActivityChart"), { ssr: false });

interface DashboardProps { data: any; }

const medals = ["#1", "#2", "#3"];

function StatCard({ icon: Icon, label, value, sub, bg }: {
  icon: any; label: string; value: string | number; sub?: string; bg: string;
}) {
  return (
    <div className={`${bg} border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-black">{label}</span>
        <Icon size={16} strokeWidth={2.5} className="text-black" />
      </div>
      <div className="text-4xl font-black text-black font-mono leading-none tracking-tight">{value}</div>
      {sub && <div className="text-xs font-bold uppercase text-black/60 tracking-wide">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ data }: DashboardProps) {
  const [isDark, setIsDark] = useState(false);
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

  // theme tokens
  const bg = isDark ? "bg-[#111111]" : "bg-[#fdfbf6]";
  const border = isDark ? "border-white" : "border-black";
  const shadow = isDark ? "shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]" : "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]";
  const cardBg = isDark ? "bg-[#1a1a1a]" : "bg-white";
  const text = isDark ? "text-white" : "text-black";
  const textMuted = isDark ? "text-white/50" : "text-black/50";
  const divider = isDark ? "border-white" : "border-black";
  const tagBg = isDark ? "bg-white text-black" : "bg-black text-white";
  const barBg = isDark ? "bg-white/10" : "bg-black/10";
  const barBorder = isDark ? "border-white/20" : "border-black/20";
  const barFill = isDark ? "bg-white border-r border-white" : "bg-black border-r border-black";
  const leaderItemBorder = isDark ? "border-2 border-white p-2" : "border-2 border-black p-2";
  const rankActive = isDark ? "bg-white text-black px-1" : "bg-black text-white px-1";
  const rankInactive = isDark ? "text-white/40" : "text-black/40";
  const hdrBg = isDark ? "bg-white text-black" : "bg-black text-white";
  const hdrMuted = isDark ? "text-black/50" : "text-white/50";
  const toggleBg = isDark ? "bg-[#ffc900] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "bg-black text-white border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]";

  return (
    <div className={`min-h-screen ${bg} p-6 md:p-10 font-sans transition-colors duration-150`}>

      {/* Header */}
      <div className={`mb-8 border-4 ${border} ${shadow} ${hdrBg} p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3`}>
        <div>
          <p className={`text-xs font-black uppercase tracking-widest ${hdrMuted} mb-1`}>VibeCheck ✦ Analysis</p>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none">
            Chat Analysis
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className={`text-sm font-bold uppercase tracking-wider ${hdrMuted}`}>
            {fmt(s.firstMessage)} → {fmt(s.lastMessage)}
          </p>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`border-4 ${toggleBg} px-4 py-2 text-xs font-black uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px]`}
          >
            {isDark ? "☀ GO LIGHT" : "☾ GO DARK"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={MessageSquare} label="Total Messages"
          value={s.totalMessages?.toLocaleString("en-IN") ?? "—"}
          sub={s.avgPerUser ? `~${Math.round(s.avgPerUser)} per member` : undefined}
          bg="bg-[#ff90e8]" />
        <StatCard icon={Users} label="Active Members"
          value={s.totalUsers ?? "—"} sub="unique senders" bg="bg-[#22c55e]" />
        <StatCard icon={Calendar} label="Days Active"
          value={s.daysActive ?? "—"}
          sub={s.totalMessages && s.daysActive ? `${Math.round(s.totalMessages / s.daysActive)} msgs/day` : undefined}
          bg="bg-[#ffc900]" />
        <StatCard icon={Zap} label="Busiest Time"
          value={busiestTime} sub="peak activity" bg="bg-[#c084fc]" />
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Leaderboard */}
        <div className={`border-4 ${border} ${shadow} ${cardBg} p-5 flex flex-col`}>
          <div className={`flex items-center justify-between mb-4 border-b-4 ${divider} pb-3`}>
            <h2 className={`text-sm font-black uppercase tracking-widest ${text}`}>Leaderboard</h2>
            <span className={`text-xs font-black px-2 py-0.5 uppercase ${tagBg}`}>{userStats.length} members</span>
          </div>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1"
            style={{ maxHeight: 420, scrollbarWidth: "thin" }}>
            {userStats.slice(0, 50).map((u, i) => {
              const pct = Math.round((u.messageCount / topCount) * 100);
              const barColors = ["bg-[#ff90e8]", "bg-[#ffc900]", "bg-[#c084fc]"];
              return (
                <div key={u.sender} className={leaderItemBorder}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-black shrink-0 w-6 text-center ${i < 3 ? rankActive : rankInactive}`}>
                        {i < 3 ? medals[i] : i + 1}
                      </span>
                      <span className={`text-sm font-black truncate uppercase tracking-wide ${text}`}>{u.sender}</span>
                    </div>
                    <span className={`text-xs font-black font-mono shrink-0 ${text}`}>
                      {u.messageCount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className={`h-2 w-full ${barBg} border ${barBorder}`}>
                    <div
                      className={`h-full ${i < 3 ? barColors[i] + " border-r border-black" : barFill}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Chart */}
        <div className={`md:col-span-2 border-4 ${border} ${shadow} ${cardBg} p-5 flex flex-col`}>
          <div className={`flex items-center justify-between mb-4 border-b-4 ${divider} pb-3`}>
            <h2 className={`text-sm font-black uppercase tracking-widest ${text}`}>Activity by Hour</h2>
            <span className="text-xs font-black bg-[#ffc900] border-2 border-black px-2 py-0.5 uppercase text-black">
              Peak highlighted
            </span>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ActivityChart hourlyData={hourlyData} isDark={isDark} />
          </div>
        </div>

      </div>
    </div>
  );
}