"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { extractAndFilterWords } from "../lib/optimized-word-extraction";
import type { ParsedMessage } from "../types";

interface WordCloudProps {
  messages: ParsedMessage[];
  isDark: boolean;
  maxWords?: number;
}

const colors = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#10b981",
  "#06b6d4", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1",
  "#d946ef", "#f43f5e", "#0ea5e9", "#22c55e", "#eab308",
];

function getColor(index: number): string {
  return colors[index % colors.length];
}

function getRandomSize(index: number, total: number): number {
  const ratio = (total - index) / total;
  return 0.6 + ratio * 1.8;
}

const BASE_FILTER_CONFIG = {
  minFrequency: 3,
  minUniqueUsers: 2,
  minLength: 4, // Raised to 4 to kill short Hinglish noise
  includeNumbers: false,
  excludeNames: true,
} as const;

interface WordItem {
  word: string;
  frequency: number;
}

export default function WordCloud({ messages, isDark, maxWords = 50 }: WordCloudProps) {
  const [customFilter, setCustomFilter] = useState("");
  const [baseWordData, setBaseWordData] = useState<WordItem[]>([]);
  const requestIdRef = useRef(0);

  // Heavy extraction runs in a worker when available (keeps the UI thread
  // free on large chats); falls back to sync computation otherwise (SSR,
  // workers unavailable, or worker construction failure).
  useEffect(() => {
    let cancelled = false;
    const id = ++requestIdRef.current;

    const runSync = () => {
      const result = extractAndFilterWords(messages, BASE_FILTER_CONFIG);
      if (!cancelled) setBaseWordData(result.words);
    };

    if (typeof Worker === "undefined") {
      runSync();
      return () => {
        cancelled = true;
      };
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL("../lib/word-extraction.worker.ts", import.meta.url), { type: "module" });
    } catch {
      runSync();
      return () => {
        cancelled = true;
      };
    }

    worker.onmessage = (event: MessageEvent<{ id: number; words: WordItem[]; error: string | null }>) => {
      if (event.data.id !== requestIdRef.current) return; // stale response
      if (!cancelled) setBaseWordData(event.data.words);
      worker.terminate();
    };
    worker.onerror = () => {
      // Worker failed to load — recompute on the main thread.
      if (!cancelled) runSync();
      worker.terminate();
    };

    worker.postMessage({ id, messages, config: BASE_FILTER_CONFIG });

    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [messages]);

  // Light filtering: instant when typing custom words; no re-extraction.
  const wordData = useMemo(() => {
    const customStops = new Set(
      customFilter
        .split(/[\s,]+/)
        // Aggressively strip anything that isn't a letter or number from the input
        .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((w) => w.length > 0)
    );

    return baseWordData
      .filter((item) => {
        // Aggressively strip invisible characters and @ tags from the chat data
        const heavilyCleanedWord = item.word.toLowerCase().replace(/[^a-z0-9]/g, "");
        return !customStops.has(heavilyCleanedWord);
      })
      .slice(0, maxWords);
  }, [baseWordData, customFilter, maxWords]);

  const maxFreq = wordData[0]?.frequency || 1;

  return (
    <div className={`border rounded-2xl p-6 ${isDark ? "bg-[#121214] border-white/5" : "bg-white border-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"}`}>
      <div className="mb-6">
        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Group Vocabulary</h2>
        <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Most frequently spammed words</p>
      </div>

      <div className={`p-6 rounded-xl mb-6 min-h-[240px] flex flex-wrap items-center justify-center gap-4 ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
        {wordData.length > 0 ? (
          wordData.map((item, i) => {
            const size = getRandomSize(i, wordData.length);
            const color = getColor(i);
            const opacity = 0.6 + (item.frequency / maxFreq) * 0.4;

            return (
              <div
                key={`${item.word}-${i}`}
                className="inline-block cursor-default transition-transform duration-200 hover:scale-[1.3] hover:z-10 relative"
                style={{
                  fontSize: `${size}rem`,
                  color,
                  opacity,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  textShadow: isDark ? `0 0 20px ${color}20` : "none",
                }}
                title={`${item.word}: ${item.frequency} times`}
              >
                {item.word}
              </div>
            );
          })
        ) : (
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>No words found matching current filters</p>
        )}
      </div>

      <details className={`cursor-pointer p-4 rounded-lg border ${isDark ? "border-white/5 bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"}`}>
        <summary className={`font-semibold text-sm ${isDark ? "text-white" : "text-zinc-900"}`}>⚙️ Advanced Filters</summary>
        <div className="mt-4">
          <label className={`text-xs font-medium block mb-2 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Custom Stop Words</label>
          <textarea
            value={customFilter}
            onChange={(e) => setCustomFilter(e.target.value)}
            placeholder="Add words to filter (space-separated): word1 word2"
            className={`w-full text-xs p-2 rounded border ${isDark ? "bg-[#121214] border-white/10 text-white" : "bg-white border-zinc-300"} focus:outline-none focus:ring-1 focus:ring-blue-500`}
            rows={2}
          />
        </div>
      </details>
    </div>
  );
}
