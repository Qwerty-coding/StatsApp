"use client";
import { useCallback, useRef, useState } from "react";
import Dashboard from "./Dashboard";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [filename, setFilename] = useState<string>("");
  const workerRef = useRef<Worker | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".json")) {
      setStatus("error");
      return;
    }
    const fileType = file.name.endsWith(".json") ? "telegram" : "whatsapp";
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
        if (event.data.success) {
          setParsedData(event.data);
          setStatus("done");
        }
        worker.terminate();
      };

      worker.onerror = (err) => {
        console.error("Worker error:", err);
        setStatus("error");
        worker.terminate();
      };

      worker.postMessage({ text, fileType });
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
    idle: "Drop your WhatsApp (.txt) or Telegram (.json) export here",
    loading: "Parsing…",
    done: `✓ Done — check console for output (${filename})`,
    error: "Something went wrong — make sure it's a .txt or .json file",
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
            {status === "idle" && (
              <p className="text-zinc-600 text-xs">or click to browse</p>
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