"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Dismissible banner surfacing parser warnings (e.g. low-confidence format
 * detection) that were previously dropped silently.
 */
export default function WarningsBanner({ warnings }: { warnings: string[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (warnings.length === 0 || dismissed) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3">
      <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-300">
          Heads up — this export may be imperfect
        </p>
        <ul className="mt-1 space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs leading-relaxed text-amber-200/70">
              {w}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warnings"
        className="flex-shrink-0 rounded-full p-1 text-amber-400/70 transition-colors hover:text-amber-200"
      >
        <X size={16} />
      </button>
    </div>
  );
}
