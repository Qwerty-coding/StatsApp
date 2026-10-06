import type { ParsedMessage } from "../../types";
import { extractEmojis } from "./text-utils";

/**
 * Emoji usage analytics for the Emoji Galaxy: per-emoji frequency, users,
 * monthly trend, and the co-occurrence matrix that drives orbit clustering.
 */

export interface EmojiStat {
  emoji: string;
  count: number;
  /** Users sorted by usage (top 10). */
  users: { sender: string; count: number }[];
  firstUsed: number;
  lastUsed: number;
  /** Monthly usage, sorted chronologically. */
  monthly: { key: string; count: number }[];
}

export interface EmojiStatsResult {
  /** Sorted by count, descending. */
  emojis: EmojiStat[];
  /** Symmetric co-occurrence: coOccurrence[a][b] = messages containing both. */
  coOccurrence: Record<string, Record<string, number>>;
}

export function buildEmojiStats(messages: ParsedMessage[], minCount = 2): EmojiStatsResult {
  const counts = new Map<string, number>();
  const userSets = new Map<string, Map<string, number>>();
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  const monthly = new Map<string, Map<string, number>>();
  const coOccurrence: Record<string, Record<string, number>> = {};

  for (const msg of messages) {
    if (msg.isSystem || !msg.text) continue;
    const emojis = Array.from(new Set(extractEmojis(msg.text)));
    if (emojis.length === 0) continue;

    for (const emoji of emojis) {
      counts.set(emoji, (counts.get(emoji) ?? 0) + 1);

      let users = userSets.get(emoji);
      if (!users) { users = new Map(); userSets.set(emoji, users); }
      users.set(msg.sender, (users.get(msg.sender) ?? 0) + 1);

      if (!first.has(emoji) || msg.timestamp < first.get(emoji)!) first.set(emoji, msg.timestamp);
      if (!last.has(emoji) || msg.timestamp > last.get(emoji)!) last.set(emoji, msg.timestamp);

      const d = new Date(msg.timestamp);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        let m = monthly.get(emoji);
        if (!m) { m = new Map(); monthly.set(emoji, m); }
        m.set(key, (m.get(key) ?? 0) + 1);
      }
    }

    // Same-message co-occurrence (unordered pairs).
    for (let i = 0; i < emojis.length; i++) {
      for (let j = i + 1; j < emojis.length; j++) {
        const a = emojis[i];
        const b = emojis[j];
        if (a === b) continue;
        (coOccurrence[a] ??= {})[b] = (coOccurrence[a]?.[b] ?? 0) + 1;
        (coOccurrence[b] ??= {})[a] = (coOccurrence[b]?.[a] ?? 0) + 1;
      }
    }
  }

  const emojis: EmojiStat[] = Array.from(counts.entries())
    .filter(([, count]) => count >= minCount)
    .sort((x, y) => y[1] - x[1])
    .map(([emoji, count]) => ({
      emoji,
      count,
      users: Array.from(userSets.get(emoji)!.entries())
        .sort((x, y) => y[1] - x[1])
        .slice(0, 10)
        .map(([sender, c]) => ({ sender, count: c })),
      firstUsed: first.get(emoji) ?? 0,
      lastUsed: last.get(emoji) ?? 0,
      monthly: Array.from(monthly.get(emoji)?.entries() ?? [])
        .sort((x, y) => x[0].localeCompare(y[0]))
        .map(([key, c]) => ({ key, count: c })),
    }));

  // Prune co-occurrence to emojis that survived the minCount filter.
  const kept = new Set(emojis.map((e) => e.emoji));
  const pruned: Record<string, Record<string, number>> = {};
  for (const [a, row] of Object.entries(coOccurrence)) {
    if (!kept.has(a)) continue;
    for (const [b, n] of Object.entries(row)) {
      if (!kept.has(b)) continue;
      (pruned[a] ??= {})[b] = n;
    }
  }

  return { emojis, coOccurrence: pruned };
}
