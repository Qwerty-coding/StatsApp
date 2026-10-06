import { describe, it, expect } from "vitest";
import { WhatsAppParser, parseTelegram, parseChat } from "../lib/whatsapp-parser";

function parseLines(lines: string[]) {
  return new WhatsAppParser(lines.join("\n")).parse();
}

describe("format detection", () => {
  it("detects india_ddmmyy_short", () => {
    const result = parseLines([
      "12/05/24, 10:00 - Alice: good morning",
      "12/05/24, 10:01 - Bob: morning, did you see the match",
    ]);
    expect(result.format).toBe("india_ddmmyy_short");
    expect(result.success).toBe(true);
  });

  it("detects ios_12h_slash", () => {
    const result = parseLines([
      "[12/31/2024, 3:45:22 PM] Alice: hey",
      "[12/31/2024, 3:46:22 PM] Bob: yo",
    ]);
    expect(result.format).toBe("ios_12h_slash");
    expect(result.success).toBe(true);
  });

  it("detects android_24h_dot", () => {
    const result = parseLines([
      "31.12.2024, 15:45:22 - Bob: yo",
      "01.01.2025, 09:10:00 - Alice: happy new year",
    ]);
    expect(result.format).toBe("android_24h_dot");
    expect(result.success).toBe(true);
  });

  it("detects android_24h_slash", () => {
    const result = parseLines([
      "31/12/2024, 15:45:22 - Charlie: sup",
      "01/01/2025, 09:00:00 - Dave: hello",
    ]);
    expect(result.format).toBe("android_24h_slash");
    expect(result.success).toBe(true);
  });

  it("detects india_ddmmmyy month abbreviation", () => {
    const result = parseLines([
      "31/Dec/24, 15:45 - Frank: ok",
      "01/Jan/25, 08:00 - Alice: fine",
    ]);
    expect(result.format).toBe("india_ddmmmyy");
    expect(result.success).toBe(true);
  });
});

describe("parsing behaviour", () => {
  it("parses messages, senders and continuation lines", () => {
    const result = parseLines([
      "12/05/24, 10:00 - Alice: first line",
      "second line",
      "12/05/24, 10:05 - Bob: reply",
    ]);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ sender: "Alice", text: "first line\nsecond line" });
    expect(result.messages[1]).toMatchObject({ sender: "Bob", text: "reply" });
  });

  it("returns chronological order regardless of file order", () => {
    const result = parseLines([
      "12/05/24, 10:05 - Bob: later",
      "12/05/24, 10:00 - Alice: earlier",
    ]);
    expect(result.messages[0].sender).toBe("Alice");
    expect(result.messages[1].sender).toBe("Bob");
  });

  it("marks system messages and excludes them from stats", () => {
    const result = parseLines([
      "12/05/24, 09:55 - Alice: before",
      "12/05/24, 09:56 - Bob left",
      "12/05/24, 10:00 - Alice: after",
    ]);
    const system = result.messages.find((m) => m.isSystem);
    expect(system).toBeDefined();
    expect(system?.sender).toBe("[System]");
    // Stats only count non-system messages.
    expect(result.stats).toMatchObject({ totalMessages: 2, totalUsers: 1 });
  });

  it("flags media messages", () => {
    const result = parseLines(["12/05/24, 10:00 - Alice: <Media omitted>"]);
    expect(result.messages[0].isMedia).toBe(true);
  });

  it("succeeds and warns when the format confidence is low", () => {
    // Mostly-unparseable sample keeps confidence below 25% while a few valid
    // lines still produce messages.
    const lines = ["12/05/24, 10:00 - Alice: real message"];
    for (let i = 0; i < 30; i++) lines.push(`noise line ${i} that matches nothing`);
    const result = parseLines(lines);
    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.warnings.some((w) => w.toLowerCase().includes("confidence"))).toBe(true);
  });

  it("fails with errors when nothing parses", () => {
    const result = parseLines(["random text", "not a chat at all"]);
    expect(result.success).toBe(false);
    expect(result.messages).toHaveLength(0);
    expect((result.errors ?? []).length).toBeGreaterThan(0);
  });

  it("expands two-digit years across the century boundary", () => {
    // 99 must land in 1999 (a past year), not 2099.
    const result = parseLines([
      "31/12/99, 23:59 - Old: ancient",
      "01/01/24, 00:00 - New: modern",
    ]);
    expect(result.messages[0].timestamp).toBeLessThan(result.messages[1].timestamp);
    expect(new Date(result.messages[0].timestamp).getFullYear()).toBe(1999);
    expect(new Date(result.messages[1].timestamp).getFullYear()).toBe(2024);
  });

  it("parses 12-hour AM/PM times correctly", () => {
    const result = parseLines([
      "[12/31/2024, 12:05:00 AM] Alice: just after midnight",
      "[12/31/2024, 12:05:00 PM] Bob: just after noon",
    ]);
    const [midnight, noon] = result.messages;
    expect(new Date(midnight.timestamp).getHours()).toBe(0);
    expect(new Date(noon.timestamp).getHours()).toBe(12);
  });
});

describe("parseTelegram", () => {
  it("parses text and rich-text segment arrays", () => {
    const json = JSON.stringify({
      messages: [
        { type: "message", from: "Alice", date: "2024-06-01T10:00:00", text: "plain" },
        { type: "message", from: "Bob", date: "2024-06-01T10:05:00", text: ["mix", { type: "plain", text: "ed" }] },
        { type: "service", from: "Alice", date: "2024-06-01T10:06:00", text: "added Bob" },
      ],
    });
    const messages = parseTelegram(json);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ sender: "Alice", text: "plain" });
    expect(messages[1].text).toBe("mixed");
  });

  it("skips messages without a usable date instead of pinning them to now", () => {
    const before = Date.now() - 60_000; // guard against clock jitter
    const json = JSON.stringify({
      messages: [
        { type: "message", from: "Ghost", text: "no date" },
        { type: "message", from: "Alice", date: "2024-06-01T10:00:00", text: "dated" },
      ],
    });
    const messages = parseTelegram(json);
    expect(messages).toHaveLength(1);
    expect(messages[0].sender).toBe("Alice");
    expect(messages[0].timestamp).toBeLessThan(before);
    expect(messages[0].timestamp).toBeGreaterThan(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseTelegram("{not json")).toThrow(/Invalid Telegram JSON/);
  });

  it("throws when the messages array is missing", () => {
    expect(() => parseTelegram(JSON.stringify({ chats: [] }))).toThrow(/messages/);
  });
});

describe("parseChat", () => {
  it("routes by file type", () => {
    const tg = parseChat(
      JSON.stringify({ messages: [{ type: "message", from: "A", date: "2024-06-01T10:00:00", text: "hi" }] }),
      "telegram"
    );
    expect(tg.format).toBe("telegram_json");
    expect(tg.success).toBe(true);
  });

  it("reports a failure for a Telegram export with no parseable messages", () => {
    const result = parseChat(JSON.stringify({ messages: [{ type: "service", date: "2024-06-01T10:00:00" }] }), "telegram");
    expect(result.success).toBe(false);
    expect((result.errors ?? []).length).toBeGreaterThan(0);
  });
});
