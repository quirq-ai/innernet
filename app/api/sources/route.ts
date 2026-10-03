import { APP } from "@/components/activity/shared";
import { appendEvent } from "@/lib/activity";
import { ingestSession } from "@/lib/db/ingest";
import { sourceInfo } from "@/lib/source-storage";
import { readSourceRequest, sourceError, sourceHeaders } from "@/lib/source-request";
import { readRemoteConfig, validSourceSelection, writeSourceSelection } from "@/lib/sources";
import { normalizeRemoteConfig, remoteActivityFields } from "@/lib/remote-config";
import { sourceSyncRunning } from "@/lib/sync-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readSourceRequest(req);
  if (body instanceof Response) return body;
  if (body.action !== "inspect" && body.action !== "save") return sourceError(400, "Unknown source action.");
  if (body.action === "save" && !validSourceSelection(body.selection)) return sourceError(400, "Choose Local, Remote, or both.");
  if (body.action === "save" && sourceSyncRunning()) return sourceError(409, "Wait for the current sync to finish before changing sources.");
  try {
    if (body.action === "save") {
      let remote;
      try { remote = body.remote === undefined ? readRemoteConfig() : normalizeRemoteConfig(body.remote); }
      catch (error) { return sourceError(400, error instanceof Error ? error.message : "Check the GitHub account and repository list."); }
      const selection = body.selection as { local: boolean; remote: boolean };
      writeSourceSelection(selection, remote);
      const logged = appendEvent(body.session, APP, { kind: "sources", title: "Sources updated", local: selection.local, remote: selection.remote, ...remoteActivityFields(remote) });
      if (!logged.ok) return sourceError(500, "Sources were saved, but the change could not be recorded in activity.");
      await ingestSession(body.session);
    }
    return Response.json(sourceInfo(body.session), { headers: sourceHeaders });
  } catch {
    return sourceError(500, "Sources could not be read or saved. Check the source configuration and file permissions.");
  }
}
