"use client";

import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "@/lib/types";
import type { ClipMark } from "@/lib/useClipper";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function TranscriptFeed({
  transcript,
  clipMarks = [],
  height = 360,
}: {
  transcript: TranscriptSegment[];
  clipMarks?: ClipMark[];
  height?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-follow ONLY the panel's own scroll, and only when already near the
  // bottom — never scrolls the page or yanks you up while reading.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [transcript, clipMarks]);

  // For each segment, is there a clip trigger inside its time range?
  const markFor = (s: TranscriptSegment): ClipMark | undefined =>
    clipMarks.find((m) => m.at >= s.start - 0.6 && m.at <= s.end + 0.6);

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
          {transcript.map((s) => {
            const mark = markFor(s);
            return (
              <div key={s.id} style={{ display: "grid", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: mark ? "4px 6px" : 0,
                    margin: mark ? "0 -6px" : 0,
                    borderRadius: 8,
                    background: mark ? "rgba(255,77,109,0.10)" : "transparent",
                    borderLeft: mark ? "2px solid var(--hot)" : "2px solid transparent",
                  }}
                >
                  <span className="mono" style={{ color: "var(--muted)", fontSize: 12, minWidth: 40 }}>
                    {fmt(s.start)}
                  </span>
                  <span style={{ fontSize: 14 }}>{s.text}</span>
                </div>
                {mark && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--hot)",
                      paddingLeft: 50,
                    }}
                  >
                    <span>✂ clip captured{mark.quality ? ` · ${mark.quality.label}` : ""}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
