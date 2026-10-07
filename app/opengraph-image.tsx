import { ImageResponse } from "next/og";

/**
 * File-convention OG image (1200×630), generated at build time.
 * Referenced automatically by layout.tsx's openGraph/twitter metadata.
 */

export const alt = "VibeCheck — your group chat, turned into a story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #09090b 0%, #10101a 55%, #0d1220 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* glow blob */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "#3b82f6",
            opacity: 0.16,
            filter: "blur(80px)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -60,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: "#8b5cf6",
            opacity: 0.12,
            filter: "blur(80px)",
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            V
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>VibeCheck</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Your group chat,
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              background: "linear-gradient(90deg, #3b82f6, #a78bfa)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            turned into a story.
          </div>
        </div>

        {/* Feature chips */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {["Wrapped stats", "Time Machine", "Connection Web", "Emoji Galaxy", "Vibe Score"].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#d4d4d8",
                }}
              >
                {chip}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 26, color: "#71717a" }}>
            100% in-browser. No uploads. No accounts.
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#3b82f6" }}>
            vibecheck
          </div>
        </div>
      </div>
    ),
    size
  );
}
