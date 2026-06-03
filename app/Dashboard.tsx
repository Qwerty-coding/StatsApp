"use client";

import { useState, useRef } from "react";
import { MessageSquare, Calendar, Activity, Sun, Moon, Download, Flame } from "lucide-react";
import ActivityChart from "./ActivityChart";
import { toPng } from "html-to-image";

interface DashboardProps {
  data: any;
}

const medals = ["🥇", "🥈", "🥉"];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  isDark,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  isDark: boolean;
}) {
  return (
    <div className={`p-6 rounded-2xl border flex flex-col gap-4 transition-all duration-200 ${
      isDark 
        ? 'bg-[#121214] border-white/5' 
        : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
    }`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          {label}
        </span>
        <Icon size={20} className="text-[#3b82f6]" />
      </div>
      <div>
        <div className={`text-4xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          {value}
        </div>
        {sub && <div className={`text-sm mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ data }: DashboardProps) {
  const [isDark, setIsDark] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const s = data?.stats ?? {};
  const userStats: Array<{ sender: string; messageCount: number }> = s.userStats ?? [];
  const topCount = userStats[0]?.messageCount ?? 1;

  const fmt = (d: string) => {
    if (!d) return "—";
    const date = new Date(d);
    return isNaN(date.getTime())
      ? d
      : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Peak Hour Formatting
  const hourNum = s.busiestHour != null ? parseInt(String(s.busiestHour).split(':')[0]) : null;
  const formatHour = (h: number) => h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
  
  const peakHourOnly = hourNum != null ? formatHour(hourNum) : "—";
  const peakSubtext = s.busiestDay ? `Usually on ${s.busiestDay}s` : "peak activity window";

  // Busiest Date Formatting
  const busiestDateFormatted = s.busiestDate ? fmt(s.busiestDate) : "—";
  const busiestDateSubtext = s.busiestDateCount ? `${s.busiestDateCount.toLocaleString("en-IN")} messages` : "peak daily volume";

  // Highlight Stats
  const topTalkerPct = s.totalMessages ? ((userStats[0]?.messageCount / s.totalMessages) * 100).toFixed(1) : "0.0";
  const topTalkerName = userStats[0]?.sender ?? "Someone";
  const bottomTalker = userStats.length > 1 ? userStats[userStats.length - 1] : null;

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, { backgroundColor: '#09090b', pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "vibecheck-export.png";
      a.click();
    } catch (error) {
      console.error("Failed to export image", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`min-h-screen p-6 md:p-10 font-sans transition-colors duration-200 ${isDark ? 'bg-[#09090b] text-white' : 'bg-[#fcfcfd] text-zinc-900'}`}>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Chat Analysis
          </h1>
          <p className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {fmt(s.firstMessage)} — {fmt(s.lastMessage)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm ${
              isExporting ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-[#3b82f6] text-white hover:bg-blue-600 hover:shadow-md'
            }`}
          >
            <Download size={18} />
            {isExporting ? "Exporting..." : "Export Wrapped"}
          </button>
          <button 
            onClick={() => setIsDark(!isDark)}
            className={`p-2.5 rounded-full border transition-all ${
              isDark 
                ? 'bg-[#121214] border-white/10 text-zinc-400 hover:text-white' 
                : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm'
            }`}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <StatCard
          icon={MessageSquare}
          label="Total Messages"
          value={s.totalMessages?.toLocaleString("en-IN") ?? "—"}
          sub={s.avgPerUser ? `~${Math.round(s.avgPerUser).toLocaleString()} per member` : undefined}
          isDark={isDark}
        />
        <StatCard
          icon={Flame}
          label="Busiest Date"
          value={busiestDateFormatted}
          sub={busiestDateSubtext}
          isDark={isDark}
        />
        <StatCard
          icon={Calendar}
          label="Longest Silence"
          value={s.longestSilence ?? "—"}
          sub="Max time without a text"
          isDark={isDark}
        />
        <StatCard
          icon={Activity}
          label="Peak Time"
          value={peakHourOnly}
          sub={peakSubtext}
          isDark={isDark}
        />
      </div>

      {/* Highlights Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? 'bg-[#121214] border-white/5' : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">Top Talker</span>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{topTalkerName}</span> dominated the chat with {userStats[0]?.messageCount?.toLocaleString("en-IN") ?? 0} messages ({topTalkerPct}% of all texts).
          </p>
        </div>
        
        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? 'bg-[#121214] border-white/5' : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">Pure Chaos</span>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            Your group's busiest day of the week was a <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{s.busiestDay ?? "—"}</span>. No one was going to sleep early that day.
          </p>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? 'bg-[#121214] border-white/5' : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">Response Time</span>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            Group average response time: <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{s.avgResponseTime ?? "—"}</span>. That's how long it takes to rescue a dying conversation.
          </p>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? 'bg-[#121214] border-white/5' : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">The Observer</span>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{bottomTalker ? bottomTalker.sender : "Nobody"}</span> was the quietest, sending only {bottomTalker ? bottomTalker.messageCount : 0} messages total. 
          </p>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className={`border rounded-2xl p-6 flex flex-col min-h-[400px] ${isDark ? 'bg-[#121214] border-white/5' : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Leaderboard</h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>By message volume</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
              {userStats.length} members
            </span>
          </div>

          <div className="overflow-y-auto flex-1 space-y-4 pr-2" style={{ maxHeight: 420 }}>
            {userStats.slice(0, 50).map((u, i) => {
              const pct = Math.round((u.messageCount / topCount) * 100);
              return (
                <div key={u.sender} className="group">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-sm font-medium w-5 text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {i < 3 ? medals[i] : i + 1}
                      </span>
                      <span className={`text-sm truncate font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>
                        {u.sender}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {u.messageCount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-zinc-100'}`}>
                    <div
                      className="h-full rounded-full bg-[#3b82f6]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className={`lg:col-span-2 border rounded-2xl p-6 flex flex-col min-h-[400px] ${isDark ? 'bg-[#121214] border-white/5' : 'bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Activity by Hour</h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Message frequency across the day</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Peak hour</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/20'}`}></span>
                <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Normal</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
            <ActivityChart hourlyData={s.hourlyStats ?? Array(24).fill(0)} isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Hidden Export Poster */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div 
          ref={exportRef} 
          className="w-[1080px] h-[1920px] bg-[#09090b] text-white flex flex-col justify-between font-sans relative overflow-hidden" 
          style={{ padding: '80px' }}
        >
          {/* Header */}
          <div className="mt-10">
            <h1 className="text-8xl font-black tracking-tighter mb-6 text-white uppercase">VIBECHECK</h1>
            <p className="text-4xl font-medium tracking-wide text-zinc-400">
              {fmt(s.firstMessage)} — {fmt(s.lastMessage)}
            </p>
          </div>

          {/* Big Stats Row */}
          <div className="grid grid-cols-2 gap-12 mt-16 mb-16">
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-12">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] block mb-6">Total Messages</span>
              <span className="text-[120px] leading-none font-black tracking-tighter text-white block">
                {s.totalMessages?.toLocaleString("en-IN") ?? "—"}
              </span>
            </div>
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-12">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] block mb-6">Busiest Date</span>
              <span className="text-[75px] leading-tight font-black tracking-tighter text-white block">
                {busiestDateFormatted}
              </span>
              <span className="text-2xl mt-4 font-medium text-zinc-400 block">{busiestDateSubtext}</span>
            </div>
          </div>

          {/* 2x2 Highlights Grid */}
          <div className="grid grid-cols-2 gap-12 flex-1">
            {/* Top Talker */}
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-12 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-10">Top Talker</span>
              <p className="text-5xl leading-[1.4] text-zinc-300 font-medium">
                <span className="font-bold text-white text-6xl">{topTalkerName}</span><br/><br/>
                Dominated the chat with <span className="text-[#3b82f6] font-bold">{userStats[0]?.messageCount?.toLocaleString("en-IN") ?? 0}</span> messages ({topTalkerPct}% of all texts).
              </p>
            </div>
            
            {/* Pure Chaos */}
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-12 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-10">Pure Chaos</span>
              <p className="text-5xl leading-[1.4] text-zinc-300 font-medium">
                Your group's busiest day of the week was a <span className="font-bold text-white text-6xl">{s.busiestDay ?? "—"}</span>.<br/><br/>
                No one was going to sleep early that day.
              </p>
            </div>
            
            {/* Response Time */}
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-12 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-10">Response Time</span>
              <p className="text-5xl leading-[1.4] text-zinc-300 font-medium">
                Group average response time:<br/><br/>
                <span className="font-bold text-white text-6xl">{s.avgResponseTime ?? "—"}</span>.<br/><br/>
                That's how long it takes to rescue a dying conversation.
              </p>
            </div>
            
            {/* The Observer */}
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-12 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-10">The Observer</span>
              <p className="text-5xl leading-[1.4] text-zinc-300 font-medium">
                <span className="font-bold text-white text-6xl">{bottomTalker ? bottomTalker.sender : "Nobody"}</span><br/><br/>
                was the quietest, sending only <span className="text-[#3b82f6] font-bold">{bottomTalker ? bottomTalker.messageCount : 0}</span> messages total.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pb-10 text-center">
            <p className="text-4xl font-bold tracking-widest uppercase text-zinc-600">
              Generated locally on VibeCheck
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}