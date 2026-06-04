// Shared domain types for the real-time clipper pipeline.

export type Platform = "twitch" | "youtube" | "kick" | "tiktok" | "unknown";

export type IngestMode = "real" | "simulated";

export type SessionStatus =
  | "starting"
  | "live"
  | "stopping"
  | "stopped"
  | "error";

/** A single transcribed utterance with absolute stream timestamps (seconds). */
export interface TranscriptSegment {
  id: string;
  /** Seconds from session start. */
  start: number;
  end: number;
  text: string;
  /** Optional speaker label from diarization. */
  speaker?: string;
}

/**
 * A kind of moment the user wants to catch ("Funny", "Fight about to happen").
 * The LLM scorer is told to watch for every enabled quality; the heuristic
 * fallback matches the `hints`.
 */
export interface Quality {
  id: string;
  label: string;
  /** Plain-English definition fed to the LLM and shown in the UI. */
  description: string;
  enabled: boolean;
  /** Keyword/phrase cues used by the heuristic (and as LLM hints). */
  hints: string[];
}

/** Per-signal scores that feed the weighted "interesting" fusion. */
export interface SignalScores {
  /** How strongly the dialogue matches an enabled quality (0..1). */
  dialogue: number;
  /** Audio energy / loudness spike (0..1). */
  audio: number;
  /** Chat message velocity spike (0..1). */
  chat: number;
}

/** A quality that a moment was classified as. */
export interface QualityMatch {
  id: string;
  label: string;
}

/** The tunable definition of "interesting". */
export interface DetectionParams {
  /** The qualities the user is hunting for. */
  qualities: Quality[];
  /** Fused score in [0,1] above which a clip fires. */
  threshold: number;
  /** Seconds of context to grab before the trigger moment. */
  preSeconds: number;
  /** Seconds of context to grab after the trigger moment. */
  postSeconds: number;
  /** Minimum gap between two clips to avoid duplicates (seconds). */
  cooldownSeconds: number;
}

export interface ClipResult {
  id: string;
  sessionId: string;
  /** Seconds from session start. */
  triggerAt: number;
  startAt: number;
  endAt: number;
  score: number;
  signals: SignalScores;
  /** Which quality this moment was classified as, if any. */
  quality?: QualityMatch;
  /** Short human-readable reason the moment fired. */
  reason: string;
  /** Transcript text spanning the clip window. */
  transcript: string;
  /** Path served under /api/clips/:id when a real media file exists. */
  mediaUrl?: string;
  createdAt: number;
}

export interface SessionConfig {
  url: string;
  params: DetectionParams;
}

export interface SessionState {
  id: string;
  url: string;
  platform: Platform;
  status: SessionStatus;
  ingestMode: IngestMode;
  params: DetectionParams;
  startedAt: number;
  /** Latest stream clock in seconds since session start. */
  clock: number;
  error?: string;
  clipCount: number;
}

// --- Live event stream pushed to the browser over SSE ---

export type PipelineEvent =
  | { type: "status"; state: SessionState }
  | { type: "transcript"; segment: TranscriptSegment }
  | {
      type: "score";
      at: number;
      fused: number;
      signals: SignalScores;
      quality?: QualityMatch;
    }
  | { type: "clip"; clip: ClipResult }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "stopped"; sessionId: string };

/**
 * The built-in qualities offered out of the box. "Highlight" is a broad
 * catch-all (on by default) so the tool clips any exciting/notable moment even
 * when it doesn't fit a specific category; the others refine the label. Hints
 * are matched leniently (substring + word-stem), and general delivery cues
 * (shouting, laughter, excitement, audio energy) count even with no hint match.
 */
export const DEFAULT_QUALITIES: Quality[] = [
  {
    id: "highlight",
    label: "Highlight (anything exciting)",
    description: "Any high-energy, surprising, funny, or otherwise notable moment",
    enabled: false,
    hints: [
      "wow", "whoa", "oh my god", "no way", "crazy", "insane", "unbelievable",
      "holy", "huge", "massive", "let's go", "lets go", "omg",
      "are you kidding", "you serious", "incredible", "amazing", "what the",
    ],
  },
  {
    id: "hype",
    label: "Hype / big win",
    description: "Clutch plays, big wins, victories, hype reactions",
    enabled: false,
    hints: [
      "clutch", "pog", "poggers", "let's go", "lets go", "no way", "insane",
      "world record", "triple kill", "we did it", "got him", "got em", "won",
      "victory", "gg", "ez", "clip that", "first try", "perfect",
    ],
  },
  {
    id: "funny",
    label: "Funny",
    description: "Jokes, laughter, hilarious or absurd moments",
    enabled: true,
    hints: [
      "lol", "lmao", "lmfao", "haha", "hahaha", "funny", "hilarious", "joke",
      "kidding", "bruh", "i'm dead", "dying", "can't breathe", "cant breathe",
      "so funny", "cracking up", "weird",
    ],
  },
  {
    id: "fight",
    label: "Drama / confrontation",
    description: "Rising tension, callouts, arguments, a fight brewing",
    enabled: false,
    hints: [
      "fight", "square up", "throw hands", "run it", "who said", "call out",
      "callout", "beef", "come here", "say it again", "problem", "step up",
      "one v one", "1v1", "talking trash", "shut up", "are you serious",
    ],
  },
  {
    id: "controversial",
    label: "Controversial / hot take",
    description: "Hot takes, unpopular opinions, drama, spicy statements",
    enabled: false,
    hints: [
      "hot take", "unpopular opinion", "controversial", "no offense",
      "the problem with", "honestly", "drama", "cancel", "exposed", "sus",
      "to be honest", "in my opinion",
    ],
  },
  {
    id: "story",
    label: "Story time",
    description: "The streamer launches into a personal story or anecdote",
    enabled: false,
    hints: [
      "story time", "let me tell you", "so basically", "one time", "back when",
      "this one time", "long story", "remember when", "funny story",
      "true story", "so anyway",
    ],
  },
  {
    id: "emotional",
    label: "Emotional / wholesome",
    description: "Heartfelt, grateful, proud, or tearful moments",
    enabled: false,
    hints: [
      "crying", "tearing up", "emotional", "means so much", "grateful",
      "thank you", "appreciate", "love you", "proud", "heartfelt",
    ],
  },
];

export const DEFAULT_PARAMS: DetectionParams = {
  qualities: DEFAULT_QUALITIES,
  threshold: 0.5,
  preSeconds: 25,
  postSeconds: 12,
  cooldownSeconds: 30,
};
