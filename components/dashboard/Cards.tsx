"use client";

import type { ComponentType, ReactNode } from "react";

export function cardClasses(isDark: boolean): string {
  return isDark
    ? "bg-[#121214] border-white/5"
    : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]";
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  isDark,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  isDark: boolean;
}) {
  return (
    <div className={`p-6 rounded-2xl border flex flex-col gap-4 transition-all duration-200 ${cardClasses(isDark)}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {label}
        </span>
        <Icon size={20} className="text-[#3b82f6]" />
      </div>
      <div>
        <div className={`text-4xl font-semibold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
          {value}
        </div>
        {sub && <div className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{sub}</div>}
      </div>
    </div>
  );
}

export function AchievementCard({
  title,
  name,
  stat,
  statLabel,
  flavor,
  isDark,
  accentColor = "#3b82f6",
}: {
  title: string;
  name: ReactNode;
  stat: ReactNode;
  statLabel: string;
  flavor: string;
  isDark: boolean;
  accentColor?: string;
}) {
  return (
    <div className={`relative overflow-hidden p-6 rounded-2xl border flex flex-col gap-3 transition-all duration-200 ${cardClasses(isDark)}`}>
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ background: accentColor }}
      />
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accentColor }}>
          {title}
        </span>
      </div>
      <div className={`text-xl font-bold truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
        {name || "—"}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black tracking-tight" style={{ color: accentColor }}>
          {stat}
        </span>
        <span className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {statLabel}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {flavor}
      </p>
    </div>
  );
}
