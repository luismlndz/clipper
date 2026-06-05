"use client";

import type { ClipResult } from "@/lib/types";
import { ShareBar } from "./ShareBar";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function ClipCard({
  clip,
  bookmarked = false,
  onBookmark,
}: {
  clip: ClipResult;
  bookmarked?: boolean;
  onBookmark?: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: `1px solid ${bookmarked ? "var(--warn)" : "var(--border)"}`,
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
        <button
          onClick={onBookmark}
          title={bookmarked ? "Remove bookmark" : "Bookmark clip"}
          aria-pressed={bookmarked}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            lineHeight: 0,
            flexShrink: 0,
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill={bookmarked ? "var(--warn)" : "none"}
            stroke={bookmarked ? "var(--warn)" : "var(--muted)"}
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      </div>

      <ShareBar clip={clip} />

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
    </div>
  );
}
