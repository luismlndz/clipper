import type { DetectionParams, QualityMatch, SignalScores } from "@/lib/types";
import { clamp01, fuse } from "@/lib/util";
import type { DialogueScorer } from "./types";

export interface RawSignals {
  /** Audio energy / loudness spike in [0,1], or null when unavailable. */
  audio: number | null;
  /** Chat-velocity spike in [0,1], or null when unavailable. */
  chat: number | null;
}

export interface Evaluation {
  signals: SignalScores;
  fused: number;
  reason: string;
  quality?: QualityMatch;
}

// Fixed fusion weights: the quality-match dialogue score leads, with audio
// energy a strong corroborating signal (loud/excited moments) and chat a boost.
// Unavailable signals (e.g. chat in real mode) are excluded, not zeroed.
const WEIGHTS = { dialogue: 1, audio: 0.7, chat: 0.6 };

/**
 * Classifies each window against the enabled qualities, fuses with audio/chat,
 * and decides whether to fire a clip (threshold + cooldown).
 */
export class Detector {
  private lastFiredAt = -Infinity;

  constructor(
    private params: DetectionParams,
    private readonly scorer: DialogueScorer
  ) {}

  updateParams(params: DetectionParams): void {
    this.params = params;
  }

  getParams(): DetectionParams {
    return this.params;
  }

  /** Score the current window. Async because dialogue scoring may call an LLM. */
  async evaluate(windowText: string, raw: RawSignals): Promise<Evaluation> {
    const enabled = this.params.qualities.filter((q) => q.enabled);
    const judged = await this.scorer.score(windowText, enabled);
    const dialogue = clamp01(judged.score);

    const fused = fuse(
      {
        dialogue,
        audio: raw.audio == null ? null : clamp01(raw.audio),
        chat: raw.chat == null ? null : clamp01(raw.chat),
      },
      WEIGHTS
    );

    const signals: SignalScores = {
      dialogue,
      audio: raw.audio == null ? 0 : clamp01(raw.audio),
      chat: raw.chat == null ? 0 : clamp01(raw.chat),
    };
    return { signals, fused, reason: judged.reason, quality: judged.quality };
  }

  /** Threshold + cooldown gate. */
  shouldFire(fused: number, atClock: number): boolean {
    if (fused < this.params.threshold) return false;
    if (atClock - this.lastFiredAt < this.params.cooldownSeconds) return false;
    return true;
  }

  markFired(atClock: number): void {
    this.lastFiredAt = atClock;
  }
}
