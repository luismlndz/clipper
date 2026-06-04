import type { Quality } from "@/lib/types";
import type { DialogueScorer, DialogueJudgement } from "./types";
import { clamp01 } from "@/lib/util";

// Broad reaction/excitement vocabulary used for the general-interestingness
// signal — independent of any specific quality. Real speech rarely contains a
// category's exact keyword, but it very often contains one of these.
const REACTION_WORDS = [
  "wow", "whoa", "oh my", "no way", "crazy", "insane", "unbelievable",
  "holy", "huge", "massive", "omg", "kidding", "incredible", "amazing",
  "ridiculous", "nuts", "wild", "let's go", "lets go", "unreal",
];
const LAUGHTER = ["lol", "lmao", "lmfao", "haha", "hehe", "rofl"];

/**
 * Heuristic interestingness scorer. Combines GENERAL delivery cues (shouting,
 * exclamation, questions, reaction words, laughter) with a lenient per-quality
 * hint match, so a moment can score highly purely on energy and still get the
 * best-fitting label. Swap for the Anthropic scorer with a key for real
 * semantic understanding.
 */
export class MockDialogueScorer implements DialogueScorer {
  readonly name = "mock-heuristic";

  async score(windowText: string, qualities: Quality[]): Promise<DialogueJudgement> {
    const text = windowText.toLowerCase();
    const general = generalInterest(windowText, text);

    // Lenient per-quality match: best quality by hint hits.
    let best: { q: Quality; specific: number; hint?: string } | null = null;
    for (const q of qualities) {
      const hit = q.hints.find((h) => text.includes(h.toLowerCase()));
      const hits = q.hints.filter((h) => text.includes(h.toLowerCase())).length;
      if (hits === 0) continue;
      const specific = clamp01(hits / 1.5);
      if (!best || specific > best.specific) best = { q, specific, hint: hit };
    }

    const bestSpecific = best?.specific ?? 0;
    const dialogue = clamp01(0.62 * general + 0.6 * bestSpecific);

    // Pick a label: a clearly-matched category wins; otherwise fall back to the
    // enabled "highlight" catch-all (or the weak best match) so general energy
    // still gets a sensible tag.
    const highlight = qualities.find((q) => q.id === "highlight");
    let quality: { id: string; label: string } | undefined;
    let reason: string;
    if (best && bestSpecific >= 0.34) {
      quality = { id: best.q.id, label: best.q.label };
      reason = `${best.q.label}${best.hint ? ` — “${best.hint}”` : ""}`;
    } else if (highlight) {
      quality = { id: highlight.id, label: highlight.label };
      reason = energyReason(general);
    } else if (best) {
      quality = { id: best.q.id, label: best.q.label };
      reason = `${best.q.label} (weak)`;
    } else {
      reason = energyReason(general);
    }

    return { score: dialogue, reason, quality };
  }
}

/** General excitement 0..1 from delivery, regardless of topic. */
function generalInterest(raw: string, lower: string): number {
  const excl = (raw.match(/!/g) || []).length;
  const q = (raw.match(/\?/g) || []).length;
  const punct = clamp01((excl + q * 0.5) / 3);

  const letters = raw.replace(/[^a-zA-Z]/g, "");
  const caps = raw.replace(/[^A-Z]/g, "").length;
  const capsRatio = letters.length ? caps / letters.length : 0;
  const shouting = clamp01((capsRatio - 0.12) * 3);

  const reactions = clamp01(
    REACTION_WORDS.filter((w) => lower.includes(w)).length / 2
  );
  const laughter = LAUGHTER.some((w) => lower.includes(w)) ? 0.6 : 0;
  const repeated = /\b(\w+)\s+\1\b/.test(lower) ? 0.35 : 0; // "no no", "go go"

  return clamp01(
    0.4 * reactions + 0.3 * punct + 0.3 * shouting + 0.45 * laughter + repeated
  );
}

function energyReason(general: number): string {
  if (general >= 0.7) return "high-energy moment";
  if (general >= 0.45) return "notable reaction";
  return "lively moment";
}
