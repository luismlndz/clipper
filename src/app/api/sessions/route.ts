import { NextResponse } from "next/server";
import { manager } from "@/lib/pipeline/manager";
import {
  DEFAULT_OUTPUT,
  DEFAULT_PARAMS,
  type DetectionParams,
  type OutputConfig,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sessions: manager.list() });
}

export async function POST(req: Request) {
  let body: {
    url?: string;
    params?: Partial<DetectionParams>;
    output?: Partial<OutputConfig>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const params: DetectionParams = {
    ...DEFAULT_PARAMS,
    ...body.params,
    qualities: body.params?.qualities ?? DEFAULT_PARAMS.qualities,
  };

  const output: OutputConfig = { ...DEFAULT_OUTPUT, ...body.output };

  const session = await manager.create(url, params, output);
  return NextResponse.json({ id: session.id, state: session.snapshot() });
}
