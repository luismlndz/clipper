"use client";

import { useState } from "react";
import type { BookmarkFolder } from "@/lib/useBookmarks";

export type TreeSelection = string; // "live" | "bookmarks" | folderId

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {open ? (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7l-2 9a1 1 0 0 1-1-1V7z" />
    ) : (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    )}
  </svg>
);

function Row({
  icon,
  label,
  count,
  active,
  depth = 0,
  trailing,
  actions,
  onClick,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  count?: number;
  active: boolean;
  depth?: number;
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 8px",
        paddingLeft: 8 + depth * 14,
        borderRadius: 7,
        cursor: "pointer",
        color: active ? "var(--text)" : "var(--muted)",
        background: active ? "rgba(124,92,255,0.14)" : hover ? "var(--panel-2)" : "transparent",
        borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        fontSize: 13,
        userSelect: "none",
      }}
    >
      <span style={{ display: "flex", color: active ? "var(--accent)" : "var(--muted)" }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {actions && hover ? (
        <span style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
          {actions}
        </span>
      ) : (
        <>
          {trailing}
          {typeof count === "number" && (
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)", minWidth: 14, textAlign: "right" }}>
              {count}
            </span>
          )}
        </>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  padding: 2,
  lineHeight: 0,
  fontSize: 13,
};

export function FolderTree({
  liveCount,
  isLive,
  bookmarkCount,
  folders,
  selected,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  liveCount: number;
  isLive: boolean;
  bookmarkCount: number;
  folders: BookmarkFolder[];
  selected: TreeSelection;
  onSelect: (s: TreeSelection) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const submitNew = () => {
    if (draft.trim()) onCreateFolder(draft.trim());
    setDraft("");
    setCreating(false);
  };
  const submitRename = (id: string) => {
    if (renameDraft.trim()) onRenameFolder(id, renameDraft.trim());
    setRenamingId(null);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 10,
        display: "grid",
        gap: 2,
        alignContent: "start",
      }}
    >
      <Row
        icon={<span style={{ fontSize: 13 }}>◉</span>}
        label="Live clips"
        count={liveCount}
        active={selected === "live"}
        onClick={() => onSelect("live")}
        trailing={
          isLive ? (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--hot)",
                animation: "clipper-pulse 1.6s infinite",
              }}
            />
          ) : undefined
        }
      />
      <Row
        icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill={selected === "bookmarks" ? "var(--warn)" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          </svg>
        }
        label="All bookmarks"
        count={bookmarkCount}
        active={selected === "bookmarks"}
        onClick={() => onSelect("bookmarks")}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 8px 4px",
          fontSize: 11,
          letterSpacing: 0.5,
          fontWeight: 600,
          color: "var(--muted)",
        }}
      >
        <span>FOLDERS</span>
        <button onClick={() => { setCreating(true); setDraft(""); }} title="New folder" style={{ ...iconBtn, fontSize: 16 }}>
          +
        </button>
      </div>

      {folders.map((f) =>
        renamingId === f.id ? (
          <input
            key={f.id}
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename(f.id);
              if (e.key === "Escape") setRenamingId(null);
            }}
            onBlur={() => submitRename(f.id)}
            style={treeInput}
          />
        ) : (
          <Row
            key={f.id}
            depth={1}
            icon={<FolderIcon open={selected === f.id} />}
            label={f.name}
            count={f.clipIds.length}
            active={selected === f.id}
            onClick={() => onSelect(f.id)}
            actions={
              <>
                <button
                  title="Rename"
                  style={iconBtn}
                  onClick={() => { setRenamingId(f.id); setRenameDraft(f.name); }}
                >
                  ✎
                </button>
                <button
                  title="Delete folder"
                  style={iconBtn}
                  onClick={() => {
                    if (confirm(`Delete folder "${f.name}"? Clips stay in Bookmarks.`)) {
                      if (selected === f.id) onSelect("bookmarks");
                      onDeleteFolder(f.id);
                    }
                  }}
                >
                  🗑
                </button>
              </>
            }
          />
        )
      )}

      {creating && (
        <input
          autoFocus
          value={draft}
          placeholder="Folder name…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNew();
            if (e.key === "Escape") { setCreating(false); setDraft(""); }
          }}
          onBlur={submitNew}
          style={{ ...treeInput, marginLeft: 22 }}
        />
      )}

      {folders.length === 0 && !creating && (
        <div style={{ padding: "4px 8px 4px 22px", fontSize: 11.5, color: "var(--muted)" }}>
          No folders yet
        </div>
      )}
    </div>
  );
}

const treeInput: React.CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--accent)",
  borderRadius: 6,
  padding: "5px 8px",
  color: "var(--text)",
  fontSize: 13,
  margin: "1px 0",
};
