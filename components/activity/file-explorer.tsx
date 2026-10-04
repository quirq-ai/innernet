"use client";

import { useEffect, useRef, useState } from "react";
import type { DirectoryListing, FileContents, FileEntry } from "@/lib/activity-files-types";
import { appPath } from "@/lib/base-path";
import { bytes, num } from "@/lib/format";
import { formatJsonPage, initialJsonFormatState, type JsonFormatState } from "@/lib/json-page-format";
import { JsonContent } from "./json-content";

const button = "rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:cursor-wait disabled:opacity-50";

async function read<T>(action: "list" | "read", path: string, cursor = 0, signal?: AbortSignal, snapshot?: string): Promise<T> {
  const response = await fetch(appPath("/api/activity/files"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, path, cursor, snapshot }), credentials: "same-origin", cache: "no-store", signal,
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "The activity files could not be read.");
  return result.data as T;
}

function FileIcon({ folder = false, open = false }: { folder?: boolean; open?: boolean }) {
  return <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-muted">
    {folder ? <path d={open ? "M3 8V5h7l2 3h9v3M3 11h19l-3 9H5l-2-9Z" : "M3 5h7l2 3h9v12H3V5Z"} /> : <><path d="M5 3h9l5 5v13H5V3Z" /><path d="M14 3v6h5M8 13h8M8 17h5" /></>}
  </svg>;
}

type TreeProps = { path: string; selected: string | null; onSelect: (path: string) => void; depth?: number };

function FolderEntry({ entry, selected, onSelect, depth = 0 }: Omit<TreeProps, "path"> & { entry: FileEntry }) {
  const [open, setOpen] = useState(false);
  return <li>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? "Close" : "Open"} folder ${entry.name}`} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-ink-2 hover:bg-bg-sunk" style={{ paddingLeft: 8 + Math.min(depth, 7) * 12 }}>
      <span aria-hidden className="w-2 shrink-0 text-muted">{open ? "▾" : "▸"}</span><FileIcon folder open={open} /><span className="min-w-0 [overflow-wrap:anywhere]">{entry.name}</span>
    </button>
    {open && <FolderContents path={entry.path} selected={selected} onSelect={onSelect} depth={depth + 1} />}
  </li>;
}

function FolderContents({ path, selected, onSelect, depth = 0 }: TreeProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  async function load(cursor = 0) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError("");
    try {
      const next = await read<DirectoryListing>("list", path, cursor, controller.signal, cursor ? listing?.snapshot : undefined);
      setListing((previous) => cursor && previous ? { ...next, entries: [...previous.entries, ...next.entries] } : next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This folder could not be read.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { void load(); return () => request.current?.abort(); }, [path]); // One request when a folder opens.

  return <div>
    {listing && <ul className="space-y-0.5">
      {listing.entries.map((entry) => entry.kind === "directory" ? <FolderEntry key={entry.path} entry={entry} selected={selected} onSelect={onSelect} depth={depth} /> : (
        <li key={entry.path}>
          <button type="button" onClick={() => onSelect(entry.path)} disabled={entry.kind !== "file"} aria-label={`View ${entry.path}`} aria-current={selected === entry.path ? "true" : undefined} className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors disabled:cursor-default disabled:text-muted ${selected === entry.path ? "bg-bg-sunk text-link" : "text-ink-2 enabled:hover:bg-bg-sunk"}`} style={{ paddingLeft: 18 + Math.min(depth, 7) * 12 }}>
            <FileIcon /><span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{entry.name}<span className="mt-0.5 block text-[10px] text-muted">{entry.kind === "file" ? entry.bytes === null ? "File" : bytes(entry.bytes) : entry.kind === "link" ? "Link, not followed" : "Special file"}</span></span>
          </button>
        </li>
      ))}
    </ul>}
    {!loading && !error && listing?.total === 0 && <p className="px-3 py-4 text-[12px] text-muted">{path ? "This folder is empty." : "No activity files yet. Your next visit will appear here."}</p>}
    {loading && <p role="status" className="px-3 py-3 text-[12px] text-muted">Loading files…</p>}
    {error && <div className="px-3 py-3"><p role="alert" className="text-[12px] text-muted">{error}</p><button type="button" onClick={() => void load()} className="mt-2 text-[12px] text-link hover:underline">Reload folder</button></div>}
    {!loading && !error && listing?.nextCursor != null && <button type="button" onClick={() => void load(listing.nextCursor!)} className="px-3 py-3 text-[12px] text-link hover:underline">Show more ({num(listing.total - listing.entries.length)} remaining)</button>}
  </div>;
}

type PagePosition = { cursor: number; state: JsonFormatState };

