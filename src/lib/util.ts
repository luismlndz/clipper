import { randomUUID } from "node:crypto";
import type { Platform } from "./types";

export const newId = (prefix = ""): string =>
  prefix ? `${prefix}_${randomUUID().slice(0, 8)}` : randomUUID();

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Lowercase kebab slug for ids (e.g. "Plot Twist!" → "plot-twist"). */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "q";

export const now = (): number => Date.now();

/** Detect the streaming platform from a pasted URL. */
export function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("kick.com")) return "kick";
  if (u.includes("tiktok.com")) return "tiktok";
  return "unknown";
}

type SignalKey = "dialogue" | "audio" | "chat";

/**
 * Weighted average over the *available* signals only. A signal that is
 * undefined/null (e.g. audio energy when there's no audio tap) is excluded from
 * both numerator and denominator, so missing signals don't suppress the score —
 * unlike treating them as zero.
 */
export function fuse(
  signals: Partial<Record<SignalKey, number | null>>,
  weights: Record<SignalKey, number>
): number {
  let weightUsed = 0;
  let sum = 0;
  for (const key of ["dialogue", "audio", "chat"] as SignalKey[]) {
    const v = signals[key];
    if (v == null || !Number.isFinite(v)) continue;
    weightUsed += weights[key];
    sum += v * weights[key];
  }
  if (weightUsed <= 0) return 0;
  return clamp01(sum / weightUsed);
}
