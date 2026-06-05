"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

/**
 * Modal with a single text field for naming a folder. Used for both creating a
 * new folder and renaming an existing one (pass `initialValue`). Enter submits,
 * Escape / click-away cancels; the confirm button is disabled while empty.
 */
export function FolderNameModal({
  open,
  title,
  confirmLabel = "Create folder",
  initialValue = "",
  placeholder = "e.g. Fight in Brickell City Centre",
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel?: string;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset to the current value and focus the field each time it opens.
  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, initialValue]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: "grid", gap: 16 }}
      >
        <label style={{ display: "grid", gap: 7 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Folder name</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={80}
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 14px",
              color: "var(--text)",
              fontSize: 15,
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            style={{
              background: "var(--accent)",
              border: "none",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: value.trim() ? "pointer" : "not-allowed",
              opacity: value.trim() ? 1 : 0.5,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
