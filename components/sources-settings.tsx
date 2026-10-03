"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { sessionId } from "@/components/activity/trail";
import { appPath } from "@/lib/base-path";
import { plural } from "@/lib/format";

type Selection = { local: boolean; remote: boolean };
type StorageLocation = {
  id: string;
  label: string;
  path: string;
  description: string;
  kind: "file" | "directory";
  exists: boolean;
  editable: boolean;
};
type SourcesInfo = {
  selection: Selection;
  local: { roots: string[]; maxDepth: number | null; error?: string };
  remote: {
    label: string;
    url: string;
    indexPath: string;
    generatedAt: string | null;
    owner: string;
    repositories: string[];
    needsSync: boolean;
    error?: string;
  };
  storage: StorageLocation[];
  browserStorage: { label: string; location: string; description: string }[];
};
type Feedback = { error: boolean; message: string };

const smallButton = "rounded-md border border-line-strong px-2.5 py-1.5 text-[12px] text-ink-2 transition-colors enabled:hover:bg-bg-sunk enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const actionButton = "rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink-2 transition-colors enabled:hover:bg-bg-sunk enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const sourceInput = "mt-2 block w-full rounded-lg border border-line-strong bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:opacity-50";

async function sourcesRequest<T>(path: string, body: object): Promise<T> {
  const response = await fetch(appPath(path), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, session: sessionId() }),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(typeof result.error === "string" ? result.error : "Could not complete that action. Please try again.");
  }
  return result as T;
}

