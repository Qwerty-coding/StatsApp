"use client";

import { useMemo, useState } from "react";
import { calculateStats } from "./calculateStats";
import type { ParsedMessage, Stats, StatsResult } from "../types";

export type TimeFilter = string; // "all" | "YYYY" | "YYYY-MM"

export interface ChatFilterOptions {
  years: string[];
  months: { label: string; sortKey: string }[];
}

interface UseChatStatsResult {
  allMessages: ParsedMessage[];
  filteredMessages: ParsedMessage[];
  filterOptions: ChatFilterOptions;
  timeFilter: TimeFilter;
  setTimeFilter: (f: TimeFilter) => void;
  /** null when there are no valid messages in the current selection. */
  stats: Stats | null;
}

const THEME_KEY = "vibecheck.theme";
const FILTER_KEY = "vibecheck.timeFilter";

function readStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== "light";
  } catch {
    return true;
  }
}

export function useChatStats(data: {
  messages?: ParsedMessage[];
  warnings?: string[];
}): UseChatStatsResult {
  const messages = useMemo(() => data.messages ?? [], [data.messages]);

  // Sort once. Filtering preserves order, so calculateStats never re-sorts.
  const allMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  const filterOptions = useMemo<ChatFilterOptions>(() => {
    const yearSet = new Set<string>();
    const monthMap = new Map<string, { label: string; sortKey: string }>();

    for (const msg of allMessages) {
      if (msg.isSystem) continue;
      const d = new Date(msg.timestamp);
      if (isNaN(d.getTime())) continue;
      const year = String(d.getFullYear());
      yearSet.add(year);
      const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
          sortKey: monthKey,
        });
      }
    }

    const years = Array.from(yearSet).sort();
    const months = Array.from(monthMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return { years, months };
  }, [allMessages]);

  // Restore the last-used filter during the first render (client-only
  // component, so localStorage is available). Format-validated here; if the
  // stored filter matches no data in this chat, the dashboard shows its
  // empty-selection state with a reset button.
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
    try {
      const stored = localStorage.getItem(FILTER_KEY);
      if (stored && (stored === "all" || /^\d{4}$/.test(stored) || /^\d{4}-\d{2}$/.test(stored))) {
        return stored;
      }
    } catch {
      // private mode etc. — default is fine
    }
    return "all";
  });

  const setTimeFilterPersisted = (f: TimeFilter) => {
    setTimeFilter(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      // ignore
    }
  };

  const filteredMessages = useMemo(() => {
    if (timeFilter === "all") return allMessages;
    return allMessages.filter((msg) => {
      if (msg.isSystem) return false;
      const d = new Date(msg.timestamp);
      if (isNaN(d.getTime())) return false;
      if (timeFilter.length === 4) return String(d.getFullYear()) === timeFilter;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return monthKey === timeFilter;
    });
  }, [allMessages, timeFilter]);

  const rawStats = useMemo(() => calculateStats(filteredMessages), [filteredMessages]) as StatsResult;
  const stats: Stats | null = useMemo(
    () => ("totalMessages" in rawStats ? (rawStats as Stats) : null),
    [rawStats]
  );

  return { allMessages, filteredMessages, filterOptions, timeFilter, setTimeFilter: setTimeFilterPersisted, stats };
}

/** Persisted dark/light preference. Defaults to dark (the app's design). */
export function useTheme(): [boolean, (v: boolean) => void] {
  // Lazy init reads the stored preference once; client-only component, so
  // localStorage exists (guarded anyway for non-browser environments).
  const [isDark, setIsDark] = useState(readStoredTheme);

  const set = (v: boolean) => {
    setIsDark(v);
    try {
      localStorage.setItem(THEME_KEY, v ? "dark" : "light");
    } catch {
      // ignore
    }
  };

  return [isDark, set];
}
