import type {
  CaptionWord,
  ClipResult,
  DetectionParams,
  OutputConfig,
  PipelineEvent,
  SessionState,
  TranscriptSegment,
} from "@/lib/types";
import { newId } from "@/lib/util";
import { Detector, type Evaluation } from "./detect/detector";
import { selectDialogueScorer } from "./detect";
import { selectSource } from "./ingest";
import type { IngestSource, SourceTick } from "./ingest";
import { cutClip } from "./clipper";

type Listener = (event: PipelineEvent) => void;

const WINDOW_SEGMENTS = 5; // dialogue-scoring context window
const HISTORY_SECONDS = 240; // transcript kept for clip assembly
// Throttle scoring to ~once per this many seconds of stream time. Whisper can
// emit several segments per window; without this the LLM scorer would fire
// redundantly. Tunable via SCORE_INTERVAL_SECONDS.
const SCORE_INTERVAL_SECONDS = Number(process.env.SCORE_INTERVAL_SECONDS) || 4;

/** Approximate word timings by splitting a segment's text evenly across its span. */
function synthWords(seg: TranscriptSegment): CaptionWord[] {
  const tokens = seg.text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const step = (seg.end - seg.start) / tokens.length;
  return tokens.map((text, i) => ({
    text,
    start: seg.start + i * step,
    end: seg.start + (i + 1) * step,
  }));
}

/**
 * Orchestrates one monitoring session: ingest → transcribe → score → clip.
 * Emits PipelineEvents that the SSE route forwards to the browser.
 */
export class Session {
  readonly id: string;
  private source?: IngestSource;
  private detector: Detector;
  private listeners = new Set<Listener>();
  private history: TranscriptSegment[] = [];
  private window: string[] = [];
  private clipCount = 0;
  private clock = 0;
  private lastEvalClock = -Infinity;
  private state: SessionState;

