"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric value toward its target over ~350ms — makes stats tick
 * smoothly during Time Machine replay instead of hard-swapping digits.
 *
 * React 19 pattern, lint-rule-clean: value changes are detected and
 * snap-vs-tween is decided *during render* (setPrevValue), with all
 * tween state in useState — refs are touched only inside effects/rAF.
 */
export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString("en-IN"),
  durationMs = 350,
}: {
  value: number;
  format?: (v: number) => string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const [from, setFrom] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const rafRef = useRef(0);

  // Adjust-during-render (the documented alternative to setState-in-effect).
  if (value !== prevValue) {
    setPrevValue(value);
    let reduceMotion = false;
    try {
      reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // non-browser environment — animate is fine
    }
    // Huge jumps (fresh parse/scrub landing) snap instantly; small deltas tween.
    const tooBig = Math.abs(value - from) > Math.max(1000, value);
    if (reduceMotion || tooBig) {
      setFrom(value);
      setDisplay(value);
    }
    // else: keep `from` where it is — the effect below tweens to the new value.
  }

  useEffect(() => {
    if (from === value) return; // already there (snapped, no change, or done)

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
        setDisplay(current);
      } else {
        setDisplay(value);
        setFrom(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [from, value, durationMs]);

  return <>{format(display)}</>;
}
