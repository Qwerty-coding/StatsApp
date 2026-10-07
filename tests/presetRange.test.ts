import { describe, it, expect } from "vitest";
import { presetRangeFromFilter, presetLabel } from "../lib/presetRange";

describe("presetRangeFromFilter", () => {
  it("returns null for all-time", () => {
    expect(presetRangeFromFilter("all")).toBeNull();
    expect(presetRangeFromFilter("")).toBeNull();
  });

  it("spans the full year in local time", () => {
    const r = presetRangeFromFilter("2024")!;
    expect(new Date(r.startMs).getFullYear()).toBe(2024);
    expect(new Date(r.startMs).getMonth()).toBe(0);
    expect(new Date(r.startMs).getDate()).toBe(1);
    expect(new Date(r.startMs).getHours()).toBe(0);
    expect(new Date(r.endMs).getFullYear()).toBe(2024);
    expect(new Date(r.endMs).getMonth()).toBe(11);
    expect(new Date(r.endMs).getDate()).toBe(31);
    expect(new Date(r.endMs).getHours()).toBe(23);
  });

  it("spans the exact month including length differences", () => {
    const jan = presetRangeFromFilter("2024-01")!;
    expect(new Date(jan.startMs).getDate()).toBe(1);
    expect(new Date(jan.endMs).getDate()).toBe(31);

    const feb = presetRangeFromFilter("2024-02")!; // leap year
    expect(new Date(feb.endMs).getDate()).toBe(29);
    const feb23 = presetRangeFromFilter("2023-02")!; // non-leap
    expect(new Date(feb23.endMs).getDate()).toBe(28);

    const dec = presetRangeFromFilter("2023-12")!;
    expect(new Date(dec.endMs).getDate()).toBe(31);
  });

  it("endMs is start-of-next-day minus 1ms (inclusive whole days)", () => {
    const r = presetRangeFromFilter("2024-06")!;
    // June: 30 days → 29 day-gaps + one day minus 1ms.
    expect(r.endMs - r.startMs).toBe(
      29 * 24 * 60 * 60 * 1000 + 86_399_999
    );
  });

  it("returns null for garbage filters", () => {
    expect(presetRangeFromFilter("2024-13")).toBeNull();
    expect(presetRangeFromFilter("2024-00")).toBeNull();
    expect(presetRangeFromFilter("hello")).toBeNull();
  });
});

describe("presetLabel", () => {
  it("labels all-time, years and months", () => {
    expect(presetLabel("all")).toBe("All-Time");
    expect(presetLabel("")).toBe("All-Time");
    expect(presetLabel("2024")).toBe("2024");
    expect(presetLabel("2024-03")).toBe("2024-03");
  });

  it("uses the month label map when given", () => {
    const labels = new Map([["2024-03", "March 2024"]]);
    expect(presetLabel("2024-03", labels)).toBe("March 2024");
  });
});
