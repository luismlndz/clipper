"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_OUTPUT,
  DEFAULT_PARAMS,
  type DetectionParams,
  type OutputConfig,
} from "@/lib/types";
import { useClipper } from "@/lib/useClipper";
import { ParamControls } from "@/components/ParamControls";
import { OutputControls } from "@/components/OutputControls";
import { ClipCard } from "@/components/ClipCard";
import { StreamPlayer } from "@/components/StreamPlayer";
import { FolderBar } from "@/components/FolderBar";
import { FolderPicker } from "@/components/FolderPicker";
import { useBookmarks } from "@/lib/useBookmarks";
import Image from "next/image";
import kickIcon from "@/kick-icon.png";
import twitchIcon from "@/twitch-icon.png";

const EXAMPLES = [
  "https://kick.com/n3on",
  "https://kick.com/clavicular",
  "https://twitch.tv/kaicenat",
  "https://twitch.tv/jynxzi",
  "https://kick.com/xqc",
  "https://twitch.tv/caseoh_",
];

export default function Home() {
  const { state, transcript, clips, clipMarks, logs, starting, isLive, start, stop, updateParams, updateOutput } =
    useClipper();
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<DetectionParams>(DEFAULT_PARAMS);
  const [output, setOutput] = useState<OutputConfig>(DEFAULT_OUTPUT);
  const {
    bookmarks,
    isBookmarked,
    toggle: toggleBookmark,
    remove: removeBookmark,
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    isInFolder,
    toggleClipInFolder,
  } = useBookmarks();
  const [view, setView] = useState<"live" | "saved">("live");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const activeFolderObj = folders.find((f) => f.id === activeFolder) ?? null;
  const savedToShow = activeFolderObj
    ? bookmarks.filter((c) => activeFolderObj.clipIds.includes(c.id))
    : bookmarks;

  // Push tuned params to a live session, debounced.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!isLive) return;
    const t = setTimeout(() => void updateParams(params), 400);
    return () => clearTimeout(t);
  }, [params, isLive, updateParams]);

  // Live-swap the output format on a running session — the next clip detected
  // uses whatever is selected now.
  const firstOutputRun = useRef(true);
  useEffect(() => {
    if (firstOutputRun.current) {
      firstOutputRun.current = false;
      return;
    }
    if (!isLive) return;
    void updateOutput(output);
  }, [output, isLive, updateOutput]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLive) void stop();
    else if (url.trim()) void start(url.trim(), params, output);
  };

  // Clicking a suggestion fills the input AND starts clipping it. If a stream is
  // already live, switch to the new one (stop the current session first).
  const startWithUrl = async (u: string) => {
    if (starting) return;
    setUrl(u);
    if (isLive) await stop();
    void start(u, params, output);
  };

  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: "22px 22px 64px" }}>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, margin: "0 0 10px" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a live Twitch / YouTube / Kick URL…"
          disabled={isLive}
          style={{
            flex: 1,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "13px 15px",
            color: "var(--text)",
            fontSize: 15,
          }}
        />
        <button
          type="submit"
          disabled={starting || (!isLive && !url.trim())}
          style={{
            background: isLive ? "var(--hot)" : "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "0 24px",
            fontWeight: 600,
            fontSize: 15,
            opacity: starting ? 0.6 : 1,
          }}
        >
          {starting ? "Starting…" : isLive ? "Stop" : "Start clipping"}
        </button>
      </form>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          SUGGESTIONS
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EXAMPLES.map((ex) => (
            <SuggestionChip
              key={ex}
              url={ex}
              disabled={starting}
              onClick={() => void startWithUrl(ex)}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 330px) minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Sidebar — controls + live context */}
        <aside style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <ParamControls params={params} onChange={setParams} />
          <OutputControls output={output} onChange={setOutput} />
          {logs.length > 0 && <LogPanel logs={logs} />}
        </aside>

        {/* Main — the clips (hero) */}
        <section style={{ minWidth: 0 }}>
          {state && (
            <StreamPlayer url={state.url} transcript={transcript} clipMarks={clipMarks} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <TabButton active={view === "live"} onClick={() => setView("live")}>
              Clips
              {isLive && <LiveDot />}
              <Count>{clips.length}</Count>
            </TabButton>
            <TabButton active={view === "saved"} onClick={() => setView("saved")}>
              Bookmarks
              <Count>{bookmarks.length}</Count>
            </TabButton>
          </div>

          {view === "live" ? (
            clips.length === 0 ? (
              <EmptyState isLive={!!isLive} />
            ) : (
              <ClipGrid>
                {clips.map((c) => (
                  <ClipCard
                    key={c.id}
                    clip={c}
                    bookmarked={isBookmarked(c.id)}
                    onBookmark={() => toggleBookmark(c)}
                  />
                ))}
              </ClipGrid>
            )
          ) : bookmarks.length === 0 ? (
            <BookmarksEmpty />
          ) : (
            <>
              <FolderBar
                folders={folders}
                active={activeFolder}
                totalCount={bookmarks.length}
                onSelect={setActiveFolder}
                onCreate={(name) => createFolder(name)}
                onRename={renameFolder}
                onDelete={deleteFolder}
              />
              {savedToShow.length === 0 ? (
                <FolderEmpty name={activeFolderObj?.name} />
              ) : (
                <ClipGrid>
                  {savedToShow.map((c) => (
                    <ClipCard
                      key={c.id}
                      clip={c}
                      bookmarked
                      onBookmark={() => removeBookmark(c.id)}
                      footer={
                        <FolderPicker
                          clipId={c.id}
                          folders={folders}
                          isInFolder={isInFolder}
                          onToggle={(fid) => toggleClipInFolder(fid, c.id)}
                          onCreate={(name) => createFolder(name, c.id)}
                        />
                      }
                    />
                  ))}
                </ClipGrid>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ClipGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
        gap: 20,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: active ? "var(--panel-2)" : "transparent",
        border: `1px solid ${active ? "var(--border)" : "transparent"}`,
        color: active ? "var(--text)" : "var(--muted)",
        borderRadius: 12,
        padding: "11px 20px",
        fontSize: 18,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>
      {children}
    </span>
  );
}

function BookmarksEmpty() {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px dashed var(--border)",
        borderRadius: 16,
        padding: "64px 24px",
        textAlign: "center",
        color: "var(--muted)",
      }}
    >
      <div style={{ fontSize: 16, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
        No bookmarks yet
      </div>
      <div style={{ fontSize: 13.5, maxWidth: 380, margin: "0 auto", lineHeight: 1.5 }}>
        Tap the flag icon on any clip to save it here. Bookmarks stick around after
        you refresh or start a new session.
      </div>
    </div>
  );
}

function FolderEmpty({ name }: { name?: string }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px dashed var(--border)",
        borderRadius: 16,
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--muted)",
        fontSize: 13.5,
        lineHeight: 1.5,
      }}
    >
      <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
        {name ? `"${name}" is empty` : "Folder is empty"}
      </div>
      Open <strong>All</strong> and use “Add to folder” on a clip to file it here.
    </div>
  );
}

