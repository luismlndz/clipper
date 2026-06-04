"use client";

export function SignalBar({
  label,
  value,
  color = "var(--accent)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{ width: 64, color: "var(--muted)", fontSize: 12 }}
        className="mono"
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: "var(--panel-2)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 220ms ease",
          }}
        />
      </div>
      <span
        className="mono"
        style={{ width: 32, textAlign: "right", fontSize: 12, color: "var(--muted)" }}
      >
        {pct}
      </span>
    </div>
  );
}
