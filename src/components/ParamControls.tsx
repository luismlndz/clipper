"use client";

import { useState } from "react";
import type { DetectionParams, Quality } from "@/lib/types";

/** Client-side slug (kept here to avoid pulling server-only util into the bundle). */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "q";

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

function QualityCard({
  quality,
  onToggle,
  onRemove,
}: {
  quality: Quality;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const on = quality.enabled;
  const custom = quality.id.startsWith("custom_");
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 11px",
        borderRadius: 10,
        cursor: "pointer",
        minWidth: 0,
        border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
        background: on ? "rgba(124,92,255,0.10)" : "transparent",
        transition: "border-color 150ms, background 150ms",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: on ? "var(--text)" : "var(--muted)",
          }}
        >
          {quality.label}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            lineHeight: 1.35,
          }}
        >
          {quality.description}
        </div>
      </div>
      {custom && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      )}
      <Toggle on={on} />
    </div>
  );
}

function AddQuality({ onAdd }: { onAdd: (q: Quality) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd({
      id: `custom_${slugify(trimmed)}`,
      label: trimmed,
      description: desc.trim() || trimmed,
      enabled: true,
      hints: trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    });
    setLabel("");
    setDesc("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "1px dashed var(--border)",
          color: "var(--accent)",
          borderRadius: 10,
          padding: "9px 11px",
          fontSize: 13,
          textAlign: "left",
        }}
      >
        + Add a custom quality
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Name (e.g. Plot twist)"
        style={input}
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="What it looks like (helps the AI)"
        style={input}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} style={primaryBtn}>Add</button>
        <button onClick={() => setOpen(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
  readout,
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
  readout?: string;
  help?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
        <span>{label}</span>
        <span className="mono" style={{ color: "var(--accent-2)" }}>{readout ?? `${value}${suffix ?? ""}`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "var(--accent)" }}
      />
      {help && <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{help}</span>}
    </label>
  );
}

export function ParamControls({
  params,
  onChange,
}: {
  params: DetectionParams;
  onChange: (p: DetectionParams) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setQualities = (qualities: Quality[]) => onChange({ ...params, qualities });
  const toggle = (id: string) =>
    setQualities(params.qualities.map((q) => (q.id === id ? { ...q, enabled: !q.enabled } : q)));
  const remove = (id: string) => setQualities(params.qualities.filter((q) => q.id !== id));
  const add = (q: Quality) => {
    if (params.qualities.some((x) => x.id === q.id)) return;
    setQualities([...params.qualities, q]);
  };
  const setAll = (enabled: boolean) =>
    setQualities(params.qualities.map((q) => ({ ...q, enabled })));

  const enabledCount = params.qualities.filter((q) => q.enabled).length;

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 0.5, fontWeight: 600 }}>
            WHAT TO CLIP
          </span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--accent-2)" }}>{enabledCount} on</span>
            <button onClick={() => setAll(true)} style={miniBtn}>all</button>
            <button onClick={() => setAll(false)} style={miniBtn}>none</button>
          </span>
        </div>

        <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
          {params.qualities.map((q) => (
            <QualityCard key={q.id} quality={q} onToggle={() => toggle(q.id)} onRemove={() => remove(q.id)} />
          ))}
          <AddQuality onAdd={add} />
        </div>
      </div>

      <div style={card}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            fontSize: 12,
            letterSpacing: 0.5,
            fontWeight: 600,
            padding: 0,
          }}
        >
          <span>DETECTION SETTINGS</span>
          <span style={{ transition: "transform 150ms", transform: settingsOpen ? "rotate(90deg)" : "none" }}>▸</span>
        </button>

        {settingsOpen && (
          <div style={{ display: "grid", gap: 14, marginTop: 2 }}>
            <Slider
              label="Clip threshold"
              value={params.threshold}
              min={0.2}
              max={0.95}
              step={0.01}
              readout={`${Math.round(params.threshold * 100)} / 100`}
              onChange={(v) => onChange({ ...params, threshold: v })}
              help={`A moment must score at least ${Math.round(params.threshold * 100)} / 100 to clip. ${thresholdHint(params.threshold)}`}
            />
            <Slider label="Pre-roll" value={params.preSeconds} min={0} max={60} step={1} suffix="s"
              onChange={(v) => onChange({ ...params, preSeconds: v })}
              help={`Seconds kept BEFORE the moment — rewinds to catch the build-up.`} />
            <Slider label="Post-roll" value={params.postSeconds} min={0} max={30} step={1} suffix="s"
              onChange={(v) => onChange({ ...params, postSeconds: v })}
              help={`Seconds kept AFTER. Clip length ≈ ${params.preSeconds + params.postSeconds}s.`} />
            <Slider label="Cooldown" value={params.cooldownSeconds} min={0} max={120} step={1} suffix="s"
              onChange={(v) => onChange({ ...params, cooldownSeconds: v })}
              help={`Minimum gap between clips — stops one streak from spamming.`} />
          </div>
        )}
      </div>
    </div>
  );
}

function thresholdHint(t: number): string {
  if (t <= 0.4) return "Very loose — lots of clips.";
  if (t <= 0.6) return "Balanced.";
  if (t <= 0.8) return "Strict — strong moments only.";
  return "Very strict.";
}

const input: React.CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 13,
};
const primaryBtn: React.CSSProperties = {
  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 13,
};
const miniBtn: React.CSSProperties = {
  background: "var(--panel-2)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", fontSize: 11,
};
