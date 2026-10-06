"use client";

import { AchievementCard } from "./Cards";
import type { Stats } from "../../types";

interface HallOfFameProps {
  stats: Stats;
  topTalkerPct: string;
  isDark: boolean;
}

export default function HallOfFame({ stats: s, topTalkerPct, isDark }: HallOfFameProps) {
  const topTalker = s.userStats[0];
  const observer = s.userStats.length > 1 ? s.userStats[s.userStats.length - 1] : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6 mb-10">
      {/* Row 1 */}
      <AchievementCard
        title="Top Talker"
        name={topTalker?.sender ?? "—"}
        stat={topTalker?.messageCount?.toLocaleString("en-IN") ?? 0}
        statLabel="messages sent"
        flavor={`That's ${topTalkerPct}% of everything ever said in this chat. Absolutely unhinged.`}
        isDark={isDark}
        accentColor="#3b82f6"
      />
      <AchievementCard
        title="The Observer"
        name={observer?.sender ?? "—"}
        stat={observer?.messageCount?.toLocaleString("en-IN") ?? 0}
        statLabel={`message${observer?.messageCount === 1 ? "" : "s"} total`}
        flavor="Lurking in the shadows. Watching. Never texting back. A legend of restraint."
        isDark={isDark}
        accentColor="#a855f7"
      />

      {/* Row 2 */}
      <AchievementCard
        title="The Icebreaker"
        name={s.icebreakerName || "—"}
        stat={s.icebreakerCount ?? 0}
        statLabel="revivals"
        flavor="Swooped in to rescue the chat after 6+ hours of dead silence. The unsung hero."
        isDark={isDark}
        accentColor="#f97316"
      />
      <AchievementCard
        title="The Monologuer"
        name={s.monologuerName || "—"}
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
  );
}
