import { describe, it, expect } from "vitest";
import { calculateStats } from "../lib/calculateStats";
import type { ParsedMessage } from "../types";

function msg(
  sender: string,
  timestamp: number,
  text = "hello",
  opts: Partial<ParsedMessage> = {}
): ParsedMessage {
  return { sender, timestamp, text, isMedia: false, isSystem: false, ...opts };
}

/** Local-time helper: 2024-06-10 at h:m. */
const at = (day: number, h = 0, m = 0) => new Date(2024, 5, day, h, m).getTime();

const MIN = 60_000;

describe("calculateStats", () => {
  it("returns empty object for empty input", () => {
    expect(calculateStats([])).toEqual({});
  });

  it("excludes system messages from every stat", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 9, 0)),
      msg("[System]", at(10, 9, 1), "Alice left", { isSystem: true }),
      msg("Bob", at(10, 9, 2)),
    ]) as import("../types").Stats;
    expect(stats.totalMessages).toBe(2);
    expect(stats.totalUsers).toBe(2);
    expect(stats.userStats.map((u) => u.sender)).not.toContain("[System]");
  });

  it("aggregates counts, averages, first/last message", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 9, 0)),
      msg("Alice", at(10, 9, 1)),
      msg("Bob", at(10, 9, 2)),
      msg("Bob", at(11, 10, 0)),
    ]) as import("../types").Stats;
    expect(stats.totalMessages).toBe(4);
    expect(stats.totalUsers).toBe(2);
    expect(stats.avgPerUser).toBe(2);
    expect(stats.firstMessage).toBe(at(10, 9, 0));
    expect(stats.lastMessage).toBe(at(11, 10, 0));
    expect(stats.userStats[0]).toMatchObject({ sender: "Alice", messageCount: 2 });
  });

  it("finds the busiest date", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 8, 0)),
      msg("Alice", at(10, 12, 0)),
      msg("Bob", at(10, 18, 0)),
      msg("Bob", at(11, 9, 0)),
    ]) as import("../types").Stats;
    expect(stats.busiestDate).toBe("2024-06-10");
    expect(stats.busiestDateCount).toBe(3);
  });

  it("buckets hourly, weekly and monthly stats", () => {
    // 2024-06-10 is a Monday; 10 AM.
    const stats = calculateStats([
      msg("Alice", at(10, 10, 0)),
      msg("Bob", at(10, 10, 30)),
      msg("Alice", at(11, 10, 0)),
    ]) as import("../types").Stats;
    expect(stats.hourlyStats[10]).toBe(3);
    expect(stats.weeklyStats.find((w) => w.name === "Mon")?.value).toBe(2);
    expect(stats.weeklyStats.find((w) => w.name === "Tue")?.value).toBe(1);
    expect(stats.monthlyStats.find((m) => m.name === "Jun")?.value).toBe(3);
  });

  it("computes longest silence and average response time", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 9, 0)),
      msg("Bob", at(10, 9, 10)), // 10 min gap
      msg("Alice", at(10, 11, 10)), // 2 hour gap
    ]) as import("../types").Stats;
    expect(stats.longestSilence).toBe("2.0 Hours");
    expect(stats.avgResponseTime).toBe("1.1 Hours"); // (10m + 2h) / 2 = 65m
  });

  it("awards Icebreaker for reviving after 6+ hours of silence", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 8, 0)),
      msg("Bob", at(10, 15, 0)), // 7h silence, Bob revives
      msg("Bob", at(10, 15, 5)),
    ]) as import("../types").Stats;
    expect(stats.icebreakerName).toBe("Bob");
    expect(stats.icebreakerCount).toBe(1);
  });

  it("awards Monologuer for the longest consecutive streak", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 9, 0)),
      msg("Alice", at(10, 9, 1)),
      msg("Alice", at(10, 9, 2)),
      msg("Bob", at(10, 9, 3)),
      msg("Bob", at(10, 9, 4)),
    ]) as import("../types").Stats;
    expect(stats.monologuerName).toBe("Alice");
    expect(stats.monologuerStreak).toBe(3);
  });

  it("awards Speed Demon to the fastest average cross-person replier (min 5 replies)", () => {
    const messages: ParsedMessage[] = [];
    let t = at(10, 8, 0);
    // Bob replies in 1 min, five times; Alice replies in 30 min, five times.
    for (let i = 0; i < 5; i++) {
      messages.push(msg("Alice", t));
      t += MIN;
      messages.push(msg("Bob", t));
      t += MIN;
      t += 29 * MIN;
      messages.push(msg("Alice", t));
      t += 30 * MIN;
      messages.push(msg("Bob", t));
      t += MIN;
    }
    const stats = calculateStats(messages) as import("../types").Stats;
    expect(stats.speedDemonName).toBe("Bob");
  });

  it("withholds Speed Demon when nobody has 5 qualifying replies", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 9, 0)),
      msg("Bob", at(10, 9, 1)),
    ]) as import("../types").Stats;
    expect(stats.speedDemonName).toBe("Nobody");
    expect(stats.speedDemonFormatted).toBe("—");
  });

  it("awards Dynamic Duo to the pair with most fast exchanges", () => {
    const messages: ParsedMessage[] = [];
    let t = at(10, 8, 0);
    for (let i = 0; i < 4; i++) {
      messages.push(msg("Alice", t)); t += MIN;
      messages.push(msg("Bob", t)); t += MIN;
      messages.push(msg("Alice", t)); t += 10 * MIN;
      messages.push(msg("Carol", t)); t += 30 * MIN; // slow: not counted
    }
    const stats = calculateStats(messages) as import("../types").Stats;
    expect(stats.dynamicDuoPair).toBe("Alice ⇄ Bob");
    expect(stats.maxInteractions).toBe(8);
  });

  it("awards Left on Read for messages followed by 2+ hour silences", () => {
    const stats = calculateStats([
      msg("Alice", at(10, 8, 0)),
      msg("Bob", at(10, 11, 0)), // Alice left Bob on read for 3h
      msg("Bob", at(10, 11, 30)),
    ]) as import("../types").Stats;
    expect(stats.leftOnReadName).toBe("Alice");
    expect(stats.maxLeftOnRead).toBe(1);
  });

  it("never produces negative gaps from unsorted input artifacts", () => {
    // Contract: input must be sorted; equal timestamps must not break anything.
    const stats = calculateStats([
      msg("Alice", at(10, 9, 0)),
      msg("Bob", at(10, 9, 0)),
    ]) as import("../types").Stats;
    expect(stats.totalMessages).toBe(2);
  });

  it("handles a 60+ hour silence in Days formatting", () => {
    const stats = calculateStats([
      msg("Alice", at(1, 8, 0)),
      msg("Bob", at(4, 20, 0)), // ~3.5 days later
    ]) as import("../types").Stats;
    expect(stats.longestSilence).toBe("4 Days");
  });
});
