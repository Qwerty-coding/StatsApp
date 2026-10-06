import type { ParsedMessage } from "../../types";
import { countWords, extractEmojis } from "./text-utils";

/**
 * Pair-level analytics: who replies to whom, how fast, how often.
 * Powers the Connection Web graph, member dossiers, and community detection.
 *
 * A "reply" is a cross-person transition between consecutive messages:
 * if A sends and B sends next, that is one reply B→A with gap = t_B − t_A.
 *
 * Input contract: `messages` in chronological order (the parser guarantees it).
 * System messages are skipped.
 */

export interface DirectionStat {
  /** Times this direction replied (aToB = a replied after b's message). */
  replies: number;
  /** Average reply time in ms over counted replies. */
  avgMs: number;
}

export interface PairStat {
  /** Lexicographically smaller sender. */
  a: string;
  /** Lexicographically larger sender. */
  b: string;
  /** Total cross-person transitions between the pair. */
  exchanges: number;
  /** Transitions faster than 5 minutes (rapid back-and-forth). */
  fastExchanges: number;
  /** Average reply time across both directions (over counted replies). */
  avgReplyMs: number;
  /** Median reply time across both directions (over counted replies). */
  medianReplyMs: number;
  aToB: DirectionStat;
  bToA: DirectionStat;
}

export interface MemberProfile {
  sender: string;
  messageCount: number;
  avgWords: number;
  emojiCount: number;
  /** Share of messages sent between 22:00 and 04:59. */
  nightRatio: number;
  /** Cross-person transitions where this member replied. */
  repliesGiven: number;
  /** Cross-person transitions where someone replied to this member. */
  repliesReceived: number;
  /** This member's average reply time over counted replies (Infinity if none). */
  avgReplyMs: number;
  /** Their messages followed by > 2h of silence (they were "left on read"). */
  ghostCount: number;
  /** Longest run of consecutive messages by this member. */
  longestStreak: number;
  firstMessage: number;
  lastMessage: number;
}

export interface PairStatsResult {
  pairs: PairStat[];
  members: MemberProfile[];
}

const FAST_MS = 5 * 60 * 1000;
const GHOST_MS = 2 * 60 * 60 * 1000;
/** Reply-time stats ignore gaps above this — a 3-month gap is not a "reply". */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Night hours: 22:00–04:59. */
function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

interface MemberAcc {
  sender: string;
  messageCount: number;
  totalWords: number;
  emojiCount: number;
  nightCount: number;
  repliesGiven: number;
  repliesReceived: number;
  replyGaps: number[];
  ghostCount: number;
  streak: number;
  firstMessage: number;
  lastMessage: number;
}

interface PairAcc {
  a: string;
  b: string;
  exchanges: number;
  fastExchanges: number;
  aToB: { replies: number; totalMs: number };
  bToA: { replies: number; totalMs: number };
  /** In-window (fresh) reply counts per direction — the avgMs denominators. */
  aToBCounted: number;
  bToACounted: number;
  gaps: number[]; // all reply gaps within the window, for the median
}

