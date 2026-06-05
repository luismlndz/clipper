import { RealSource } from "./real";
import { canIngestReal } from "./tools";
import type { IngestSource } from "./types";

/**
 * Always use real streamlink+ffmpeg capture. The corpus simulator fallback is
 * disabled: if the required CLI tools aren't installed we fail loudly rather
 * than silently producing fake data.
 */
export async function selectSource(
  sessionId: string,
  url: string
): Promise<IngestSource> {
  if (!(await canIngestReal())) {
    throw new Error(
      "Real capture requires streamlink and ffmpeg on PATH. Install them (e.g. `brew install streamlink ffmpeg`) and restart."
    );
  }
  return new RealSource(sessionId, url);
}

export type { IngestSource, SourceTick } from "./types";
