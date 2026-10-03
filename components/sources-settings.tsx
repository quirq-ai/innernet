"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { sessionId } from "@/components/activity/trail";
import { appPath } from "@/lib/base-path";
import { bytes, plural, timeAgo } from "@/lib/format";

// Sources, in the order data flows: the input (folders on this machine, GitHub
// repositories), everything that input generates, and the storage its copy goes to.
// Every request goes to this app's own routes, which answer only on this machine.

type Selection = { local: boolean; remote: boolean };
type Generated = {
  id: string;
  label: string;
  path: string;
  kind: "file" | "directory" | "browser";
  exists: boolean;
  bytes: number | null;
  more: boolean;
  modified: string | null;
  detail: string | null;
  editable: boolean;
};
type SourcesInfo = {
  selection: Selection;
  local: { roots: string[]; maxDepth: number | null; config: string; error?: string };
  remote: { repositories: string[]; legacyAccount: string | null; snapshot: string | null; generatedAt: string | null; needsSync: boolean; error?: string };
  generated: Generated[];
  storage: { target: "local" | "remote"; local: { path: string }; remote: { label: string; ready: boolean } };
};
type DbStatus = {
  kind: "pglite" | "remote" | "neon" | null;
  state: string;
  label: string;
  note: string;
  index: { generatedAt: string; storedAt: string | null; pages: number | null } | null;
  activity: { lines: number; sessions: number } | null;
};
type Feedback = { error: boolean; message: string };

const pill = "rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink-2 transition-colors enabled:hover:bg-bg-sunk enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const solid = "flex items-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 text-[13px] text-bg transition-opacity enabled:hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";
const icon = "grid size-7 place-items-center rounded-md text-muted transition-colors enabled:hover:bg-bg-sunk enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
const field = "mt-2 block w-full rounded-lg border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:opacity-50";
const H2 = "font-display text-[30px] leading-tight";

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(appPath(path), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, session: sessionId() }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error(typeof result.error === "string" ? result.error : "That did not work. Try again.");
  return result as T;
}

const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const size = (g: Generated) => (g.bytes == null ? "" : `${g.more ? "at least " : ""}${bytes(g.bytes)}`);

