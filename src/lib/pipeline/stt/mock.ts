import type { SttProvider, SttStartOptions, SttHandle } from "./types";
import { STREAM_CORPUS } from "../corpus";
import { newId } from "@/lib/util";

/**
 * Mock streaming STT. Emits synthetic dialogue from the corpus on a timer,
 * ignoring any real audio. Used when no STT API key is configured so the
 * pipeline still produces a live transcript end-to-end.
 */
export class MockStt implements SttProvider {
  readonly name = "mock-stt";

  async start(opts: SttStartOptions): Promise<SttHandle> {
    let i = 0;
    let clock = 0; // seconds since start
    const startMs = opts.startedAtMs;

    const tick = () => {
      const line = STREAM_CORPUS[i % STREAM_CORPUS.length];
      const dur = 2 + Math.min(line.text.length / 18, 4);
      const start = clock;
      const end = clock + dur;
      opts.onSegment({
        id: newId("seg"),
        start: round(start),
        end: round(end),
        text: line.text,
        speaker: "streamer",
      });
      clock = end + 0.4;
      i += 1;
    };

    // Emit the first line promptly, then pace the rest.
    tick();
    const timer = setInterval(tick, 2600);

    return {
      stop: async () => {
        clearInterval(timer);
        void startMs;
      },
    };
  }
}

const round = (n: number) => Math.round(n * 10) / 10;
