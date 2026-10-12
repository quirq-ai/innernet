"use client";

import { useMemo, useState } from "react";
import type { FileContents } from "@/lib/activity-files-types";

const code = "whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-[12px] leading-[1.8] text-ink-2";

/** Render data as text and React nodes only, including malformed JSON and HTML-like strings. */
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const [visible, setVisible] = useState(100);
  if (value === null || typeof value !== "object") {
    return <span className={`[overflow-wrap:anywhere] ${typeof value === "string" ? "text-ink-2" : "text-link"}`}>{JSON.stringify(value)}</span>;
  }
  const array = Array.isArray(value);
  const entries = Object.entries(value);
  if (!entries.length) return <span className="text-muted">{array ? "[]" : "{}"}</span>;
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="min-w-0">
      <summary className="cursor-pointer text-muted hover:text-ink">
        {array ? "Array" : "Object"} <span className="text-faint">·</span> {entries.length.toLocaleString("en-US")} {array ? "items" : "fields"}
      </summary>
      {open && (
        <div className={`mt-1 space-y-1 border-l border-line ${depth < 6 ? "ml-1 pl-3" : "pl-1"}`}>
          {entries.slice(0, visible).map(([key, child]) => (
            <div key={key} className="min-w-0">
              <span className="[overflow-wrap:anywhere] text-ink">{array ? `[${key}]` : JSON.stringify(key)}</span>
              <span className="text-muted">: </span>
              <JsonValue value={child} depth={depth + 1} />
            </div>
          ))}
          {entries.length > visible && (
            <button type="button" onClick={() => setVisible((count) => count + 100)} className="py-1 text-link hover:underline">Show more ({entries.length - visible} remaining)</button>
          )}
        </div>
      )}
    </details>
  );
}

function parse(text: string): { value: unknown; error?: never } | { error: string; value?: never } {
  try { return { value: JSON.parse(text) }; }
  catch { return { error: "This is not valid JSON. The original text is shown below." }; }
}

export function JsonContent({ file, continuedText }: { file: FileContents; continuedText: string }) {
  const [visible, setVisible] = useState(100);
  const parsed = useMemo(() => {
    if (file.binary || file.format === "text" || (file.format === "json" && !file.complete) || file.partialLine) return null;
    if (file.format === "json") return [{ line: 1, raw: file.content }];
    return file.content.split(/\r?\n/).flatMap((raw, index) => raw.trim() ? [{ line: index + 1, raw }] : []);
  }, [file]);

  if (!file.binary && ((file.format === "json" && !file.complete) || file.partialLine)) return <pre aria-label="Formatted JSON content" className={code}>{continuedText}</pre>;
  if (!parsed) return <p className="text-[14px] leading-relaxed text-muted">{file.binary ? "This file contains binary data. Choose Raw to inspect its bytes." : file.format === "json" ? "This JSON file spans multiple pages. Choose Raw to read each part." : "This is a text file. Choose Raw to read its contents."}</p>;
  if (!parsed.length || !file.content.trim()) return <p className="text-[14px] text-muted">This file has no JSON records yet.</p>;
  return (
    <div className="space-y-6">
      {parsed.slice(0, visible).map((source) => { const item = { ...source, ...parse(source.raw) }; return (
        <section key={item.line} aria-label={file.format === "jsonl" ? `Line ${item.line} on this page` : "JSON document"}>
          {file.format === "jsonl" && <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Line {item.line}{file.complete ? "" : " on this page"}</h3>}
          {item.error ? (
            <div className="rounded-lg border border-notice-line bg-notice p-3">
              <p className="mb-2 text-[13px] text-ink-2">{item.error}</p>
              <pre className={code}>{item.raw}</pre>
            </div>
          ) : <div className="font-mono text-[12px] leading-[1.9]"><JsonValue value={item.value} /></div>}
        </section>
      ); })}
      {parsed.length > visible && <button type="button" onClick={() => setVisible((count) => count + 100)} className="text-[13px] text-link hover:underline">Show more records ({(parsed.length - visible).toLocaleString("en-US")} remaining on this page)</button>}
    </div>
  );
}
