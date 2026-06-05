import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { ASPECT_RATIOS, type CaptionWord, type OutputConfig } from "@/lib/types";
import type { RollingBuffer } from "./ingest/buffer";

const CLIPS_ROOT = path.join(process.cwd(), "data", "clips");
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";
const FFPROBE_BIN = process.env.FFPROBE_BIN || "ffprobe";

export interface CutRequest {
  clipId: string;
  startAt: number;
  endAt: number;
  /** Desired output format (aspect ratio / captions). */
  output: OutputConfig;
  /** Per-word timings (clip-relative seconds) for burned-in captions. */
  captionWords?: CaptionWord[];
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

  // Build the video filter chain. "source" with no captions keeps the fast,
  // lossless `-c copy` path. A crop and/or burned-in captions each force a
  // re-encode (stream-copy can do neither). We re-encode with x264 CRF 18 on
  // the High profile / yuv420p: visually lossless and playable everywhere
  // (unlike -qp 0, whose High 4:4:4 profile browsers/QuickTime can't decode).
  // Frame rate and audio are left untouched (no -r, audio stream-copied).
  const cropFilter = cropFor(req.output.aspectRatio);
  const wantCaptions = !!(
    req.output.captions &&
    req.captionWords &&
    req.captionWords.length
  );

  const filters: string[] = [];
  if (cropFilter) filters.push(cropFilter);

  let assPath: string | null = null;
  if (wantCaptions) {
    const dims = await outputDims(segs[0], req.output.aspectRatio);
    assPath = path.join(CLIPS_ROOT, `${req.clipId}.ass`);
    await writeFile(assPath, buildAssCaptions(req.captionWords!, dims));
    // The ass filter chains after the crop so subtitle layout matches the
    // final (cropped) frame.
    filters.push(`ass=${escapeFilterPath(assPath)}`);
  }

  const encode = filters.length
    ? [
        "-vf",
        filters.join(","),
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
  if (assPath) await rm(assPath, { force: true }).catch(() => void 0);
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
    const p = spawn(FFMPEG_BIN, args, { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

interface Dims {
  w: number;
  h: number;
}

/**
 * The final rendered dimensions: probe the source segment, then apply the same
 * even-floored center-crop math as `cropFor`. Used to size/position the ASS
 * captions correctly (especially on a cropped 9:16 frame). Falls back to a
 * 1080-height frame in the target ratio if the probe fails.
 */
async function outputDims(
  segPath: string,
  aspectRatio: OutputConfig["aspectRatio"]
): Promise<Dims> {
  const src = await probeDims(segPath);
  const opt = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
  if (aspectRatio === "source" || !opt) {
    return src ?? { w: 1920, h: 1080 };
  }
  const a = opt.w / opt.h;
  if (!src) {
    const h = 1080;
    return { w: even(h * a), h };
  }
  return {
    w: even(Math.min(src.w, src.h * a)),
    h: even(Math.min(src.h, src.w / a)),
  };
}

function even(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

function probeDims(file: string): Promise<Dims | null> {
  return new Promise((resolve) => {
    const p = spawn(
      FFPROBE_BIN,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        file,
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    let out = "";
    p.stdout!.on("data", (d) => (out += d));
    p.on("error", () => resolve(null));
    p.on("exit", () => {
      const [w, h] = out.trim().split(",").map(Number);
      resolve(w && h ? { w, h } : null);
    });
  });
}

const GROUP_SIZE = 3; // max words shown on screen at once (TikTok style)

/**
 * Build an ASS subtitle file rendering TikTok-style captions: up to GROUP_SIZE
 * big bold words centered on screen, the currently-spoken word green, advancing
 * word-group by group and breaking on sentence punctuation. Word times are
 * clip-relative seconds; alignment is frame-accurate because the cut resets the
 * output PTS to 0 at the clip start.
 */
function buildAssCaptions(words: CaptionWord[], dims: Dims): string {
  const fontSize = Math.round(dims.h * 0.09);
  const outline = Math.max(2, Math.round(dims.h * 0.006));
  const shadow = Math.max(0, Math.round(dims.h * 0.003));

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${dims.w}`,
    `PlayResY: ${dims.h}`,
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // White text, black outline, centered (Alignment 5). Bold on.
    `Style: Pop,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${outline},${shadow},5,40,40,40,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");

  const events: string[] = [];
  const groups = groupWords(words);
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      const start = group[i].start;
      const end = i + 1 < group.length ? group[i + 1].start : group[i].end;
      if (end <= start) continue;
      const text = group
        .map((w, j) => {
          const t = escapeAssText(w.text);
          return j === i ? `{\\c&H00FF00&}${t}{\\c&HFFFFFF&}` : t;
        })
        .join(" ");
      events.push(
        `Dialogue: 0,${assTime(start)},${assTime(end)},Pop,,0,0,0,,${text}`
      );
    }
  }
  return `${header}\n${events.join("\n")}\n`;
}

/** Split words into on-screen groups of ≤GROUP_SIZE, breaking on sentence ends. */
function groupWords(words: CaptionWord[]): CaptionWord[][] {
  const groups: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  for (const w of words) {
    cur.push(w);
    const endsSentence = /[.!?]$/.test(w.text);
    if (cur.length >= GROUP_SIZE || endsSentence) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Seconds → ASS timestamp H:MM:SS.cc (centiseconds). */
function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  const cc = Math.min(99, cs);
  return `${h}:${String(m).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cc).padStart(2, "0")}`;
}

/** Escape characters that have meaning in ASS dialogue text. */
function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

/** Escape a file path for use inside an ffmpeg filter argument. */
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export const clipsRoot = CLIPS_ROOT;
