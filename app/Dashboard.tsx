"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MessageSquare, Activity, Sun, Moon, Download, Flame, ChevronDown, Zap, RotateCcw, Waypoints, Orbit, LogOut } from "lucide-react";
import ActivityChart from "./ActivityChart";
import { toPng } from "html-to-image";
import WordCloud from "../components/WordCloud";
import Leaderboard from "../components/dashboard/Leaderboard";
import HallOfFame from "../components/dashboard/HallOfFame";
import Poster from "../components/dashboard/Poster";
import WarningsBanner from "../components/dashboard/WarningsBanner";
import TimeMachine from "../components/dashboard/TimeMachine";
import MemberDossier from "../components/dashboard/MemberDossier";
import VibeScore from "../components/dashboard/VibeScore";
import { StatCard, cardClasses } from "../components/dashboard/Cards";
import { useChatStats, useTheme } from "../lib/useChatStats";
import { useDebouncedValue } from "../lib/useDebounced";
import { computePairStats } from "../lib/analytics/pairStats";
import type { ParseResult } from "../types";

// Heavy deep-dive views are loaded only when their tab is opened.
const NetworkGraph = dynamic(() => import("../components/dashboard/NetworkGraph"), {
  ssr: false,
  loading: () => <DeepDiveSkeleton label="Summoning the web…" />,
});
const EmojiGalaxy = dynamic(() => import("../components/dashboard/EmojiGalaxy"), {
  ssr: false,
  loading: () => <DeepDiveSkeleton label="Big-banging the galaxy…" />,
});

interface DashboardProps {
  data: ParseResult;
  /** Optional: return to the upload screen. */
  onExit?: () => void;
}

const fmt = (d: string | number) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime())
    ? String(d)
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

type DeepDive = "none" | "web" | "galaxy";

function DeepDiveSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#121214] p-6 mb-6">
      <div className="h-[420px] flex items-center justify-center text-sm text-zinc-500">{label}</div>
    </div>
  );
}