  constructor(
    readonly url: string,
    params: DetectionParams,
    private output: OutputConfig
  ) {
    this.id = newId("sess");
    this.detector = new Detector(params, selectDialogueScorer());
    this.state = {
      id: this.id,
      url,
      platform: "unknown",
      status: "starting",
      ingestMode: "simulated",
      params,
      startedAt: Date.now(),
      clock: 0,
      clipCount: 0,
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn({ type: "status", state: this.snapshot() });
    return () => this.listeners.delete(fn);
  }

  private emit(event: PipelineEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        /* a dead listener must not break the pipeline */
      }
    }
  }

  snapshot(): SessionState {
    return { ...this.state, clock: this.clock, clipCount: this.clipCount };
  }

  updateParams(params: DetectionParams): void {
    this.detector.updateParams(params);
    this.state.params = params;
    this.emit({ type: "status", state: this.snapshot() });
  }

  /**
   * Live-swap the output format. Each clip uses whatever is selected at the
   * moment it's detected, so the format can change between clips in one session.
   */
  updateOutput(output: OutputConfig): void {
    this.output = output;
  }

  async start(): Promise<void> {
    try {
      this.source = await selectSource(this.id, this.url);
      this.state.platform = this.source.platform;
      this.state.ingestMode = this.source.mode;
      this.state.status = "live";
      this.emit({ type: "status", state: this.snapshot() });
      this.emit({
        type: "log",
        level: "info",
        message: `Ingest started — ${this.source.mode} mode, ${this.source.platform}, STT: ${this.source.engine}.`,
      });
      this.armTranscriptWatchdog();
      await this.source.start((tick) => void this.onTick(tick));
    } catch (err) {
      this.state.status = "error";
      this.state.error = (err as Error).message;
      this.emit({ type: "status", state: this.snapshot() });
      this.emit({ type: "log", level: "error", message: this.state.error });
    }
  }

  /** Warn if no transcript shows up — usually a non-live or silent stream. */
  private armTranscriptWatchdog(): void {
    const delay = this.source?.mode === "real" ? 30000 : 8000;
    setTimeout(() => {
      if (this.state.status === "live" && this.history.length === 0) {
        this.emit({
          type: "log",
          level: "warn",
          message:
            "No transcript yet after " +
            delay / 1000 +
            "s. Is the stream actually LIVE and is someone talking? " +
            "(Whisper needs audible speech; music/silence won't transcribe.)",
        });
      }
    }, delay);
  }

  private async onTick(tick: SourceTick): Promise<void> {
    this.clock = tick.clock;
    this.pushHistory(tick.segment);
    this.emit({ type: "transcript", segment: tick.segment });

    this.window.push(tick.segment.text);
    if (this.window.length > WINDOW_SEGMENTS) this.window.shift();
    const windowText = this.window.join(" ");

    // Throttle scoring (and thus LLM calls) to roughly once per interval.
    if (tick.clock - this.lastEvalClock < SCORE_INTERVAL_SECONDS) return;
    this.lastEvalClock = tick.clock;

    const evaluation = await this.detector.evaluate(windowText, tick.raw);
    this.emit({
      type: "score",
      at: tick.clock,
      fused: evaluation.fused,
      signals: evaluation.signals,
      quality: evaluation.quality,
    });

    if (this.detector.shouldFire(evaluation.fused, tick.clock)) {
      this.detector.markFired(tick.clock);
      await this.fireClip(tick, evaluation);
    }
  }

  private pushHistory(seg: TranscriptSegment): void {
    this.history.push(seg);
    const cutoff = this.clock - HISTORY_SECONDS;
    while (this.history.length && this.history[0].end < cutoff) {
      this.history.shift();
    }
  }

  private transcriptForRange(startAt: number, endAt: number): string {
    return this.history
      .filter((s) => s.end >= startAt && s.start <= endAt)
      .map((s) => s.text)
      .join(" ");
  }

  /**
   * Per-word timings within the clip window, rebased to clip-relative seconds
   * (0 = clip start) for burned-in captions. Uses real word timestamps when the
   * STT provides them; otherwise distributes a segment's words evenly across its
   * span so captions still roughly track the audio in mock/no-word-data mode.
   */
  private wordsForRange(startAt: number, endAt: number): CaptionWord[] {
    const dur = endAt - startAt;
    const out: CaptionWord[] = [];
    for (const seg of this.history) {
      if (seg.end < startAt || seg.start > endAt) continue;
      const words = seg.words?.length ? seg.words : synthWords(seg);
      for (const w of words) {
        if (w.end < startAt || w.start > endAt) continue;
        const start = Math.min(Math.max(0, w.start - startAt), dur);
        const end = Math.min(Math.max(0, w.end - startAt), dur);
        if (end <= start || !w.text) continue;
        out.push({ text: w.text, start, end });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  private async fireClip(tick: SourceTick, evaluation: Evaluation): Promise<void> {
    const { fused: score, signals, reason, quality } = evaluation;
    const params = this.detector.getParams();
    // Snapshot the format at detection time — if the user switches the aspect
    // ratio before the delayed cut runs, this clip still uses what was selected
    // when it fired.
    const output = this.output;
    const triggerAt = tick.clock;
    const startAt = Math.max(0, triggerAt - params.preSeconds);
    const endAt = triggerAt + params.postSeconds;
    const clipId = newId("clip");
    this.clipCount += 1;

    // Signal the moment immediately so the UI can mark the transcript, even
    // though the rendered media (real mode) lands a few seconds later.
    this.emit({ type: "clipping", at: triggerAt, clipId, quality });

    const buffer = this.source?.buffer ?? null;

    const assemble = (mediaUrl?: string): ClipResult => ({
      id: clipId,
      sessionId: this.id,
      triggerAt,
      startAt,
      endAt,
      score,
      signals,
      quality,
      reason,
      transcript: this.transcriptForRange(startAt, endAt),
      mediaUrl,
      createdAt: Date.now(),
    });

    if (!buffer) {
      // Simulated mode: no media file, emit metadata immediately.
      this.emit({ type: "clip", clip: assemble() });
      this.emit({ type: "status", state: this.snapshot() });
      return;
    }

    // Real mode: wait for the post-roll to land on disk, then cut.
    const format =
      output.aspectRatio === "source"
        ? "source aspect"
        : `${output.aspectRatio} crop`;
    this.emit({
      type: "log",
      level: "info",
      message: `Moment at ${triggerAt.toFixed(0)}s (score ${score.toFixed(2)}, ${format}) — cutting in ${params.postSeconds}s…`,
    });
    setTimeout(() => {
      // Gather words now (not at detection time) so the post-roll's words,
      // transcribed during the wait, are included in the captions.
      const captionWords = output.captions
        ? this.wordsForRange(startAt, endAt)
        : undefined;
      void cutClip(buffer, { clipId, startAt, endAt, output, captionWords })
        .then((res) => {
          const mediaUrl = res.filePath
            ? `/api/clips/${clipId}`
            : undefined;
          this.emit({ type: "clip", clip: assemble(mediaUrl) });
          this.emit({ type: "status", state: this.snapshot() });
        })
        .catch((err) => {
          this.emit({
            type: "log",
            level: "warn",
            message: `Clip render failed: ${(err as Error).message}`,
          });
        });
    }, params.postSeconds * 1000);
  }

  async stop(): Promise<void> {
    this.state.status = "stopping";
    this.emit({ type: "status", state: this.snapshot() });
    await this.source?.stop().catch(() => void 0);
    this.state.status = "stopped";
    this.emit({ type: "status", state: this.snapshot() });
    this.emit({ type: "stopped", sessionId: this.id });
    this.listeners.clear();
  }
}
