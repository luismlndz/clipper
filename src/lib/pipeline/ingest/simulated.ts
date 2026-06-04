import type { IngestMode, Platform } from "@/lib/types";
import { clamp01, detectPlatform, newId } from "@/lib/util";
import { STREAM_CORPUS } from "../corpus";
import type { IngestSource, SourceTick } from "./types";

/**
 * Corpus-driven stream simulator. Walks STREAM_CORPUS on a timer, emitting a
 * transcript segment plus synthetic audio-energy and chat-velocity signals
 * derived from each line's hidden `intensity`. Lets the full multimodal
 * detection path run end-to-end with no streamlink/ffmpeg/API keys.
 */
export class SimulatedSource implements IngestSource {
  readonly mode: IngestMode = "simulated";
  readonly platform: Platform;
  readonly engine = "corpus-sim";
  readonly buffer = null;
  private timer?: NodeJS.Timeout;
  private i = 0;
  private clock = 0;

  constructor(private readonly url: string) {
    this.platform = detectPlatform(url);
  }

  async start(onTick: (tick: SourceTick) => void): Promise<void> {
    const emit = () => {
      const line = STREAM_CORPUS[this.i % STREAM_CORPUS.length];
      const dur = 2 + Math.min(line.text.length / 18, 4);
      const start = this.clock;
      const end = this.clock + dur;

      // Chat reacts a beat behind hype; audio tracks it with noise.
      const jitter = (amt: number) => clamp01(amt + (hash(this.i) - 0.5) * 0.2);
      const tick: SourceTick = {
        clock: round(end),
        segment: {
          id: newId("seg"),
          start: round(start),
          end: round(end),
          text: line.text,
          speaker: "streamer",
        },
        raw: {
          audio: jitter(line.intensity),
          chat: jitter(line.intensity * 0.9),
        },
      };
      onTick(tick);

      this.clock = end + 0.4;
      this.i += 1;
    };

    emit(); // emit first line immediately
    this.timer = setInterval(emit, 2600);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Deterministic pseudo-noise in [0,1) — avoids Math.random for reproducibility. */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
