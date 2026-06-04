# Clipper — real-time livestream clipper (prototype)

Paste a live **Twitch / YouTube / Kick** URL and the app ingests the stream,
transcribes the dialogue, scores every moment for "interestingness," and
auto-cuts clips the instant something pops — all in real time.

This is the working prototype from the deep-research spec. It runs end-to-end
**with zero API keys** thanks to mock STT + heuristic scoring, and upgrades to
real capture and real models as you add tools/keys.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Paste any URL (or click an example chip) and hit **Start clipping**. Define what
counts as "interesting" by **checking the qualities** you want to catch —
*Hype / clutch play, Funny, Fight about to happen, Controversial, Story time,
Emotional* — or **add your own** (name + a short description the AI uses). Tune
sensitivity, pre/post-roll, and cooldown live; changes apply to the running
session. Each clip is tagged with the quality it matched.

## Two run modes (auto-detected)

| | Ingestion | STT | Dialogue scoring | Clips |
|---|---|---|---|---|
| **Simulated** (default, no setup) | corpus generator | corpus | heuristic | metadata only |
| **Real** (tools + keys) | `streamlink` → `ffmpeg` rolling buffer | AssemblyAI* | Anthropic* | real `.mp4` |

The app picks **real** ingestion automatically when `streamlink` **and**
`ffmpeg` are on `PATH`; otherwise it simulates so you always see the full
pipeline move.

\* STT uses AssemblyAI only when `ASSEMBLYAI_API_KEY` is set **and** a real audio
tap exists; dialogue scoring uses Anthropic only when `ANTHROPIC_API_KEY` is set.
Otherwise the mock providers run. Copy `.env.example` → `.env.local` to enable.

```bash
brew install ffmpeg streamlink   # enable real capture
cp .env.example .env.local       # then add keys to go fully live
```

## Architecture

```
URL ─▶ ingest (streamlink+ffmpeg | simulator)
         ├─▶ rolling buffer  (4s .ts segments, ~180s window)  ──┐
         └─▶ transcript ──▶ detector                            │
                              ├ quality classifier (LLM|heuristic)│  on fire:
                              │   → matched quality tag           │  cut T-pre→T+post
                              ├ audio-energy boost                │  from buffer
                              └ chat-velocity boost               │
                                     ▼ weighted fusion ──────────┘
                                  threshold + cooldown ─▶ clip ─▶ SSE ─▶ UI
```

Key files:

- `src/lib/pipeline/ingest/` — `buffer.ts` (rolling FFmpeg segmenter), `real.ts`, `simulated.ts`
- `src/lib/pipeline/stt/` — `mock.ts`, `assemblyai.ts` (Universal-Streaming scaffold)
- `src/lib/pipeline/detect/` — `detector.ts` (fusion), `mock-llm.ts`, `anthropic.ts`
- `src/lib/pipeline/clipper.ts` — retroactive cut from buffer
- `src/lib/pipeline/session.ts` — orchestrates ingest → score → clip, emits events
- `src/app/api/` — REST + SSE routes

## Known prototype limits (honest list)

- **TikTok Live** ingestion is intentionally omitted — no reliable programmatic
  A/V capture exists (the popular lib only yields chat events). See research.
- Real-mode **audio-energy and chat-velocity signals are stubbed to 0** — v1
  detection there runs on dialogue + keywords. Multimodal fusion is fully wired
  and demonstrated in simulated mode.
- Sessions live in process memory (no DB); fine for a single-user prototype.
- Clipping any arbitrary streamer is a **ToS/legal gray area** — the viable
  commercial path is creator-authorized capture. See the research report.
# clipper
