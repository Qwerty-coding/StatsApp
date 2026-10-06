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
 */

interface TimeMachineProps {
  messages: ParsedMessage[];
  dataRange: { firstMs: number; lastMs: number };
  windowRange: WindowRange | null;
  setWindowRange: (r: WindowRange | null) => void;
  isDark: boolean;
}

type Speed = 1 | 10 | 60 | 600; // days per second

const STRIP_H = 56;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function TimeMachine({ messages, dataRange, windowRange, setWindowRange, isDark }: TimeMachineProps) {
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

  // Selection indices derived from the authoritative windowRange.
  const sel = useMemo<[number, number] | null>(() => {
    if (!windowRange || bucketCount === 0) return null;
    const startIdx = Math.max(0, Math.round((windowRange.startMs - firstDay) / DAY_MS));
    const endIdx = Math.min(bucketCount - 1, Math.round((windowRange.endMs - firstDay) / DAY_MS));
    return [startIdx, endIdx];
  }, [windowRange, firstDay, bucketCount]);

  // Latest range for the replay interval without re-subscribing every tick.
  const windowRef = useRef<WindowRange | null>(windowRange);
  useEffect(() => {
    windowRef.current = windowRange;
  }, [windowRange]);

  const selectDays = useCallback(
    (startIdx: number, endIdx: number) => {
      if (bucketCount === 0) return;
      const s = Math.max(0, Math.min(startIdx, endIdx));
      const e = Math.min(bucketCount - 1, Math.max(startIdx, endIdx));
      setWindowRange({ startMs: buckets[s].dayMs, endMs: buckets[e].dayMs });
    },
    [bucketCount, buckets, setWindowRange]
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
      selectDays(0, 0);
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

        let color: string;
        const inSel = sel && i >= sel[0] && i <= sel[1];
        if (inSel) color = "#3b82f6";
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

      // Hover cursor
      if (hoverDay !== null) {
        const x = (hoverDay / n) * W;
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
        ctx.fillRect(x, 0, 1, H);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(containerRef.current!);
    return () => ro.disconnect();
  }, [buckets, bucketCount, sel, hoverDay, isDark, timeline, firstDay]);

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
    dragState.current = { anchor: day };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    selectDays(day, day);
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

  const fmtDay = (ms: number) =>
    new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const selLabel = sel && bucketCount
    ? `${fmtDay(buckets[sel[0]].dayMs)} → ${fmtDay(buckets[sel[1]].dayMs)}`
    : null;

  const yearsSpan = firstDay && lastDay ? ((lastDay - firstDay) / (365.25 * DAY_MS)).toFixed(1) : "0";

  return (
    <div className={`rounded-2xl border p-5 mb-10 ${cardClasses(isDark)}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Time Machine</h2>
          <p className={`text-xs mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {timeline ? `${timeline.activeDays.toLocaleString("en-IN")} active days across ${yearsSpan} years — drag to zoom any era` : "No data"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selLabel && (
            <button
              onClick={clearSelection}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isDark ? "bg-[#3b82f6]/15 text-blue-400 hover:bg-[#3b82f6]/25" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              <X size={13} />
              {selLabel}
            </button>
          )}

          <div className={`flex items-center rounded-full p-0.5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
            {([1, 10, 60, 600] as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => toggleReplay(s)}
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

      {/* Hover tooltip */}
      <div className={`h-5 mt-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
        {hoverDay !== null && buckets[hoverDay] && (
          <span>
            <span className="font-semibold">{fmtDay(buckets[hoverDay].dayMs)}</span>
            {" · "}{buckets[hoverDay].count.toLocaleString("en-IN")} messages
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
          Speeds are days-per-second of replay.
        </span>
      </div>
    </div>
  );
}
