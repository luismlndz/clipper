import { NextResponse } from "next/server";
import { manager } from "@/lib/pipeline/manager";
import { DEFAULT_PARAMS, type DetectionParams } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = manager.get(params.id);
  if (!session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ state: session.snapshot() });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = manager.get(params.id);
  if (!session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    params?: Partial<DetectionParams>;
  };
  const current = session.snapshot().params;
  const next: DetectionParams = {
    ...DEFAULT_PARAMS,
    ...current,
    ...body.params,
    qualities: body.params?.qualities ?? current.qualities,
  };
  session.updateParams(next);
  return NextResponse.json({ state: session.snapshot() });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ok = await manager.stop(params.id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ stopped: params.id });
}
