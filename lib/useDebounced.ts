"use client";

import { useEffect, useState } from "react";

/**
 * Debounces a rapidly-changing value (scrub drags, replay ticks) so heavy
 * consumers — word extraction, force layouts, WebGL — recompute at most
 * once per `delayMs` after the value settles.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, debounced]);

  return debounced;
}
