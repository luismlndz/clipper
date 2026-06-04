import type { DialogueScorer } from "./types";
import { MockDialogueScorer } from "./mock-llm";
import { AnthropicDialogueScorer } from "./anthropic";

/** Use the real LLM scorer when ANTHROPIC_API_KEY is set, else the heuristic. */
export function selectDialogueScorer(): DialogueScorer {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? new AnthropicDialogueScorer(key) : new MockDialogueScorer();
}

export type { DialogueScorer, DialogueJudgement } from "./types";