export function FileExplorer({ rootLabel, rootPath }: { rootLabel: string; rootPath: string }) {
  const [version, setVersion] = useState(0);
  const [treeOpen, setTreeOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<FileContents | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"formatted" | "raw">("formatted");
  const [previous, setPrevious] = useState<PagePosition[]>([]);
  const [format, setFormat] = useState(() => ({ text: "", start: initialJsonFormatState(), end: initialJsonFormatState() }));
  const [copied, setCopied] = useState("");
  const request = useRef<AbortController | null>(null);
  const viewer = useRef<HTMLElement | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function open(path: string, cursor = 0, back: PagePosition[] = [], keepView = false, state = initialJsonFormatState()) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSelected(path); setLoading(true); setError(""); setCopied(""); setFile(null);
    try {
      const data = await read<FileContents>("read", path, cursor, controller.signal);
      const formatted = !data.binary && data.format !== "text" ? formatJsonPage(data.content, state) : { text: data.content, state };
      setFormat({ text: formatted.text, start: state, end: formatted.state });
      setFile(data); setPrevious(back);
      if (!keepView) setView(data.binary || data.format === "text" ? "raw" : "formatted");
      if (window.matchMedia("(max-width: 767px)").matches || cursor > 0 || back.length) viewer.current?.scrollIntoView({ block: "start", behavior: "instant" });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This file could not be read.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopied(`${label} copied.`); }
    catch { setCopied("Copy is unavailable. You can select and copy the text below."); }
  }

  return <div className="mt-9 border-t border-line">
    <div className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0"><p className="[overflow-wrap:anywhere] font-mono text-[12px] text-ink-2">{rootLabel}</p><p className="mt-1 text-[12px] text-muted">Files on this machine · read only</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => void copy(rootPath, "Folder path")}>Copy folder path</button><button type="button" className={button} disabled={loading} onClick={() => { setVersion((n) => n + 1); if (selected) void open(selected, 0, [], true); }}>Refresh</button></div>
    </div>
    <p role="status" className="text-[12px] text-muted">{copied}</p>
    <button type="button" aria-expanded={treeOpen} aria-controls="activity-file-tree" onClick={() => setTreeOpen(!treeOpen)} className={`mt-3 md:hidden ${button}`}>{treeOpen ? "Hide folders" : "Browse folders & files"}</button>
    <div className="mt-3 grid min-w-0 gap-8 border-t border-line pt-5 md:grid-cols-[290px_minmax(0,1fr)] lg:grid-cols-[330px_minmax(0,1fr)] md:gap-7">
      <nav id="activity-file-tree" aria-label="Activity folders and files" className={`min-w-0 md:block md:border-r md:border-line md:pr-5 ${treeOpen ? "" : "hidden"}`}>
        <h2 className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Folders &amp; files</h2>
        <FolderContents key={version} path="" selected={selected} onSelect={(path) => { setTreeOpen(false); void open(path); }} />
      </nav>
      <section ref={viewer} aria-label="File contents" aria-busy={loading} className="min-w-0 scroll-mt-24 border-t border-line pt-6 md:border-t-0 md:pt-0">
        {loading && <p role="status" className="py-8 font-serif text-[18px] text-muted">Reading file…</p>}
        {error && <div className="rounded-xl border border-notice-line bg-notice p-5"><p role="alert" className="text-[14px] text-ink-2">{error}</p><button type="button" onClick={() => selected && void open(selected)} className="mt-3 text-[13px] text-link hover:underline">Try again</button></div>}
        {!file && !loading && !error && <div className="py-8 sm:py-14"><FileIcon folder open /><h2 className="mt-5 font-display text-[32px] text-ink">Every session has a folder</h2><p className="mt-3 max-w-[420px] font-serif text-[18px] leading-[1.65] text-ink-2">Open one on the left, then choose a file to see what it holds. Each app writes its own JSON Lines file, one event at a time.</p><p className="mt-5 max-w-[480px] [overflow-wrap:anywhere] font-mono text-[11px] text-muted">{rootPath}</p></div>}
        {file && <>
          <p className="[overflow-wrap:anywhere] font-mono text-[11px] text-muted">{file.path}</p>
          <h2 className="mt-2 [overflow-wrap:anywhere] font-display text-[32px] leading-tight text-ink">{file.name}</h2>
          <p className="mt-2 text-[12px] text-muted">{bytes(file.bytes)} · {file.binary ? "Binary" : file.format === "jsonl" ? "JSON Lines" : file.format === "json" ? "JSON" : "Text"}{file.modified && <> · Modified <time dateTime={file.modified}>{new Date(file.modified).toLocaleString()}</time></>}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div role="group" aria-label="Content view" className="flex gap-1 rounded-full bg-bg-sunk p-1">
              {(["formatted", "raw"] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`rounded-full px-4 py-1.5 text-[12px] ${view === mode ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-muted hover:text-ink"}`}>{mode === "formatted" ? "Formatted" : "Raw"}</button>)}
            </div>
            <button type="button" onClick={() => void copy(file.content, file.complete ? "Raw content" : "Page content")} className={button}>{file.complete ? "Copy raw" : "Copy page"}</button>
          </div>
          {file.notice && <p className="mt-4 rounded-lg border border-notice-line bg-notice px-3 py-2 text-[12px] leading-relaxed text-ink-2">{file.notice}</p>}
          {!file.complete && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted"><span>Page {previous.length + 1} · starts at byte {num(file.cursor + 1)}</span><div className="flex gap-2"><button type="button" disabled={!previous.length} className={button} onClick={() => { const page = previous.at(-1)!; void open(file.path, page.cursor, previous.slice(0, -1), true, page.state); }}>Previous</button><button type="button" disabled={file.nextCursor === null} className={button} onClick={() => void open(file.path, file.nextCursor!, [...previous, { cursor: file.cursor, state: format.start }], true, format.end)}>Next</button></div></div>}
          <div className="mt-5 min-w-0 rounded-xl border border-line bg-surface/60 p-4 sm:p-5">
            {view === "raw" ? <pre aria-label="Raw file content" className="whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-[12px] leading-[1.85] text-ink-2">{file.content || "This file is empty."}</pre> : <JsonContent key={`${file.path}:${file.cursor}:${file.modified}`} file={file} continuedText={format.text} />}
          </div>
        </>}
      </section>
    </div>
  </div>;
}
