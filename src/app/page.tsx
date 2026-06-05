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

const EXAMPLES = ["https://twitch.tv/", "https://youtube.com/watch?v=", "https://kick.com/"];

export default function Home() {
  const { state, transcript, clips, clipMarks, logs, starting, isLive, start, stop, updateParams, updateOutput, manualClipping, toggleManualClip } =
    useClipper();
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<DetectionParams>(DEFAULT_PARAMS);
  const [output, setOutput] = useState<OutputConfig>(DEFAULT_OUTPUT);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Persist bookmarks across refreshes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("clipper:bookmarks");
      if (raw) setBookmarks(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);
  const toggleBookmark = (id: string) =>
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("clipper:bookmarks", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });

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

  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: "22px 22px 64px" }}>
      <Header />

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, margin: "18px 0 10px" }}>
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

      {!state ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setUrl(ex)} className="mono" style={chip}>
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <StatusBar />
        </div>
      )}

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
            <StreamPlayer
              url={state.url}
              transcript={transcript}
              clipMarks={clipMarks}
              manualClipping={manualClipping}
              onToggleClip={isLive ? toggleManualClip : undefined}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              Clips
              {isLive && <LiveDot />}
              <span className="mono" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>
                {clips.length}
              </span>
            </h2>
          </div>

          {clips.length === 0 ? (
            <EmptyState isLive={!!isLive} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))",
                gap: 16,
                alignItems: "start",
              }}
            >
              {clips.map((c) => (
                <ClipCard
                  key={c.id}
                  clip={c}
                  bookmarked={bookmarks.has(c.id)}
                  onBookmark={() => toggleBookmark(c.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );

  function StatusBar() {
    if (!state) return null;
    const chips: [string, string][] = [
      ["status", state.status],
      ["mode", state.ingestMode],
      ["platform", state.platform],
      ["clock", `${Math.floor(state.clock)}s`],
      ["clips", String(state.clipCount)],
    ];
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {chips.map(([k, v]) => (
          <span key={k} className="mono" style={statusChip}>
            <span style={{ color: "var(--muted)" }}>{k} </span>
            <span
              style={{
                color:
                  k === "status" && v === "live"
                    ? "var(--accent-2)"
                    : k === "mode" && v === "simulated"
                    ? "var(--warn)"
                    : "var(--text)",
              }}
            >
              {v}
            </span>
          </span>
        ))}
        {state.error && <span style={{ color: "var(--hot)", fontSize: 12 }}>{state.error}</span>}
      </div>
    );
  }
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

function Header() {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        ✂
      </div>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Clipper</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Real-time livestream clipper — auto-cuts interesting moments as they happen
        </p>
      </div>
    </header>
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

const chip: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
};
const statusChip: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "4px 12px",
  fontSize: 12,
};
