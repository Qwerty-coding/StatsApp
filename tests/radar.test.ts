import { describe, it, expect } from "vitest";
import { radarLayout, axisPoint, labelBox, estimateLabelWidth } from "../lib/analytics/radar";

/**
 * Regression tests for the VibeScore radar clipping bug: labels used to sit
 * at a fixed 1.22× rim radius inside a fixed 210px viewBox, so long labels
 * overflowed the edge. The layout now derives padding from the labels.
 */

const REAL_LABELS = ["Activity", "Balance", "Loyalty", "Chaos", "Depth"];
const WORST_CASE_LABELS = ["Activity", "Balance", "Loyalty", "Chaos", "Depth", "BIGGEST CHATTERBOX"];

describe("estimateLabelWidth", () => {
  it("scales with text length and is deterministic", () => {
    expect(estimateLabelWidth("ACTIVITY")).toBeGreaterThan(0);
    expect(estimateLabelWidth("ACTIVITY")).toBe(estimateLabelWidth("ACTIVITY"));
    expect(estimateLabelWidth("ACTIVITY")).toBeLessThan(estimateLabelWidth("A VERY LONG AXIS LABEL"));
  });

  it("returns 0 for empty labels", () => {
    expect(estimateLabelWidth("")).toBe(0);
  });
});

describe("radarLayout", () => {
  it("grows padding for longer labels", () => {
    const short = radarLayout(REAL_LABELS);
    const long = radarLayout(WORST_CASE_LABELS);
    expect(long.pad).toBeGreaterThan(short.pad);
    expect(long.size).toBeGreaterThan(short.size);
  });

  it("keeps the rim + label radius inside the viewBox", () => {
    const layout = radarLayout(WORST_CASE_LABELS);
    expect(layout.labelR).toBeLessThan(layout.center);
    expect(layout.center + layout.labelR).toBeLessThanOrEqual(layout.size - layout.pad);
  });
});

describe("label clipping regression", () => {
  it("every real label fits inside [0, size] on both axes", () => {
    const layout = radarLayout(REAL_LABELS);
    for (let i = 0; i < REAL_LABELS.length; i++) {
      const box = labelBox(layout, i, REAL_LABELS.length, REAL_LABELS[i]);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(layout.size);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.size);
    }
  });

  it("every worst-case label (incl. 15-char) fits inside [0, size] on both axes", () => {
    const layout = radarLayout(WORST_CASE_LABELS);
    for (let i = 0; i < WORST_CASE_LABELS.length; i++) {
      const box = labelBox(layout, i, WORST_CASE_LABELS.length, WORST_CASE_LABELS[i]);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(layout.size);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.size);
    }
  });

  it("axis points stay within the rim radius", () => {
    const layout = radarLayout(REAL_LABELS);
    for (let i = 0; i < REAL_LABELS.length; i++) {
      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        const [x, y] = axisPoint(layout, i, REAL_LABELS.length, frac);
        expect(x).toBeGreaterThanOrEqual(layout.center - layout.r);
        expect(x).toBeLessThanOrEqual(layout.center + layout.r);
        expect(y).toBeGreaterThanOrEqual(layout.center - layout.r);
        expect(y).toBeLessThanOrEqual(layout.center + layout.r);
      }
    }
  });
});
