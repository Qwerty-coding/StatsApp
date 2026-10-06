/**
 * Shared text helpers for analytics modules.
 * Pure functions — no DOM, safe in tests and workers.
 */

/**
 * Matches emoji sequences: flags (regional indicator pairs), keycaps,
 * skintone modifiers, and ZWJ sequences (family, handshake, etc.).
 */
export const EMOJI_RE =
  /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}\p{Emoji_Modifier}?(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}\p{Emoji_Modifier}?(?:\uFE0F)?)*)/gu;

/** Returns the distinct emoji sequences in `text`, in order of appearance. */
export function extractEmojis(text: string): string[] {
  if (!text) return [];
  return text.match(EMOJI_RE) ?? [];
}

const WORD_SPLIT_RE = /[\s\n\t(),;:"'!?.—–\-<>\[\]{}*]+/;

/** Word count using the same tokenizer as the word cloud. */
export function countWords(text: string): number {
  if (!text) return 0;
  const parts = text.split(WORD_SPLIT_RE).filter((w) => w.length > 0);
  return parts.length;
}

/** Lowercased, punctuation-stripped words (same normalization as word cloud). */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const raw of text.split(WORD_SPLIT_RE)) {
    const word = raw.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (word) out.push(word);
  }
  return out;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "#3b82f6", "#a855f7", "#10b981", "#f97316",
  "#f43f5e", "#06b6d4", "#eab308", "#8b5cf6",
];

/** Deterministic color for a member name (same name → same color). */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
