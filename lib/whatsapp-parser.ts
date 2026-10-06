import type { ParsedMessage, ParseResult } from "../types";
import { calculateStats } from "./calculateStats";

const MONTH_ABBREVS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Percentage of sample lines that must match a format before we commit to it. */
const MIN_CONFIDENCE = 25;

/**
 * Pure WhatsApp/Telegram chat parser. No DOM/Worker APIs — safe to run in a
 * Web Worker, in Node (tests), or anywhere else.
 */
export class WhatsAppParser {
  lines: string[];
  detectedFormat: { key: string; parser: () => ParsedMessage[]; confidence: number } | null = null;
  /** Fatal problems (parse produced nothing usable). */
  errors: string[] = [];
  /** Non-fatal data-quality notes surfaced to the UI. */
  warnings: string[] = [];

  constructor(fileContent: string) {
    this.lines = fileContent.replace(/\r\n/g, "\n").split("\n");
  }

  detectFormat() {
    const patterns: Record<string, { regex: RegExp; parser: () => ParsedMessage[] }> = {
      ios_12h_slash: { regex: /^\[\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\]/, parser: this.parseIOS12hSlash.bind(this) },
      android_24h_dot: { regex: /^\d{1,2}\.\d{1,2}\.\d{2,4},\s+\d{1,2}:\d{2}:\d{2}\s+-\s+/, parser: this.parseAndroid24hDot.bind(this) },
      android_24h_slash: { regex: /^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}:\d{2}\s+-\s+/, parser: this.parseAndroid24hSlash.bind(this) },
      india_ddmmyy_short: { regex: /^\d{1,2}\/\d{1,2}\/\d{2},\s+\d{1,2}:\d{2}\s+-\s+/, parser: this.parseIndiaShortDate.bind(this) },
      android_12h_short: { regex: /^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}[\s\u202F]*[aApP][mM]\s+-\s+/, parser: this.parseAndroid12hShort.bind(this) },
      india_ddmmmyy: { regex: /^\d{1,2}\/\w{3}\/\d{2},\s+\d{1,2}:\d{2}\s+-\s+/, parser: this.parseIndiaMonthAbbrev.bind(this) },
    };

    const scores: Record<string, number> = {};
    const sampleLines = this.lines.slice(0, 50);

    for (const [key, pattern] of Object.entries(patterns)) {
      scores[key] = sampleLines.filter((line) => pattern.regex.test(line)).length;
    }

    const detected = Object.entries(scores).reduce((a, b) => (scores[a[0]] > scores[b[0]] ? a : b))[0];
    const matchCount = scores[detected];
    const confidence = (matchCount / Math.min(50, this.lines.length)) * 100;

    this.detectedFormat = { key: detected, parser: patterns[detected].parser, confidence };
    return this.detectedFormat;
  }

  parse(): ParseResult {
    try {
      const format = this.detectFormat();
      if (format.confidence < MIN_CONFIDENCE) {
        this.warnings.push(
          `Format detected with low confidence (${Math.round(format.confidence)}%). Stats may be incomplete.`
        );
      }

      const messages = format.parser();
      messages.sort((a, b) => a.timestamp - b.timestamp);

      const stats = calculateStats(messages);
      const producedNothing = messages.length === 0;

      // A warning is data-quality info, not a failure. Only an empty result
      // (or a thrown error) means the parse failed outright.
      if (producedNothing) {
        // Promote warnings to errors: they explain why nothing was parsed.
        this.errors.push(...this.warnings);
        this.warnings = [];
        if (this.errors.length === 0) {
          this.errors.push("No messages could be parsed from this file.");
        }
      }

      return {
        success: !producedNothing,
        messages,
        stats,
        format: format.key,
        warnings: this.warnings,
        errors: this.errors.length > 0 ? this.errors : undefined,
      };
    } catch (error) {
      return { success: false, messages: [], stats: null, format: null, warnings: [], errors: [(error as Error).message] };
    }
  }

  parseIOS12hSlash(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;
    const timestampRegex = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, month, day, year, hour, min, sec, ampm, sender, text] = match;
        currentMessage = {
          timestamp: this.parseTimestampIOS12h(month, day, year, hour, min, sec, ampm),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes("<Media omitted>"),
          isSystem: false,
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, month, day, year, hour, min, sec, ampm, content] = sysMatch;
        currentMessage = {
          timestamp: this.parseTimestampIOS12h(month, day, year, hour, min, sec, ampm),
          sender: "[System]",
          text: content.trim(),
          isMedia: false,
          isSystem: true,
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += "\n" + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseAndroid24hDot(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;
    const timestampRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, sender, text] = match;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes("<Media omitted>"),
          isSystem: false,
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, content] = sysMatch;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: "[System]",
          text: content.trim(),
          isMedia: false,
          isSystem: true,
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += "\n" + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseAndroid12hShort(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;

    const prefixRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})[\s\u202F]*([aApP][mM])\s+-\s+(.*)/;

    // System messages in this format have no "Sender: " prefix at all.
    // A real user's message always has "Name: text" with a name that is not a
    // full system action sentence, so we detect system lines by checking whether
    // the text BEFORE the first colon reads as a system action verb phrase
    // (starts with a known verb), rather than substring-matching the whole line.
    const systemActionVerbs = [
      "created group", "added you", "added", "removed", "left",
      "changed group description", "changed the subject", "changed this group's icon",
      "messages and calls are end-to-end encrypted", "changed their phone number",
      "joined using this group's invite link", "joined group", "changed the group description",
    ];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line.trim()) continue;

      const match = line.match(prefixRegex);

      if (match) {
        if (currentMessage) messages.push(currentMessage);

        const [, month, day, yearShort, hour, min, ampm, restOfLine] = match;
        const year = this.expandYearShort(parseInt(yearShort));
        const timestamp = this.parseTimestampIOS12h(month, day, year.toString(), hour, min, "00", ampm.toUpperCase());

        const colonIndex = restOfLine.indexOf(": ");
        let isSystem = true;
        let sender = "[System]";
        let text = restOfLine;

        if (colonIndex !== -1) {
          const tentativeSender = restOfLine.substring(0, colonIndex).trim().toLowerCase();

          // A system action phrase starts with a verb ("added X to the group"),
          // whereas a participant's name does not contain these verb phrases.
          const startsWithSystemAction = systemActionVerbs.some((keyword) =>
            tentativeSender.startsWith(keyword)
          );

          if (!startsWithSystemAction) {
            isSystem = false;
            sender = restOfLine.substring(0, colonIndex).trim();
            text = restOfLine.substring(colonIndex + 2).trim();
          }
        }

        if (isSystem) {
          isSystem = systemActionVerbs.some((keyword) => restOfLine.toLowerCase().startsWith(keyword)) || colonIndex === -1;
        }

        currentMessage = {
          timestamp,
          sender,
          text,
          isMedia: text.includes("<Media omitted>"),
          isSystem,
        };
      } else {
        if (currentMessage) currentMessage.text += "\n" + line;
      }
    }

    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseAndroid24hSlash(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;
    const timestampRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, sender, text] = match;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes("<Media omitted>"),
          isSystem: false,
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, content] = sysMatch;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: "[System]",
          text: content.trim(),
          isMedia: false,
          isSystem: true,
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += "\n" + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseIndiaShortDate(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;
    const timestampRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, yearShort, hour, min, sender, text] = match;
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, "00"),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes("<Media omitted>"),
          isSystem: false,
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, yearShort, hour, min, content] = sysMatch;
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, "00"),
          sender: "[System]",
          text: content.trim(),
          isMedia: false,
          isSystem: true,
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += "\n" + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseIndiaMonthAbbrev(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;
    const timestampRegex = /^(\d{1,2})\/(\w{3})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\w{3})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, monthStr, yearShort, hour, min, sender, text] = match;
        const month = MONTH_ABBREVS[monthStr.toLowerCase()] || "01";
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, "00"),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes("<Media omitted>"),
          isSystem: false,
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, monthStr, yearShort, hour, min, content] = sysMatch;
        const month = MONTH_ABBREVS[monthStr.toLowerCase()] || "01";
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, "00"),
          sender: "[System]",
          text: content.trim(),
          isMedia: false,
          isSystem: true,
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += "\n" + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseTimestampIOS12h(month: string, day: string, year: string, hour: string, min: string, sec: string, ampm: string): number {
    let hour24 = parseInt(hour);
    if (ampm === "PM" && hour24 !== 12) hour24 += 12;
    else if (ampm === "AM" && hour24 === 12) hour24 = 0;
    let y = parseInt(year);
    if (y < 100) y = this.expandYearShort(y);
    return new Date(y, parseInt(month) - 1, parseInt(day), hour24, parseInt(min), parseInt(sec)).getTime();
  }

  parseTimestamp24h(day: string, month: string, year: string, hour: string, min: string, sec: string): number {
    let y = parseInt(year);
    if (y < 100) y = this.expandYearShort(y);
    return new Date(y, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec)).getTime();
  }

  /**
   * Two-digit year pivot. WhatsApp exports are always recent (you can only
   * export a chat that exists today), so "00–68 → 2000s, 69–99 → 1900s" is the
   * safest split: a `99` in a 2026 export can only be 1999-era history (e.g. a
   * very old imported chat), never a future 2099 date.
   */
  expandYearShort(year: number): number {
    return year > 68 ? 1900 + year : 2000 + year;
  }
}

