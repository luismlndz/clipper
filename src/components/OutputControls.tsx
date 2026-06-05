"use client";

import { ASPECT_RATIOS, type AspectRatioOption, type OutputConfig } from "@/lib/types";

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 12,
  minWidth: 0,
};

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        background: on ? "var(--accent)" : "var(--border)",
        position: "relative",
        flexShrink: 0,
        transition: "background 150ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 150ms",
        }}
      />
    </span>
  );
}

/** Proportional rectangle preview of an aspect ratio, fit within a fixed frame. */
function RatioGlyph({ option, on }: { option: AspectRatioOption; on: boolean }) {
  const FRAME = 30;
  const longer = Math.max(option.w, option.h);
  const w = (FRAME * option.w) / longer;
  const h = (FRAME * option.h) / longer;
  return (
    <span
      style={{
        width: FRAME,
        height: FRAME,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: w,
          height: h,
          borderRadius: 3,
          border: `1.5px solid ${on ? "var(--accent)" : "var(--muted)"}`,
          background: on ? "rgba(124,92,255,0.18)" : "transparent",
          transition: "border-color 150ms, background 150ms",
        }}
      />
    </span>
  );
}

function RatioTile({
  option,
  on,
  onSelect,
}: {
  option: AspectRatioOption;
  on: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 11px",
        borderRadius: 10,
        cursor: "pointer",
        minWidth: 0,
        border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
        background: on ? "rgba(124,92,255,0.10)" : "transparent",
        transition: "border-color 150ms, background 150ms",
      }}
    >
      <RatioGlyph option={option} on={on} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="mono"
          style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--text)" : "var(--muted)" }}
        >
          {option.label}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
          {option.use}
        </div>
      </div>
    </div>
  );
}

export function OutputControls({
  output,
  onChange,
}: {
  output: OutputConfig;
  onChange: (o: OutputConfig) => void;
}) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.5, fontWeight: 600 }}>
          VIDEO OUTPUT
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--accent-2)" }}>
          {output.aspectRatio}
        </span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>Aspect ratio</span>
        <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
          {ASPECT_RATIOS.map((opt) => (
            <RatioTile
              key={opt.id}
              option={opt}
              on={output.aspectRatio === opt.id}
              onSelect={() => onChange({ ...output, aspectRatio: opt.id })}
            />
          ))}
        </div>
      </div>

      <div
        role="switch"
        aria-checked={output.captions}
        onClick={() => onChange({ ...output, captions: !output.captions })}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 11px",
          borderRadius: 10,
          cursor: "pointer",
          minWidth: 0,
          border: `1px solid ${output.captions ? "var(--accent)" : "var(--border)"}`,
          background: output.captions ? "rgba(124,92,255,0.10)" : "transparent",
          transition: "border-color 150ms, background 150ms",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: output.captions ? "var(--text)" : "var(--muted)",
            }}
          >
            Burn-in captions
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
            Render the transcript onto the clip as subtitles (coming soon)
          </div>
        </div>
        <Toggle on={output.captions} />
      </div>

      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
        Applied to rendered clips in real mode via a lossless center-crop. You
        can switch this mid-session — each clip uses whatever is selected the
        moment it's detected.
      </span>
    </div>
  );
}
