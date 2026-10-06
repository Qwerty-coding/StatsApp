"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ParseResult } from "../types";

// Code-split: the heavy dashboard (recharts, html-to-image, word cloud) is
// excluded from the landing page bundle entirely.
const Dashboard = dynamic(() => import("./Dashboard"), { ssr: false });

const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB hard ceiling
const CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB decode chunks

const ACCEPTED_EXTENSIONS = [".txt", ".json"];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

type UploadStatus = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const cancelledRef = useRef(false);

  const killWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const cancelInFlight = useCallback(() => {
    cancelledRef.current = true;
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    killWorker();
  }, [killWorker]);

  // Terminate the worker + cancel any in-flight stream on unmount.
  useEffect(() => cancelInFlight, [cancelInFlight]);

  const failWith = useCallback((message: string) => {
    setErrorMessage(message);
    setStatus("error");
    killWorker();
  }, [killWorker]);

  const processFile = useCallback(
    async (file: File) => {
      // Any previous run is torn down before we start a new one.
      cancelInFlight();
      const cancelled = () => cancelledRef.current;

      const lowerName = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        failWith("Unsupported file type — drop a WhatsApp .txt or Telegram .json export.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        failWith(`File is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_FILE_BYTES)}.`);
        return;
      }
      if (file.size === 0) {
        failWith("That file is empty.");
        return;
      }

      const fileType = lowerName.endsWith(".json") ? "telegram" : "whatsapp";

      setFilename(file.name);
      setErrorMessage("");
      setProgress(0);
      setParsedData(null);
      setStatus("loading");
      cancelledRef.current = false;

      // Telegram exports are JSON — the whole document is needed before
      // JSON.parse can run, so stream only plain-text WhatsApp exports.
      const canStream = fileType === "whatsapp" && typeof file.stream === "function";

      try {
        if (!canStream) {
          // Telegram (or missing stream support): read whole file, single shot.
          const text = await file.text();
          if (cancelled()) return;

          const worker = new Worker(new URL("../lib/parser.worker.ts", import.meta.url), { type: "module" });
          workerRef.current = worker;

          worker.onmessage = (event: MessageEvent<ParseResult>) => {
            const data = event.data;
            if (data.success) {
              setParsedData(data);
              setStatus("done");
            } else {
              failWith(data.errors?.[0] ?? "Could not find any messages in this export.");
            }
            killWorker();
          };
          worker.onerror = (err) => {
            console.error("Worker error:", err);
            failWith("The parser crashed while reading this file.");
          };

          worker.postMessage({ text, fileType });
          return;
        }

        // Streaming path: feed 2 MB text chunks to the worker as they decode.
        const worker = new Worker(new URL("../lib/parser.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<ParseResult | { type: "progress"; progress: number }>) => {
          const data = event.data;
          if ("type" in data && data.type === "progress") {
            setProgress(data.progress);
            return;
          }
          const result = data as ParseResult;
          if (result.success) {
            setParsedData(result);
            setStatus("done");
          } else {
            failWith(result.errors?.[0] ?? "Could not find any messages in this export.");
          }
          killWorker();
        };
        worker.onerror = (err) => {
          console.error("Worker error:", err);
          failWith("The parser crashed while reading this file.");
        };

        const stream: ReadableStream<Uint8Array> = file.stream();
        const reader = stream.getReader() as ReadableStreamDefaultReader<Uint8Array>;
        readerRef.current = reader;

        const decoder = new TextDecoder("utf-8");
        let pending = "";
        let offset = 0;

        // Decode loop that never splits a multi-byte character between chunks:
        // keep any trailing incomplete sequence in `pending` until more bytes
        // arrive (stream: true) or flush it on the final chunk.
        const flushToWorker = (text: string, isFinal: boolean) => {
          worker.postMessage({ mode: "chunk", text, offset, total: file.size, isFinal, fileType });
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (cancelled()) return;
          if (done) break;

          offset += value.byteLength;
          pending += decoder.decode(value, { stream: true });

          if (pending.length >= CHUNK_BYTES) {
            flushToWorker(pending, false);
            pending = "";
          }
        }
        pending += decoder.decode(); // flush any remaining partial sequence

        if (cancelled()) return;
        flushToWorker(pending, true);
      } catch (error) {
        if (!cancelled()) {
          console.error("Failed to read file:", error);
          failWith("Could not read that file — it may be locked or in use.");
        }
      }
    },
    [cancelInFlight, failWith, killWorker]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
      e.target.value = ""; // allow re-selecting the same file
    },
    [processFile]
  );

  const statusText: Record<UploadStatus, string> = {
    idle: "Drop your WhatsApp (.txt) or Telegram (.json) export here",
    loading: progress > 0 ? `Reading… ${progress}%` : "Reading…",
    done: `✓ Done — ${filename}`,
    error: errorMessage || "Something went wrong — make sure it's a .txt or .json file",
  };

  if (parsedData) {
    return <Dashboard data={parsedData} />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-white text-3xl font-bold tracking-tight mb-1">
          VibeCheck
        </h1>
        <p className="text-zinc-500 text-sm mb-8">
          Local chat analyzer — nothing leaves your device.
        </p>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${status === "idle" ? "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50" : ""}
            ${status === "loading" ? "border-blue-500/50 bg-blue-950/20 animate-pulse" : ""}
            ${status === "done" ? "border-emerald-500/50 bg-emerald-950/20" : ""}
            ${status === "error" ? "border-red-500/50 bg-red-950/20" : ""}
          `}
        >
          <input
            type="file"
            accept=".txt,.json"
            onChange={onFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="pointer-events-none space-y-3">
            <div className="text-4xl">
              {status === "idle" && "📂"}
              {status === "loading" && "⚙️"}
              {status === "done" && "✅"}
              {status === "error" && "❌"}
            </div>
            <p
              className={`text-sm font-medium ${
                status === "done"
                  ? "text-emerald-400"
                  : status === "error"
                  ? "text-red-400"
                  : status === "loading"
                  ? "text-blue-400"
                  : "text-zinc-400"
              }`}
            >
              {statusText[status]}
            </p>
            {status === "loading" && (
              <div className="w-full max-w-xs mx-auto h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
            )}
            {status === "idle" && (
              <p className="text-zinc-600 text-xs">or click to browse</p>
            )}
            {status === "error" && errorMessage && (
              <p className="text-zinc-600 text-xs">{filename ? `While reading ${filename}` : " "}</p>
            )}
          </div>
        </div>

        {/* Privacy Statement */}
        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3b82f6]">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Your file never leaves your browser. All analysis is 100% local.</span>
        </div>

        <p className="text-zinc-700 text-xs text-center mt-6">
          WhatsApp: ··· → More → Export chat → Without Media &nbsp;·&nbsp; Telegram: ··· → Export Chat History → Format: JSON
        </p>
      </div>
    </main>
  );
}
