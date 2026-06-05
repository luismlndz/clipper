"use client";

import { useState } from "react";
import type { BookmarkFolder } from "@/lib/useBookmarks";
import { Modal } from "./Modal";

/**
 * Per-clip "Add to folder" control: a full-width button that opens a modal
 * listing every folder as a toggle, plus an inline "create new folder" field
 * (which seeds the new folder with this clip).
 */
export function FolderPicker({
  clipId,
  folders,
  isInFolder,
  onToggle,
  onCreate,
}: {
  clipId: string;
  folders: BookmarkFolder[];
  isInFolder: (folderId: string, clipId: string) => boolean;
  onToggle: (folderId: string) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const create = () => {
    const v = newName.trim();
    if (!v) return;
    onCreate(v);
    setNewName("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          marginTop: 2,
          background: "var(--panel-2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <FolderIcon />
        Add to folder
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add to folder" width={540}>
        <div style={{ display: "grid", gap: 18 }}>
          {folders.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55 }}>
              No folders yet. Create one below to start organizing your clips.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxHeight: 360, overflowY: "auto", paddingRight: 2 }}>
              {folders.map((f) => {
                const checked = isInFolder(f.id, clipId);
                return (
                  <label
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                      background: checked ? "rgba(124,92,255,0.12)" : "var(--panel-2)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(f.id)}
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 44,
                        height: 44,
                        borderRadius: 11,
                        flexShrink: 0,
                        background: checked ? "var(--accent)" : "var(--panel)",
                        color: checked ? "#fff" : "var(--muted)",
                      }}
                    >
                      <FolderIcon />
                    </span>
                    <span style={{ display: "grid", gap: 3, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.name}
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        {f.clipIds.length} {f.clipIds.length === 1 ? "clip" : "clips"}
                      </span>
                    </span>
                    <Indicator checked={checked} />
                  </label>
                );
              })}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            style={{ display: "grid", gap: 9, borderTop: "1px solid var(--border)", paddingTop: 18 }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.6, color: "var(--muted)" }}>
              CREATE NEW FOLDER
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fight in Brickell City Centre"
                maxLength={80}
                style={{
                  flex: 1,
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "13px 15px",
                  color: "var(--text)",
                  fontSize: 15,
                }}
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                style={{
                  background: "var(--accent)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "0 22px",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: newName.trim() ? "pointer" : "not-allowed",
                  opacity: newName.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 12,
              padding: "13px 22px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Selection state shown on the right of each folder row. */
function Indicator({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
          borderRadius: "50%",
          flexShrink: 0,
          background: "var(--accent)",
          color: "#fff",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        flexShrink: 0,
        border: "2px solid var(--border)",
      }}
    />
  );
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}
