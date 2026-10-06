import { describe, it, expect } from "vitest";
import { buildEmojiStats } from "../lib/analytics/emojiStats";
import { extractEmojis, countWords, initials, avatarColor } from "../lib/analytics/text-utils";
import type { ParsedMessage } from "../types";

function msg(sender: string, ts: number, text: string): ParsedMessage {
  return { sender, timestamp: ts, text, isMedia: false, isSystem: false };
}

const T0 = new Date(2024, 0, 15, 10, 0).getTime();
const T1 = new Date(2024, 1, 15, 10, 0).getTime();

describe("extractEmojis", () => {
  it("extracts simple emojis", () => {
    expect(extractEmojis("hey 😂 lol")).toEqual(["😂"]);
  });
  it("extracts ZWJ sequences as one unit", () => {
    const seq = extractEmojis("👍🏽").join("");
    expect(seq).toBe("👍🏽");
    const family = extractEmojis("👨‍👩‍👧‍👦");
    expect(family).toHaveLength(1);
  });
  it("extracts flags as one unit", () => {
    expect(extractEmojis("🇮🇳🇺🇸")).toHaveLength(2);
  });
  it("returns empty for plain text", () => {
    expect(extractEmojis("no emojis here")).toEqual([]);
  });
});

describe("buildEmojiStats", () => {
  it("counts usage, users, and monthly trend (deduped per message)", () => {
    const result = buildEmojiStats([
      msg("Priya", T0, "😂😂 ok"), // repeated emoji in one message counts once
      msg("Rohan", T1, "😂 nice"), // next month
      msg("Priya", T1, "😭 bye"),
    ]);
    const laugh = result.emojis.find((e) => e.emoji === "😂")!;
    expect(laugh.count).toBe(2);
    expect(laugh.users[0]).toEqual({ sender: "Priya", count: 1 });
    expect(laugh.monthly).toHaveLength(2);
    expect(laugh.firstUsed).toBe(T0);
  });

  it("builds a symmetric co-occurrence matrix from same-message pairs", () => {
    const result = buildEmojiStats([
      msg("A", T0, "😂🔥"),
      msg("A", T0 + 1000, "🔥😂"),
      msg("B", T0 + 2000, "🔥"),
    ]);
    expect(result.coOccurrence["😂"]["🔥"]).toBe(2);
    expect(result.coOccurrence["🔥"]["😂"]).toBe(2);
  });

  it("filters by minCount and prunes co-occurrence to kept emojis", () => {
    const result = buildEmojiStats(
      [msg("A", T0, "😂🔥"), msg("A", T0 + 1000, "🔥"), msg("B", T0 + 2000, "🥲")],
      2
    );
    // 😂 and 🥲 appear once → dropped; 🔥 appears twice → kept
    expect(result.emojis.map((e) => e.emoji)).toEqual(["🔥"]);
    expect(result.coOccurrence["😂"]).toBeUndefined();
  });

  it("ignores system messages", () => {
    const result = buildEmojiStats([
      msg("System", T0, "🤖"),
    ]);
    void result;
    expect(buildEmojiStats([{ ...msg("S", T0, "🤖"), isSystem: true }]).emojis).toEqual([]);
  });
});

describe("text utils", () => {
  it("counts words with the shared tokenizer", () => {
    expect(countWords("hello there, friend!")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("derives stable initials", () => {
    expect(initials("Priya Sharma")).toBe("PS");
    expect(initials("madhavan")).toBe("MA");
    expect(initials("")).toBe("?");
  });
  it("assigns deterministic avatar colors", () => {
    expect(avatarColor("Priya")).toBe(avatarColor("Priya"));
    expect(avatarColor("A")).not.toBe(avatarColor("B"));
  });
});
