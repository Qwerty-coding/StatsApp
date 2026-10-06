import type { ParseResult } from "../types";

/**
 * Recent analyses: past parsed chats are stored locally so users can re-open
 * a previous analysis without re-dropping the export file. Nothing is synced
 * anywhere — same privacy model as the rest of the app.
 */

const RECENTS_KEY = "vibecheck.recents";
const MAX_RECENTS = 4;
/** Skip persisting monster chats — localStorage quota (~5MB) would explode. */
const MAX_SERIALIZED_BYTES = 4 * 1024 * 1024;

export interface RecentChat {
  id: string;
  /** Original file name. */
  name: string;
  savedAt: number;
  fileType: string;
  data: ParseResult;
}

function isRecentChat(v: unknown): v is RecentChat {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<RecentChat>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    typeof r.savedAt === "number" &&
    !!r.data &&
    typeof r.data === "object" &&
    Array.isArray((r.data as ParseResult).messages)
  );
}

// ---- useSyncExternalStore plumbing -----------------------------------------
// Recents behave like an external store: React subscribes, mutations emit.
// Snapshot is cached so identity is stable between mutations.

const EMPTY_RECENTS: RecentChat[] = [];
let snapshotCache: RecentChat[] | null = null;
const listeners = new Set<() => void>();

/** Subscribe to recents changes (storage events + local mutations). */
export function subscribeRecents(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === RECENTS_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot getter for useSyncExternalStore (client). */
export function getRecentsSnapshot(): RecentChat[] {
  if (snapshotCache === null) snapshotCache = loadRecents();
  return snapshotCache;
}

/** Server snapshot for useSyncExternalStore (SSR has no localStorage). */
export function getRecentsServerSnapshot(): RecentChat[] {
  return EMPTY_RECENTS;
}

function emitChange(): void {
  snapshotCache = null;
  for (const listener of listeners) listener();
}

export function loadRecents(): RecentChat[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentChat).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveRecent(name: string, fileType: string, data: ParseResult): void {
  const entry: RecentChat = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: Date.now(),
    fileType,
    data,
  };
  const next = [entry, ...loadRecents()].slice(0, MAX_RECENTS);
  try {
    const serialized = JSON.stringify(next);
    if (serialized.length > MAX_SERIALIZED_BYTES) {
      // Try with just this one entry; a single huge chat still won't fit, so bail.
      if (JSON.stringify([entry]).length > MAX_SERIALIZED_BYTES) return;
      localStorage.setItem(RECENTS_KEY, JSON.stringify([entry]));
    } else {
      localStorage.setItem(RECENTS_KEY, serialized);
    }
  } catch {
    // Quota exceeded / private mode — recents are best-effort.
  }
  emitChange();
}

export function deleteRecent(id: string): void {
  const next = loadRecents().filter((r) => r.id !== id);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  emitChange();
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(RECENTS_KEY);
  } catch {
    // ignore
  }
  emitChange();
}
