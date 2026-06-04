import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { RollingBuffer } from "./ingest/buffer";

const CLIPS_ROOT = path.join(process.cwd(), "data", "clips");

export interface CutRequest {
  clipId: string;
  startAt: number;
  endAt: number;
}

export interface CutResult {
  /** Absolute file path of the rendered mp4, or null if no media was produced. */
  filePath: string | null;
}

/**
 * Render a clip by concatenating the buffer segments overlapping the window,
 * then trimming to [startAt, endAt]. Returns null filePath when there's no
 * buffer (simulated mode) — the clip still exists as metadata.
 */
export async function cutClip(
  buffer: RollingBuffer | null,
  req: CutRequest
): Promise<CutResult> {
  if (!buffer) return { filePath: null };

  const segs = await buffer.segmentsForRange(req.startAt, req.endAt);
  if (segs.length === 0) return { filePath: null };

  await mkdir(CLIPS_ROOT, { recursive: true });
  const listPath = path.join(CLIPS_ROOT, `${req.clipId}.txt`);
  const outPath = path.join(CLIPS_ROOT, `${req.clipId}.mp4`);
  await writeFile(listPath, segs.map((s) => `file '${s}'`).join("\n"));

  // Offset within the concatenated segments where our window begins.
  const firstIdx = Number(path.basename(segs[0]).slice(4, 9));
  const concatStart = firstIdx * buffer.segmentSeconds;
  const ss = Math.max(0, req.startAt - concatStart);
  const dur = Math.max(1, req.endAt - req.startAt);

  const ok = await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-ss",
    ss.toFixed(2),
    "-t",
    dur.toFixed(2),
    "-c",
    "copy",
    "-y",
    outPath,
  ]);

  await rm(listPath, { force: true }).catch(() => void 0);
  return { filePath: ok ? outPath : null };
}

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

export const clipsRoot = CLIPS_ROOT;
