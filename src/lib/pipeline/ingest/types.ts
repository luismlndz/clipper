import type { IngestMode, Platform, TranscriptSegment } from "@/lib/types";
import type { RawSignals } from "../detect/detector";
import type { RollingBuffer } from "./buffer";

/** One unit of stream progress: a transcript segment plus the live signals. */
export interface SourceTick {
  segment: TranscriptSegment;
  raw: RawSignals;
  /** Stream clock (seconds since session start) at this tick. */
  clock: number;
}

/**
 * A source of stream content. Either real (streamlink+ffmpeg buffer + STT) or
 * simulated (corpus-driven). Both push SourceTicks to the session.
 */
export interface IngestSource {
  readonly mode: IngestMode;
  readonly platform: Platform;
  /** Human-readable transcription engine in use (e.g. "local-whisper"). */
  readonly engine: string;
  /** Present in real mode so the clipper can cut media; null when simulated. */
  readonly buffer: RollingBuffer | null;
  start(onTick: (tick: SourceTick) => void): Promise<void>;
  stop(): Promise<void>;
}
