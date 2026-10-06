import { describe, it, expect } from "vitest";
import { buildTimeline } from "../lib/analytics/timeline";
import type { ParsedMessage } from "../types";

const D = (dayIndex: number, hour = 12) =>
  new Date(2024, 0, 1 + dayIndex, hour, 0, 0).getTime();

function msg(sender: string, ts: number, text = "hey"): ParsedMessage {
  return { sender, timestamp: ts, text, isMedia: false, isSystem: false };
}

describe("buildTimeline", () => {
  it("creates contiguous day buckets with zero-fill", () => {
    const result = buildTimeline([
      msg("A", D(0)), msg("A", D(2)), msg("B", D(2)),
    ]);
    expect(result.buckets).toHaveLength(3);
    expect(result.buckets.map((b) => b.count)).toEqual([1, 0, 2]);
    expect(result.maxCount).toBe(2);
    expect(result.activeDays).toBe(2);
    expect(result.firstDayMs).toBe(D(0, 0));
    expect(result.lastDayMs).toBe(D(2, 0));
  });

  it("marks start, peak and end moments", () => {
    const result = buildTimeline([
      msg("A", D(0)),
      msg("A", D(3)), msg("B", D(3)), msg("A", D(3)), // peak: 3 messages
      msg("B", D(6)),
    ]);
    const types = result.keyMoments.map((m) => m.type);
    expect(types).toContain("start");
    expect(types).toContain("peak");
    expect(types).toContain("end");
    const peak = result.keyMoments.find((m) => m.type === "peak")!;
    expect(peak.dayMs).toBe(D(3, 0));
    expect(peak.detail).toContain("3");
  });

  it("detects the longest silence (>= 3 days)", () => {
    const result = buildTimeline([
      msg("A", D(0)),
      msg("A", D(1)),
      msg("B", D(10)), // 8-day gap after day 1
      msg("B", D(11)),
    ]);
    const silence = result.keyMoments.find((m) => m.type === "silence")!;
    expect(silence).toBeDefined();
    expect(silence.dayMs).toBe(D(1, 0));
    expect(silence.detail).toContain("8 days");
  });

  it("records crown changes when the top talker changes", () => {
    const messages: ParsedMessage[] = [];
    // Days 0–4: Alice talks a lot; days 5–9: Bob overtakes
    for (let d = 0; d < 5; d++) {
      for (let i = 0; i < 10; i++) messages.push(msg("Alice", D(d, 9 + i)));
      messages.push(msg("Bob", D(d, 20)));
    }
    for (let d = 5; d < 10; d++) {
      for (let i = 0; i < 15; i++) messages.push(msg("Bob", D(d, 9 + i)));
    }
    const result = buildTimeline(messages);
    const crowns = result.keyMoments.filter((m) => m.type === "crown");
    expect(crowns.length).toBeGreaterThanOrEqual(1);
    expect(crowns.some((c) => c.title.includes("Bob"))).toBe(true);
    // Crown day must be within the Bob surge
    const bobCrown = crowns.find((c) => c.title.includes("Bob"))!;
    expect(bobCrown.dayMs).toBeGreaterThanOrEqual(D(5, 0));
  });

  it("handles empty chats", () => {
    const result = buildTimeline([]);
    expect(result.buckets).toEqual([]);
    expect(result.keyMoments).toEqual([]);
    expect(result.maxCount).toBe(0);
  });
});
