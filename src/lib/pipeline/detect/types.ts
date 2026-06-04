import type { Quality, QualityMatch } from "@/lib/types";

/**
 * Classifies a window of dialogue against the user's enabled qualities and
 * returns how strongly it matches the best one. Implemented by a heuristic
 * (mock) or a real LLM (Anthropic).
 */
export interface DialogueScorer {
  readonly name: string;
  /**
   * @param windowText recent transcript text (most recent last)
   * @param qualities the enabled qualities to watch for
   * @returns best-match score in [0,1], the matched quality, and a short reason
   */
  score(windowText: string, qualities: Quality[]): Promise<DialogueJudgement>;
}

export interface DialogueJudgement {
  score: number;
  reason: string;
  quality?: QualityMatch;
}
