"use client";

import { useState, useRef, useMemo } from "react";
import { MessageSquare, Calendar, Activity, Sun, Moon, Download, Flame, ChevronDown } from "lucide-react";
import ActivityChart from "./ActivityChart";
import { toPng } from "html-to-image";

interface Message {
  timestamp: number;
  sender: string;
  text: string;
  isMedia: boolean;
  isSystem: boolean;
}

interface DashboardProps {
  data: {
    messages: Message[];
    stats?: any;
    format?: string;
    warnings?: string[];
  };
}

const medals = ["🥇", "🥈", "🥉"];

function calculateStats(messages: Message[]) {
  if (!messages || messages.length === 0) return {};

  const userCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {};
  const dateCounts: Record<string, number> = {};
  const hourlyStats = Array(24).fill(0);
  const validMessages: Message[] = [];

  for (const msg of messages) {
    if (msg.isSystem) continue;
    validMessages.push(msg);

    const sender = msg.sender;
    userCounts[sender] = (userCounts[sender] || 0) + 1;

    const date = new Date(msg.timestamp);
    if (!isNaN(date.getTime())) {
      const day = date.toLocaleDateString("en-US", { weekday: "long" });
      const hour = date.getHours();
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
      dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
      hourlyStats[hour]++;
    }
  }

  if (validMessages.length === 0) return {};

  validMessages.sort((a, b) => a.timestamp - b.timestamp);

  let maxGapMs = 0;
  let totalGapMs = 0;
  let gapCount = 0;

  for (let i = 1; i < validMessages.length; i++) {
    const gap = validMessages[i].timestamp - validMessages[i - 1].timestamp;
    if (gap > maxGapMs) maxGapMs = gap;
    totalGapMs += gap;
    gapCount++;
  }

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours > 24) return `${Math.round(hours / 24)} Days`;
    return hours < 1 ? `${Math.round(hours * 60)} Mins` : `${hours.toFixed(1)} Hours`;
  };

  const longestSilence = maxGapMs > 0 ? formatDuration(maxGapMs) : "—";
  const avgResponseTime = gapCount > 0 ? formatDuration(totalGapMs / gapCount) : "—";

  let busiestDay = "";
  let maxDayCount = 0;
  for (const [day, count] of Object.entries(dayCounts)) {
    if (count > maxDayCount) { maxDayCount = count; busiestDay = day; }
  }

  let busiestDate = "";
  let busiestDateCount = 0;
  for (const [dateKey, count] of Object.entries(dateCounts)) {
    if (count > busiestDateCount) { busiestDateCount = count; busiestDate = dateKey; }
  }

  let busiestHour = 0;
  let maxHourCount = 0;
  for (let i = 0; i < 24; i++) {
    if (hourlyStats[i] > maxHourCount) { maxHourCount = hourlyStats[i]; busiestHour = i; }
  }

  const userStats = Object.entries(userCounts)
    .map(([sender, count]) => ({ sender, messageCount: count }))
    .sort((a, b) => b.messageCount - a.messageCount);

  const totalMessages = validMessages.length;
  const totalUsers = userStats.length;

  return {
    totalMessages,
    totalUsers,
    avgPerUser: totalUsers > 0 ? totalMessages / totalUsers : 0,
    firstMessage: validMessages[0].timestamp,
    lastMessage: validMessages[validMessages.length - 1].timestamp,
    busiestDay,
    busiestHour,
    busiestDate,
    busiestDateCount,
    hourlyStats,
    userStats,
    longestSilence,
    avgResponseTime,
  };
}