export function SourcesSettings() {
  const router = useRouter();
  const busy = useRef(false);
  const localId = useId();
  const remoteId = useId();
  const reposId = useId();
  const [info, setInfo] = useState<SourcesInfo | null>(null);
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [selection, setSelection] = useState<Selection>({ local: true, remote: false });
  const [repos, setRepos] = useState("");
  const [pending, setPending] = useState<string | null>("inspect");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const dirty = !!info && (selection.local !== info.selection.local || selection.remote !== info.selection.remote || repos !== info.remote.repositories.join("\n"));
  const chosen = selection.local || selection.remote;
  const remoteEmpty = selection.remote && !lines(repos).length;

  useEffect(() => {
    void inspect();
  }, []);

  function apply(result: SourcesInfo) {
    setInfo(result);
    setSelection(result.selection);
    setRepos(result.remote.repositories.join("\n"));
  }

  /** Run one action at a time, with its message in the bar. */
  async function run(name: string, work: () => Promise<string | null>) {
    if (busy.current) return;
    busy.current = true;
    setPending(name);
    try {
      const message = await work();
      setFeedback(message ? { error: false, message } : null);
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "That did not work. Try again." });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function refreshStatus() {
    setStatus(await post<DbStatus>("/api/storage", { action: "status" }).catch(() => null));
  }

  const inspect = () =>
    run("inspect", async () => {
      apply(await post<SourcesInfo>("/api/sources", { action: "inspect" }));
      void refreshStatus();
      return null;
    });

  const save = () =>
    run("save", async () => {
      apply(await post<SourcesInfo>("/api/sources", { action: "save", selection, remote: { repositories: lines(repos) } }));
      router.refresh();
      return "Saved. Sync to refresh their pages.";
    });

  const sync = () =>
    run("sync", async () => {
      setFeedback({ error: false, message: "Syncing. This can take a minute." });
      const result = await post<{ pages: number }>("/api/sources/sync", {});
      const refreshed = await post<SourcesInfo>("/api/sources", { action: "inspect" }).catch(() => null);
      if (refreshed) apply(refreshed);
      void refreshStatus();
      router.refresh();
      return `Synced: ${plural(result.pages, "page")}.`;
    });

  const open = (g: { id: string; label: string }, action: "reveal" | "edit") =>
    run(`${action}:${g.id}`, async () => {
      await post("/api/sources/open", { target: g.id, action });
      return action === "edit" ? `Opened ${g.label.toLowerCase()} in your editor.` : `Opened the folder of ${g.label.toLowerCase()}.`;
    });

  async function copy(g: Generated) {
    try {
      await navigator.clipboard.writeText(g.path);
      setCopied(g.id);
      setTimeout(() => setCopied((c) => (c === g.id ? null : c)), 1600);
    } catch {
      setFeedback({ error: true, message: "Could not copy. Select the path and copy it by hand." });
    }
  }

  const test = () =>
    run("test", async () => {
      const r = await post<{ ms: number }>("/api/storage", { action: "test" });
      return `${info?.storage.remote.label ?? "The remote database"} answered in ${r.ms} ms.`;
    });

  const switchTo = (target: "local" | "remote") =>
    run(`switch:${target}`, async () => {
      setConfirming(false);
      setFeedback({ error: false, message: target === "remote" ? "Copying your index and history to the remote database." : "Copying your index and history to this machine's database." });
      const r = await post<{ status: DbStatus; last: { error?: string } }>("/api/storage", { action: "switch", target, confirm: target === "remote" });
      setStatus(r.status);
      const refreshed = await post<SourcesInfo>("/api/sources", { action: "inspect" }).catch(() => null);
      if (refreshed) apply(refreshed);
      return target === "remote" ? "Now storing in the remote database." : "Now storing on this machine.";
    });

  if (!info) {
    return (
      <>
        {pending === "inspect" && <p role="status" className="text-[13px] text-muted">Loading.</p>}
        {feedback && <p role="alert" className="text-[13px] text-ink">{feedback.message}</p>}
        {!pending && (
          <button type="button" onClick={() => void inspect()} className={`${pill} mt-3`}>
            Try again
          </button>
        )}
      </>
    );
  }

  const st = info.storage;
  const inUse = st.target;

  return (
    <>
      {feedback && (
        <div className="sticky top-16 z-30 bg-bg py-3">
          <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${feedback.error ? "border-notice-line bg-notice text-ink" : "border-line bg-bg-sunk text-ink-2"}`}>
            {feedback.message}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------ Input */}
      <section id="input" aria-labelledby="input-title" className="scroll-mt-32">
        <h2 id="input-title" className={H2}>
          Input
        </h2>
        <fieldset disabled={!!pending} className="mt-5">
          <legend className="sr-only">What Innernet reads</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`min-w-0 rounded-xl border p-4 ${selection.local ? "border-line-strong bg-bg-sunk" : "border-line"}`}>
              <label htmlFor={localId} className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
                <input id={localId} type="checkbox" checked={selection.local} onChange={(e) => setSelection((s) => ({ ...s, local: e.target.checked }))} className="size-4 shrink-0 accent-link" />
                Local
                <span className="text-[12px] font-normal text-muted">folders on this machine</span>
              </label>
              {info.local.error ? (
                <p className="mt-3 text-[12.5px] text-ink">{info.local.error}</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {info.local.roots.map((root) => (
                    <li key={root} className="break-all font-mono text-[12px] text-ink-2">
                      {root}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted">
                <span>{info.local.maxDepth != null && `${info.local.maxDepth} levels deep`}</span>
                <button type="button" onClick={() => void open({ id: "config", label: "Folder settings" }, "edit")} className="link text-[12px]" title={info.local.config}>
                  Edit folders
                </button>
              </div>
            </div>

            <div className={`min-w-0 rounded-xl border p-4 ${selection.remote ? "border-line-strong bg-bg-sunk" : "border-line"}`}>
              <label htmlFor={remoteId} className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
                <input id={remoteId} type="checkbox" checked={selection.remote} onChange={(e) => setSelection((s) => ({ ...s, remote: e.target.checked }))} className="size-4 shrink-0 accent-link" />
                Remote
                <span className="text-[12px] font-normal text-muted">GitHub repositories</span>
              </label>
              <label htmlFor={reposId} className="sr-only">
                GitHub repository links, one per line
              </label>
              <textarea
                id={reposId}
                rows={4}
                value={repos}
                onChange={(e) => setRepos(e.target.value)}
                placeholder={"https://github.com/quirq-ai/innernet\nhttps://github.com/octocat/hello-world"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby={`${reposId}-help`}
                className={`${field} resize-y`}
              />
              <p id={`${reposId}-help`} className="mt-2 text-[12px] text-muted">
                One public repository per line, from any account. Up to 50.
              </p>
              {info.remote.legacyAccount && (
                <p className="mt-2 text-[12px] text-ink">
                  Remote used to take all of {info.remote.legacyAccount}&apos;s repositories. List the ones you want.
                </p>
              )}
              {info.remote.error && (
                <p role="alert" className="mt-2 text-[12px] text-ink">
                  {info.remote.error}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void save()} disabled={!!pending || !dirty || !chosen || remoteEmpty} className={pill}>
            {pending === "save" ? "Saving." : "Save"}
          </button>
          <button type="button" onClick={() => void sync()} disabled={!!pending || dirty || !chosen} className={solid}>
            <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={pending === "sync" ? "motion-safe:animate-spin" : ""}>
              <path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" />
            </svg>
            {pending === "sync" ? "Syncing." : "Sync now"}
          </button>
          <span className="text-[12px] text-muted">
            {!chosen ? "Choose at least one." : remoteEmpty ? "Add a repository for Remote." : dirty ? "Save before syncing." : info.remote.needsSync && selection.remote ? "Remote has not been synced yet." : "Saves and syncs show in History."}
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------------ Generated data */}
      <section id="generated" aria-labelledby="generated-title" className="mt-12 scroll-mt-32 border-t border-line pt-9">
        <h2 id="generated-title" className={H2}>
          Generated data
        </h2>
        <p className="mt-2 text-[13px] text-muted">Made from the input. Paths are relative to the app, or to your home folder (~).</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {info.generated.map((g) => (
            <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[170px_minmax(0,1fr)_170px_92px]">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{g.label}</div>
                {g.detail && <div className="truncate text-[12px] text-muted">{g.detail}</div>}
              </div>
              <div className="order-3 col-span-2 min-w-0 truncate font-mono text-[12px] text-ink-2 sm:order-none sm:col-span-1" title={g.path}>
                {g.path}
              </div>
              <div className="order-4 col-span-2 text-[12px] tabular-nums text-muted sm:order-none sm:col-span-1">
                {g.kind === "browser" ? "in your browser" : !g.exists ? "not made yet" : [size(g), g.modified && timeAgo(g.modified)].filter(Boolean).join(" · ")}
              </div>
              {g.kind !== "browser" ? (
                <div className="flex justify-end gap-0.5">
                  <button type="button" onClick={() => void copy(g)} disabled={!!pending} aria-label={`Copy the path of ${g.label}`} title="Copy path" className={icon}>
                    {copied === g.id ? (
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    ) : (
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                      </svg>
                    )}
                  </button>
                  <button type="button" onClick={() => void open(g, "reveal")} disabled={!!pending} aria-label={`Open the folder of ${g.label}`} title="Open folder" className={icon}>
                    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    </svg>
                  </button>
                  {g.editable && (
                    <button type="button" onClick={() => void open(g, "edit")} disabled={!!pending || !g.exists} aria-label={`Edit ${g.label}`} title={g.exists ? "Edit" : "Not made yet"} className={icon}>
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 20h4L19 9l-4-4L4 16Z" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ Storage */}
      <section id="storage" aria-labelledby="storage-title" className="mt-12 scroll-mt-32 border-t border-line pt-9">
        <h2 id="storage-title" className={H2}>
          Storage
        </h2>
        <p className="mt-2 text-[13px] text-muted">Where the copy of the local index and history is kept. The files above stay the record.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              { id: "local", title: "This machine", where: st.local.path, about: "PGlite. Nothing leaves this machine.", ready: true },
              { id: "remote", title: "Remote", where: st.remote.label, about: "Your own Neon database. Your index and history leave this machine.", ready: st.remote.ready },
            ] as const
          ).map((o) => {
            const current = inUse === o.id;
            return (
              <div key={o.id} className={`min-w-0 rounded-xl border p-4 ${current ? "border-ink/40 bg-bg-sunk" : "border-line"}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink">{o.title}</span>
                  {current && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-bg">In use</span>}
                </div>
                <p className="mt-1.5 break-all font-mono text-[12px] text-ink-2">{o.where}</p>
                <p className="mt-1.5 text-[12px] text-muted">{o.about}</p>
                {!current && o.ready && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.id === "remote" ? (
                      <>
                        <button type="button" onClick={() => setConfirming(true)} disabled={!!pending || confirming} className={pill}>
                          Switch to remote
                        </button>
                        <button type="button" onClick={() => void test()} disabled={!!pending} className={pill}>
                          {pending === "test" ? "Testing." : "Test"}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => void switchTo("local")} disabled={!!pending} className={pill}>
                        {pending === "switch:local" ? "Switching." : "Switch to this machine"}
                      </button>
                    )}
                  </div>
                )}
                {current && o.id === "remote" && (
                  <button type="button" onClick={() => void test()} disabled={!!pending} className={`${pill} mt-3`}>
                    {pending === "test" ? "Testing." : "Test"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {confirming && (
          <div role="group" aria-label="Confirm the switch to remote" className="mt-4 rounded-xl border border-notice-line bg-notice p-4">
            <p className="text-[13px] leading-relaxed text-ink">
              This copies your local index (folder paths, README text, agent instructions) and your history to {st.remote.label}. Your files stay here, and
              the copy stays there until you delete it.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void switchTo("remote")} disabled={!!pending} className={solid}>
                {pending === "switch:remote" ? "Copying." : "Copy and switch"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={!!pending} className={pill}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-[12.5px] text-muted" aria-live="polite">
          {!status
            ? "Checking the database."
            : status.state !== "ready"
              ? status.note
              : [
                  status.index?.pages != null ? `${plural(status.index.pages, "page")}` : null,
                  status.activity ? `${plural(status.activity.lines, "history line")}` : null,
                  status.index?.storedAt ? `stored ${timeAgo(status.index.storedAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Empty so far."}
        </p>
      </section>
    </>
  );
}
