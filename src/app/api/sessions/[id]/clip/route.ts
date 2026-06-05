import { NextResponse } from "next/server";
import { manager } from "@/lib/pipeline/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual clipping: POST { action: "start" } marks the clip's beginning at the
 * current stream position; POST { action: "stop" } ends it and renders the
 * window. Lets the user clip moments the detector didn't catch.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = manager.get(params.id);
  if (!session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: "start" | "stop";
  };
  if (body.action === "start") {
    session.startManualClip();
  } else if (body.action === "stop") {
    session.stopManualClip();
  } else {
    return NextResponse.json(
      { error: "action must be 'start' or 'stop'" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