function StatCard({
  icon: Icon, label, value, sub, isDark,
}: {
  icon: any; label: string; value: string | number; sub?: string; isDark: boolean;
}) {
  return (
    <div className={`p-6 rounded-2xl border flex flex-col gap-4 transition-all duration-200 ${
      isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    }`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {label}
        </span>
        <Icon size={20} className="text-[#3b82f6]" />
      </div>
      <div>
        <div className={`text-4xl font-semibold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
          {value}
        </div>
        {sub && <div className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ data }: DashboardProps) {
  const [isDark, setIsDark] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [timeFilter, setTimeFilter] = useState("all");
  const exportRef = useRef<HTMLDivElement>(null);

  const allMessages: Message[] = data?.messages ?? [];

  // Build filter options from all messages
  const filterOptions = useMemo(() => {
    const yearSet = new Set<string>();
    const monthMap = new Map<string, { label: string; sortKey: string }>();

    for (const msg of allMessages) {
      if (msg.isSystem) continue;
      const d = new Date(msg.timestamp);
      if (isNaN(d.getTime())) continue;
      const year = String(d.getFullYear());
      yearSet.add(year);
      const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
          sortKey: monthKey,
        });
      }
    }

    const years = Array.from(yearSet).sort();
    const months = Array.from(monthMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return { years, months };
  }, [allMessages]);

  // Filter messages based on selected timeFilter
  const filteredMessages = useMemo(() => {
    if (timeFilter === "all") return allMessages;

    return allMessages.filter((msg) => {
      if (msg.isSystem) return false;
      const d = new Date(msg.timestamp);
      if (isNaN(d.getTime())) return false;

      if (timeFilter.length === 4) {
        // Year filter e.g. "2024"
        return String(d.getFullYear()) === timeFilter;
      } else {
        // Month filter e.g. "2024-11"
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return monthKey === timeFilter;
      }
    });
  }, [allMessages, timeFilter]);

  // Recalculate stats from filtered messages
  const s: any = useMemo(() => calculateStats(filteredMessages), [filteredMessages]);

  const userStats: Array<{ sender: string; messageCount: number }> = s.userStats ?? [];
  const topCount = userStats[0]?.messageCount ?? 1;

  const fmt = (d: string | number) => {
    if (!d) return "—";
    const date = new Date(d);
    return isNaN(date.getTime())
      ? String(d)
      : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const hourNum = s.busiestHour != null ? parseInt(String(s.busiestHour).split(":")[0]) : null;
  const formatHour = (h: number) =>
    h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;

  const peakHourOnly = hourNum != null ? formatHour(hourNum) : "—";
  const peakSubtext = s.busiestDay ? `Usually on ${s.busiestDay}s` : "peak activity window";

  const busiestDateFormatted = s.busiestDate ? fmt(s.busiestDate) : "—";
  const busiestDateSubtext = s.busiestDateCount
    ? `${s.busiestDateCount.toLocaleString("en-IN")} messages`
    : "peak daily volume";

  const topTalkerPct = s.totalMessages
    ? ((userStats[0]?.messageCount / s.totalMessages) * 100).toFixed(1)
    : "0.0";
  const topTalkerName = userStats[0]?.sender ?? "Someone";
  const bottomTalker = userStats.length > 1 ? userStats[userStats.length - 1] : null;

  // Poster date range label
  const posterDateLabel = useMemo(() => {
    if (timeFilter === "all") {
      return `${fmt(s.firstMessage)} — ${fmt(s.lastMessage)}`;
    }
    if (timeFilter.length === 4) return `${timeFilter} Wrapped`;
    // Month filter: find the label
    const match = filterOptions.months.find((m) => m.sortKey === timeFilter);
    return match ? `${match.label} Wrapped` : `${timeFilter} Wrapped`;
  }, [timeFilter, s.firstMessage, s.lastMessage, filterOptions.months]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, { backgroundColor: "#09090b", pixelRatio: 2 });
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
    <div className={`min-h-screen p-6 md:p-10 font-sans transition-colors duration-200 ${
      isDark ? "bg-[#09090b] text-white" : "bg-[#fcfcfd] text-zinc-900"
    }`}>

      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>
            Chat Analysis
          </h1>
          <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            {fmt(s.firstMessage)} — {fmt(s.lastMessage)}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Time Slicer Dropdown */}
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className={`appearance-none pl-4 pr-9 py-2.5 rounded-full text-sm font-semibold border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40 ${
                isDark
                  ? "bg-[#121214] border-white/10 text-zinc-200 hover:border-white/20"
                  : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 shadow-sm"
              }`}
            >
              <option value="all">All-Time</option>
              {filterOptions.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
              {filterOptions.months.map((m) => (
                <option key={m.sortKey} value={m.sortKey}>{m.label}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            />
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm ${
              isExporting
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-[#3b82f6] text-white hover:bg-blue-600 hover:shadow-md"
            }`}
          >
            <Download size={18} />
            {isExporting ? "Exporting..." : "Export Wrapped"}
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2.5 rounded-full border transition-all ${
              isDark
                ? "bg-[#121214] border-white/10 text-zinc-400 hover:text-white"
                : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm"
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
        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">Top Talker</span>
          <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
            <span className={`font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{topTalkerName}</span>{" "}
            dominated the chat with {userStats[0]?.messageCount?.toLocaleString("en-IN") ?? 0} messages ({topTalkerPct}% of all texts).
          </p>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">Pure Chaos</span>
          <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
            Your group's busiest day of the week was a{" "}
            <span className={`font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{s.busiestDay ?? "—"}</span>. No one was going to sleep early that day.
          </p>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">Response Time</span>
          <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
            Group average response time:{" "}
            <span className={`font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{s.avgResponseTime ?? "—"}</span>. That's how long it takes to rescue a dying conversation.
          </p>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-center ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
          <span className="text-xs font-bold tracking-wider uppercase mb-2 text-[#3b82f6]">The Observer</span>
          <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
            <span className={`font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {bottomTalker ? bottomTalker.sender : "Nobody"}
            </span>{" "}
            was the quietest, sending only {bottomTalker ? bottomTalker.messageCount.toLocaleString("en-IN") : 0}{" "}
            {bottomTalker && bottomTalker.messageCount === 1 ? "message" : "messages"} total.
          </p>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className={`border rounded-2xl p-6 flex flex-col min-h-[400px] ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Leaderboard</h2>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>By message volume</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDark ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700"}`}>
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
                      <span className={`text-sm font-medium w-5 text-center ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {i < 3 ? medals[i] : i + 1}
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
        </div>

        {/* Activity Chart */}
        <div className={`lg:col-span-2 border rounded-2xl p-6 flex flex-col min-h-[400px] ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Activity by Hour</h2>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Message frequency across the day</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Peak hour</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isDark ? "bg-white/20" : "bg-black/20"}`}></span>
                <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Normal</span>
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
          className="w-[1080px] h-[1920px] bg-[#09090b] text-white flex flex-col font-sans relative"
          style={{ padding: "60px" }}
        >
          <div className="mt-4">
            <h1 className="text-8xl font-black tracking-tighter mb-4 text-white uppercase">VIBECHECK</h1>
            <p className="text-4xl font-medium tracking-wide text-zinc-400">{posterDateLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 my-10">
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-10">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] block mb-4">Total Messages</span>
              <span className="text-[110px] leading-none font-black tracking-tighter text-white block">
                {s.totalMessages?.toLocaleString("en-IN") ?? "—"}
              </span>
            </div>
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-10">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] block mb-4">Busiest Date</span>
              <span className="text-[65px] leading-tight font-black tracking-tighter text-white block">
                {busiestDateFormatted}
              </span>
              <span className="text-2xl mt-3 font-medium text-zinc-400 block">{busiestDateSubtext}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 flex-1">
            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-10 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-8">Top Talker</span>
              <p className="text-[42px] leading-[1.4] text-zinc-300 font-medium">
                <span className="font-bold text-white text-[56px]">{topTalkerName}</span><br /><br />
                Dominated the chat with{" "}
                <span className="text-[#3b82f6] font-bold">{userStats[0]?.messageCount?.toLocaleString("en-IN") ?? 0}</span>{" "}
                messages ({topTalkerPct}% of all texts).
              </p>
            </div>

            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-10 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-8">Pure Chaos</span>
              <p className="text-[42px] leading-[1.4] text-zinc-300 font-medium">
                Your group's busiest day of the week was a{" "}
                <span className="font-bold text-white text-[56px]">{s.busiestDay ?? "—"}</span>.<br /><br />
                No one was going to sleep early that day.
              </p>
            </div>

            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-10 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-8">Response Time</span>
              <p className="text-[42px] leading-[1.4] text-zinc-300 font-medium">
                Group average response time:<br /><br />
                <span className="font-bold text-white text-[56px]">{s.avgResponseTime ?? "—"}</span>.<br /><br />
                That's how long it takes to rescue a dying conversation.
              </p>
            </div>

            <div className="bg-[#121214] border border-white/10 rounded-[40px] p-10 flex flex-col justify-center">
              <span className="text-3xl font-bold tracking-widest uppercase text-[#3b82f6] mb-8">The Observer</span>
              <p className="text-[42px] leading-[1.4] text-zinc-300 font-medium">
                <span className="font-bold text-white text-[56px]">{bottomTalker ? bottomTalker.sender : "Nobody"}</span><br /><br />
                was the quietest, sending only{" "}
                <span className="text-[#3b82f6] font-bold">{bottomTalker ? bottomTalker.messageCount : 0}</span>{" "}
                {bottomTalker && bottomTalker.messageCount === 1 ? "message" : "messages"} total.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-8 pb-4 text-center">
            <p className="text-[32px] font-bold tracking-widest uppercase text-zinc-600">
              Generated locally on VibeCheck
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}