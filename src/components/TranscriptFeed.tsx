"use client";

import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "@/lib/types";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function TranscriptFeed({
  transcript,
  height = 360,
}: {
  transcript: TranscriptSegment[];
  height?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-follow ONLY the panel's own scroll, and only when the user is already
  // near the bottom — never scrolls the page or yanks you up while reading.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  return (
    <div
      ref={scrollRef}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 14,
        height,
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, letterSpacing: 0.5, fontWeight: 600 }}>
        LIVE TRANSCRIPT
      </div>
      {transcript.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          Waiting for the stream to start talking…
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {transcript.map((s) => (
            <div key={s.id} style={{ display: "flex", gap: 10 }}>
              <span
                className="mono"
                style={{ color: "var(--muted)", fontSize: 12, minWidth: 40 }}
              >
                {fmt(s.start)}
              </span>
              <span style={{ fontSize: 14 }}>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