export function computePairStats(messages: ParsedMessage[]): PairStatsResult {
  const valid = messages.filter((m) => !m.isSystem && m.sender);
  const members = new Map<string, MemberAcc>();
  const pairs = new Map<string, PairAcc>();

  const member = (sender: string): MemberAcc => {
    let m = members.get(sender);
    if (!m) {
      m = {
        sender, messageCount: 0, totalWords: 0, emojiCount: 0, nightCount: 0,
        repliesGiven: 0, repliesReceived: 0, replyGaps: [], ghostCount: 0,
        streak: 0, firstMessage: Number.MAX_SAFE_INTEGER, lastMessage: 0,
      };
      members.set(sender, m);
    }
    return m;
  };

  const pairAcc = (a: string, b: string): PairAcc => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = `${lo}\u0000${hi}`;
    let p = pairs.get(key);
    if (!p) {
      p = {
        a: lo, b: hi, exchanges: 0, fastExchanges: 0,
        aToB: { replies: 0, totalMs: 0 },
        bToA: { replies: 0, totalMs: 0 },
        aToBCounted: 0,
        bToACounted: 0,
        gaps: [],
      };
      pairs.set(key, p);
    }
    return p;
  };

  for (const msg of valid) {
    const m = member(msg.sender);
    m.messageCount++;
    m.totalWords += countWords(msg.text);
    m.emojiCount += extractEmojis(msg.text).length;
    if (!msg.isMedia && isNightHour(new Date(msg.timestamp).getHours())) m.nightCount++;
    if (msg.timestamp < m.firstMessage) m.firstMessage = msg.timestamp;
    if (msg.timestamp > m.lastMessage) m.lastMessage = msg.timestamp;
  }

  // Monologue streaks + pair transitions in one ordered pass.
  let currentStreak = 0;
  let currentSender: string | null = null;
  let prev: ParsedMessage | null = null;

  const closeStreak = () => {
    if (currentSender) {
      const m = member(currentSender);
      if (currentStreak > m.streak) m.streak = currentStreak;
    }
  };

  for (const msg of valid) {
    if (msg.sender === currentSender) {
      currentStreak++;
    } else {
      closeStreak();
      currentSender = msg.sender;
      currentStreak = 1;
    }

    if (prev && prev.sender !== msg.sender) {
      const gap = msg.timestamp - prev.timestamp;
      const replier = member(msg.sender);
      const repliedTo = member(prev.sender);

      replier.repliesGiven++;
      repliedTo.repliesReceived++;

      const p = pairAcc(prev.sender, msg.sender);
      p.exchanges++;
      if (gap < FAST_MS) p.fastExchanges++;
      const dir = msg.sender === p.a ? p.aToB : p.bToA;
      dir.replies++;

      if (gap >= 0 && gap <= REPLY_WINDOW_MS) {
        dir.totalMs += gap;
        if (msg.sender === p.a) p.aToBCounted++; else p.bToACounted++;
        p.gaps.push(gap);
        replier.replyGaps.push(gap);
      }
    }
    prev = msg;
  }
  closeStreak();

  // Ghost counts: a message followed by > 2h silence (excluding chat end —
  // nothing "left on read" about the chat just ending).
  for (let i = 0; i < valid.length - 1; i++) {
    const gap = valid[i + 1].timestamp - valid[i].timestamp;
    if (gap > GHOST_MS) member(valid[i].sender).ghostCount++;
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : Infinity);
  const median = (arr: number[]) => {
    if (!arr.length) return Infinity;
    const s = [...arr].sort((x, y) => x - y);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const outPairs: PairStat[] = Array.from(pairs.values()).map((p) => {
    // avgMs is over in-window replies only; a direction whose only replies
    // were month-long gaps reports Infinity, not 0.
    const aToBAvg = p.aToBCounted ? p.aToB.totalMs / p.aToBCounted : Infinity;
    const bToAAvg = p.bToACounted ? p.bToA.totalMs / p.bToACounted : Infinity;
    const both = [aToBAvg, bToAAvg].filter((v) => v !== Infinity);
    return {
      a: p.a,
      b: p.b,
      exchanges: p.exchanges,
      fastExchanges: p.fastExchanges,
      avgReplyMs: both.length ? both.reduce((s, v) => s + v, 0) / both.length : Infinity,
      medianReplyMs: median(p.gaps),
      aToB: { replies: p.aToB.replies, avgMs: aToBAvg },
      bToA: { replies: p.bToA.replies, avgMs: bToAAvg },
    };
  }).sort((x, y) => y.exchanges - x.exchanges);

  const outMembers: MemberProfile[] = Array.from(members.values()).map((m) => ({
    sender: m.sender,
    messageCount: m.messageCount,
    avgWords: m.messageCount ? m.totalWords / m.messageCount : 0,
    emojiCount: m.emojiCount,
    nightRatio: m.messageCount ? m.nightCount / m.messageCount : 0,
    repliesGiven: m.repliesGiven,
    repliesReceived: m.repliesReceived,
    avgReplyMs: avg(m.replyGaps),
    ghostCount: m.ghostCount,
    longestStreak: m.streak,
    firstMessage: m.firstMessage === Number.MAX_SAFE_INTEGER ? 0 : m.firstMessage,
    lastMessage: m.lastMessage,
  })).sort((x, y) => y.messageCount - x.messageCount);

  return { pairs: outPairs, members: outMembers };
}

