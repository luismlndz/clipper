#!/usr/bin/env python3
"""
Local streaming STT sidecar for the clipper.

Usage: whisper_stt.py <stream_url> [model]

Pulls audio from a live stream via `streamlink | ffmpeg` as 16 kHz mono PCM,
transcribes it in rolling windows with faster-whisper, and prints one JSON
object per finalized segment to stdout:

    {"start": 12.0, "end": 16.0, "text": "...", "rms": 0.31}

`start`/`end` are seconds since capture began; `rms` is normalized loudness
(0..1) for that window, used as the audio-energy signal. All errors go to
stderr as {"error": "..."} so the Node side can surface them.
"""
import sys
import json
import subprocess
import numpy as np

SAMPLE_RATE = 16000
WINDOW_SECONDS = 5.0
BYTES_PER_SAMPLE = 2  # s16le
WINDOW_BYTES = int(SAMPLE_RATE * WINDOW_SECONDS) * BYTES_PER_SAMPLE


def log_err(msg):
    print(json.dumps({"error": str(msg)}), file=sys.stderr, flush=True)


def main():
    if len(sys.argv) < 2:
        log_err("missing stream url")
        sys.exit(2)
    url = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base.en"

    try:
        from faster_whisper import WhisperModel
    except Exception as e:  # noqa: BLE001
        log_err(f"faster-whisper import failed: {e}")
        sys.exit(3)

    # CPU + int8 keeps it light on Apple Silicon (no CUDA).
    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception as e:  # noqa: BLE001
        log_err(f"model load failed: {e}")
        sys.exit(4)

    # streamlink → ffmpeg → raw PCM on stdout.
    streamlink = subprocess.Popen(
        ["streamlink", "--stdout", "--default-stream", "best", url, "best"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    ffmpeg = subprocess.Popen(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
            "-f", "s16le", "pipe:1",
        ],
        stdin=streamlink.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )

    print(json.dumps({"ready": True, "model": model_name}), flush=True)

    clock = 0.0  # seconds of audio consumed so far
    buf = bytearray()
    try:
        while True:
            chunk = ffmpeg.stdout.read(WINDOW_BYTES - len(buf))
            if not chunk:
                break
            buf.extend(chunk)
            if len(buf) < WINDOW_BYTES:
                continue

            samples = np.frombuffer(bytes(buf), dtype=np.int16).astype(np.float32) / 32768.0
            buf = bytearray()
            window_start = clock
            clock += WINDOW_SECONDS

            rms = float(np.sqrt(np.mean(np.square(samples)))) if samples.size else 0.0
            # Map RMS to a perceptual-ish 0..1. Gain kept modest so loud streams
            # don't saturate at 1.0 and the signal stays discriminative
            # (typical speech raw rms ~0.05-0.18 → ~0.15-0.5; shouting → ~0.7+).
            audio_level = max(0.0, min(1.0, rms * 3.0))

            segments, _ = model.transcribe(
                samples, language="en", beam_size=1, vad_filter=True,
                word_timestamps=True,
            )
            for seg in segments:
                text = seg.text.strip()
                if not text:
                    continue
                # Per-word timing powers karaoke-style burned-in captions.
                # Offset each word by window_start, same as the segment times.
                words = [
                    {
                        "w": w.word.strip(),
                        "s": round(window_start + w.start, 2),
                        "e": round(window_start + w.end, 2),
                    }
                    for w in (seg.words or [])
                    if w.word.strip()
                ]
                print(json.dumps({
                    "start": round(window_start + seg.start, 2),
                    "end": round(window_start + seg.end, 2),
                    "text": text,
                    "rms": round(audio_level, 3),
                    "words": words,
                }), flush=True)
    except BrokenPipeError:
        pass
    except Exception as e:  # noqa: BLE001
        log_err(e)
    finally:
        for p in (ffmpeg, streamlink):
            try:
                p.kill()
            except Exception:  # noqa: BLE001
                pass


if __name__ == "__main__":
    main()
