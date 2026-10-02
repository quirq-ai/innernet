"use client";

import { useEffect, useState } from "react";

// Copies a command to the clipboard. localhost is a secure context, so the async
// clipboard works; if it is refused, the button says so and the text stays selectable.

export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  }

  const label = state === "done" ? "Copied" : state === "failed" ? "Select and copy" : "Copy";
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={state === "idle" ? "Copy command" : label}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[11.5px] text-muted shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong hover:text-ink ${className}`}
    >
      <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {state === "done" ? (
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
            <path d="M10.5 5.5V3.9c0-.8-.6-1.4-1.4-1.4H3.9c-.8 0-1.4.6-1.4 1.4v5.2c0 .8.6 1.4 1.4 1.4h1.6" />
          </>
        )}
      </svg>
      <span aria-live="polite">{label}</span>
    </button>
  );
}
