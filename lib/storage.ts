import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Where Innernet keeps the copy of what it generates (the local index and the history):
// this machine's database (PGlite in ~/.innernet/db) or your own remote one (Neon). The
// files stay the record either way; the database is the copy that serves an index whose
// file went missing, and that `pnpm db:load` writes back.
//
// Both settings live in ~/.innernet, beside the history and the database, outside the
// project, so neither git nor a deploy ever carries them:
//   storage.json  { "target": "local" | "remote" }       which one is in use
//   remote.json   { "url": "postgres://...", ... }       the remote database (a secret)
// INNERNET_STORAGE and INNERNET_REMOTE_DATABASE_URL override them; INNERNET_HOME moves
// the folder. The public demo never reads any of this.

export type StorageTarget = "local" | "remote";

export interface RemoteDatabase {
  url: string;
  provider: string | null; // "neon"
  name: string | null; // "innernet-personal"
}

const home = (p: string) => (p === "~" ? os.homedir() : p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);

export const STATE_DIR = path.resolve(home(process.env.INNERNET_HOME?.trim() || path.join(os.homedir(), ".innernet")));
export const STORAGE_FILE = path.join(STATE_DIR, "storage.json");
export const REMOTE_FILE = path.join(STATE_DIR, "remote.json");

const POSTGRES_URL = /^postgres(?:ql)?:\/\/[^\s]+$/;

/** The storage in use. Local unless the settings or INNERNET_STORAGE say remote. */
export function storageTarget(): StorageTarget {
  const forced = process.env.INNERNET_STORAGE?.trim().toLowerCase();
  if (forced === "local" || forced === "remote") return forced;
  try {
    const saved = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf8")) as { target?: unknown };
    if (saved?.target === "remote") return "remote";
  } catch {
    /* none saved: local */
  }
  return "local";
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The remote database, if one is set up. Its URL is a secret: never logged, never sent
 * to a browser, never written anywhere but remote.json. */
export function remoteDatabase(): RemoteDatabase | null {
  const forced = process.env.INNERNET_REMOTE_DATABASE_URL?.trim();
  if (forced) return POSTGRES_URL.test(forced) ? { url: forced, provider: null, name: null } : null;
  try {
    const saved = JSON.parse(fs.readFileSync(REMOTE_FILE, "utf8")) as Record<string, unknown>;
    const url = text(saved?.url);
    if (url && POSTGRES_URL.test(url)) return { url, provider: text(saved.provider), name: text(saved.name) };
  } catch {
    /* none set up */
  }
  return null;
}

/** For people: "innernet-personal on Neon, us-east-1". Never a password, user or full host. */
export function remoteLabel(remote: RemoteDatabase | null): string {
  if (!remote) return "no remote database";
  let host = "";
  try {
    host = new URL(remote.url).hostname;
  } catch {
    /* unreadable: the name alone */
  }
  const neon = remote.provider === "neon" || host.endsWith(".neon.tech");
  const region = host.match(/\.(?:[a-z]-\d+\.)?([a-z]{2}-[a-z]+-\d)\./)?.[1] ?? null;
  const where = [neon ? "Neon" : "Postgres", region].filter(Boolean).join(", ");
  return remote.name ? `${remote.name} on ${where}` : `your ${where} database`;
}

/** Save the storage in use: ~/.innernet/storage.json, folder 700, file 600, written whole. */
export function writeStorageTarget(target: StorageTarget): void {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${STORAGE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ target }, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, STORAGE_FILE);
}

/** "~/.innernet/storage.json" for a path under the home folder, the path otherwise. */
export function homeLabel(p: string): string {
  const h = os.homedir();
  return p === h ? "~" : p.startsWith(h + path.sep) ? `~${p.slice(h.length)}` : p;
}