/** Source choices and a map to the files behind this Innernet. */
export function SourcesSettings() {
  const router = useRouter();
  const running = useRef(false);
  const localId = useId();
  const remoteId = useId();
  const ownerId = useId();
  const repositoriesId = useId();
  const [info, setInfo] = useState<SourcesInfo | null>(null);
  const [selection, setSelection] = useState<Selection>({ local: true, remote: false });
  const [remoteOwner, setRemoteOwner] = useState("quirq-ai");
  const [remoteRepositories, setRemoteRepositories] = useState("");
  const [pending, setPending] = useState<string | null>("inspect");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const dirty = !!info && (
    selection.local !== info.selection.local || selection.remote !== info.selection.remote ||
    remoteOwner !== info.remote.owner || remoteRepositories !== info.remote.repositories.join("\n")
  );
  const hasSelection = selection.local || selection.remote;

  useEffect(() => {
    void inspect();
  }, []);

  function applyInfo(result: SourcesInfo) {
    setInfo(result);
    setSelection(result.selection);
    setRemoteOwner(result.remote.owner);
    setRemoteRepositories(result.remote.repositories.join("\n"));
  }

  async function inspect() {
    if (running.current) return;
    running.current = true;
    setPending("inspect");
    setFeedback(null);
    setCopied(null);
    try {
      const result = await sourcesRequest<SourcesInfo>("/api/sources", { action: "inspect" });
      applyInfo(result);
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Could not load sources." });
    } finally {
      running.current = false;
      setPending(null);
    }
  }

  async function save() {
    if (running.current || !hasSelection || !dirty) return;
    running.current = true;
    setPending("save");
    setFeedback({ error: false, message: "Saving your sources." });
    try {
      const result = await sourcesRequest<SourcesInfo>("/api/sources", {
        action: "save",
        selection,
        remote: {
          owner: remoteOwner,
          repositories: remoteRepositories.split(/\r?\n/).map((repository) => repository.trim()).filter(Boolean),
        },
      });
      applyInfo(result);
      setFeedback({ error: false, message: "Sources saved. Sync now to refresh their pages." });
      router.refresh();
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Could not save sources." });
    } finally {
      running.current = false;
      setPending(null);
    }
  }

  async function sync() {
    if (running.current || dirty || !hasSelection) return;
    running.current = true;
    setPending("sync");
    setFeedback({ error: false, message: "Syncing your selected sources. This may take a minute." });
    try {
      const result = await sourcesRequest<{ ok: true; pages: number }>("/api/sources/sync", {});
      setFeedback({ error: false, message: `Sources synced. ${plural(result.pages, "page")} indexed.` });
      // Update file availability after a first sync without losing a successful
      // outcome if refreshing the storage details is temporarily unavailable.
      const refreshed = await sourcesRequest<SourcesInfo>("/api/sources", { action: "inspect" }).catch(() => null);
      if (refreshed) {
        applyInfo(refreshed);
      }
      router.refresh();
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Could not sync sources. Please try again." });
    } finally {
      running.current = false;
      setPending(null);
    }
  }

  async function openLocation(location: StorageLocation, action: "reveal" | "edit") {
    if (running.current) return;
    running.current = true;
    setPending(`${action}:${location.id}`);
    setFeedback(null);
    try {
      await sourcesRequest<{ ok: true }>("/api/sources/open", { target: location.id, action });
      setFeedback({ error: false, message: action === "edit" ? `Opened ${location.label.toLowerCase()} for editing.` : `Opened the folder for ${location.label.toLowerCase()}.` });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Could not open this location. Copy its path to open it manually." });
    } finally {
      running.current = false;
      setPending(null);
    }
  }

  async function copyPath(location: StorageLocation) {
    try {
      await navigator.clipboard.writeText(location.path);
      setCopied(location.id);
      setFeedback({ error: false, message: `Copied the path for ${location.label.toLowerCase()}.` });
    } catch {
      setFeedback({ error: true, message: "Could not copy the path. Select the path below and copy it manually." });
    }
  }

  return (
    <>
      {feedback && (
        <div className="sticky top-16 z-30 bg-bg py-3">
          <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${feedback.error ? "border-notice-line bg-notice text-ink" : "border-line bg-bg-sunk text-ink-2"}`}>{feedback.message}</p>
        </div>
      )}
      {pending === "inspect" && <p role="status" className="mb-4 text-[13px] text-muted">Loading sources and storage locations.</p>}
      {!info && !pending && <button type="button" onClick={() => void inspect()} className={actionButton}>Try again</button>}
      {info && (
        <>
          <section id="choose-sources" aria-labelledby="choose-sources-title" className="scroll-mt-32">
            <h2 id="choose-sources-title" className="mb-5 font-display text-[30px] leading-tight">Choose sources</h2>
            <fieldset disabled={!!pending}>
              <legend className="sr-only">Include in your Innernet</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`min-w-0 rounded-xl border p-4 ${selection.local ? "border-line-strong bg-bg-sunk" : "border-line"}`}>
                  <label htmlFor={localId} className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
                    <input id={localId} type="checkbox" checked={selection.local} onChange={(event) => setSelection((previous) => ({ ...previous, local: event.target.checked }))} className="size-4 shrink-0 accent-link" />
                    Local
                  </label>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{info.local.error ?? <>Folders on this machine, up to {info.local.maxDepth} levels deep.</>}</p>
                  <ul className="mt-2 space-y-1">
                    {info.local.roots.map((root) => <li key={root} className="break-all font-mono text-[11px] leading-relaxed text-ink-2">{root}</li>)}
                  </ul>
                </div>
                <div className={`min-w-0 rounded-xl border p-4 ${selection.remote ? "border-line-strong bg-bg-sunk" : "border-line"}`}>
                  <label htmlFor={remoteId} className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
                    <input id={remoteId} type="checkbox" checked={selection.remote} onChange={(event) => setSelection((previous) => ({ ...previous, remote: event.target.checked }))} className="size-4 shrink-0 accent-link" />
                    Remote <span className="text-[12px] font-normal text-muted">GitHub</span>
                  </label>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Public repositories from GitHub.</p>
                  <a href={info.remote.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-[12.5px] text-link hover:underline">{info.remote.label}</a>
                  <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-muted">{info.remote.url}</p>
                </div>
              </div>
              {info.remote.error && <p role="alert" className="mt-4 rounded-lg border border-notice-line bg-notice px-3 py-2.5 text-[13px] leading-relaxed">{info.remote.error}</p>}
              <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="min-w-0">
                  <label htmlFor={ownerId} className="text-[13px] font-medium">GitHub account</label>
                  <input id={ownerId} type="text" value={remoteOwner} onChange={(event) => setRemoteOwner(event.target.value)} placeholder="quirq-ai" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={`${ownerId}-help`} className={sourceInput} />
                  <p id={`${ownerId}-help`} className="mt-2 text-[12.5px] leading-relaxed text-muted">An organization or user name, or its GitHub URL.</p>
                </div>
                <div className="min-w-0">
                  <label htmlFor={repositoriesId} className="text-[13px] font-medium">Repositories <span className="font-normal text-muted">(optional)</span></label>
                  <textarea id={repositoriesId} rows={3} value={remoteRepositories} onChange={(event) => setRemoteRepositories(event.target.value)} placeholder="One repository per line" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={`${repositoriesId}-help`} className={`${sourceInput} resize-y`} />
                  <p id={`${repositoriesId}-help`} className="mt-2 text-[12.5px] leading-relaxed text-muted">Leave empty for all public repositories. Enter one name or GitHub repository URL per line, all from the account above.</p>
                </div>
              </div>
            </fieldset>
            <p className="mt-3 text-[12.5px] text-muted">
              {!hasSelection ? "Choose at least one source to continue." : dirty ? "You have unsaved changes. Save your sources before syncing." : "You can use either source or both. Sync refreshes your saved selection."}
            </p>
            {!dirty && info.remote.needsSync && <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{selection.remote ? "Sync now to index this GitHub account and repository selection. Their pages will appear after the sync completes." : "This GitHub account and repository selection still need a sync. Enable Remote and save when you want to index them."}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void save()} disabled={!!pending || !dirty || !hasSelection} className={actionButton}>{pending === "save" ? "Saving." : "Save sources"}</button>
              <button type="button" onClick={() => void sync()} disabled={!!pending || dirty || !hasSelection} className="flex items-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 text-[13px] text-bg transition-opacity enabled:hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40">
                <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={pending === "sync" ? "motion-safe:animate-spin" : ""}><path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>
                {pending === "sync" ? "Syncing." : "Sync now"}
              </button>
              <span className="text-[12px] text-muted">Changes and syncs appear in Activity.</span>
            </div>
          </section>

          <section id="storage" className="mt-12 scroll-mt-32 border-t border-line pt-9" aria-labelledby="storage-title">
            <h2 id="storage-title" className="font-display text-[30px] leading-tight">Where your data lives</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">These paths are on the machine running Innernet. Generated pages are built from the indexes below, with no separate file for each page.</p>
            <div className="mt-3 divide-y divide-line">
              {info.storage.map((location) => (
                <div key={location.id} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-8">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3 className="text-[13px] font-medium">{location.label}</h3>
                      {!location.exists && <span className="text-[11px] text-muted">Not created yet</span>}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{location.description}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="select-text break-all rounded-md bg-bg-sunk px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-ink-2">{location.path}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => void copyPath(location)} disabled={!!pending} aria-label={`Copy path for ${location.label}`} className={smallButton}>{copied === location.id ? "Copied" : "Copy path"}</button>
                      <button type="button" onClick={() => void openLocation(location, "reveal")} disabled={!!pending} aria-label={`Open folder for ${location.label}`} title={location.exists ? undefined : "Open the nearest existing parent folder"} className={smallButton}>{pending === `reveal:${location.id}` ? "Opening." : "Open folder"}</button>
                      {location.editable && <button type="button" onClick={() => void openLocation(location, "edit")} disabled={!!pending || !location.exists} aria-label={`Edit file for ${location.label}`} title={location.exists ? undefined : "This file has not been created yet"} className={smallButton}>{pending === `edit:${location.id}` ? "Opening." : "Edit file"}</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {info.browserStorage.length > 0 && (
              <div className="border-t border-line pt-4">
                <h3 className="text-[11px] uppercase tracking-[0.12em] text-muted">In this browser</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">These values live in browser storage. Inspect them in your browser's developer tools under Application or Storage.</p>
                {info.browserStorage.map((location) => (
                  <div key={location.location} className="mt-3">
                    <p className="text-[13px] font-medium">{location.label}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-ink-2">{location.location}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{location.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
