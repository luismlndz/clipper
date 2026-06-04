import { SimulatedSource } from "./simulated";
import { RealSource } from "./real";
import { canIngestReal } from "./tools";
import type { IngestSource } from "./types";

/**
 * Pick an ingest source. Uses real streamlink+ffmpeg capture when both tools
 * are installed; otherwise falls back to the corpus simulator so the prototype
 * always runs.
 */
export async function selectSource(
  sessionId: string,
  url: string
): Promise<IngestSource> {
  if (await canIngestReal()) {
    return new RealSource(sessionId, url);
  }
  return new SimulatedSource(url);
}

export type { IngestSource, SourceTick } from "./types";
