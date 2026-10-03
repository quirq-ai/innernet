"use client";

import { useEffect, useState } from "react";
import { SessionList } from "./session-list";
import { APP, toSession, validEvent, type Session } from "./shared";
import { ThisTab } from "./this-tab";
import { clearBrowserHistory, readBrowserHistory } from "./trail";

// The demo's history: the same sessions and events a local Innernet writes to disk,
// read from this browser's localStorage, where the recorder keeps them. Nothing here
// was ever sent to the server.

export function BrowserHistory() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const load = () => {
      const saved = readBrowserHistory();
      const list = Object.entries(saved)
        .map(([id, events]) => toSession(id, events.filter(validEvent).map((e) => ({ ...e, app: APP }))))
        .filter((s) => s.total > 0)
        .sort((a, b) => (a.id < b.id ? 1 : -1));
      setSessions(list);
      setNow(Date.now());
    };
    load();
    // The recorder writes this page's own visit a moment after it loads.
    const again = setTimeout(load, 1800);
    return () => clearTimeout(again);
  }, []);

  if (!sessions) return <div className="h-40" aria-hidden />;

  return (
    <div>
      {sessions.length ? (
        <>
          <SessionList sessions={sessions} now={now} />
          <ThisTab />
          <p className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
            <span>Kept in this browser only.</span>
            <button
              type="button"
              onClick={() => {
                clearBrowserHistory();
                setSessions([]);
              }}
              className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
            >
              Clear this browser’s history
            </button>
          </p>
        </>
      ) : (
        <p className="font-serif text-[18px] leading-[1.6] text-ink-2">Nothing yet. Open a few pages and they will appear here, kept in this browser alone.</p>
      )}
    </div>
  );
}
