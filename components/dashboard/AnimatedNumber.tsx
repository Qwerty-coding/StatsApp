"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric value toward its target over ~350ms — makes stats tick
 * smoothly during Time Machine replay instead of hard-swapping digits.
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
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    // Huge jumps (fresh parse) snap instantly; small deltas animate.
    if (Math.abs(to - from) > Math.max(1000, to)) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durationMs]);

  return <>{format(display)}</>;
}
