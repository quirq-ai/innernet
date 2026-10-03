import { APP, MAX_EVENT_BYTES, SESSION_RE, newSessionId, type ActivityEvent } from "./shared";

// The browser side of the history, shared by the recorder and the header's back and
// forward buttons. One session per tab: its id lives in sessionStorage, made on first
// load from the start time and a random id. The trail is the tab's own stack of pages
// with a cursor, like a browser's: a normal navigation cuts off whatever lay ahead,
// and the buttons only move the cursor.
//
// On this machine each event goes to the app's own /api/activity route. On the demo
// nothing is sent anywhere: the same events, under the same session ids, are kept in
// this browser's localStorage.

const SESSION_KEY = "innernet-session";
const TRAIL_KEY = "innernet-trail";
export const DEMO_KEY = "innernet-history";

/** Fired on window whenever the trail changes, so the buttons can follow. */
export const TRAIL_EVENT = "innernet:trail";

const MAX_TRAIL = 100;
const DEMO_SESSIONS = 40;
const DEMO_EVENTS = 400;

export interface TrailEntry {
  url: string;
  label?: string; // what the tooltip names: the page's title, or the search in quotes
}

export interface Trail {
  stack: TrailEntry[];
  cursor: number;
}

// If storage is blocked (a private window, a sandbox) the tab still works for as long
// as the page stays loaded.
let memorySession: string | null = null;
let memoryTrail: Trail = { stack: [], cursor: -1 };

export function sessionId(): string {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && SESSION_RE.test(saved)) return saved;
    const id = memorySession ?? newSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    memorySession = id;
    return id;
  } catch {
    return (memorySession ??= newSessionId());
  }
}

/** The id without making one: for pages that only want to know which session is theirs. */
export function currentSessionId(): string | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved && SESSION_RE.test(saved) ? saved : memorySession;
  } catch {
    return memorySession;
  }
}

export function readTrail(): Trail {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    if (!raw) return memoryTrail;
    const t = JSON.parse(raw) as Trail;
    if (!Array.isArray(t.stack) || typeof t.cursor !== "number") return memoryTrail;
    const stack = t.stack.filter((e) => e && typeof e.url === "string" && e.url.startsWith("/") && !e.url.startsWith("//"));
    return { stack, cursor: Math.min(Math.max(t.cursor, stack.length ? 0 : -1), stack.length - 1) };
  } catch {
    return memoryTrail;
  }
}

export function writeTrail(t: Trail) {
  // Keep the newest pages; the cursor moves with them.
  const drop = Math.max(0, t.stack.length - MAX_TRAIL);
  memoryTrail = { stack: t.stack.slice(drop), cursor: Math.max(-1, t.cursor - drop) };
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(memoryTrail));
  } catch {
    /* kept in memory */
  }
  window.dispatchEvent(new CustomEvent(TRAIL_EVENT));
}

// A move made with the buttons, waiting for its route to arrive, so the recorder logs
// it as "back" or "forward" rather than as a new visit.
let pendingMove: { dir: "back" | "forward"; url: string; at: number } | null = null;

export function setPendingMove(dir: "back" | "forward", url: string) {
  pendingMove = { dir, url, at: Date.now() };
}

/** True while a step is on its way, so a quick second click cannot cross it. */
export function moving(): boolean {
  return !!pendingMove && Date.now() - pendingMove.at < 4000;
}

export function takePendingMove(url: string): "back" | "forward" | null {
  const move = pendingMove;
  pendingMove = null;
  return move && move.url === url ? move.dir : null;
}

export type Fields = { kind: "visit" | "search" | "back" | "forward"; url: string; title?: string; q?: string; via?: "buttons" | "browser" };

/** Record one event: to this machine's history, or on the demo to this browser only. */
export function record(fields: Fields, demo: boolean) {
  const session = sessionId();
  if (demo) {
    keepInBrowser(session, { at: new Date().toISOString(), app: APP, ...fields });
    return;
  }
  const body = JSON.stringify({ session, ...fields });
  if (body.length > MAX_EVENT_BYTES) return;
  fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {
    /* offline or the server restarting; one missed line is not worth a retry */
  });
}

export type BrowserHistory = Record<string, ActivityEvent[]>;

export function readBrowserHistory(): BrowserHistory {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const parsed = raw ? (JSON.parse(raw) as { sessions?: BrowserHistory }) : null;
    const sessions = parsed?.sessions;
    if (!sessions || typeof sessions !== "object") return {};
    const out: BrowserHistory = {};
    for (const [id, events] of Object.entries(sessions)) if (SESSION_RE.test(id) && Array.isArray(events)) out[id] = events;
    return out;
  } catch {
    return {};
  }
}

export function clearBrowserHistory() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* nothing to clear */
  }
}

function keepInBrowser(session: string, event: ActivityEvent) {
  if (JSON.stringify(event).length > MAX_EVENT_BYTES) return;
  const sessions = readBrowserHistory();
  sessions[session] = [...(sessions[session] ?? []), event].slice(-DEMO_EVENTS);
  // The newest sessions only: session ids sort by their start time.
  const keep = Object.keys(sessions).sort().slice(-DEMO_SESSIONS);
  const out: BrowserHistory = {};
  for (const id of keep) out[id] = sessions[id];
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify({ v: 1, sessions: out }));
  } catch {
    /* storage full or blocked; the history page says what it can */
  }
}