export default function Dashboard({ data, onExit }: DashboardProps) {
  const [isDark, setIsDark] = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState<"list" | "chart">("list");
  const [deepDive, setDeepDive] = useState<DeepDive>("none");
  const [dossierSender, setDossierSender] = useState<string | null>(null);

  const {
    allMessages,
    filteredMessages,
    filterOptions,
    timeFilter,
    setTimeFilter,
    windowRange,
    setWindowRange,
    dataRange,
    stats: s,
  } = useChatStats({ messages: data.messages });

  // Heavy pair analytics + dossier read a debounced copy of the messages so
  // scrubbing/replay stays fluid; stats above update at full frequency.
  const slowMessages = useDebouncedValue(filteredMessages, 350);
  const pairResult = useMemo(() => computePairStats(slowMessages), [slowMessages]);

  // Poster is only mounted while an export is running.
  const [posterMounted, setPosterMounted] = useState(false);
  const [pendingExport, setPendingExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const startExport = () => {
    if (!s || isExporting) return;
    setPendingExport(true);
    setPosterMounted(true);
  };

  useEffect(() => {
    if (!pendingExport || !posterMounted || !exportRef.current) return;
    let cancelled = false;

    (async () => {
      setIsExporting(true);
      try {
        // Let the freshly-mounted poster paint before capturing.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const dataUrl = await toPng(exportRef.current!, {
          backgroundColor: "#09090b",
          pixelRatio: 2,
          width: 1080,
          height: 1920,
        });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "vibecheck-export.png";
        a.click();
      } catch (error) {
        console.error("Failed to export image", error);
      } finally {
        if (!cancelled) {
          setIsExporting(false);
          setPendingExport(false);
          setPosterMounted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingExport, posterMounted]);

  const topTalkerPct =
    s && s.totalMessages && s.userStats.length
      ? ((s.userStats[0].messageCount / s.totalMessages) * 100).toFixed(1)
      : "0.0";

  const headerRangeLabel = (() => {
    if (windowRange) return `${fmt(windowRange.startMs)} — ${fmt(windowRange.endMs)} (selected window)`;
    if (!s) return "";
    if (timeFilter === "all") return `${fmt(s.firstMessage)} — ${fmt(s.lastMessage)}`;
    if (timeFilter.length === 4) return `${timeFilter} Wrapped`;
    const match = filterOptions.months.find((m) => m.sortKey === timeFilter);
    return match ? `${match.label} Wrapped` : `${timeFilter} Wrapped`;
  })();

  const posterDateLabel = headerRangeLabel.replace(" (selected window)", "");

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
          {s && (
            <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {headerRangeLabel}
            </p>
          )}
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
            onClick={startExport}
            disabled={!s || isExporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm ${
              !s || isExporting
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-[#3b82f6] text-white hover:bg-blue-600 hover:shadow-md"
            }`}
          >
            <Download size={18} />
            {isExporting ? "Exporting..." : "Export Wrapped"}
          </button>

          {onExit && (
            <button
              onClick={onExit}
              aria-label="Analyze another file"
              className={`p-2.5 rounded-full border transition-all ${
                isDark
                  ? "bg-[#121214] border-white/10 text-zinc-400 hover:text-white"
                  : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm"
              }`}
            >
              <LogOut size={20} />
            </button>
          )}

          <button
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
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

      {/* Parser data-quality warnings (previously silent) */}
      <WarningsBanner warnings={data.warnings ?? []} />

      {!s ? (
        /* Empty selection — no valid messages in current filter */
        <div className={`border rounded-2xl p-16 text-center ${cardClasses(isDark)}`}>
          <p className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>
            No messages in this selection
          </p>
          <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            The current time filter doesn&apos;t match any messages.
          </p>
          <button
            onClick={() => setTimeFilter("all")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3b82f6] text-white text-sm font-semibold hover:bg-blue-600 transition-all"
          >
            <RotateCcw size={16} />
            Reset to All-Time
          </button>
        </div>
      ) : (
        <>
          {/* Time Machine — scrubber drives everything below */}
          <TimeMachine
            messages={allMessages}
            dataRange={dataRange}
            windowRange={windowRange}
            setWindowRange={setWindowRange}
            isDark={isDark}
          />

          {/* Top Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
            <StatCard
              icon={MessageSquare}
              label="Total Messages"
              value={s.totalMessages ?? 0}
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

          {/* Vibe Score */}
          <VibeScore stats={s} messages={filteredMessages} isDark={isDark} />

          {/* Leaderboard + Activity Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Leaderboard</h2>
                  <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Click a member for their dossier</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDark ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                    {s.userStats.length} members
                  </span>
                  <div className={`flex items-center rounded-full p-0.5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
                    <button
                      onClick={() => setLeaderboardView("list")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                        leaderboardView === "list"
                          ? isDark ? "bg-white/15 text-white" : "bg-white text-zinc-900 shadow-sm"
                          : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setLeaderboardView("chart")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                        leaderboardView === "chart"
                          ? isDark ? "bg-white/15 text-white" : "bg-white text-zinc-900 shadow-sm"
                          : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
                      }`}
                    >
                      Chart
                    </button>
                  </div>
                </div>
              </div>
              <Leaderboard
                userStats={s.userStats}
                totalMessages={s.totalMessages}
                isDark={isDark}
                view={leaderboardView}
                onSelectMember={setDossierSender}
              />
            </div>

            {/* Activity Chart card */}
            <div className={`lg:col-span-2 border rounded-2xl p-6 flex flex-col min-h-[400px] ${cardClasses(isDark)}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Chat Rhythm</h2>
                  <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Message frequency over time</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                    <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Peak</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isDark ? "bg-white/20" : "bg-black/20"}`}></span>
                    <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Normal</span>
                  </div>
                </div>
              </div>
              <div className="w-full flex-1 min-h-[320px] mt-2">
                <ActivityChart
                  hourlyData={s.hourlyStats ?? Array(24).fill(0)}
                  weeklyData={s.weeklyStats ?? []}
                  monthlyData={s.monthlyStats ?? []}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>

          {/* Deep Dives */}
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <h2 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              Deep Dives
            </h2>
            <div className={`h-px flex-1 min-w-[40px] ${isDark ? "bg-white/5" : "bg-zinc-200"}`} />
            <div className={`flex items-center rounded-full p-0.5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
              {([
                { key: "web", label: "Connection Web", icon: Waypoints },
                { key: "galaxy", label: "Emoji Galaxy", icon: Orbit },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setDeepDive(deepDive === key ? "none" : key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    deepDive === key
                      ? "bg-[#3b82f6] text-white"
                      : isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {deepDive === "none"
              ? "Open a view to explore who talks to whom — or your emoji universe."
              : deepDive === "web"
              ? "Click a member to open their dossier. Hover edges for reply stats."
              : "Click a planet to see who uses it and when."}
          </p>

          {deepDive === "web" && (
            <div className="mb-10">
              <NetworkGraph
                members={pairResult.members}
                pairs={pairResult.pairs}
                isDark={isDark}
                minStrength={0}
                onNodeClick={setDossierSender}
              />
            </div>
          )}
          {deepDive === "galaxy" && (
            <div className="mb-10">
              <EmojiGalaxy messages={filteredMessages} isDark={isDark} />
            </div>
          )}

          {/* Word Cloud (debounced during scrub/replay) */}
          <div className="mb-10">
            <WordCloud messages={slowMessages} isDark={isDark} maxWords={50} />
          </div>

          {/* Hall of Fame */}
          <div className="mb-4 flex items-center gap-3">
            <h2 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              Hall of Fame
            </h2>
            <div className={`h-px flex-1 ${isDark ? "bg-white/5" : "bg-zinc-200"}`} />
          </div>
          <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Lifetime achievements, unlocked by data.
          </p>

          <HallOfFame stats={s} topTalkerPct={topTalkerPct} isDark={isDark} />
        </>
      )}

      {/* Export poster — mounted only while exporting */}
      {posterMounted && (
        <div className="fixed left-[-9999px] top-0 pointer-events-none" aria-hidden>
          <Poster ref={exportRef} stats={s ?? emptyStats} dateLabel={posterDateLabel} />
        </div>
      )}

      {/* Member dossier drawer */}
      <MemberDossier
        sender={dossierSender}
        messages={slowMessages}
        pairResult={pairResult}
        onClose={() => setDossierSender(null)}
      />
    </div>
  );
}

// Poster requires a full Stats shape; this branch is unreachable in practice
// (exports are disabled when there are no stats) but keeps types honest.
const emptyStats = {
  totalMessages: 0, totalUsers: 0, avgPerUser: 0, firstMessage: 0, lastMessage: 0,
  busiestDay: "", busiestDate: "", busiestDateCount: 0, hourlyStats: Array(24).fill(0),
  userStats: [], longestSilence: "—", avgResponseTime: "—", icebreakerName: "", icebreakerCount: 0,
  monologuerName: "", monologuerStreak: 0, speedDemonName: "", speedDemonFormatted: "—",
  dynamicDuoPair: "", maxInteractions: 0, leftOnReadName: "", maxLeftOnRead: 0,
  weeklyStats: [], monthlyStats: [],
};