function extractTelegramText(textField: unknown): string {
  if (typeof textField === "string") {
    return textField;
  }
  if (Array.isArray(textField)) {
    return textField
      .map((segment) => {
        if (typeof segment === "string") return segment;
        if (segment && typeof segment === "object" && typeof (segment as { text?: unknown }).text === "string") return (segment as { text: string }).text;
        return "";
      })
      .join("");
  }
  return "";
}

export function parseTelegram(text: string): ParsedMessage[] {
  let data: { messages?: unknown };
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Invalid Telegram JSON: " + (e as Error).message);
  }

  const rawMessages = data.messages;
  if (!Array.isArray(rawMessages)) {
    throw new Error('Telegram JSON does not contain a "messages" array.');
  }

  const messages: ParsedMessage[] = [];

  for (const msg of rawMessages) {
    if (msg.type !== "message") continue;

    const plainText = extractTelegramText(msg.text);
    if (!plainText || !plainText.trim()) continue;

    const sender = (msg.from || "[Unknown]").trim();
    // Skip messages with no usable date rather than pinning them to "now",
    // which corrupts first/last-message and streak stats.
    const dateMs = msg.date ? new Date(msg.date).getTime() : NaN;
    if (isNaN(dateMs)) continue;

    messages.push({
      timestamp: dateMs,
      sender,
      text: plainText.trim(),
      isMedia: false,
      isSystem: false,
    });
  }

  return messages;
}

export function parseChat(text: string, fileType: string): ParseResult {
  if (fileType === "telegram") {
    const messages = parseTelegram(text);
    if (messages.length === 0) {
      return { success: false, messages: [], stats: null, format: "telegram_json", warnings: [], errors: ["No parseable messages found in the Telegram export."] };
    }
    messages.sort((a, b) => a.timestamp - b.timestamp);
    const stats = calculateStats(messages);
    return { success: true, format: "telegram_json", stats, messages, warnings: [] };
  }

  return new WhatsAppParser(text).parse();
}
