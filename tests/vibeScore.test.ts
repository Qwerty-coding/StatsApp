import { describe, it, expect } from "vitest";
import { computeVibeScore } from "../lib/analytics/vibeScore";
import type { ParsedMessage, Stats, UserStat } from "../types";

const DAY = 24 * 60 * 60 * 1000;

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    totalMessages: 0, totalUsers: 0, avgPerUser: 0,
    firstMessage: new Date(2024, 0, 1).getTime(),
    lastMessage: new Date(2024, 0, 31).getTime(),
    busiestDay: "Monday", busiestDate: "", busiestDateCount: 0,
    hourlyStats: Array(24).fill(0),
    userStats: [],
    longestSilence: "—", avgResponseTime: "—",
    icebreakerName: "", icebreakerCount: 0,
    monologuerName: "", monologuerStreak: 0,
    speedDemonName: "", speedDemonFormatted: "—",
    dynamicDuoPair: "", maxInteractions: 0,
    leftOnReadName: "", maxLeftOnRead: 0,
    weeklyStats: [], monthlyStats: [],
    ...overrides,
  };
}

function msg(sender: string, ts: number, text = "hello there"): ParsedMessage {
  return { sender, timestamp: ts, text, isMedia: false, isSystem: false };
}

function users(...pairs: [string, number][]): UserStat[] {
  return pairs.map(([sender, messageCount]) => ({ sender, messageCount }))
    .sort((a, b) => b.messageCount - a.messageCount);
}

describe("computeVibeScore", () => {
  it("scores a dead chat low", () => {
    const stats = makeStats({ totalMessages: 3, totalUsers: 2, userStats: users(["A", 2], ["B", 1]) });
    const score = computeVibeScore(stats, [
      msg("A", stats.firstMessage),
      msg("B", stats.firstMessage + 10 * DAY),
      msg("A", stats.lastMessage),
    ]);
    expect(score.total).toBeLessThan(40);
    expect(score.verdict).toContain("defibrillator");
  });

  it("scores a lively, balanced chat high", () => {
    const messages: ParsedMessage[] = [];
    // 30 days, 3 balanced members, messages across many hours
    for (let d = 0; d < 30; d++) {
      for (let h = 0; h < 24; h += 4) {
        for (const [i, sender] of ["A", "B", "C"].entries()) {
          messages.push(msg(sender, new Date(2024, 0, 1 + d, h + i).getTime(), "what a great day to chat together"));
        }
      }
    }
    const stats = makeStats({
      totalMessages: messages.length,
      totalUsers: 3,
      userStats: users(["A", 180], ["B", 180], ["C", 180]),
      firstMessage: messages[0].timestamp,
      lastMessage: messages[messages.length - 1].timestamp,
      // Messages span 18 distinct hours → healthy chaos axis
      hourlyStats: messages.reduce((acc: number[], m) => {
        acc[new Date(m.timestamp).getHours()]++;
        return acc;
      }, Array(24).fill(0)),
    });
    const score = computeVibeScore(stats, messages);
    expect(score.total).toBeGreaterThan(70);
    expect(score.axes).toHaveLength(5);
    expect(score.axes.map((a) => a.score).every((s) => s >= 0 && s <= 100)).toBe(true);
  });

  it("rewards balance when everyone talks equally", () => {
    const even = makeStats({ userStats: users(["A", 50], ["B", 50], ["C", 50], ["D", 50]) });
    const skewed = makeStats({ userStats: users(["A", 190], ["B", 5], ["C", 3], ["D", 2]) });
    const evenScore = computeVibeScore(even, [msg("A", even.firstMessage)]);
    const skewedScore = computeVibeScore(skewed, [msg("A", skewed.firstMessage)]);
    const evenBalance = evenScore.axes.find((a) => a.key === "balance")!.score;
    const skewedBalance = skewedScore.axes.find((a) => a.key === "balance")!.score;
    expect(evenBalance).toBeGreaterThan(skewedBalance);
  });

  it("never exceeds 0–100 bounds", () => {
    const stats = makeStats({ totalMessages: 1_000_000, totalUsers: 1, userStats: users(["A", 1_000_000]) });
    const score = computeVibeScore(stats, [msg("A", stats.firstMessage, Array(50).fill("word").join(" "))]);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.total).toBeGreaterThanOrEqual(0);
  });
});
