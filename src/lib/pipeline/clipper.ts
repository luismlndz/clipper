import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { ASPECT_RATIOS, type OutputConfig } from "@/lib/types";
import type { RollingBuffer } from "./ingest/buffer";

const CLIPS_ROOT = path.join(process.cwd(), "data", "clips");

export interface CutRequest {
  clipId: string;
  startAt: number;
  endAt: number;
  /** Desired output format (aspect ratio / captions). */
  output: OutputConfig;
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

  const input = [
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
  ];

  // "source" → stream-copy verbatim (instant, lossless, original aspect).
  // Any other ratio → center-crop, which requires a re-encode. We use x264
  // CRF 18 on the High profile with yuv420p: visually lossless, but unlike
  // -qp 0 (which forces the High 4:4:4 Predictive profile that browsers and
  // QuickTime can't decode) this plays everywhere. Frame rate and audio are
  // left untouched (no -r, audio stream-copied).
  const cropFilter = cropFor(req.output.aspectRatio);
  const encode = cropFilter
    ? [
        "-vf",
        cropFilter,
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "medium",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
      ]
    : ["-c", "copy"];

  const ok = await runFfmpeg([...input, ...encode, "-y", outPath]);

  await rm(listPath, { force: true }).catch(() => void 0);
  return { filePath: ok ? outPath : null };
}

/**
 * Build a center-crop filter for the target aspect ratio, or null for "source"
 * (no crop). Expressed in terms of the input's own iw/ih so the source
 * resolution never has to be probed; dimensions are floored to even values
 * because libx264 requires width/height divisible by 2. The commas inside
 * min() are backslash-escaped so ffmpeg's filtergraph parser doesn't read them
 * as filter-chain separators.
 */
function cropFor(aspectRatio: OutputConfig["aspectRatio"]): string | null {
  if (aspectRatio === "source") return null;
  const opt = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
  if (!opt) return null;
  const a = opt.w / opt.h;
  const cw = `floor(min(iw\\,ih*${a})/2)*2`;
  const ch = `floor(min(ih\\,iw/${a})/2)*2`;
  return `crop=${cw}:${ch}`;
}

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

export const clipsRoot = CLIPS_ROOT;
