"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClipResult,
  DetectionParams,
  OutputConfig,
  PipelineEvent,
  QualityMatch,
  SessionState,
  SignalScores,
  TranscriptSegment,
} from "./types";

export interface LiveScore {
  at: number;
  fused: number;
  signals: SignalScores;
  quality?: QualityMatch;
}

export interface LogLine {
  level: "info" | "warn" | "error";
  message: string;
  at: number;
}

const MAX_TRANSCRIPT = 60;
const MAX_LOGS = 30;

export function useClipper() {
  const [state, setState] = useState<SessionState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [clips, setClips] = useState<ClipResult[]>([]);
  const [live, setLive] = useState<LiveScore | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [starting, setStarting] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const teardown = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const connect = useCallback((id: string) => {
    teardown();
    const es = new EventSource(`/api/sessions/${id}/events`);
    esRef.current = es;
    es.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as PipelineEvent;
      switch (event.type) {
        case "status":
          setState(event.state);
          break;
        case "transcript":
          setTranscript((t) => [...t, event.segment].slice(-MAX_TRANSCRIPT));
          break;
        case "score":
          setLive({
            at: event.at,
            fused: event.fused,
            signals: event.signals,
            quality: event.quality,
          });
          break;
        case "clip":
          setClips((c) => [event.clip, ...c]);
          break;
        case "log":
          setLogs((l) =>
            [{ level: event.level, message: event.message, at: Date.now() }, ...l].slice(
              0,
              MAX_LOGS
            )
          );
          break;
        case "stopped":
          teardown();
          break;
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnects; nothing to do */
    };
  }, [teardown]);

  const start = useCallback(
    async (url: string, params: DetectionParams, output: OutputConfig) => {
      setStarting(true);
      setTranscript([]);
      setClips([]);
      setLive(null);
      setLogs([]);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, params, output }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "failed to start");
        setState(data.state);
        connect(data.id);
      } catch (err) {
        setLogs((l) => [
          { level: "error", message: (err as Error).message, at: Date.now() },
          ...l,
        ]);
      } finally {
        setStarting(false);
      }
    },
    [connect]
  );

  const stop = useCallback(async () => {
    if (!state) return;
    await fetch(`/api/sessions/${state.id}`, { method: "DELETE" }).catch(
      () => void 0
    );
    teardown();
    setState((s) => (s ? { ...s, status: "stopped" } : s));
  }, [state, teardown]);

  const updateParams = useCallback(
    async (params: DetectionParams) => {
      if (!state || state.status !== "live") return;
      await fetch(`/api/sessions/${state.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params }),
      }).catch(() => void 0);
    },
    [state]
  );

  const updateOutput = useCallback(
    async (output: OutputConfig) => {
      if (!state || state.status !== "live") return;
      await fetch(`/api/sessions/${state.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ output }),
      }).catch(() => void 0);
    },
    [state]
  );

  useEffect(() => () => teardown(), [teardown]);

  const isLive = state?.status === "live" || state?.status === "starting";

  return {
    state,
    transcript,
    clips,
    live,
    logs,
    starting,
    isLive,
    start,
    stop,
    updateParams,
    updateOutput,
  };
}
