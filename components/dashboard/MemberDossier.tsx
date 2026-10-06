"use client";

import { useEffect, useMemo } from "react";
import { X, Clock, Ghost, MessageSquare, Moon, Zap, Link2, Flame } from "lucide-react";
import type { ParsedMessage } from "../../types";
import type { PairStatsResult } from "../../lib/analytics/pairStats";
import { buildMemberDossier } from "../../lib/analytics/memberStats";
import { avatarColor, initials } from "../../lib/analytics/text-utils";
import { useTheme } from "../../lib/useChatStats";

/**
 * Member Dossier: slide-over drawer with a member's full personality profile —
 * top words/emojis, hour×weekday heatmap, best duo, ghost score.
 */

interface MemberDossierProps {
  sender: string | null;
  messages: ParsedMessage[];
  pairResult: PairStatsResult;
  onClose: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MemberDossier({ sender, messages, pairResult, onClose }: MemberDossierProps) {
  const [isDark] = useTheme();
  const dossier = useMemo(
    () => (sender ? buildMemberDossier(sender, messages, pairResult) : null),
    [sender, messages, pairResult]
  );

  // Close on Escape
  useEffect(() => {
    if (!sender) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sender, onClose]);

  if (!sender) return null;

  const color = avatarColor(sender);
  const maxGrid = dossier ? Math.max(1, ...dossier.activityGrid) : 1;

  const fmtMs = (ms: number) =>
    ms === Infinity ? "—" :
    ms < 60_000 ? `${Math.round(ms / 1000)}s` :
    ms < 3_600_000 ? `${Math.round(ms / 60_000)}m` :
    `${(ms / 3_600_000).toFixed(1)}h`;

  const fmtDate = (ms: number) =>
    ms ? new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const rank = pairResult.members.findIndex((m) => m.sender === sender) + 1;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto shadow-2xl ${
          isDark ? "bg-[#121214] border-l border-white/10" : "bg-white border-l border-zinc-200"
        }`}
        style={{ animation: "dossier-slide 220ms ease-out" }}
      >
        <style>{`@keyframes dossier-slide { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-5 border-b" style={{
          background: isDark ? "#121214" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e4e4e7",
        }}>
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-1.5 rounded-full transition-all ${
              isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
            }`}
            aria-label="Close dossier"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
              style={{ background: color }}
            >
              {initials(sender)}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{sender}</h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                Rank #{rank} of {pairResult.members.length}
              </p>
            </div>
          </div>
        </div>

        {dossier && (
          <div className="px-6 py-5 space-y-6">
            {/* Key numbers */}
            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={MessageSquare} isDark={isDark} label="Messages"
                value={dossier.messageCount.toLocaleString("en-IN")} sub={`${dossier.sharePct.toFixed(1)}% of chat`} />
              <MiniStat icon={Flame} isDark={isDark} label="Monologue"
                value={`${dossier.longestStreak}×`} sub="longest solo streak" />
              <MiniStat icon={Ghost} isDark={isDark} label="Left on read"
                value={String(dossier.ghostCount)} sub="times ghosted the chat" />
              <MiniStat icon={Moon} isDark={isDark} label="Night owl"
                value={`${Math.round(dossier.nightOwlPct)}%`} sub="22:00–05:00 texts" />
            </div>

            {/* Best duo / speed */}
            <Section isDark={isDark} title="Connections">
              <div className="space-y-2.5">
                {dossier.bestDuo && (
                  <ConnRow isDark={isDark} icon={Link2} label="Best duo"
                    value={`${dossier.bestDuo.partner} · ${dossier.bestDuo.exchanges.toLocaleString("en-IN")} exchanges`} />
                )}
                {dossier.fastestReplierTo && (
                  <ConnRow isDark={isDark} icon={Zap} label="Replies fastest to"
                    value={`${dossier.fastestReplierTo.partner} · avg ${fmtMs(dossier.fastestReplierTo.avgMs)}`} />
                )}
                {dossier.fastestReplierFrom && (
                  <ConnRow isDark={isDark} icon={Clock} label="Gets fastest replies from"
                    value={`${dossier.fastestReplierFrom.partner} · avg ${fmtMs(dossier.fastestReplierFrom.avgMs)}`} />
                )}
                {!dossier.bestDuo && (
                  <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>No pair connections yet.</p>
                )}
              </div>
            </Section>

            {/* Activity heatmap */}
            <Section isDark={isDark} title={`Activity heatmap · peak ${dossier.peakHour}:00`}>
              <div className="overflow-x-auto pb-1">
                <div style={{ minWidth: 24 * 9 }}>
                  {WEEKDAYS.map((day, di) => (
                    <div key={day} className="flex items-center gap-[3px] mb-[3px]">
                      <span className={`w-7 text-[9px] flex-shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{day}</span>
                      {Array.from({ length: 24 }, (_, h) => {
                        const v = dossier.activityGrid[di * 24 + h];
                        const t = v / maxGrid;
                        return (
                          <div
                            key={h}
                            title={`${day} ${h}:00 — ${v} messages`}
                            className="flex-1 h-3.5 rounded-[2px]"
                            style={{
                              background: v === 0
                                ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)")
                                : `${color}${Math.round(40 + t * 215).toString(16).padStart(2, "0")}`,
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex gap-[3px] mt-1 pl-[34px]">
                    {[0, 6, 12, 18].map((h) => (
                      <span key={h} className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                        style={{ width: "calc((100% - 69px) / 24 * 6)", flexGrow: 6 }}>
                        {String(h).padStart(2, "0")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Top words + emojis */}
            <Section isDark={isDark} title="Signature language">
              {dossier.topWords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {dossier.topWords.slice(0, 10).map((w) => (
                    <span key={w.word}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDark ? "bg-white/5 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                      }`}>
                      {w.word} <span style={{ color }}>{w.count}</span>
                    </span>
                  ))}
                </div>
              )}
              {dossier.topEmojis.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dossier.topEmojis.map((e) => (
                    <span key={e.emoji} className={`px-1.5 py-0.5 rounded-lg text-sm ${
                      isDark ? "bg-white/5" : "bg-zinc-100"
                    }`}>
                      {e.emoji} <span className="text-[10px] text-zinc-500">{e.count}</span>
                    </span>
                  ))}
                </div>
              )}
              {dossier.topWords.length === 0 && dossier.topEmojis.length === 0 && (
                <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Mostly media or very short texts.</p>
              )}
            </Section>

            {/* Lifetime */}
            <Section isDark={isDark} title="Lifetime">
              <div className={`grid grid-cols-2 gap-y-2 text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Avg words</span>
                <span className="font-semibold">{dossier.avgWords.toFixed(1)}</span>
                <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Active days</span>
                <span className="font-semibold">{dossier.activeDays.toLocaleString("en-IN")}</span>
                <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>First seen</span>
                <span className="font-semibold">{fmtDate(dossier.firstMessage)}</span>
                <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Last seen</span>
                <span className="font-semibold">{fmtDate(dossier.lastMessage)}</span>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, isDark, children }: { title: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, sub, isDark,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sub: string; isDark: boolean;
}) {
  return (
    <div className={`p-3.5 rounded-xl border ${isDark ? "bg-white/[0.03] border-white/5" : "bg-zinc-50 border-zinc-100"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className="text-[#3b82f6]" />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          {label}
        </span>
      </div>
      <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{value}</div>
      <div className={`text-[11px] mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{sub}</div>
    </div>
  );
}

function ConnRow({
  icon: Icon, label, value, isDark,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-1.5 rounded-lg ${isDark ? "bg-white/5 text-blue-400" : "bg-blue-50 text-blue-500"}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{label}</div>
        <div className={`text-sm font-semibold truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{value}</div>
      </div>
    </div>
  );
}
