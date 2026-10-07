"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Info } from "lucide-react";
import type { ParsedMessage } from "../../types";
import { buildTimeline } from "../../lib/analytics/timeline";
import type { WindowRange } from "../../lib/useChatStats";
import { cardClasses } from "./Cards";

/**
 * Time Machine: density heatmap of the whole chat with a day-granular brush.
 * Selecting a window re-filters the entire dashboard live; Replay Mode grows
 * the selection day-by-day. The `windowRange` in the parent is the single
 * source of truth — selection indices are derived from it, never mirrored.
 *
 * `activeRange` is the scope the preset filter allows (null = all-time).
 * Days outside it are dimmed and not selectable; drags and replay clamp to it.
 */

interface TimeMachineProps {
  messages: ParsedMessage[];
  dataRange: { firstMs: number; lastMs: number };
  windowRange: WindowRange | null;
  setWindowRange: (r: WindowRange | null) => void;
  /** Bounds allowed by the preset filter (null = all-time). */
  activeRange: WindowRange | null;
  /** Human label of the preset ("2024", "March 2024", "All-Time"). */
  activeLabel: string;
  isDark: boolean;
}

type Speed = 1 | 10 | 60 | 600; // days per second

const STRIP_H = 56;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function TimeMachine({
  messages,
  dataRange,
  windowRange,
  setWindowRange,
  activeRange,
  activeLabel,
  isDark,
}: TimeMachineProps) {
  const timeline = useMemo(
    () => (dataRange.firstMs ? buildTimeline(messages) : null),
    [messages, dataRange.firstMs]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed | 0>(0);

  const buckets = useMemo(() => timeline?.buckets ?? [], [timeline]);
  const firstDay = timeline?.firstDayMs ?? 0;
  const lastDay = timeline?.lastDayMs ?? 0;
  const bucketCount = buckets.length;

  // Preset scope in bucket indices; selection/interaction clamps to it.
  const activeBounds = useMemo<[number, number] | null>(() => {
    if (!activeRange || bucketCount === 0) return null;
    const startIdx = Math.max(0, Math.round((activeRange.startMs - firstDay) / DAY_MS));
    const endIdx = Math.min(bucketCount - 1, Math.round((activeRange.endMs - firstDay) / DAY_MS));
    if (startIdx > endIdx) return null;
    return [startIdx, endIdx];
  }, [activeRange, firstDay, bucketCount]);

  // Selection indices derived from the authoritative windowRange, clamped
  // into the preset scope (a stored window may predate a later preset change).
  const sel = useMemo<[number, number] | null>(() => {
    if (!windowRange || bucketCount === 0) return null;
    const startIdx = Math.max(0, Math.round((windowRange.startMs - firstDay) / DAY_MS));
    const endIdx = Math.min(bucketCount - 1, Math.round((windowRange.endMs - firstDay) / DAY_MS));
    if (activeBounds) {
      return [
        Math.max(activeBounds[0], startIdx),
        Math.min(activeBounds[1], endIdx),
      ];
    }
    return [startIdx, endIdx];
  }, [windowRange, firstDay, bucketCount, activeBounds]);

  // Latest range for the replay interval without re-subscribing every tick.
  const windowRef = useRef<WindowRange | null>(windowRange);
  useEffect(() => {
    windowRef.current = windowRange;
  }, [windowRange]);

  const selectDays = useCallback(
    (startIdxRaw: number, endIdxRaw: number) => {
      if (bucketCount === 0) return;
      // Clamp into the preset scope before normalizing order.
      const lo = activeBounds ? activeBounds[0] : 0;
      const hi = activeBounds ? activeBounds[1] : bucketCount - 1;
      const s = Math.max(lo, Math.min(startIdxRaw, endIdxRaw));
      const e = Math.min(hi, Math.max(startIdxRaw, endIdxRaw));
      setWindowRange({ startMs: buckets[s].dayMs, endMs: buckets[e].dayMs });
    },
    [bucketCount, buckets, setWindowRange, activeBounds]
  );

  const clearSelection = useCallback(() => {
    setSpeed(0);
    setWindowRange(null);
  }, [setWindowRange]);

  // Toggle replay from a click handler (never from an effect body).
  const toggleReplay = (next: Speed) => {
    if (speed === next) {
      setSpeed(0);
      return;
    }
    setSpeed(next);
    if (!windowRef.current && bucketCount > 0) {
      // Replay starts where the active scope starts, not at all-time day 0.
      const startIdx = activeBounds ? activeBounds[0] : 0;
      selectDays(startIdx, startIdx);
    }
  };

  // ---- Replay loop -------------------------------------------------------
  useEffect(() => {
    if (speed === 0 || bucketCount === 0) return;
    const timer = setInterval(() => {
      const current = windowRef.current;
      if (!current) return;
      const endIdx = Math.round((current.endMs - firstDay) / DAY_MS);
      const nextEnd = Math.min(bucketCount - 1, endIdx + speed);
      if (nextEnd === endIdx) {
        setSpeed(0); // reached the end
        return;
      }
      setWindowRange({ startMs: current.startMs, endMs: buckets[nextEnd].dayMs });
    }, 1000);
    return () => clearInterval(timer);
  }, [speed, bucketCount, firstDay, buckets, setWindowRange]);

  // Key moments inside the current window — derived, no state.
  const activeMoment = useMemo(() => {
    if (!timeline || !windowRange) return null;
    const inWindow = timeline.keyMoments.filter(
      (m) => m.dayMs >= windowRange.startMs && m.dayMs <= windowRange.endMs
    );
    return inWindow.length ? inWindow[inWindow.length - 1] : null;
  }, [timeline, windowRange]);

  // ---- Canvas rendering --------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bucketCount === 0) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = containerRef.current!.getBoundingClientRect();
      const W = rect.width;
      const H = STRIP_H;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const n = bucketCount;
      const barW = Math.max(1, W / n - 0.4); // hairline gap
      const maxCount = timeline?.maxCount || 1;

      for (let i = 0; i < n; i++) {
        const x = (i / n) * W;
        const t = buckets[i].count / maxCount;
        // Log-ish scaling so quiet days are still visible
        const hFrac = t === 0 ? 0.04 : 0.08 + Math.sqrt(t) * 0.92;
        const h = H * hFrac;

        const inSel = sel && i >= sel[0] && i <= sel[1];
        // Outside the preset scope: visibly locked, never looks selectable.
        const outOfScope =
          activeBounds !== null && (i < activeBounds[0] || i > activeBounds[1]);
        let color: string;
        if (inSel) color = "#3b82f6";
        else if (outOfScope)
          color = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
        else if (sel) color = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
        else color = isDark ? `rgba(59,130,246,${0.25 + t * 0.75})` : `rgba(59,130,246,${0.35 + t * 0.65})`;

        ctx.fillStyle = color;
        ctx.fillRect(x, H - h, barW, h);
      }

      // Key moment markers on top
      if (timeline) {
        for (const m of timeline.keyMoments) {
          const idx = Math.round((m.dayMs - firstDay) / DAY_MS);
          if (idx < 0 || idx >= n) continue;
          if (activeBounds && (idx < activeBounds[0] || idx > activeBounds[1])) continue;
          const x = (idx / n) * W + barW / 2;
          ctx.beginPath();
          ctx.arc(x, 8, 4, 0, Math.PI * 2);
          ctx.fillStyle =
            m.type === "crown" ? "#eab308" :
            m.type === "peak" ? "#f97316" :
            m.type === "silence" ? "#6b7280" :
            m.type === "start" ? "#10b981" : "#3b82f6";
          ctx.fill();
        }
      }

      // Hover cursor — suppressed over out-of-scope days
      if (hoverDay !== null && !(activeBounds && (hoverDay < activeBounds[0] || hoverDay > activeBounds[1]))) {
        const x = (hoverDay / n) * W;
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
        ctx.fillRect(x, 0, 1, H);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(containerRef.current!);
    return () => ro.disconnect();
  }, [buckets, bucketCount, sel, hoverDay, isDark, timeline, firstDay, activeBounds]);

  // ---- Pointer interactions ----------------------------------------------
  const dayFromEvent = useCallback(
    (clientX: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas || bucketCount === 0) return null;
      const rect = canvas.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.min(bucketCount - 1, Math.floor(frac * bucketCount));
    },
    [bucketCount]
  );

  const dragState = useRef<{ anchor: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (speed !== 0) setSpeed(0);
    const day = dayFromEvent(e.clientX);
    if (day === null) return;
    // Clamp the anchor so a drag started outside the scope snaps inside it.
    const clamped = activeBounds
      ? Math.max(activeBounds[0], Math.min(activeBounds[1], day))
      : day;
    dragState.current = { anchor: clamped };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    selectDays(clamped, clamped);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const day = dayFromEvent(e.clientX);
    setHoverDay(day);
    if (dragState.current && day !== null) {
      selectDays(dragState.current.anchor, day);
    }
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  // ---- Keyboard a11y (role="slider") --------------------------------------
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (bucketCount === 0) return;
    const lo = activeBounds ? activeBounds[0] : 0;
    const hi = activeBounds ? activeBounds[1] : bucketCount - 1;
    const current = sel ? sel[1] : lo;
    let next: number | null = null;

    if (e.key === "ArrowRight") next = Math.min(hi, current + (e.shiftKey ? 7 : 1));
    else if (e.key === "ArrowLeft") next = Math.max(lo, current - (e.shiftKey ? 7 : 1));
    else if (e.key === "Home") next = lo;
    else if (e.key === "End") next = hi;
    else if (e.key === "Escape" && windowRange) {
      e.preventDefault();
      clearSelection();
      return;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      clearSelection();
      return;
    } else {
      return;
    }

    e.preventDefault();
    setSpeed(0);
    selectDays(next, next);
  };

  const fmtDay = (ms: number) =>
    new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const selLabel = sel && bucketCount
    ? `${fmtDay(buckets[sel[0]].dayMs)} → ${fmtDay(buckets[sel[1]].dayMs)}`
    : null;

  // Live region: derived directly from selection state — aria-live announces
  // it whenever the text content changes.
  const announcement = selLabel
    ? `${activeLabel}: ${selLabel} selected`
    : `${activeLabel} selected`;

  // Honest chip: preset scope + selected window, both when both apply.
  const chipLabel = selLabel
    ? activeLabel === "All-Time"
      ? `${selLabel} (selected window)`
      : `${activeLabel} · ${selLabel} (selected window)`
    : null;

  const yearsSpan = firstDay && lastDay ? ((lastDay - firstDay) / (365.25 * DAY_MS)).toFixed(1) : "0";

  const scopeNote = activeRange
    ? `${activeLabel} scope — days outside are locked`
    : null;

  return (
    <div className={`rounded-2xl border p-5 mb-10 ${cardClasses(isDark)}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Time Machine</h2>
          <p className={`text-xs mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {timeline ? `${timeline.activeDays.toLocaleString("en-IN")} active days across ${yearsSpan} years — drag to zoom any era` : "No data"}
            {scopeNote ? ` · ${scopeNote}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {chipLabel && (
            <button
              onClick={clearSelection}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isDark ? "bg-[#3b82f6]/15 text-blue-400 hover:bg-[#3b82f6]/25" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              <X size={13} />
              {chipLabel}
            </button>
          )}

          <div className={`flex items-center rounded-full p-0.5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`} role="group" aria-label="Replay speed">
            {([1, 10, 60, 600] as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => toggleReplay(s)}
                aria-pressed={speed === s}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  speed === s
                    ? "bg-[#3b82f6] text-white"
                    : isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {s === 1 ? "1×" : `${s}d/s`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas strip */}
      <div
        ref={containerRef}
        className="relative w-full select-none touch-none"
        style={{ height: STRIP_H }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          aria-hidden
        />
        {/* Interaction + a11y slider surface (visually transparent, sits above canvas) */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Time Machine scrubber — selects the analyzed date range"
          aria-valuemin={activeBounds ? activeBounds[0] : 0}
          aria-valuemax={activeBounds ? activeBounds[1] : Math.max(0, bucketCount - 1)}
          aria-valuenow={sel ? sel[1] : activeBounds ? activeBounds[0] : 0}
          aria-valuetext={selLabel ? `${activeLabel}: ${selLabel}` : activeLabel}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] rounded-xl"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { setHoverDay(null); dragState.current = null; }}
        />
        {/* Selection overlay frame */}
        {sel && bucketCount > 0 && (
          <div
            className="absolute top-0 bottom-0 border-x-2 border-[#3b82f6] pointer-events-none"
            style={{
              left: `${(sel[0] / bucketCount) * 100}%`,
              width: `${((sel[1] - sel[0] + 1) / bucketCount) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Live region for screen readers */}
      <span className="sr-only" aria-live="polite">{announcement}</span>

      {/* Hover tooltip */}
      <div className={`h-5 mt-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
        {hoverDay !== null && buckets[hoverDay] && (
          <span>
            <span className="font-semibold">{fmtDay(buckets[hoverDay].dayMs)}</span>
            {" · "}{buckets[hoverDay].count.toLocaleString("en-IN")} messages
            {activeBounds && (hoverDay < activeBounds[0] || hoverDay > activeBounds[1]) && (
              <span className="ml-1 opacity-70">· outside {activeLabel}</span>
            )}
          </span>
        )}
      </div>

      {/* Replay moment ticker */}
      {activeMoment && (
        <div className={`mt-1 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl ${
          isDark ? "bg-white/5 text-zinc-200" : "bg-zinc-50 text-zinc-700"
        }`}>
          <span>{activeMoment.icon} {activeMoment.title} — {activeMoment.detail}</span>
        </div>
      )}

      <div className={`mt-3 flex items-start gap-1.5 text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        <Info size={12} className="mt-0.5 flex-shrink-0" />
        <span>
          Everything below — stats, leaderboard, word cloud, Hall of Fame — recomputes live for the selected window.
          Speeds are days-per-second of replay. Keyboard: ←/→ move a day, Shift+←/→ a week, Home/End jump, Esc clears.
        </span>
      </div>
    </div>
  );
}
