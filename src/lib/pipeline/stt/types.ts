import type { TranscriptSegment } from "@/lib/types";

/**
 * A streaming speech-to-text provider. Implementations push finalized
 * transcript segments as audio flows in. Both the mock and the real
 * (AssemblyAI/Deepgram) providers conform to this interface so the rest of
 * the pipeline is provider-agnostic.
 */
export interface SttProvider {
  readonly name: string;
  /**
   * Begin transcribing. `onSegment` is called for each finalized utterance.
   * Returns a stop function that tears down the connection / generator.
   */
  start(opts: SttStartOptions): Promise<SttHandle>;
}

/** Optional per-segment metadata a provider may surface alongside the text. */
export interface SegmentMeta {
  /** Normalized audio energy / loudness for the segment window (0..1). */
  audio?: number;
}

export interface SttStartOptions {
  /** Emits finalized transcript segments (timestamps relative to start). */
  onSegment: (segment: TranscriptSegment, meta?: SegmentMeta) => void;
  /** Optional raw PCM/Opus audio source for real providers. */
  audio?: AsyncIterable<Uint8Array>;
  /** Wall-clock-to-stream-clock zero point in ms; used to stamp segments. */
  startedAtMs: number;
}

export interface SttHandle {
  stop(): Promise<void>;
}
