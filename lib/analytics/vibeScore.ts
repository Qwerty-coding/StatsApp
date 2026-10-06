import type { ParsedMessage, Stats } from "../../types";

/**
 * The Vibe Score: a 0–100 personality score for the chat, with a 5-axis
 * breakdown for the radar chart and a verdict line.
 */

export interface VibeAxis {
  key: "activity" | "balance" | "loyalty" | "chaos" | "depth";
  label: string;
  score: number; // 0–100
  note: string;
}

export interface VibeScore {
  total: number; // 0–100
  verdict: string;
  axes: VibeAxis[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Normalized Shannon entropy → how evenly distributed a distribution is. */
function evenness(counts: number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total <= 0 || counts.length <= 1) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return (h / Math.log(counts.length)) * 100;
}

export function computeVibeScore(stats: Stats, messages: ParsedMessage[]): VibeScore {
  const valid = messages.filter((m) => !m.isSystem);

  // Activity: messages per member per day (5+ msgs/member/day scores full
  // marks — a quiet 1:1 chat does ~2, a wild group 20+).
  const spanDays = Math.max(1, (stats.lastMessage - stats.firstMessage) / DAY_MS);
  const msgsPerDay = valid.length / spanDays;
  const perUserPerDay = msgsPerDay / Math.max(1, stats.totalUsers);
  const activity = clamp100(perUserPerDay * 20);

  // Balance: how evenly members share the conversation.
  const balance = clamp100(evenness(stats.userStats.map((u) => u.messageCount)));

  // Loyalty: how many days in the chat's lifespan had any activity.
  const activeDaySet = new Set<string>();
  for (const m of valid) {
    const d = new Date(m.timestamp);
    if (!isNaN(d.getTime())) activeDaySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  const loyalty = clamp100((activeDaySet.size / spanDays) * 100);

  // Chaos: how spread-out the hours of activity are (all-nighter energy).
  const chaos = clamp100(evenness(stats.hourlyStats.filter((c) => c > 0)));

  // Depth: average words per message (~12.5+ words scores full marks).
  let words = 0;
  for (const m of valid) {
    if (!m.text) continue;
    words += m.text.split(/[\s\n\t]+/).filter(Boolean).length;
  }
  const avgWords = valid.length ? words / valid.length : 0;
  const depth = clamp100((avgWords / 12.5) * 100);

  const axes: VibeAxis[] = [
    { key: "activity", label: "Activity", score: Math.round(activity), note: `${Math.round(perUserPerDay)} msgs/member/day` },
    { key: "balance", label: "Balance", score: Math.round(balance), note: `${stats.totalUsers} voices` },
    { key: "loyalty", label: "Loyalty", score: Math.round(loyalty), note: `${activeDaySet.size} active days` },
    { key: "chaos", label: "Chaos", score: Math.round(chaos), note: "hour spread" },
    { key: "depth", label: "Depth", score: Math.round(depth), note: `${avgWords.toFixed(1)} words avg` },
  ];

  const weights: Record<VibeAxis["key"], number> = {
    activity: 0.25, balance: 0.2, loyalty: 0.2, chaos: 0.15, depth: 0.2,
  };
  const total = Math.round(axes.reduce((s, a) => s + a.score * weights[a.key], 0));

  const band =
    total >= 85 ? "Certified legendary — this chat never sleeps." :
    total >= 70 ? "Elite group chat energy. Protect this at all costs." :
    total >= 55 ? "Solid, dependable chaos. The group is carrying." :
    total >= 40 ? "It's alive… mostly. Someone say something." :
    "This chat needs a defibrillator. 💀";

  const top = [...axes].sort((a, b) => b.score - a.score)[0];
  const trait =
    top.key === "chaos" ? "Unhinged in the best way." :
    top.key === "balance" ? "Beautifully democratic." :
    top.key === "activity" ? "Relentless pace." :
    top.key === "depth" ? "Big paragraph energy." :
    "Always comes back.";

  return { total, verdict: `${band} ${trait}`, axes };
}
