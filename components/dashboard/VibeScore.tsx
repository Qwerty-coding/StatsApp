"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { ParsedMessage, Stats } from "../../types";
import { computeVibeScore, type VibeAxis } from "../../lib/analytics/vibeScore";
import { radarLayout, axisPoint } from "../../lib/analytics/radar";
import { cardClasses } from "./Cards";

/**
 * The Vibe Score card: a 0–100 verdict on the chat plus a 5-axis radar
 * (Activity, Balance, Loyalty, Chaos, Depth). Hand-rolled SVG — no chart lib.
 */

export default function VibeScore({ stats, messages, isDark }: { stats: Stats; messages: ParsedMessage[]; isDark: boolean }) {
  const vibe = useMemo(() => computeVibeScore(stats, messages), [stats, messages]);

  const scoreColor =
    vibe.total >= 70 ? "#10b981" :
    vibe.total >= 55 ? "#3b82f6" :
    vibe.total >= 40 ? "#f97316" : "#f43f5e";

  return (
    <div className={`rounded-2xl border p-6 mb-10 relative overflow-hidden ${cardClasses(isDark)}`}>
      <div
        className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-[0.07] blur-3xl pointer-events-none"
        style={{ background: scoreColor }}
      />
      <div className="grid md:grid-cols-[minmax(0,auto)_1fr] gap-8 items-center">
        {/* Radar */}
        <Radar axes={vibe.axes} isDark={isDark} accent={scoreColor} />

        {/* Score + verdict */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} style={{ color: scoreColor }} />
            <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Vibe Score
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-7xl font-black tracking-tighter" style={{ color: scoreColor }}>
              {vibe.total}
            </span>
            <span className={`text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>/ 100</span>
          </div>

          {/* Bar */}
          <div className={`h-2 rounded-full mt-4 overflow-hidden ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${vibe.total}%`, background: `linear-gradient(90deg, ${scoreColor}88, ${scoreColor})` }}
            />
          </div>

          <p className={`mt-4 text-sm font-medium leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
            {vibe.verdict}
          </p>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2">
            {vibe.axes.map((a) => (
              <div key={a.key}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {a.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{a.score}</span>
                </div>
                <div className={`text-[10px] truncate ${isDark ? "text-zinc-600" : "text-zinc-400"}`} title={a.note}>{a.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pentagonal radar rendered as inline SVG. Geometry lives in lib/analytics/radar.ts —
 *  padding is computed from the labels, so no axis label can ever clip. */
function Radar({ axes, isDark, accent }: { axes: VibeAxis[]; isDark: boolean; accent: string }) {
  const layout = useMemo(() => radarLayout(axes.map((a) => a.label)), [axes]);
  const { size, center } = layout;

  const point = (idx: number, frac: number): [number, number] => axisPoint(layout, idx, axes.length, frac);

  const ring = (frac: number) =>
    axes.map((_, i) => point(i, frac).join(",")).join(" ");

  const dataPoly = axes.map((a, i) => point(i, Math.max(0.04, a.score / 100)).join(",")).join(" ");

  return (
    <div className="aspect-square w-full max-w-[300px] shrink-0">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img"
        aria-label={`Vibe radar: ${axes.map((a) => `${a.label} ${a.score}`).join(", ")}`}>
        {/* Rings */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={ring(f)}
            fill="none"
            stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth={1}
          />
        ))}
        {/* Spokes */}
        {axes.map((a, i) => {
          const [x, y] = point(i, 1);
          return <line key={a.key} x1={center} y1={center} x2={x} y2={y} stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />;
        })}
        {/* Data */}
        <polygon points={dataPoly} fill={accent} fillOpacity={0.25} stroke={accent} strokeWidth={2} strokeLinejoin="round" />
        {/* Vertices */}
        {axes.map((a, i) => {
          const [x, y] = point(i, Math.max(0.04, a.score / 100));
          return <circle key={a.key} cx={x} cy={y} r={3.5} fill={accent} />;
        })}
        {/* Labels — anchored at labelR from center; layout guarantees they fit */}
        {axes.map((a, i) => {
          const [x, y] = point(i, layout.labelR / layout.r);
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              fill={isDark ? "#a1a1aa" : "#71717a"}
              style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {a.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
