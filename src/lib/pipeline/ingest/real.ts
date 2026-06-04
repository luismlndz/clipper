import path from "node:path";
import type { IngestMode, Platform } from "@/lib/types";
import { detectPlatform } from "@/lib/util";
import { RollingBuffer } from "./buffer";
import { MockStt } from "../stt/mock";
import { LocalWhisperStt, hasLocalWhisper } from "../stt/whisper";
import type { SttProvider, SttHandle } from "../stt/types";
import type { IngestSource, SourceTick } from "./types";

const DATA_ROOT = path.join(process.cwd(), "data", "buffers");

/**
 * Real capture: streamlink+ffmpeg fill a rolling buffer of .ts segments while
 * an STT provider transcribes the real audio. STT preference:
 *   1. local faster-whisper  (keyless, if the venv sidecar exists)
 *   2. mock corpus           (last resort, so the pipeline still runs)
 * Whisper also reports per-window audio energy, giving a real audio signal;
 * chat-velocity stays null until a chat-WS source is wired.
 */
export class RealSource implements IngestSource {
  readonly mode: IngestMode = "real";
  readonly platform: Platform;
  readonly buffer: RollingBuffer;
  readonly engine: string;
  private stt: SttProvider;
  private sttHandle?: SttHandle;

  constructor(sessionId: string, private readonly url: string) {
    this.platform = detectPlatform(url);
    this.buffer = new RollingBuffer(sessionId, url, DATA_ROOT);
    this.stt = this.pickStt();
    this.engine = this.stt.name;
  }

  private pickStt(): SttProvider {
    if (hasLocalWhisper()) return new LocalWhisperStt(this.url);
    return new MockStt();
  }

  async start(onTick: (tick: SourceTick) => void): Promise<void> {
    await this.buffer.start();
    this.sttHandle = await this.stt.start({
      startedAtMs: Date.now(),
      onSegment: (segment, meta) => {
        onTick({
          segment,
          raw: { audio: meta?.audio ?? null, chat: null },
          clock: segment.end,
        });
      },
    });
  }

  async stop(): Promise<void> {
    await this.sttHandle?.stop().catch(() => void 0);
    await this.buffer.stop();
  }
}
