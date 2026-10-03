import { APP } from "@/components/activity/shared";
import { appendEvent } from "@/lib/activity";
import { getLocalIndex } from "@/lib/data";
import { dbState, getDb, reopenDb } from "@/lib/db";
import { ingestSession, rememberStore, storeLocal, type LastStore } from "@/lib/db/ingest";
import { errorText } from "@/lib/db/log";
import { openRemote } from "@/lib/db/neon";
import { dbStatus } from "@/lib/db/status";
import { readSourceRequest, sourceError, sourceHeaders } from "@/lib/source-request";
import { remoteDatabase, remoteLabel, storageTarget, writeStorageTarget, type StorageTarget } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where the copy of everything Innernet generates is kept: this machine's database or
// the remote one. Local only, from this app's own pages (lib/source-request.ts).
//
//   status   what the database in use holds
//   test     reach the remote database, without switching to it
//   switch   change the storage, then copy the index and every history folder into it.
//            Remote asks for `confirm: true`: it sends this machine's index (folder
//            paths, README text, agent instructions) and history to that database.

/** One query against the remote database, timed. Throws a sentence. */
async function reach(): Promise<number> {
  const remote = remoteDatabase();
  if (!remote) throw new Error("No remote database is set up.");
  const started = Date.now();
  const db = await openRemote(remote, remoteLabel(remote));
  try {
    await db.query("SELECT 1 AS ok");
  } catch (err) {
    throw new Error(`${remoteLabel(remote)} did not answer (${errorText(err)}).`);
  } finally {
    await db.close();
  }
  return Date.now() - started;
}

export async function POST(req: Request) {
  const body = await readSourceRequest(req);
  if (body instanceof Response) return body;
  const action = body.action;

  if (action === "status") return Response.json(await dbStatus(), { headers: sourceHeaders });

  if (action === "test") {
    try {
      return Response.json({ ok: true, ms: await reach() }, { headers: sourceHeaders });
    } catch (err) {
      return sourceError(502, err instanceof Error ? err.message : "The remote database did not answer.");
    }
  }

  if (action !== "switch") return sourceError(400, "Unknown storage action.");
  const target = body.target as StorageTarget;
  if (target !== "local" && target !== "remote") return sourceError(400, "Choose this machine or remote.");
  if (process.env.INNERNET_STORAGE) return sourceError(409, "INNERNET_STORAGE is set for this server, so the storage can only change there.");
  if (target === "remote") {
    if (!remoteDatabase()) return sourceError(400, "No remote database is set up yet.");
    if (body.confirm !== true) return sourceError(400, "Confirm that this machine's index and history may be copied to the remote database.");
    // Never switch to a database that cannot be reached: the copy would have nowhere to go.
    try {
      await reach();
    } catch (err) {
      return sourceError(502, err instanceof Error ? err.message : "The remote database did not answer.");
    }
  }

  const from = storageTarget();
  if (from !== target) {
    writeStorageTarget(target);
    await reopenDb();
  }

  // Copy what the files hold into the storage now in use: the index, then every history
  // folder. The files stay as they are.
  let last: LastStore;
  const db = await getDb();
  if (!db) last = { at: new Date().toISOString(), error: dbState().note };
  else {
    try {
      const loaded = getLocalIndex();
      last = { at: new Date().toISOString(), summary: await storeLocal(db, loaded.source === "file" ? loaded.index : null) };
    } catch (err) {
      last = { at: new Date().toISOString(), error: `${db.label} did not finish (${errorText(err)}). The files are as they were.` };
    }
  }
  rememberStore(last);

  if (from !== target) {
    appendEvent(body.session, APP, { kind: "storage", title: target === "remote" ? "Storage moved to the remote database" : "Storage moved to this machine", target, url: "/sources#storage" });
    await ingestSession(body.session);
  }
  return Response.json({ target: storageTarget(), last, status: await dbStatus() }, { status: last.error ? 503 : 200, headers: sourceHeaders });
}
