import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { clipsRoot } from "@/lib/pipeline/clipper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve a rendered clip mp4 by id. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // Prevent path traversal: only allow our clip-id shape.
  if (!/^clip_[a-z0-9]+$/i.test(params.id)) {
    return new Response("bad id", { status: 400 });
  }
  const file = path.join(clipsRoot, `${params.id}.mp4`);
  try {
    const s = await stat(file);
    const nodeStream = createReadStream(file);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return new Response(webStream, {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(s.size),
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("clip not found", { status: 404 });
  }
}
