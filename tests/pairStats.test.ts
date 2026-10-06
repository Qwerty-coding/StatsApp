import { describe, it, expect } from "vitest";
import { computePairStats } from "../lib/analytics/pairStats";
import type { ParsedMessage } from "../types";

const M = 60_000;
const H = 3_600_000;
const DAY_T0 = new Date(2024, 5, 10, 8, 0, 0).getTime(); // 2024-06-10 08:00 local

function msg(sender: string, ts: number, text = "hello there friend"): ParsedMessage {
  return { sender, timestamp: ts, text, isMedia: false, isSystem: false };
}

describe("computePairStats", () => {
  it("counts directed replies and exchange totals", () => {
    const t0 = DAY_T0;
    const messages = [
      msg("Priya", t0),
      msg("Rohan", t0 + 42_000),        // Rohan → Priya, 42s
      msg("Priya", t0 + 60_000),        // Priya → Rohan, 18s
      msg("Rohan", t0 + 120_000),       // Rohan → Priya, 60s
    ];
    const { pairs, members } = computePairStats(messages);

    expect(pairs).toHaveLength(1);
    const p = pairs[0];
    expect([p.a, p.b]).toEqual(["Priya", "Rohan"]); // lexicographic
    expect(p.exchanges).toBe(3);
    expect(p.fastExchanges).toBe(3); // all under 5 min
    expect(p.bToA.replies).toBe(2);  // Rohan replied twice
    expect(p.aToB.replies).toBe(1);  // Priya replied once

    const rohan = members.find((m) => m.sender === "Rohan")!;
    expect(rohan.repliesGiven).toBe(2);
    expect(rohan.repliesReceived).toBe(1);
    expect(rohan.messageCount).toBe(2);
  });

  it("skips system messages entirely", () => {
    const t0 = DAY_T0;
    const messages = [
      msg("A", t0),
      { ...msg("System", t0 + 1000, "Alice added Bob"), sender: "System", isSystem: true },
      msg("B", t0 + 30_000),
    ];
    const { pairs, members } = computePairStats(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].exchanges).toBe(1);
    expect(members.map((m) => m.sender).sort()).toEqual(["A", "B"]);
  });

  it("excludes month-long gaps from reply-time stats but keeps the exchange", () => {
    const t0 = DAY_T0;
    const MONTH = 30 * 24 * H;
    const messages = [
      msg("A", t0),
      msg("B", t0 + MONTH),      // 30-day "reply" — real, but not a chat reply
      msg("A", t0 + MONTH + 10_000), // 10s reply — counts for timing
    ];
    const { pairs } = computePairStats(messages);
    const p = pairs[0];
    expect(p.exchanges).toBe(2);
    // Both directions register a reply event…
    expect(p.aToB.replies).toBe(1);
    expect(p.bToA.replies).toBe(1);
    // …but only the 10s gap is inside the 24h reply window.
    expect(p.aToB.avgMs).toBe(10_000);
    expect(p.bToA.avgMs).toBe(Infinity);
    expect(p.avgReplyMs).toBe(10_000);
    expect(p.medianReplyMs).toBe(10_000);
  });

  it("tracks monologue streaks", () => {
    const t0 = DAY_T0;
    const messages = [
      msg("A", t0),
      msg("A", t0 + 1000),
      msg("A", t0 + 2000),
      msg("B", t0 + 3000),
      msg("B", t0 + 4000),
    ];
    const { members } = computePairStats(messages);
    expect(members.find((m) => m.sender === "A")!.longestStreak).toBe(3);
    expect(members.find((m) => m.sender === "B")!.longestStreak).toBe(2);
  });

  it("counts ghosts (>2h silence after their message)", () => {
    const t0 = DAY_T0;
    const messages = [
      msg("A", t0),
      msg("B", t0 + 3 * H),     // A was ghosted on
      msg("A", t0 + 3 * H + M), // quick reply
      msg("B", t0 + 3 * H + 2 * M),
    ];
    const { members } = computePairStats(messages);
    expect(members.find((m) => m.sender === "A")!.ghostCount).toBe(1);
    expect(members.find((m) => m.sender === "B")!.ghostCount).toBe(0);
  });

  it("computes night ratio from 22:00–04:59 messages", () => {
    const night = new Date(2024, 5, 10, 23, 30).getTime();
    const day = new Date(2024, 5, 10, 14, 0).getTime();
    const { members } = computePairStats([
      msg("A", night),
      msg("A", day),
    ]);
    expect(members[0].nightRatio).toBeCloseTo(0.5, 5);
  });

  it("handles empty input", () => {
    const { pairs, members } = computePairStats([]);
    expect(pairs).toEqual([]);
    expect(members).toEqual([]);
  });
});
