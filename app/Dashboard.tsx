"use client";

import { useState, useRef, useMemo } from "react";
import { MessageSquare, Activity, Sun, Moon, Download, Flame, ChevronDown, Zap } from "lucide-react";
import ActivityChart from "./ActivityChart";
import { toPng } from "html-to-image";
import WordCloud from "../components/WordCloud";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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

  const icebreakerCounts: Record<string, number> = {};
  const SIX_HOURS = 21_600_000;

  const monologuerStreaks: Record<string, number> = {};
  let currentStreak = 1;
  let currentSender = validMessages[0]?.sender ?? "";

  // Speed Demon
  const userGaps: Record<string, { totalMs: number; count: number }> = {};

  // Dynamic Duo
  const interactionCounts: Record<string, number> = {};

  // Left on Read
  const leftOnReadCounts: Record<string, number> = {};

  for (let i = 1; i < validMessages.length; i++) {
    const gap = validMessages[i].timestamp - validMessages[i - 1].timestamp;
    const currentMsgSender = validMessages[i].sender;
    const prevMsgSender = validMessages[i - 1].sender;

    if (gap > maxGapMs) maxGapMs = gap;
    totalGapMs += gap;
    gapCount++;

    // Icebreaker
    if (gap > SIX_HOURS) {
      icebreakerCounts[currentMsgSender] = (icebreakerCounts[currentMsgSender] || 0) + 1;
    }

    // Monologuer
    if (currentMsgSender === currentSender) {
      currentStreak++;
    } else {
      const prev = validMessages[i - 1].sender;
      if (!monologuerStreaks[prev] || currentStreak > monologuerStreaks[prev]) {
        monologuerStreaks[prev] = currentStreak;
      }
      currentStreak = 1;
      currentSender = currentMsgSender;
    }

    // Speed Demon: Only track cross-person replies under 1 hour
    if (currentMsgSender !== prevMsgSender && gap < 3_600_000) {
      if (!userGaps[currentMsgSender]) {
        userGaps[currentMsgSender] = { totalMs: 0, count: 0 };
      }
      userGaps[currentMsgSender].totalMs += gap;
      userGaps[currentMsgSender].count += 1;
    }

    // Dynamic Duo: cross-person reply under 5 minutes
    if (currentMsgSender !== prevMsgSender && gap < 300_000) {
      const pairKey = [currentMsgSender, prevMsgSender].sort().join(" ⇄ ");
      interactionCounts[pairKey] = (interactionCounts[pairKey] || 0) + 1;
    }

    // Left on Read: message followed by more than 2 hours of silence
    if (gap > 7_200_000) {
      leftOnReadCounts[prevMsgSender] = (leftOnReadCounts[prevMsgSender] || 0) + 1;
    }
  }

  if (currentSender && (!monologuerStreaks[currentSender] || currentStreak > monologuerStreaks[currentSender])) {
    monologuerStreaks[currentSender] = currentStreak;
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

  const userStats = Object.entries(userCounts)
    .map(([sender, count]) => ({ sender, messageCount: count }))
    .sort((a, b) => b.messageCount - a.messageCount);

  let icebreakerName = "";
  let icebreakerCount = 0;
  for (const [sender, count] of Object.entries(icebreakerCounts)) {
    if (count > icebreakerCount) { icebreakerCount = count; icebreakerName = sender; }
  }

  let monologuerName = "";
  let monologuerStreak = 0;
  for (const [sender, streak] of Object.entries(monologuerStreaks)) {
    if (streak > monologuerStreak) { monologuerStreak = streak; monologuerName = sender; }
  }

  // Speed Demon: Lowest average reply gap (minimum 5 qualifying replies)
  let speedDemonName = "Nobody";
  let speedDemonMinAvg = Infinity;
  for (const [sender, data] of Object.entries(userGaps)) {
    if (data.count >= 5) {
      const avg = data.totalMs / data.count;
      if (avg < speedDemonMinAvg) {
        speedDemonMinAvg = avg;
        speedDemonName = sender;
      }
    }
  }
  const speedDemonFormatted = speedDemonMinAvg !== Infinity ? formatDuration(speedDemonMinAvg) : "—";

  // Dynamic Duo: pair with most fast back-and-forth exchanges
  let dynamicDuoPair = "";
  let maxInteractions = 0;
  for (const [pair, count] of Object.entries(interactionCounts)) {
    if (count > maxInteractions) { maxInteractions = count; dynamicDuoPair = pair; }
  }

  // Left on Read: person whose messages most often precede long silences
  let leftOnReadName = "";
  let maxLeftOnRead = 0;
  for (const [sender, count] of Object.entries(leftOnReadCounts)) {
    if (count > maxLeftOnRead) { maxLeftOnRead = count; leftOnReadName = sender; }
  }

  const totalMessages = validMessages.length;
  const totalUsers = userStats.length;

  
  return {
    totalMessages,
    totalUsers,
    avgPerUser: totalUsers > 0 ? totalMessages / totalUsers : 0,
    firstMessage: validMessages[0].timestamp,
    lastMessage: validMessages[validMessages.length - 1].timestamp,
    busiestDay,
    busiestDate,
    busiestDateCount,
    hourlyStats,
    userStats,
    longestSilence,
    avgResponseTime,
    icebreakerName,
    icebreakerCount,
    monologuerName,
    monologuerStreak,
    speedDemonName,
    speedDemonFormatted,
    dynamicDuoPair,
    maxInteractions,
    leftOnReadName,
    maxLeftOnRead,
    
  };
}

