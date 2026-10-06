"use client";

import { forwardRef } from "react";
import type { Stats } from "../../types";

interface PosterProps {
  stats: Stats;
  dateLabel: string;
}

export type PosterRef = HTMLDivElement;

const fmt = (d: string | number) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime())
    ? String(d)
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * 1080×1920 export poster. Only mounted at export time (see Dashboard), so it
 * never costs render/layout work during normal browsing.
 */
const Poster = forwardRef<PosterRef, PosterProps>(function Poster(
  { stats: s, dateLabel },
  ref
) {
  const topTalker = s.userStats[0];
  const observer = s.userStats.length > 1 ? s.userStats[s.userStats.length - 1] : null;
  const topTalkerPct = s.totalMessages
    ? ((topTalker?.messageCount ?? 0) / s.totalMessages * 100).toFixed(1)
    : "0.0";

  return (
    <div
      ref={ref}
      className="w-[1080px] h-[1920px] bg-[#09090b] text-white flex flex-col font-sans relative overflow-hidden"
      style={{ padding: "56px" }}
    >
      <div className="mb-8">
        <h1 className="text-8xl font-black tracking-tighter mb-3 text-white uppercase">VIBECHECK</h1>
        <p className="text-3xl font-medium tracking-wide text-zinc-400">{dateLabel}</p>
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
        <PosterCard accent="#3b82f6" title="Top Talker" name={topTalker?.sender ?? "—"} stat={topTalker?.messageCount?.toLocaleString("en-IN") ?? 0} unit="messages sent" note={`${topTalkerPct}% of all chat. Absolutely unhinged.`} />
        {/* The Observer */}
        <PosterCard accent="#a855f7" title="The Observer" name={observer?.sender ?? "—"} stat={observer?.messageCount?.toLocaleString("en-IN") ?? 0} unit="messages total" note="Lurking. Watching. Never texting back." />
        {/* The Icebreaker */}
        <PosterCard accent="#f97316" title="The Icebreaker" name={s.icebreakerName || "—"} stat={s.icebreakerCount ?? 0} unit="revivals" note="Saved the chat after 6+ hours of silence." />
        {/* The Monologuer */}
        <PosterCard accent="#10b981" title="The Monologuer" name={s.monologuerName || "—"} stat={s.monologuerStreak ?? 0} unit="in a row" note="Nobody replied but they kept going." />
      </div>

      <div className="pt-6 text-center">
        <p className="text-2xl font-bold tracking-widest uppercase text-zinc-700">
          Generated locally on VibeCheck
        </p>
      </div>
    </div>
  );
});

function PosterCard({
  accent,
  title,
  name,
  stat,
  unit,
  note,
}: {
  accent: string;
  title: string;
  name: string;
  stat: string | number;
  unit: string;
  note: string;
}) {
  return (
    <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 blur-2xl" style={{ background: accent }} />
      <div>
        <span className="text-xl font-bold tracking-widest uppercase block mb-2" style={{ color: accent }}>{title}</span>
        <span className="text-[44px] font-black text-white leading-tight block truncate">{name}</span>
      </div>
      <div>
        <span className="text-[72px] font-black leading-none" style={{ color: accent }}>{stat}</span>
        <span className="text-xl font-medium text-zinc-400 ml-3">{unit}</span>
        <p className="text-lg text-zinc-500 mt-2">{note}</p>
      </div>
    </div>
  );
}

export default Poster;
