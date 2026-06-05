"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { BookmarkFolder } from "@/lib/useBookmarks";
import { Modal } from "./Modal";
import { FolderNameModal } from "./FolderNameModal";

/**
 * Folder selector for the Bookmarks view: an "All" tile, one tile per folder
 * (with clip count), and a "New folder" tile. When a folder is active it also
 * offers rename/delete. `active` is null for the "All" view.
 */
export function FolderBar({
  folders,
  active,
  totalCount,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: BookmarkFolder[];
  active: string | null;
  totalCount: number;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folderId: string) => void;
}) {
  const activeFolder = folders.find((f) => f.id === active) ?? null;
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 18,
        marginBottom: 18,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.6, color: "var(--muted)" }}>
          FOLDERS
        </span>
        {activeFolder && (
          <div style={{ display: "flex", gap: 14 }}>
            <ActionLink onClick={() => setRenaming(true)}>Rename</ActionLink>
            <ActionLink onClick={() => setConfirmingDelete(true)} hot>
              Delete
            </ActionLink>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Tile active={active === null} onClick={() => onSelect(null)} icon={<GridIcon />}>
          <TileName>All clips</TileName>
          <TileMeta>{totalCount} saved</TileMeta>
        </Tile>

        {folders.map((f) => (
          <Tile
            key={f.id}
            active={active === f.id}
            onClick={() => onSelect(f.id)}
            icon={<FolderIcon />}
          >
            <TileName>{f.name}</TileName>
            <TileMeta>
              {f.clipIds.length} {f.clipIds.length === 1 ? "clip" : "clips"}
            </TileMeta>
          </Tile>
        ))}

        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            minWidth: 130,
            minHeight: 84,
            padding: "14px 16px",
            background: "transparent",
            border: "1.5px dashed var(--border)",
            borderRadius: 14,
            color: "var(--accent)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PlusIcon />
          New folder
        </button>
      </div>

      <FolderNameModal
        open={creating}
        title="New folder"
        confirmLabel="Create folder"
        onSubmit={onCreate}
        onClose={() => setCreating(false)}
      />
      <FolderNameModal
        open={renaming}
        title="Rename folder"
        confirmLabel="Save"
        initialValue={activeFolder?.name ?? ""}
        onSubmit={(name) => activeFolder && onRename(activeFolder.id, name)}
        onClose={() => setRenaming(false)}
      />
      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete folder"
      >
        <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.55 }}>
          Delete <strong style={{ color: "var(--text)" }}>{activeFolder?.name}</strong>? The
          clips inside stay in your bookmarks — only the folder is removed.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={() => setConfirmingDelete(false)} style={secondaryBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeFolder) {
                onDelete(activeFolder.id);
                onSelect(null);
              }
              setConfirmingDelete(false);
            }}
            style={{ ...primaryBtn, background: "var(--hot)" }}
          >
            Delete folder
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Tile({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 170,
        minHeight: 84,
        padding: "14px 16px",
        textAlign: "left",
        background: active ? "rgba(124,92,255,0.12)" : "var(--panel-2)",
        border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 14,
        color: "var(--text)",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          borderRadius: 10,
          flexShrink: 0,
          background: active ? "var(--accent)" : "var(--panel)",
          color: active ? "#fff" : "var(--muted)",
        }}
      >
        {icon}
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>{children}</span>
    </button>
  );
}

function TileName({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 14.5,
        fontWeight: 700,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 150,
      }}
    >
      {children}
    </span>
  );
}

function TileMeta({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{children}</span>;
}

function ActionLink({
  onClick,
  hot,
  children,
}: {
  onClick: () => void;
  hot?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: hot ? "var(--hot)" : "var(--accent)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 14,
  cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  background: "var(--accent)",
  border: "none",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
