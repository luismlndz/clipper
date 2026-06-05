"use client";

import { useId } from "react";
import type { ClipResult } from "@/lib/types";

/**
 * Row of social-platform logos shown on each clip. Visual for now; the click
 * mechanism is already in place via the optional `onPost` hook — pass a handler
 * later to make each logo post the clip to that platform. When `onPost` is
 * omitted the logos render as static (non-interactive) badges.
 */

export type SocialPlatformId = "instagram" | "tiktok" | "youtube-shorts";

interface Platform {
  id: SocialPlatformId;
  label: string;
  Icon: (props: { size?: number }) => JSX.Element;
}

const PLATFORMS: Platform[] = [
  { id: "instagram", label: "Instagram", Icon: InstagramIcon },
  { id: "tiktok", label: "TikTok", Icon: TikTokIcon },
  { id: "youtube-shorts", label: "YouTube Shorts", Icon: ShortsIcon },
];

// Web upload entry points. IG web has no stable upload deep-link, so we open
// the home/create surface; TikTok and YouTube have real upload pages.
const UPLOAD_URLS: Record<SocialPlatformId, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/upload",
  "youtube-shorts": "https://www.youtube.com/upload",
};

/**
 * Assisted hand-off: open the platform's upload page in a new tab. The user
 * uploads the clip there (the clip remains downloadable from its card).
 */
function defaultPost(platform: SocialPlatformId, _clip: ClipResult) {
  window.open(UPLOAD_URLS[platform], "_blank", "noopener,noreferrer");
}

export function ShareBar({
  clip,
  onPost,
}: {
  clip: ClipResult;
  /** Override the default hand-off (e.g. a future real-API posting flow). */
  onPost?: (platform: SocialPlatformId, clip: ClipResult) => void | Promise<void>;
}) {
  // A clip is postable once it has a rendered file (real mode). Simulated /
  // metadata-only clips show the logos as inert badges.
  const interactive = !!onPost || !!clip.mediaUrl;
  const handler = onPost ?? defaultPost;
  return (
    <div
      role="group"
      aria-label="Post clip to social platforms"
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          type="button"
          title={
            interactive
              ? `Post to ${p.label} — opens upload page`
              : `${p.label} — render unavailable (simulated mode)`
          }
          aria-label={`Post to ${p.label}`}
          onClick={interactive ? () => void handler(p.id, clip) : undefined}
          style={{
            display: "inline-flex",
            border: "none",
            background: "transparent",
            padding: 3,
            borderRadius: 8,
            lineHeight: 0,
            cursor: interactive ? "pointer" : "default",
            opacity: interactive ? 1 : 0.5,
          }}
        >
          <p.Icon size={18} />
        </button>
      ))}
    </div>
  );
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.45" stopColor="#d62976" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${id})`} />
      <circle cx="12" cy="12" r="4.3" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.3" fill="#fff" />
    </svg>
  );
}

// TikTok's stylized note, with the signature cyan/magenta offset echoes.
const TIKTOK_NOTE =
  "M14 3h3c0 2.2 1.6 3.8 3.5 4.1v3c-1.3 0-2.5-.4-3.5-1v6.4c0 3-2.4 5.5-5.5 5.5S6 19.5 6 16.5 8.4 11 11.5 11c.5 0 1 .07 1.5.2v3.2c-.5-.2-1-.3-1.5-.3-1.4 0-2.5 1.1-2.5 2.4s1.1 2.4 2.5 2.4 2.5-1.1 2.5-2.4V3z";

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path transform="translate(-1 -1)" fill="#25F4EE" d={TIKTOK_NOTE} />
      <path transform="translate(1 1)" fill="#FE2C55" d={TIKTOK_NOTE} />
      <path fill="#fff" d={TIKTOK_NOTE} />
    </svg>
  );
}

function ShortsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect
        x="6.5"
        y="2.5"
        width="11"
        height="19"
        rx="5.5"
        transform="rotate(20 12 12)"
        fill="#FF0033"
      />
      <path d="M10.3 8.8v6.4l5-3.2z" fill="#fff" />
    </svg>
  );
}
