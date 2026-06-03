"use client";
import { useCallback, useRef, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [filename, setFilename] = useState<string>("");
  const workerRef = useRef<Worker | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".txt")) {
      setStatus("error");
      return;
    }
    setFilename(file.name);
    setStatus("loading");

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const worker = new Worker("/parser.worker.js");
      workerRef.current = worker;

      worker.onmessage = (event) => {
        console.log("Worker result:", event.data);
        setStatus("done");
        worker.terminate();
      };

      worker.onerror = (err) => {
        console.error("Worker error:", err);
        setStatus("error");
        worker.terminate();
      };

      worker.postMessage(text);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const statusText: Record<typeof status, string> = {
    idle: "Drop your WhatsApp .txt export here",
    loading: "Parsing…",
    done: `✓ Done — check console for output (${filename})`,
    error: "Something went wrong — make sure it's a .txt file",
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-white text-3xl font-bold tracking-tight mb-1">
          VibeCheck
        </h1>
        <p className="text-zinc-500 text-sm mb-8">
          Local WhatsApp chat analyzer — nothing leaves your device.
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
            accept=".txt"
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
            {status === "idle" && (
              <p className="text-zinc-600 text-xs">or click to browse</p>
            )}
          </div>
        </div>

        <p className="text-zinc-700 text-xs text-center mt-6">
          Export a chat in WhatsApp → ··· → More → Export chat → Without Media
        </p>
      </div>
    </main>
  );
}