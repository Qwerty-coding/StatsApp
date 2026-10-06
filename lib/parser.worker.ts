// Worker plumbing only — all parsing lives in lib/whatsapp-parser.ts so it
// stays unit-testable outside a Worker context.
import type { ParsedMessage, ParseResult } from "../types";
import { parseChat } from "./whatsapp-parser";

interface FullParseRequest {
  mode?: "full";
  text: string;
  fileType: string;
}

interface ChunkParseRequest {
  mode: "chunk";
  /** Text chunk to append to the buffer. */
  text: string;
  /** Byte offset of this chunk in the original file (for progress reporting). */
  offset: number;
  /** Total file size in bytes, for progress reporting. */
  total: number;
  /** True on the last chunk: parse and return the result. */
  isFinal: boolean;
  /** Sent on every chunk so the worker stays stateless across messages. */
  fileType: string;
}

type WorkerRequest = FullParseRequest | ChunkParseRequest;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = self;

// Buffer accumulated across chunked requests. One upload = one worker (the
// main thread terminates it on new upload / unmount), so a single buffer is
// safe; it is reset after every final chunk and on errors.
let chunkBuffer = "";
let lastProgressSent = -1;

function reset() {
  chunkBuffer = "";
  lastProgressSent = -1;
}

ctx.onmessage = function (e: MessageEvent<WorkerRequest>) {
  const data = e.data;

  try {
    if (data.mode === "chunk") {
      chunkBuffer += data.text;

      const progress = data.total > 0 ? Math.min(100, Math.round((data.offset / data.total) * 100)) : 0;
      if (progress !== lastProgressSent) {
        lastProgressSent = progress;
        ctx.postMessage({ type: "progress", progress });
      }

      if (!data.isFinal) return;

      const result = parseChat(chunkBuffer, data.fileType);
      reset();
      ctx.postMessage(result satisfies ParseResult);
      return;
    }

    // Full-text mode (default; small files or non-streaming fallback).
    const { text, fileType } = data;
    const result = parseChat(text, fileType);
    ctx.postMessage(result satisfies ParseResult);
  } catch (error) {
    reset();
    ctx.postMessage({
      success: false,
      format: null,
      stats: null,
      messages: [] as ParsedMessage[],
      warnings: [],
      errors: [(error as Error).message],
    } satisfies ParseResult);
  }
};
