import type {
  CaptionWord,
  ClipResult,
  DetectionParams,
  OutputConfig,
  PipelineEvent,
  QualityMatch,
  SessionState,
  SignalScores,
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
// After a manual clip is stopped, wait this long for the tail segment to finish
// writing to disk before cutting (segments are ~SEGMENT_SECONDS long).
const MANUAL_CUT_DELAY_SECONDS = 5;

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
  private manualStart: number | null = null;
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
    const triggerAt = tick.clock;
    this.renderClip({
      startAt: Math.max(0, triggerAt - params.preSeconds),
      endAt: triggerAt + params.postSeconds,
      triggerAt,
      score,
      signals,
      reason,
      quality,
      // Snapshot the format at detection time — if the user switches the aspect
      // ratio before the delayed cut runs, this clip still uses what was
      // selected when it fired.
      output: this.output,
      delayMs: params.postSeconds * 1000,
      label: `Moment at ${triggerAt.toFixed(0)}s (score ${score.toFixed(2)})`,
    });
  }

  /** Begin a user-driven manual clip at the current stream position. */
  startManualClip(): void {
    if (this.manualStart != null) return; // already clipping
    this.manualStart = this.clock;
    this.emit({
      type: "log",
      level: "info",
      message: `Manual clip started at ${this.clock.toFixed(0)}s — click again to stop.`,
    });
  }

  /** End the manual clip and render everything from the start mark to now. */
  stopManualClip(): void {
    if (this.manualStart == null) return;
    const startAt = this.manualStart;
    const endAt = Math.max(startAt + 1, this.clock);
    this.manualStart = null;
    this.renderClip({
      startAt,
      endAt,
      triggerAt: endAt,
      score: 1,
      signals: { dialogue: 0, audio: 0, chat: 0 },
      reason: "Manual clip",
      output: this.output,
      // Wait for the tail segment to finish writing before cutting.
      delayMs: this.source?.buffer ? MANUAL_CUT_DELAY_SECONDS * 1000 : 0,
      label: `Manual clip ${startAt.toFixed(0)}s–${endAt.toFixed(0)}s`,
    });
  }

  /**
   * Assemble and (in real mode) render a clip over [startAt, endAt], then emit
   * it. Shared by automatic detection and manual clipping.
   */
  private renderClip(p: {
    startAt: number;
    endAt: number;
    triggerAt: number;
    score: number;
    signals: SignalScores;
    reason: string;
    quality?: QualityMatch;
    output: OutputConfig;
    delayMs: number;
    label: string;
  }): void {
    const clipId = newId("clip");
    this.clipCount += 1;

    // Signal the moment immediately so the UI can mark the transcript, even
    // though the rendered media (real mode) lands a few seconds later.
    this.emit({ type: "clipping", at: p.triggerAt, clipId, quality: p.quality });

    const buffer = this.source?.buffer ?? null;

    const assemble = (mediaUrl?: string): ClipResult => ({
      id: clipId,
      sessionId: this.id,
      triggerAt: p.triggerAt,
      startAt: p.startAt,
      endAt: p.endAt,
      score: p.score,
      signals: p.signals,
      quality: p.quality,
      reason: p.reason,
      transcript: this.transcriptForRange(p.startAt, p.endAt),
      mediaUrl,
      createdAt: Date.now(),
    });

    if (!buffer) {
      // Simulated mode: no media file, emit metadata immediately.
      this.emit({ type: "clip", clip: assemble() });
      this.emit({ type: "status", state: this.snapshot() });
      return;
    }

    // Real mode: wait for the trailing segments to land on disk, then cut.
    const format =
      p.output.aspectRatio === "source"
        ? "source aspect"
        : `${p.output.aspectRatio} crop`;
    const secs = Math.round(p.delayMs / 1000);
    const wait = secs > 0 ? ` — cutting in ${secs}s…` : " — cutting…";
    this.emit({
      type: "log",
      level: "info",
      message: `${p.label}, ${format}${wait}`,
    });
    setTimeout(() => {
      // Gather words now (not earlier) so trailing words transcribed during the
      // wait are included in the captions.
      const captionWords = p.output.captions
        ? this.wordsForRange(p.startAt, p.endAt)
        : undefined;
      void cutClip(buffer, {
        clipId,
        startAt: p.startAt,
        endAt: p.endAt,
        output: p.output,
        captionWords,
      })
        .then((res) => {
          const mediaUrl = res.filePath ? `/api/clips/${clipId}` : undefined;
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
    }, p.delayMs);
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
