/**
 * Derives the concrete time window behind a preset time filter
 * ("all" | "YYYY" | "YYYY-MM"). Pure — unit-tested and shared by the
 * dashboard hook and the Time Machine scrubber so both agree on scope.
 */

export interface PresetRange {
  startMs: number;
  endMs: number;
}

function localMidnight(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day).getTime();
}

/**
 * Returns the local-time bounds of the filter, or null for "all-time".
 * `endMs` is the last millisecond of the period (23:59:59.999).
 */
export function presetRangeFromFilter(timeFilter: string): PresetRange | null {
  if (timeFilter === "all" || !timeFilter) return null;

  if (/^\d{4}$/.test(timeFilter)) {
    const year = Number(timeFilter);
    return { startMs: localMidnight(year, 0, 1), endMs: localMidnight(year, 11, 31) + 86_399_999 };
  }

  if (/^\d{4}-\d{2}$/.test(timeFilter)) {
    const [year, month] = timeFilter.split("-").map(Number);
    if (month < 1 || month > 12) return null;
    // Day 0 of the next month = last day of this month.
    const lastDay = new Date(year, month, 0).getDate();
    return { startMs: localMidnight(year, month - 1, 1), endMs: localMidnight(year, month - 1, lastDay) + 86_399_999 };
  }

  return null;
}

/** Human label for a preset filter — used by chips and a11y announcements. */
export function presetLabel(timeFilter: string, monthLabels?: Map<string, string>): string {
  if (timeFilter === "all" || !timeFilter) return "All-Time";
  if (/^\d{4}$/.test(timeFilter)) return timeFilter;
  if (/^\d{4}-\d{2}$/.test(timeFilter)) {
    return monthLabels?.get(timeFilter) ?? timeFilter;
  }
  return timeFilter;
}
