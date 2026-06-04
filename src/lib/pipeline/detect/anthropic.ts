import Anthropic from "@anthropic-ai/sdk";
import type { Quality } from "@/lib/types";
import type { DialogueScorer, DialogueJudgement } from "./types";
import { clamp01 } from "@/lib/util";

// Haiku 4.5 — fast + cheap, the right tier for scoring a transcript window
// every few seconds per stream. No thinking / no effort (effort errors on Haiku),
// tiny max_tokens since the output is a one-line JSON verdict.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Structured-output schema: the model is constrained to emit exactly this, so the
// response is guaranteed-valid JSON (no regex parsing). Note: structured outputs
// don't support numeric min/max, so we validate the 0-100 range ourselves.
const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    quality: {
      type: "string",
      description: "The id of the best-matching quality, or 'none'.",
    },
    score: {
      type: "integer",
      description: "0-100: how strongly the latest moment matches that quality.",
    },
    reason: {
      type: "string",
      description: "<= 8 words explaining the match.",
    },
  },
  required: ["quality", "score", "reason"],
} as const;

// Reuse one client across calls (reads ANTHROPIC_API_KEY from the environment).
let client: Anthropic | null = null;
const getClient = (apiKey: string) => (client ??= new Anthropic({ apiKey }));

/**
 * LLM quality classifier. Given the enabled qualities (label + plain-English
 * description only — no keyword hints), Claude reads the rolling transcript and
 * judges whether the most recent moment is clip-worthy, using its own
 * understanding of slang, sarcasm, and context. Enabled when ANTHROPIC_API_KEY
 * is set.
 */
export class AnthropicDialogueScorer implements DialogueScorer {
  readonly name = "anthropic-llm";

  constructor(private readonly apiKey: string) {}

  async score(windowText: string, qualities: Quality[]): Promise<DialogueJudgement> {
    if (qualities.length === 0) {
      return { score: 0, reason: "no qualities enabled" };
    }

    const system = buildSystem(qualities);

    try {
      const res = await getClient(this.apiKey).messages.create({
        model: MODEL,
        max_tokens: 100,
        // System prompt (instructions + qualities) is stable across the many
        // calls in a session, so mark it cacheable. See the caveat in the note
        // I gave you: Haiku's min cacheable prefix is 4096 tokens, so a short
        // qualities list won't actually cache — it just no-ops harmlessly.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
        messages: [
          {
            role: "user",
            content: `Transcript (most recent dialogue last):\n"""${windowText}"""`,
          },
        ],
      });

      const text = res.content.find((b) => b.type === "text");
      const parsed = JSON.parse(text && "text" in text ? text.text : "{}");
      const matched = qualities.find((q) => q.id === parsed.quality);

      return {
        score: clamp01((Number(parsed.score) || 0) / 100),
        reason: String(parsed.reason || matched?.label || "llm score"),
        quality: matched ? { id: matched.id, label: matched.label } : undefined,
      };
    } catch (err) {
      // Fail soft: a scoring error must never kill the live pipeline.
      return { score: 0, reason: `llm error: ${(err as Error).message}` };
    }
  }
}

function buildSystem(qualities: Quality[]): string {
  const list = qualities
    .map((q) => `- ${q.id}: ${q.label} — ${q.description}`)
    .join("\n");
  return (
    "You score moments from a livestream transcript for a real-time clipping tool. " +
    "Decide whether the MOST RECENT moment in the transcript is clip-worthy because " +
    "it matches one of the qualities the viewer is hunting for. Use your own " +
    "understanding of slang, sarcasm, tone, and context — do not rely on keyword " +
    "matching. A moment can match a quality even if it never uses that word.\n\n" +
    "Qualities:\n" +
    `${list}\n\n` +
    "Pick the single best-matching quality id (or \"none\" if nothing fits), and " +
    "rate 0-100 how strongly the latest moment matches it. Be discerning: most " +
    "ordinary chatter should score low (< 40). Reserve high scores for moments a " +
    "human clipper would actually cut."
  );
}
