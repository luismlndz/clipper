"use client";

import type { ReactNode } from "react";
import type { ClipResult } from "@/lib/types";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function ClipCard({
  clip,
  bookmarked = false,
  onBookmark,
  footer,
}: {
  clip: ClipResult;
  bookmarked?: boolean;
  onBookmark?: () => void;
  /** Optional control rendered at the bottom of the card (e.g. folder picker). */
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: `1px solid ${bookmarked ? "var(--warn)" : "var(--border)"}`,
        borderRadius: 16,
        padding: 18,
        display: "grid",
        gap: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          {clip.quality && (
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 999,
                padding: "4px 13px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {clip.quality.label}
            </span>
          )}
          <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
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
            width="20"
            height="20"
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

      <div style={{ fontSize: 13.5, color: "var(--accent-2)" }}>▸ {clip.reason}</div>

      {clip.mediaUrl ? (
        <video
          src={clip.mediaUrl}
          controls
          style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 10, background: "#000" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: 10,
            background: "var(--panel-2)",
            border: "1px dashed var(--border)",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: 16,
            fontSize: 12.5,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          No media file
          <br />
          (simulated mode — metadata only)
        </div>
      )}

      {clip.transcript && (
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text)",
            background: "var(--panel-2)",
            borderRadius: 10,
            padding: "11px 13px",
            maxHeight: 96,
            overflow: "auto",
            lineHeight: 1.5,
          }}
        >
          “{clip.transcript}”
        </div>
      )}

      {footer}
    </div>
  );
}
