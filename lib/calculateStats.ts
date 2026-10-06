import type { ParsedMessage, Stats, BucketCount } from "../types";

/**
 * Aggregates chat statistics from a message list.
 *
 * Contract: `messages` SHOULD be in chronological order (by `timestamp`).
 * This function does not sort; callers are expected to provide an ordered
 * list so that gap/streak calculations are correct and cheap. In practice,
 * the parser returns messages pre-sorted, and the dashboard filters that
 * already-sorted array (filter preserves order) instead of re-sorting.
 */
export function calculateStats(messages: ParsedMessage[]): Stats | Record<string, never> {
  if (!messages || messages.length === 0) return {};

  const userCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {};
  const dateCounts: Record<string, number> = {};
  const hourlyStats: number[] = Array(24).fill(0);
  const monthCounts: Record<string, number> = {};
  const validMessages: ParsedMessage[] = [];

  for (const msg of messages) {
    if (msg.isSystem) continue;
    validMessages.push(msg);

    const sender = msg.sender;
    userCounts[sender] = (userCounts[sender] || 0) + 1;

    const date = new Date(msg.timestamp);
    if (!isNaN(date.getTime())) {
      const day = date.toLocaleDateString("en-US", { weekday: "long" });
      const month = date.toLocaleDateString("en-US", { month: "short" });
      const hour = date.getHours();
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
      monthCounts[month] = (monthCounts[month] || 0) + 1;
      dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
      hourlyStats[hour]++;
    }
  }

  if (validMessages.length === 0) return {};

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

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weeklyStats: BucketCount[] = daysOfWeek.map((day) => ({
    name: day.substring(0, 3),
    value: dayCounts[day] || 0,
  }));

  const monthsOfYear = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyStats: BucketCount[] = monthsOfYear.map((m) => ({
    name: m,
    value: monthCounts[m] || 0,
  }));

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
    weeklyStats,
    monthlyStats,
  };
}
