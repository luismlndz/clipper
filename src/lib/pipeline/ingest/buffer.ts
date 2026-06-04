import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { detectPlatform } from "@/lib/util";
import type { Platform } from "@/lib/types";

const SEGMENT_SECONDS = Number(process.env.SEGMENT_SECONDS) || 4;
const BUFFER_WINDOW_SECONDS = Number(process.env.BUFFER_WINDOW_SECONDS) || 180;

/**
 * Captures a live stream to a directory of short .ts segments using
 * `streamlink <url> | ffmpeg -f segment`, keeping only the most recent
 * BUFFER_WINDOW_SECONDS so we can cut clips retroactively. Segment N starts at
 * roughly N * SEGMENT_SECONDS of stream time.
 */
export class RollingBuffer {
  readonly dir: string;
  readonly segmentSeconds = SEGMENT_SECONDS;
  private streamlink?: ChildProcess;
  private ffmpeg?: ChildProcess;
  private pruner?: NodeJS.Timeout;
  private started = false;

  constructor(
    readonly sessionId: string,
    readonly url: string,
    rootDir: string
  ) {
    this.dir = path.join(rootDir, sessionId);
  }

  get platform(): Platform {
    return detectPlatform(this.url);
  }

  async start(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const pattern = path.join(this.dir, "seg_%05d.ts");

    // streamlink writes the muxed stream to stdout; ffmpeg segments it.
    this.streamlink = spawn(
      "streamlink",
      ["--stdout", "--default-stream", "best", this.url, "best"],
      { stdio: ["ignore", "pipe", "ignore"] }
    );

    this.ffmpeg = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-c",
        "copy",
        "-f",
        "segment",
        "-segment_time",
        String(SEGMENT_SECONDS),
        "-reset_timestamps",
        "1",
        pattern,
      ],
      { stdio: ["pipe", "ignore", "ignore"] }
    );

    this.streamlink.stdout!.pipe(this.ffmpeg.stdin!);
    this.streamlink.stdout!.on("error", () => void 0);
    this.ffmpeg.stdin!.on("error", () => void 0);

    this.started = true;
    this.pruner = setInterval(() => void this.prune(), SEGMENT_SECONDS * 1000);
  }

  /** List segment files sorted by index. */
  private async segments(): Promise<string[]> {
    try {
      const files = await readdir(this.dir);
      return files
        .filter((f) => f.startsWith("seg_") && f.endsWith(".ts"))
        .sort();
    } catch {
      return [];
    }
  }

  /** Delete segments older than the rolling window. */
  private async prune(): Promise<void> {
    const keep = Math.ceil(BUFFER_WINDOW_SECONDS / SEGMENT_SECONDS) + 4;
    const files = await this.segments();
    const excess = files.slice(0, Math.max(0, files.length - keep));
    await Promise.all(
      excess.map((f) => rm(path.join(this.dir, f)).catch(() => void 0))
    );
  }

  /** Segment files whose time range overlaps [startAt, endAt] (seconds). */
  async segmentsForRange(startAt: number, endAt: number): Promise<string[]> {
    const files = await this.segments();
    const out: string[] = [];
    for (const f of files) {
      const idx = Number(f.slice(4, 9));
      const segStart = idx * SEGMENT_SECONDS;
      const segEnd = segStart + SEGMENT_SECONDS;
      if (segEnd >= startAt && segStart <= endAt) out.push(path.join(this.dir, f));
    }
    return out;
  }

  async isLive(): Promise<boolean> {
    if (!this.started) return false;
    try {
      const files = await this.segments();
      if (!files.length) return false;
      const last = path.join(this.dir, files[files.length - 1]);
      const s = await stat(last);
      return s.size > 0;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    this.started = false;
    if (this.pruner) clearInterval(this.pruner);
    this.streamlink?.kill("SIGKILL");
    this.ffmpeg?.kill("SIGKILL");
    await rm(this.dir, { recursive: true, force: true }).catch(() => void 0);
  }
}
