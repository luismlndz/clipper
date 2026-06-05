"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClipResult } from "./types";

const CLIPS_KEY = "clipper:bookmarks";
const FOLDERS_KEY = "clipper:folders";

/** A named, user-created collection of bookmarked clips (referenced by id). */
export interface BookmarkFolder {
  id: string;
  name: string;
  clipIds: string[];
}

/** Client-side id generator (avoids importing node:crypto into the bundle). */
const genId = (prefix: string): string =>
  `${prefix}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(
    0,
    8
  )}`;

/**
 * Persisted bookmarked clips plus user-created folders. Clips are stored as full
 * objects (the live feed is wiped on refresh, so ids alone couldn't render
 * them); folders reference clips by id. Removing a bookmark also prunes it from
 * every folder. All persisted to localStorage so it survives reload/new session.
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<ClipResult[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);

  // Load once on mount (client-only; localStorage isn't available on the server).
  useEffect(() => {
    try {
      const rawClips = localStorage.getItem(CLIPS_KEY);
      if (rawClips) {
        const parsed = JSON.parse(rawClips);
        if (Array.isArray(parsed)) {
          // Keep only well-formed clip objects, ignoring the old id-only format.
          setBookmarks(
            parsed.filter(
              (c): c is ClipResult =>
                c && typeof c === "object" && typeof c.id === "string"
            )
          );
        }
      }
      const rawFolders = localStorage.getItem(FOLDERS_KEY);
      if (rawFolders) {
        const parsed = JSON.parse(rawFolders);
        if (Array.isArray(parsed)) {
          setFolders(
            parsed
              .filter((f) => f && typeof f.id === "string" && typeof f.name === "string")
              .map((f) => ({
                id: f.id,
                name: f.name,
                clipIds: Array.isArray(f.clipIds) ? f.clipIds.filter((x: unknown) => typeof x === "string") : [],
              }))
          );
        }
      }
    } catch {
      /* corrupt/unavailable storage — start empty */
    }
  }, []);

  const persistClips = useCallback((next: ClipResult[]) => {
    setBookmarks(next);
    try {
      localStorage.setItem(CLIPS_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — keep in-memory only */
    }
  }, []);

  const persistFolders = useCallback((next: BookmarkFolder[]) => {
    setFolders(next);
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — keep in-memory only */
    }
  }, []);

  // --- Bookmarks ---

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((c) => c.id === id),
    [bookmarks]
  );

  /** Drop a clip from the saved list AND from every folder it belonged to. */
  const remove = useCallback(
    (id: string) => {
      persistClips(bookmarks.filter((c) => c.id !== id));
      const touched = folders.filter((f) => f.clipIds.includes(id));
      if (touched.length) {
        persistFolders(
          folders.map((f) =>
            f.clipIds.includes(id)
              ? { ...f, clipIds: f.clipIds.filter((cid) => cid !== id) }
              : f
          )
        );
      }
    },
    [bookmarks, folders, persistClips, persistFolders]
  );

  /** Add the clip if absent, remove it (and unfile it) if already bookmarked. */
  const toggle = useCallback(
    (clip: ClipResult) => {
      if (bookmarks.some((c) => c.id === clip.id)) remove(clip.id);
      else persistClips([clip, ...bookmarks]);
    },
    [bookmarks, persistClips, remove]
  );

  const clear = useCallback(() => {
    persistClips([]);
    persistFolders([]);
  }, [persistClips, persistFolders]);

  // --- Folders ---

  /** Create a folder; optionally seed it with one clip. Returns the new id. */
  const createFolder = useCallback(
    (name: string, clipId?: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const folder: BookmarkFolder = {
        id: genId("fld"),
        name: trimmed,
        clipIds: clipId ? [clipId] : [],
      };
      persistFolders([...folders, folder]);
      return folder.id;
    },
    [folders, persistFolders]
  );

  const renameFolder = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persistFolders(folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
    },
    [folders, persistFolders]
  );

  const deleteFolder = useCallback(
    (id: string) => persistFolders(folders.filter((f) => f.id !== id)),
    [folders, persistFolders]
  );

  const isInFolder = useCallback(
    (folderId: string, clipId: string) =>
      folders.find((f) => f.id === folderId)?.clipIds.includes(clipId) ?? false,
    [folders]
  );

  /** Add the clip to the folder if absent, remove it if present. */
  const toggleClipInFolder = useCallback(
    (folderId: string, clipId: string) => {
      persistFolders(
        folders.map((f) => {
          if (f.id !== folderId) return f;
          const has = f.clipIds.includes(clipId);
          return {
            ...f,
            clipIds: has ? f.clipIds.filter((c) => c !== clipId) : [...f.clipIds, clipId],
          };
        })
      );
    },
    [folders, persistFolders]
  );

  return {
    bookmarks,
    isBookmarked,
    toggle,
    remove,
    clear,
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    isInFolder,
    toggleClipInFolder,
  };
}