// Donut chart color palette — cycles through named slices, last slot is "Others"
const DONUT_COLORS = ["#3b82f6", "#a855f7", "#10b981", "#f97316", "#f43f5e", "#4b5563"];
const WORD_COLORS = ["text-blue-400", "text-purple-400", "text-emerald-400", "text-orange-400", "text-pink-400", "text-cyan-400", "text-indigo-400"];
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

function AchievementCard({
  title, name, stat, statLabel, flavor, isDark, accentColor = "#3b82f6",
}: {
  title: string;
  name: string;
  stat: string | number;
  statLabel: string;
  flavor: string;
  isDark: boolean;
  accentColor?: string;
}) {
  return (
    <div className={`relative overflow-hidden p-6 rounded-2xl border flex flex-col gap-3 transition-all duration-200 ${
      isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    }`}>
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ background: accentColor }}
      />
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accentColor }}>
          {title}
        </span>
      </div>
      <div className={`text-xl font-bold truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
        {name || "—"}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black tracking-tight" style={{ color: accentColor }}>
          {stat}
        </span>
        <span className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {statLabel}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {flavor}
      </p>
    </div>
  );
}

export default function Dashboard({ data }: DashboardProps) {
  const [isDark, setIsDark] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [timeFilter, setTimeFilter] = useState("all");
  const [leaderboardView, setLeaderboardView] = useState<"list" | "chart">("list");
  const exportRef = useRef<HTMLDivElement>(null);

  const allMessages: Message[] = data?.messages ?? [];

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

  const filteredMessages = useMemo(() => {
    if (timeFilter === "all") return allMessages;
    return allMessages.filter((msg) => {
      if (msg.isSystem) return false;
      const d = new Date(msg.timestamp);
      if (isNaN(d.getTime())) return false;
      if (timeFilter.length === 4) return String(d.getFullYear()) === timeFilter;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return monthKey === timeFilter;
    });
  }, [allMessages, timeFilter]);

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

  const topTalkerPct = s.totalMessages
    ? ((userStats[0]?.messageCount / s.totalMessages) * 100).toFixed(1)
    : "0.0";
  const bottomTalker = userStats.length > 1 ? userStats[userStats.length - 1] : null;

  const posterDateLabel = useMemo(() => {
    if (timeFilter === "all") return `${fmt(s.firstMessage)} — ${fmt(s.lastMessage)}`;
    if (timeFilter.length === 4) return `${timeFilter} Wrapped`;
    const match = filterOptions.months.find((m) => m.sortKey === timeFilter);
    return match ? `${match.label} Wrapped` : `${timeFilter} Wrapped`;
  }, [timeFilter, s.firstMessage, s.lastMessage, filterOptions.months]);

  // Donut chart data: top 5 individuals + aggregated "Others"
  const pieData = useMemo(() => {
    if (!userStats.length || !s.totalMessages) return [];
    const top5 = userStats.slice(0, 5).map((u) => ({
      name: u.sender,
      value: u.messageCount,
      pct: ((u.messageCount / s.totalMessages) * 100).toFixed(1),
    }));
    const rest = userStats.slice(5);
    if (rest.length > 0) {
      const othersTotal = rest.reduce((sum, u) => sum + u.messageCount, 0);
      top5.push({
        name: "Others",
        value: othersTotal,
        pct: ((othersTotal / s.totalMessages) * 100).toFixed(1),
      });
    }
    return top5;
  }, [userStats, s.totalMessages]);

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

      {/* Top Stat Cards */}
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
          value={s.busiestDate ? fmt(s.busiestDate) : "—"}
          sub={s.busiestDateCount ? `${s.busiestDateCount.toLocaleString("en-IN")} messages` : undefined}
          isDark={isDark}
        />
        <StatCard
          icon={Zap}
          label="Speed Demon"
          value={s.speedDemonName && s.speedDemonName !== "Nobody" ? s.speedDemonName : "—"}
          sub={s.speedDemonFormatted !== "—" ? `Fastest avg response: ${s.speedDemonFormatted}` : "No match"}
          isDark={isDark}
        />
        <StatCard
          icon={Activity}
          label="Avg Response Time"
          value={s.avgResponseTime ?? "—"}
          sub="Average gap between messages"
          isDark={isDark}
        />
      </div>

      {/* Leaderboard + Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

        {/* Leaderboard card */}
        <div className={`border rounded-2xl p-6 flex flex-col min-h-[400px] ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>

          {/* Card header: title + member badge + view toggle */}
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Leaderboard</h2>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>By message volume</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Member count badge */}
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDark ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                {userStats.length} members
              </span>
              {/* View toggle */}
              <div className={`flex items-center rounded-full p-0.5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
                <button
                  onClick={() => setLeaderboardView("list")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                    leaderboardView === "list"
                      ? isDark
                        ? "bg-white/15 text-white"
                        : "bg-white text-zinc-900 shadow-sm"
                      : isDark
                        ? "text-zinc-500 hover:text-zinc-300"
                        : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setLeaderboardView("chart")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                    leaderboardView === "chart"
                      ? isDark
                        ? "bg-white/15 text-white"
                        : "bg-white text-zinc-900 shadow-sm"
                      : isDark
                        ? "text-zinc-500 hover:text-zinc-300"
                        : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Chart
                </button>
              </div>
            </div>
          </div>

          {/* List view */}
          {leaderboardView === "list" && (
            <div className="overflow-y-auto space-y-4 pr-2" style={{ maxHeight: 420 }}>
              {userStats.slice(0, 50).map((u, i) => {
                const pct = Math.round((u.messageCount / topCount) * 100);
                return (
                  <div key={u.sender} className="group">
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
          )}

          {/* Chart view */}
          {leaderboardView === "chart" && (
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
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
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
          )}
        </div>

        {/* Activity Chart card */}
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
          <div className="w-full h-[320px] mt-2">
            <ActivityChart hourlyData={s.hourlyStats ?? Array(24).fill(0)} isDark={isDark} />
          </div>
        </div>
      </div>
      

      {/* ── SECTION: WORD CLOUD ── */}
      <div className="mb-10">
        <WordCloud messages={filteredMessages} isDark={isDark} maxWords={50} />
      </div>


      {/* Hall of Fame — 3×2 grid */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
          Hall of Fame
        </h2>
        <div className={`h-px flex-1 ${isDark ? "bg-white/5" : "bg-zinc-200"}`} />
      </div>
      <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Lifetime achievements, unlocked by data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6 mb-10">
        {/* Row 1 */}
        <AchievementCard
          title="Top Talker"
          name={userStats[0]?.sender ?? "—"}
          stat={userStats[0]?.messageCount?.toLocaleString("en-IN") ?? 0}
          statLabel="messages sent"
          flavor={`That's ${topTalkerPct}% of everything ever said in this chat. Absolutely unhinged.`}
          isDark={isDark}
          accentColor="#3b82f6"
        />
        <AchievementCard
          title="The Observer"
          name={bottomTalker?.sender ?? "—"}
          stat={bottomTalker?.messageCount?.toLocaleString("en-IN") ?? 0}
          statLabel={`message${bottomTalker?.messageCount === 1 ? "" : "s"} total`}
          flavor="Lurking in the shadows. Watching. Never texting back. A legend of restraint."
          isDark={isDark}
          accentColor="#a855f7"
        />

        {/* Row 2 */}
        <AchievementCard
          title="The Icebreaker"
          name={s.icebreakerName ?? "—"}
          stat={s.icebreakerCount ?? 0}
          statLabel="revivals"
          flavor="Swooped in to rescue the chat after 6+ hours of dead silence. The unsung hero."
          isDark={isDark}
          accentColor="#f97316"
        />
        <AchievementCard
          title="The Monologuer"
          name={s.monologuerName ?? "—"}
          stat={s.monologuerStreak ?? 0}
          statLabel="in a row"
          flavor="Double-texting champion. Triple. Quadruple. Nobody replied but they kept going."
          isDark={isDark}
          accentColor="#10b981"
        />

        {/* Row 3 */}
        <AchievementCard
          title="Dynamic Duo"
          name={s.dynamicDuoPair || "—"}
          stat={s.maxInteractions ?? 0}
          statLabel="fast replies"
          flavor="Finishing each other's sentences. These two completely dominate the chat's frequency when they get going."
          isDark={isDark}
          accentColor="#c084fc"
        />
        <AchievementCard
          title="Left on Read"
          name={s.leftOnReadName || "—"}
          stat={s.maxLeftOnRead ?? 0}
          statLabel="conversations killed"
          flavor="Sent a message that was followed by a massive wall of silence. The absolute text terminator."
          isDark={isDark}
          accentColor="#f43f5e"
        />
      </div>

      {/* Hidden Export Poster */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div
          ref={exportRef}
          className="w-[1080px] h-[1920px] bg-[#09090b] text-white flex flex-col font-sans relative overflow-hidden"
          style={{ padding: "56px" }}
        >
          <div className="mb-8">
            <h1 className="text-8xl font-black tracking-tighter mb-3 text-white uppercase">VIBECHECK</h1>
            <p className="text-3xl font-medium tracking-wide text-zinc-400">{posterDateLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8">
              <span className="text-2xl font-bold tracking-widest uppercase text-[#3b82f6] block mb-3">Total Messages</span>
              <span className="text-[96px] leading-none font-black tracking-tighter text-white block">
                {s.totalMessages?.toLocaleString("en-IN") ?? "—"}
              </span>
            </div>
            <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8">
              <span className="text-2xl font-bold tracking-widest uppercase text-[#3b82f6] block mb-3">Busiest Date</span>
              <span className="text-[56px] leading-tight font-black tracking-tighter text-white block">
                {s.busiestDate ? fmt(s.busiestDate) : "—"}
              </span>
              <span className="text-xl mt-2 font-medium text-zinc-400 block">
                {s.busiestDateCount ? `${s.busiestDateCount.toLocaleString("en-IN")} messages` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl font-black tracking-widest uppercase text-white">Hall of Fame</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-6 flex-1">
            {/* Top Talker */}
            <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 blur-2xl" style={{ background: "#3b82f6" }} />
              <div>
                <span className="text-xl font-bold tracking-widest uppercase block mb-2" style={{ color: "#3b82f6" }}>Top Talker</span>
                <span className="text-[44px] font-black text-white leading-tight block truncate">{userStats[0]?.sender ?? "—"}</span>
              </div>
              <div>
                <span className="text-[72px] font-black leading-none" style={{ color: "#3b82f6" }}>
                  {userStats[0]?.messageCount?.toLocaleString("en-IN") ?? 0}
                </span>
                <span className="text-xl font-medium text-zinc-400 ml-3">messages sent</span>
                <p className="text-lg text-zinc-500 mt-2">{topTalkerPct}% of all chat. Absolutely unhinged.</p>
              </div>
            </div>

            {/* The Observer */}
            <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 blur-2xl" style={{ background: "#a855f7" }} />
              <div>
                <span className="text-xl font-bold tracking-widest uppercase block mb-2" style={{ color: "#a855f7" }}>The Observer</span>
                <span className="text-[44px] font-black text-white leading-tight block truncate">{bottomTalker?.sender ?? "—"}</span>
              </div>
              <div>
                <span className="text-[72px] font-black leading-none" style={{ color: "#a855f7" }}>
                  {bottomTalker?.messageCount?.toLocaleString("en-IN") ?? 0}
                </span>
                <span className="text-xl font-medium text-zinc-400 ml-3">messages total</span>
                <p className="text-lg text-zinc-500 mt-2">Lurking. Watching. Never texting back.</p>
              </div>
            </div>

            {/* The Icebreaker */}
            <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 blur-2xl" style={{ background: "#f97316" }} />
              <div>
                <span className="text-xl font-bold tracking-widest uppercase block mb-2" style={{ color: "#f97316" }}>The Icebreaker</span>
                <span className="text-[44px] font-black text-white leading-tight block truncate">{s.icebreakerName ?? "—"}</span>
              </div>
              <div>
                <span className="text-[72px] font-black leading-none" style={{ color: "#f97316" }}>
                  {s.icebreakerCount ?? 0}
                </span>
                <span className="text-xl font-medium text-zinc-400 ml-3">revivals</span>
                <p className="text-lg text-zinc-500 mt-2">Saved the chat after 6+ hours of silence.</p>
              </div>
            </div>

            {/* The Monologuer */}
            <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 blur-2xl" style={{ background: "#10b981" }} />
              <div>
                <span className="text-xl font-bold tracking-widest uppercase block mb-2" style={{ color: "#10b981" }}>The Monologuer</span>
                <span className="text-[44px] font-black text-white leading-tight block truncate">{s.monologuerName ?? "—"}</span>
              </div>
              <div>
                <span className="text-[72px] font-black leading-none" style={{ color: "#10b981" }}>
                  {s.monologuerStreak ?? 0}
                </span>
                <span className="text-xl font-medium text-zinc-400 ml-3">in a row</span>
                <p className="text-lg text-zinc-500 mt-2">Nobody replied but they kept going.</p>
              </div>
            </div>
          </div>

          <div className="pt-6 text-center">
            <p className="text-2xl font-bold tracking-widest uppercase text-zinc-700">
              Generated locally on VibeCheck
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}