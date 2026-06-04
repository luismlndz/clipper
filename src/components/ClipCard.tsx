"use client";

import type { ClipResult } from "@/lib/types";
import { SignalBar } from "./SignalBar";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function ClipCard({ clip }: { clip: ClipResult }) {
  const pct = Math.round(clip.score * 100);
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {clip.quality && (
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 999,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {clip.quality.label}
            </span>
          )}
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            {fmt(clip.startAt)}–{fmt(clip.endAt)} · {(clip.endAt - clip.startAt).toFixed(0)}s
          </span>
        </span>
        <span
          className="mono"
          style={{
            background: "var(--hot)",
            color: "#fff",
            borderRadius: 999,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {pct}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "var(--accent-2)" }}>▸ {clip.reason}</div>

      {clip.transcript && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text)",
            background: "var(--panel-2)",
            borderRadius: 8,
            padding: "8px 10px",
            maxHeight: 90,
            overflow: "auto",
          }}
        >
          “{clip.transcript}”
        </div>
      )}

      {clip.mediaUrl ? (
        <video
          src={clip.mediaUrl}
          controls
          style={{ width: "100%", borderRadius: 8, background: "#000" }}
        />
      ) : (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          No media file (simulated mode — metadata only).
        </div>
      )}

      <div style={{ display: "grid", gap: 5 }}>
        <SignalBar label="dialogue" value={clip.signals.dialogue} color="var(--accent)" />
        <SignalBar label="audio" value={clip.signals.audio} color="var(--accent-2)" />
        <SignalBar label="chat" value={clip.signals.chat} color="#5b8cff" />
      </div>
    </div>
  );
}
