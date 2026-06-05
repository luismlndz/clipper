import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { existsSync } from "node:fs";
import type { SttProvider, SttStartOptions, SttHandle } from "./types";
import { newId } from "@/lib/util";

const VENV_PYTHON = path.join(process.cwd(), ".venv", "bin", "python");
const SCRIPT = path.join(process.cwd(), "scripts", "whisper_stt.py");
const MODEL = process.env.WHISPER_MODEL || "base.en";

/** True when the local Whisper sidecar (venv + script) is available. */
export function hasLocalWhisper(): boolean {
  return existsSync(VENV_PYTHON) && existsSync(SCRIPT);
}

/**
 * Local streaming STT via a faster-whisper Python sidecar. Spawns
 * `whisper_stt.py <url>`, which pulls audio with streamlink+ffmpeg and prints
 * one JSON segment per line. Keyless — runs entirely on this machine.
 */
export class LocalWhisperStt implements SttProvider {
  readonly name = "local-whisper";
  private proc?: ChildProcess;

  constructor(private readonly url: string) {}

  async start(opts: SttStartOptions): Promise<SttHandle> {
    const proc = spawn(VENV_PYTHON, [SCRIPT, this.url, MODEL], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.proc = proc;

    const rl = createInterface({ input: proc.stdout! });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.text) {
          const words = Array.isArray(msg.words)
            ? msg.words
                .map((w: { w?: unknown; s?: unknown; e?: unknown }) => ({
                  text: String(w.w ?? ""),
                  start: Number(w.s) || 0,
                  end: Number(w.e) || 0,
                }))
                .filter((w: { text: string }) => w.text.length > 0)
            : undefined;
          opts.onSegment(
            {
              id: newId("seg"),
              start: Number(msg.start) || 0,
              end: Number(msg.end) || 0,
              text: String(msg.text),
              speaker: "streamer",
              words,
            },
            { audio: typeof msg.rms === "number" ? msg.rms : undefined }
          );
        }
      } catch {
        /* ignore non-JSON */
      }
    });

    // Surface sidecar errors (missing deps, stream open failure) to the log.
    const rlErr = createInterface({ input: proc.stderr! });
    rlErr.on("line", (line) => {
      if (line.includes("error")) console.warn("[whisper]", line);
    });

    return {
      stop: async () => {
        rl.close();
        rlErr.close();
        proc.kill("SIGKILL");
      },
    };
  }
}
