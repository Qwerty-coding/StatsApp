import type { ParsedMessage } from "../../types";

/**
 * Daily density buckets + auto-detected key moments for the Time Machine.
 */

export interface TimelineBucket {
  /** Local-midnight timestamp of the day. */
  dayMs: number;
  count: number;
}

export type KeyMomentType = "start" | "end" | "peak" | "silence" | "crown";

export interface KeyMoment {
  dayMs: number;
  type: KeyMomentType;
  icon: string;
  title: string;
  detail: string;
}

export interface TimelineResult {
  /** Contiguous day buckets (zeros included) from first to last active day. */
  buckets: TimelineBucket[];
  keyMoments: KeyMoment[];
  maxCount: number;
  firstDayMs: number;
  lastDayMs: number;
  activeDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function localMidnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function buildTimeline(messages: ParsedMessage[], maxCrowns = 6): TimelineResult {
  const valid = messages.filter((m) => !m.isSystem);
  if (valid.length === 0) {
    return { buckets: [], keyMoments: [], maxCount: 0, firstDayMs: 0, lastDayMs: 0, activeDays: 0 };
  }

  // Single pass: per-day totals, per-(day, sender) totals, first/last day.
  const dayTotals = new Map<string, number>();
  const dayMsByKey = new Map<string, number>();
  const daySenders = new Map<string, Map<string, number>>();
  let activeDays = 0;

  for (const msg of valid) {
    const key = dayKey(msg.timestamp);
    if (!dayTotals.has(key)) {
      dayTotals.set(key, 0);
      dayMsByKey.set(key, localMidnight(msg.timestamp));
      daySenders.set(key, new Map());
      activeDays++;
    }
    dayTotals.set(key, dayTotals.get(key)! + 1);
    const sm = daySenders.get(key)!;
    sm.set(msg.sender, (sm.get(msg.sender) ?? 0) + 1);
  }

  const firstDayMs = Math.min(...dayMsByKey.values());
  const lastDayMs = Math.max(...dayMsByKey.values());

  // Contiguous buckets, zeros included (~3.6k entries per decade — cheap).
  const buckets: TimelineBucket[] = [];
  const countByDayMs = new Map(Array.from(dayMsByKey, ([key, ms]) => [ms, dayTotals.get(key)!] as const));
  for (let t = firstDayMs; t <= lastDayMs; t += DAY_MS) {
    buckets.push({ dayMs: t, count: countByDayMs.get(t) ?? 0 });
  }
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const keyMoments: KeyMoment[] = [
    { dayMs: firstDayMs, type: "start", icon: "🌱", title: "It begins", detail: `First message · ${fmt(firstDayMs)}` },
  ];

  // Peak day
  let peak = buckets[0];
  for (const b of buckets) if (b.count > peak.count) peak = b;
  if (peak.count > 0) {
    keyMoments.push({
      dayMs: peak.dayMs,
      type: "peak",
      icon: "🎉",
      title: "Peak activity",
      detail: `${peak.count.toLocaleString("en-IN")} messages · ${fmt(peak.dayMs)}`,
    });
  }

  // Longest silence (largest gap between consecutive active days)
  const activeDaysList = buckets.filter((b) => b.count > 0);
  if (activeDaysList.length >= 2) {
    let gapStart = activeDaysList[0];
    let gapLen = 0;
    for (let i = 1; i < activeDaysList.length; i++) {
      const len = (activeDaysList[i].dayMs - activeDaysList[i - 1].dayMs) / DAY_MS - 1;
      if (len > gapLen) { gapLen = len; gapStart = activeDaysList[i - 1]; }
    }
    if (gapLen >= 3) {
      keyMoments.push({
        dayMs: gapStart.dayMs,
        type: "silence",
        icon: "💀",
        title: "The chat died",
        detail: `${Math.round(gapLen)} days of silence after ${fmt(gapStart.dayMs)}`,
      });
    }
  }

  // Crown changes: running leader by cumulative messages, checked per day.
  const sortedDays = Array.from(dayMsByKey.values()).sort((a, b) => a - b);
  const msToKey = new Map(Array.from(dayMsByKey, ([key, ms]) => [ms, key] as const));
  const running = new Map<string, number>();
  let leader: string | null = null;
  const crowns: { dayMs: number; newLeader: string; margin: number }[] = [];

  for (const dayMs of sortedDays) {
    for (const [sender, c] of daySenders.get(msToKey.get(dayMs)!)!) {
      running.set(sender, (running.get(sender) ?? 0) + c);
    }
    let top: string | null = null;
    let topCount = 0;
    for (const [sender, c] of running) {
      if (c > topCount) { topCount = c; top = sender; }
    }
    if (top && top !== leader) {
      const second = Array.from(running.entries())
        .filter(([s]) => s !== top)
        .reduce((m, [, c]) => Math.max(m, c), 0);
      crowns.push({ dayMs, newLeader: top, margin: topCount - second });
      leader = top;
    }
  }

  // Keep the most significant changes (largest lead), chronological again.
  const selectedCrowns = crowns
    .filter((c) => c.margin > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, maxCrowns)
    .sort((a, b) => a.dayMs - b.dayMs);

  for (const c of selectedCrowns) {
    keyMoments.push({
      dayMs: c.dayMs,
      type: "crown",
      icon: "👑",
      title: `${c.newLeader} takes the crown`,
      detail: `New top talker on ${fmt(c.dayMs)}`,
    });
  }

  keyMoments.push({
    dayMs: lastDayMs,
    type: "end",
    icon: "🏁",
    title: "Latest message",
    detail: fmt(lastDayMs),
  });

  return { buckets, keyMoments, maxCount, firstDayMs, lastDayMs, activeDays };
}
