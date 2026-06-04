import type { SttProvider } from "./types";
import { MockStt } from "./mock";
import { AssemblyAiStt } from "./assemblyai";

/**
 * Select an STT provider. Prefers AssemblyAI when a key is present AND we have
 * a real audio source to feed it; otherwise falls back to the mock generator so
 * the pipeline always produces a transcript.
 */
export function selectStt(opts: { hasRealAudio: boolean }): SttProvider {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (key && opts.hasRealAudio) {
    return new AssemblyAiStt(key);
  }
  return new MockStt();
}

export type { SttProvider } from "./types";