function EmptyState({ isLive }: { isLive: boolean }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px dashed var(--border)",
        borderRadius: 16,
        padding: "64px 24px",
        textAlign: "center",
        color: "var(--muted)",
      }}
    >
      <div style={{ fontSize: 38, marginBottom: 10 }}>✂️</div>
      <div style={{ fontSize: 16, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
        {isLive ? "Watching the stream…" : "No clips yet"}
      </div>
      <div style={{ fontSize: 13.5, maxWidth: 380, margin: "0 auto", lineHeight: 1.5 }}>
        {isLive
          ? "Interesting moments will appear here the instant they happen. Tune what counts in the sidebar."
          : "Paste a live stream URL above and pick what to clip. Detected moments land here."}
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--hot)",
          boxShadow: "0 0 0 0 rgba(255,77,109,0.6)",
          animation: "clipper-pulse 1.6s infinite",
        }}
      />
      <style>{`@keyframes clipper-pulse{0%{box-shadow:0 0 0 0 rgba(255,77,109,.5)}70%{box-shadow:0 0 0 7px rgba(255,77,109,0)}100%{box-shadow:0 0 0 0 rgba(255,77,109,0)}}`}</style>
      <span style={{ fontSize: 11, color: "var(--hot)", fontWeight: 700, letterSpacing: 0.5 }}>LIVE</span>
    </span>
  );
}

function LogPanel({ logs }: { logs: { level: string; message: string; at: number }[] }) {
  const color = (l: string) =>
    l === "error" ? "var(--hot)" : l === "warn" ? "var(--warn)" : "var(--muted)";
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 12,
        maxHeight: 130,
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, letterSpacing: 0.5, fontWeight: 600 }}>
        PIPELINE LOG
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {logs.map((l, i) => (
          <div key={i} className="mono" style={{ fontSize: 11.5, color: color(l.level), lineHeight: 1.4 }}>
            {l.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A suggestion chip: platform icon + username, parsed from the channel URL. */
function SuggestionChip({
  url,
  disabled,
  onClick,
}: {
  url: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { platform, handle } = parseSuggestion(url);
  const icon = platform === "kick" ? kickIcon : platform === "twitch" ? twitchIcon : null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mono"
      style={{
        ...chip,
        color: "var(--text)",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon && (
        <Image src={icon} alt="" width={16} height={16} style={{ borderRadius: 3 }} />
      )}
      {handle}
    </button>
  );
}

/** Extract platform + username (first path segment) from a channel URL. */
function parseSuggestion(url: string): {
  platform: "kick" | "twitch" | "other";
  handle: string;
} {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const handle = u.pathname.split("/").filter(Boolean)[0] ?? url;
    if (host.endsWith("kick.com")) return { platform: "kick", handle };
    if (host.endsWith("twitch.tv")) return { platform: "twitch", handle };
    return { platform: "other", handle: url };
  } catch {
    return { platform: "other", handle: url };
  }
}

const chip: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
};
