import { spawn } from "node:child_process";

const cache = new Map<string, boolean>();

// ffmpeg/ffprobe use single-dash `-version`; most others accept `--version`.
const VERSION_FLAG: Record<string, string> = {
  ffmpeg: "-version",
  ffprobe: "-version",
};

/** Check whether a CLI tool is on PATH (cached). */
export function hasTool(bin: string): Promise<boolean> {
  if (cache.has(bin)) return Promise.resolve(cache.get(bin)!);
  return new Promise((resolve) => {
    const p = spawn(bin, [VERSION_FLAG[bin] ?? "--version"], { stdio: "ignore" });
    p.on("error", () => {
      cache.set(bin, false);
      resolve(false);
    });
    p.on("exit", (code) => {
      const ok = code === 0 || code === null;
      cache.set(bin, ok);
      resolve(ok);
    });
  });
}

/** True when we can actually capture a real stream (need both tools). */
export async function canIngestReal(): Promise<boolean> {
  const [sl, ff] = await Promise.all([hasTool("streamlink"), hasTool("ffmpeg")]);
  return sl && ff;
}
