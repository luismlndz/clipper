"use client";

import { useEffect, useState } from "react";

interface Embed {
  platform: "twitch" | "youtube" | "kick";
  src: string;
}

/** Build an official embed URL from a pasted stream link. */
function toEmbed(rawUrl: string, parent: string): Embed | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host.endsWith("twitch.tv")) {
    const channel = parts[0];
    if (!channel) return null;
    return {
      platform: "twitch",
      src: `https://player.twitch.tv/?channel=${encodeURIComponent(
        channel
      )}&parent=${parent}&muted=true&autoplay=true`,
    };
  }

  if (host.endsWith("youtube.com") || host.endsWith("youtu.be")) {
    let id = u.searchParams.get("v") || "";
    if (!id && host.endsWith("youtu.be")) id = parts[0] || "";
    if (!id && parts[0] === "live") id = parts[1] || "";
    if (!id && parts[0] === "embed") id = parts[1] || "";
    if (id) {
      return {
        platform: "youtube",
        src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`,
      };
    }
    // Channel live: youtube.com/channel/UCxxxx/live
    if (parts[0] === "channel" && parts[1] && parts[2] === "live") {
      return {
        platform: "youtube",
        src: `https://www.youtube.com/embed/live_stream?channel=${parts[1]}&autoplay=1&mute=1`,
      };
    }
    return null;
  }

  if (host.endsWith("kick.com")) {
    const slug = parts[0];
    if (!slug) return null;
    return {
      platform: "kick",
      src: `https://player.kick.com/${encodeURIComponent(
        slug
      )}?autoplay=true&muted=true`,
    };
  }

  return null; // TikTok / unsupported
}

export function StreamPlayer({ url }: { url: string }) {
  // Twitch's embed requires the parent param to match the host page's hostname.
  const [parent, setParent] = useState("localhost");
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    setParent(window.location.hostname);
  }, []);

  const embed = toEmbed(url, parent);

  if (!embed) {
    return (
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span>Live preview isn’t available for this URL — clipping still runs.</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)", whiteSpace: "nowrap" }}
        >
          Open stream ↗
        </a>
      </div>
    );
  }

  const label = `${embed.platform} · ${url.replace(/^https?:\/\/(www\.)?/, "")}`;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 12px",
          borderBottom: minimized ? "none" : "1px solid var(--border)",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <button
          onClick={() => setMinimized((v) => !v)}
          title={minimized ? "Show stream" : "Minimize stream"}
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            borderRadius: 7,
            padding: "3px 10px",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {minimized ? "▸ Show stream" : "▾ Minimize"}
        </button>
      </div>

      {!minimized && (
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#000" }}>
          <iframe
            key={embed.src}
            src={embed.src}
            title="Live stream"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      )}
    </div>
  );
}
