import { ActivityFilesError, listActivityFiles, readActivityFile } from "@/lib/activity-files";
import { DEMO } from "@/lib/mode";
import { readCapped, sameOrigin } from "@/lib/same-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };
const refuse = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers });

/** Paths stay in a POST body so browsing a session never puts its name in URLs. */
export async function POST(req: Request) {
  if (DEMO) return refuse(404, "History files are available only on this machine.");
  if (!sameOrigin(req)) return refuse(403, "History files can be read only by Innernet's own pages.");
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return refuse(415, "Send JSON.");
  const text = await readCapped(req, 8192);
  if (text === null) return refuse(413, "The request is too large.");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return refuse(400, "Send a file or folder request.");
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse(400, "Bad JSON.");
  }
  if ((body.action !== "list" && body.action !== "read") || typeof body.path !== "string" || (body.cursor !== undefined && (typeof body.cursor !== "number" || !Number.isSafeInteger(body.cursor) || body.cursor < 0)) || (body.snapshot !== undefined && (typeof body.snapshot !== "string" || !/^[a-f0-9]{64}$/.test(body.snapshot)))) {
    return refuse(400, "Choose a file or folder and a valid page position.");
  }
  try {
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;
    const data = body.action === "list" ? listActivityFiles(body.path, cursor, typeof body.snapshot === "string" ? body.snapshot : undefined) : readActivityFile(body.path, cursor);
    return Response.json({ ok: true, data }, { headers });
  } catch (error) {
    return error instanceof ActivityFilesError ? refuse(error.status, error.message) : refuse(500, "The history could not be read. Try refreshing the folder.");
  }
}
