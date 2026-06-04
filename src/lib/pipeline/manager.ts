import type { DetectionParams, SessionState } from "@/lib/types";
import { Session } from "./session";

/**
 * Process-wide registry of live sessions. Stored on globalThis so it survives
 * Next.js dev hot-reloads (which re-evaluate modules but keep the process).
 */
class SessionManager {
  private sessions = new Map<string, Session>();

  async create(url: string, params: DetectionParams): Promise<Session> {
    const session = new Session(url, params);
    this.sessions.set(session.id, session);
    void session.start();
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list(): SessionState[] {
    return [...this.sessions.values()].map((s) => s.snapshot());
  }

  async stop(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;
    await session.stop();
    this.sessions.delete(id);
    return true;
  }
}

const g = globalThis as unknown as { __clipperManager?: SessionManager };
export const manager: SessionManager = g.__clipperManager ?? new SessionManager();
g.__clipperManager = manager;
