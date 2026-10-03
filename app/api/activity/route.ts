import { appendEvent } from "@/lib/activity";
import { APP, MAX_EVENT_BYTES, SESSION_RE, clean, safeHref } from "@/components/activity/shared";
import { DEMO } from "@/lib/mode";

// Where the browser records its own activity on this machine (components/activity/
// recorder.tsx). Same origin only: a request must come from a page served by this app,
// to a localhost Host, with its Origin on that same host. The demo never stores a
// visitor's activity, so there it refuses everything and the browser keeps its history
// in localStorage instead.

export const dynamic = "force-dynamic";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.localhost)(:\d+)?$/i;
const KINDS = new Set(["visit", "search", "back", "forward"]);
const VIA = new Set(["buttons", "browser"]);

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host") ?? "";
  const origin = req.headers.get("origin");
  if (!LOCAL_HOST.test(host) || !origin) return false;
  try {
    const u = new URL(origin);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.host.toLowerCase() !== host.toLowerCase()) return false;
  } catch {
    return false;
  }
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}

export async function POST(req: Request) {
  if (DEMO) return refuse(404, "The demo keeps history in your browser, never on the server.");
  if (!sameOrigin(req)) return refuse(403, "History is written only by Innernet's own pages.");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return refuse(415, "Send JSON.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_EVENT_BYTES) return refuse(413, "Too large.");

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_EVENT_BYTES) return refuse(413, "Too large.");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse(400, "Bad JSON.");
  }

  const session = typeof body.session === "string" ? body.session : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!SESSION_RE.test(session)) return refuse(400, "Bad session id.");
  if (!KINDS.has(kind)) return refuse(400, "Bad kind.");
  const url = typeof body.url === "string" && body.url.startsWith("/") ? safeHref(body.url) : null;
  if (!url) return refuse(400, "Bad url.");

  // Only the fields Innernet records, each short and printable. The time is the server's.
  const fields: Record<string, unknown> = { kind };
  if (kind === "search") fields.q = clean(body.q, 300);
  fields.url = url;
  if (kind !== "search") fields.title = clean(body.title, 200);
  if (typeof body.via === "string" && VIA.has(body.via)) fields.via = body.via;

  const result = appendEvent(session, APP, fields);
  return result.ok ? new Response(null, { status: 204 }) : refuse(result.status, result.error);
}
