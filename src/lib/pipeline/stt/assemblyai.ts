import type { SttProvider, SttStartOptions, SttHandle } from "./types";
import { newId } from "@/lib/util";

/**
 * AssemblyAI Universal-Streaming provider (cheapest hosted streaming STT,
 * ~$0.15/hr per the research). This is a working scaffold: it opens the
 * streaming WebSocket and forwards 16 kHz PCM audio chunks. Wire a real audio
 * source (16 kHz mono s16le PCM from ffmpeg) into `opts.audio` to use it.
 *
 * Docs: https://www.assemblyai.com/docs/speech-to-text/universal-streaming
 */
export class AssemblyAiStt implements SttProvider {
  readonly name = "assemblyai-streaming";

  constructor(private readonly apiKey: string) {}

  async start(opts: SttStartOptions): Promise<SttHandle> {
    if (!opts.audio) {
      throw new Error(
        "AssemblyAiStt requires a 16kHz PCM audio source (opts.audio). " +
          "In real ingest mode, pipe ffmpeg s16le output here."
      );
    }

    const url =
      "wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true";
    const ws = new WebSocket(url, {
      // @ts-expect-error Node's undici WebSocket accepts headers in options
      headers: { Authorization: this.apiKey },
    });

    const ready = new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(String(ev.data));
        // Universal-Streaming "Turn" messages carry finalized transcripts.
        if (msg.type === "Turn" && msg.end_of_turn && msg.transcript) {
          opts.onSegment({
            id: newId("seg"),
            start: round((msg.audio_start ?? 0) / 1000),
            end: round((msg.audio_end ?? 0) / 1000),
            text: msg.transcript,
            speaker: "streamer",
          });
        }
      } catch {
        /* ignore non-JSON frames */
      }
    });

    await ready;

    // Pump audio → WS.
    let stopped = false;
    (async () => {
      for await (const chunk of opts.audio!) {
        if (stopped) break;
        if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
      }
    })().catch(() => void 0);

    return {
      stop: async () => {
        stopped = true;
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "Terminate" }));
          }
          ws.close();
        } catch {
          /* noop */
        }
      },
    };
  }
}

const round = (n: number) => Math.round(n * 10) / 10;
