import type { ParsedMessage } from "../../types";
import type { PairStatsResult } from "./pairStats";
import { countWords, extractEmojis, tokenize } from "./text-utils";
import { englishStopWords, hinglishStopWords, commonIndianNames } from "../optimized-word-extraction";

/**
 * Per-member deep-dive stats for the Member Dossier drawer.
 */

export interface MemberDossier {
  sender: string;
  messageCount: number;
  sharePct: number;
  avgWords: number;
  totalWords: number;
  topWords: { word: string; count: number }[];
  topEmojis: { emoji: string; count: number }[];
  /** 7×24 activity grid; index = weekday (0 = Sunday) * 24 + hour. */
  activityGrid: number[];
  peakHour: number;
  bestDuo: { partner: string; exchanges: number } | null;
  /** Partner this member replies to fastest (≥ 5 qualifying replies). */
  fastestReplierTo: { partner: string; avgMs: number } | null;
  /** Partner who replies to this member fastest (≥ 5 qualifying replies). */
  fastestReplierFrom: { partner: string; avgMs: number } | null;
  ghostCount: number;
  longestStreak: number;
  activeDays: number;
  nightOwlPct: number;
  firstMessage: number;
  lastMessage: number;
}

const STOP_WORDS = new Set([...englishStopWords, ...hinglishStopWords, ...commonIndianNames]);
const MIN_WORD_LEN = 3;

export function buildMemberDossier(
  sender: string,
  messages: ParsedMessage[],
  pairResult: PairStatsResult
): MemberDossier | null {
  const profile = pairResult.members.find((m) => m.sender === sender);
  if (!profile) return null;

  const wordCounts = new Map<string, number>();
  const emojiCounts = new Map<string, number>();
  const activityGrid = Array(168).fill(0) as number[];
  const activeDays = new Set<string>();

  let firstMessage = Number.MAX_SAFE_INTEGER;
  let lastMessage = 0;

  for (const msg of messages) {
    if (msg.isSystem || msg.sender !== sender) continue;
    if (msg.timestamp < firstMessage) firstMessage = msg.timestamp;
    if (msg.timestamp > lastMessage) lastMessage = msg.timestamp;

    for (const word of tokenize(msg.text)) {
      if (word.length < MIN_WORD_LEN || STOP_WORDS.has(word)) continue;
      if (/^\d+$/.test(word)) continue;
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
    for (const emoji of new Set(extractEmojis(msg.text))) {
      emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1);
    }

    const d = new Date(msg.timestamp);
    if (!isNaN(d.getTime())) {
      activityGrid[d.getDay() * 24 + d.getHours()]++;
      activeDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }

  const totalMessages = pairResult.members.reduce((s, m) => s + m.messageCount, 0);

  // Pair-derived facts
  let bestDuo: MemberDossier["bestDuo"] = null;
  let fastestReplierTo: MemberDossier["fastestReplierTo"] = null;
  let fastestReplierFrom: MemberDossier["fastestReplierFrom"] = null;

  for (const p of pairResult.pairs) {
    if (p.a !== sender && p.b !== sender) continue;
    const partner = p.a === sender ? p.b : p.a;
    if (!bestDuo || p.exchanges > bestDuo.exchanges) {
      bestDuo = { partner, exchanges: p.exchanges };
    }
    const mine = p.a === sender ? p.aToB : p.bToA;
    const theirs = p.a === sender ? p.bToA : p.aToB;
    if (mine.replies >= 5 && mine.avgMs !== Infinity && (!fastestReplierTo || mine.avgMs < fastestReplierTo.avgMs)) {
      fastestReplierTo = { partner, avgMs: mine.avgMs };
    }
    if (theirs.replies >= 5 && theirs.avgMs !== Infinity && (!fastestReplierFrom || theirs.avgMs < fastestReplierFrom.avgMs)) {
      fastestReplierFrom = { partner, avgMs: theirs.avgMs };
    }
  }

  let peakHour = 0;
  let peakCount = -1;
  for (let h = 0; h < 24; h++) {
    let sum = 0;
    for (let day = 0; day < 7; day++) sum += activityGrid[day * 24 + h];
    if (sum > peakCount) { peakCount = sum; peakHour = h; }
  }

  const topWords = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  const topEmojis = Array.from(emojiCounts.entries())
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([emoji, count]) => ({ emoji, count }));

  const nightMessages = Math.round(profile.nightRatio * profile.messageCount);

  return {
    sender,
    messageCount: profile.messageCount,
    sharePct: totalMessages ? (profile.messageCount / totalMessages) * 100 : 0,
    avgWords: countWordsAvg(messages, sender),
    totalWords: profile.avgWords * profile.messageCount,
    topWords,
    topEmojis,
    activityGrid,
    peakHour,
    bestDuo,
    fastestReplierTo,
    fastestReplierFrom,
    ghostCount: profile.ghostCount,
    longestStreak: profile.longestStreak,
    activeDays: activeDays.size,
    nightOwlPct: profile.messageCount ? (nightMessages / profile.messageCount) * 100 : 0,
    firstMessage: firstMessage === Number.MAX_SAFE_INTEGER ? 0 : firstMessage,
    lastMessage: lastMessage,
  };
}

function countWordsAvg(messages: ParsedMessage[], sender: string): number {
  let words = 0;
  let count = 0;
  for (const msg of messages) {
    if (msg.isSystem || msg.sender !== sender) continue;
    words += countWords(msg.text);
    count++;
  }
  return count ? words / count : 0;
}
