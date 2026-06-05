# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Clipper is a Next.js 14 (App Router) prototype that ingests a live Twitch/YouTube/Kick
stream, transcribes it, scores every moment for "interestingness," and auto-cuts clips in
real time. Its defining design constraint: **it runs end-to-end with zero API keys** via
mock/heuristic providers, and transparently upgrades each pipeline stage to real
capture/models when the corresponding tool or key is present.

## Commands

```bash
npm install
npm run dev        # next dev — http://localhost:3000
npm run build      # next build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit  (run this to verify changes; there is no test suite)
```

There is **no test framework** wired up. `npm run typecheck` is the primary correctness gate.

Optional real-mode dependencies (auto-detected, never required):
```bash
brew install ffmpeg streamlink   # enables real stream capture
cp .env.example .env.local        # then add ANTHROPIC_API_KEY / ASSEMBLYAI_API_KEY
```

## Architecture

The whole app is a thin UI over a server-side pipeline. Data flows one direction and is
pushed to the browser over SSE:

```
ingest → transcribe (STT) → score (detector) → fire clip → SSE event → UI
```

### Capability-tiered providers (the core pattern)

Every pipeline stage has a `select*()` factory in an `index.ts` that picks a real provider
when its dependency exists, else a mock — so the pipeline always produces output. When
editing a stage, preserve this fallback contract; never make the mock path unreachable.

- **Ingest** — `ingest/index.ts#selectSource`: `RealSource` (streamlink+ffmpeg) when
  `canIngestReal()` finds both CLIs on PATH, else `SimulatedSource` (corpus generator).
- **STT** — `RealSource.pickStt()` prefers local faster-whisper (`stt/whisper.ts`, gated on
  a `.venv` + `scripts/whisper_stt.py` sidecar) and falls back to `MockStt`. Note:
  `stt/index.ts#selectStt` (AssemblyAI vs mock) exists but is **not** what `RealSource` calls
  today — real capture uses the whisper sidecar, not AssemblyAI.
- **Dialogue scoring** — `detect/index.ts#selectDialogueScorer`: `AnthropicDialogueScorer`
  when `ANTHROPIC_API_KEY` is set, else `MockDialogueScorer` (keyword/stem heuristic over
  `Quality.hints`).

### Session lifecycle

- `pipeline/manager.ts` — process-wide `SessionManager` registry, stashed on `globalThis` so
  it survives Next.js dev hot-reloads. Sessions are **in-memory only; no DB.**
- `pipeline/session.ts` — orchestrates one session: consumes ingest ticks, maintains the
  rolling transcript window, throttles scoring (`SCORE_INTERVAL_SECONDS`), and emits
  `PipelineEvent`s. This is the heart of the system.
- `pipeline/detect/detector.ts` — fuses dialogue + audio + chat signals with fixed `WEIGHTS`
  (unavailable signals are **excluded from the average, not zeroed**), then applies the
  `threshold` + `cooldownSeconds` gate in `shouldFire`.
- `pipeline/clipper.ts` + `ingest/buffer.ts` — `RollingBuffer` keeps ~180s of 4s `.ts`
  segments on disk (under `data/buffers/`); on a fire, real mode waits `postSeconds` for the
  post-roll to land, then `cutClip` retroactively assembles the segment range into an `.mp4`.

### Transport

- `app/api/sessions/route.ts` (POST create / GET list), `app/api/sessions/[id]/route.ts`
  (DELETE stop / PATCH live param update), `app/api/sessions/[id]/events/route.ts`
  (the SSE stream — `runtime = "nodejs"`, with a 15s heartbeat).
- `lib/useClipper.ts` — the single client hook: POSTs to start, opens an `EventSource`, and
  reduces `PipelineEvent`s into React state (`transcript`, `clips`, `live`, `logs`).
- `app/api/clips/[id]/route.ts` serves rendered `.mp4` files; clip `mediaUrl` is only set in
  real mode (simulated clips are metadata-only).

### Domain types

`lib/types.ts` is the contract for the whole app — `PipelineEvent` (the SSE union),
`DetectionParams`, `Quality`, `SignalScores`, and the built-in `DEFAULT_QUALITIES` /
`DEFAULT_PARAMS`. Changing the event union ripples through `session.ts` (emit) and
`useClipper.ts` (reduce); keep both sides in sync.

## Conventions & gotchas

- Path alias: `@/*` → `src/*` (see `tsconfig.json`).
- "Interesting" is user-defined: the UI lets users toggle/add `Quality` objects (label +
  description + hints). The description is fed to the LLM scorer; the hints drive the mock
  heuristic. Both must stay meaningful when adding a quality.
- Tunables are env vars with sane defaults: `BUFFER_WINDOW_SECONDS`, `SEGMENT_SECONDS`,
  `SCORE_INTERVAL_SECONDS`, `ANTHROPIC_MODEL`, `WHISPER_MODEL`.
- Known prototype limits (intentional, per README): TikTok Live ingestion is omitted;
  real-mode audio-energy comes only from whisper RMS and chat-velocity is stubbed `null`;
  sessions are not persisted.
