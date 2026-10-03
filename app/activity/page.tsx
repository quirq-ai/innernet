import type { Metadata } from "next";
import { BrowserHistory } from "@/components/activity/browser-history";
import { FormatNotes } from "@/components/activity/format-notes";
import { SessionList } from "@/components/activity/session-list";
import { newSessionId, type Session } from "@/components/activity/shared";
import { ThisTab } from "@/components/activity/this-tab";
import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { HISTORY_DIR, historyLabel, listSessions } from "@/lib/activity";
import { num } from "@/lib/format";
import { wikiHref } from "@/lib/links";
import { DEMO } from "@/lib/mode";

// The history: every session of browsing, newest first, each opening onto its events
// merged across the apps that wrote to it. On this machine it is read from the files in
// the history folder on every request. On the demo the server holds nothing, so the
// list is drawn in the browser from its own localStorage.

export const metadata: Metadata = {
  title: "History",
  description: DEMO ? "What you have opened on this demo, kept in your browser alone." : "Every page opened in Innernet, kept as plain JSON Lines files on this machine.",
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/wiki", label: "Innerpedia" },
  { href: wikiHref("Special:Random"), label: "Random article", prefetch: false },
  { href: "/#guide", label: "Field guide" },
];

const AURORA_MASK = "radial-gradient(ellipse min(620px, 100vw) 300px at 18% 0%, #000 10%, transparent 100%)";

export default function ActivityPage() {
  const { sessions, older } = DEMO ? { sessions: [], older: 0 } : listSessions();
  const total = sessions.length + older;
  const now = Date.now();
  const events = sessions.reduce((n, s) => n + s.total, 0);
  const apps = new Set(sessions.flatMap((s) => s.apps));
  const example = sessions[0]?.id ?? newSessionId(new Date(now));

  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar />
      <main id="content" tabIndex={-1} className="relative isolate flex-1 overflow-x-clip focus:outline-none">
        <div className="aurora" aria-hidden style={{ maskImage: AURORA_MASK, WebkitMaskImage: AURORA_MASK, opacity: "calc(var(--aurora-opacity) * 0.7)" }}>
          <span />
          <span />
          <span />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-16 xl:gap-24">
          <div className="min-w-0 max-w-[780px]">
            <header>
              <p className="rise text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{DEMO ? "Your visit to the demo" : "Your activity"}</p>
              <h1 className="rise mt-3 font-display text-[52px] leading-[0.98] tracking-[-0.02em] text-ink sm:text-[64px]" style={{ animationDelay: "40ms" }}>
                History
              </h1>
              <p className="rise mt-4 max-w-[560px] font-serif text-[18px] leading-[1.6] text-ink-2 sm:text-[19px]" style={{ animationDelay: "80ms" }}>
                {DEMO ? (
                  <>
                    Every page you open here, kept in <em>this browser</em> and nowhere else. The demo sends nothing to its server and stores nothing on it.
                  </>
                ) : (
                  <>
                    Every page you open in Innernet, written down as you go, in plain files at{" "}
                    <span className="whitespace-nowrap font-mono text-[14px] text-ink">{historyLabel()}</span>.
                  </>
                )}
              </p>

              {!DEMO && sessions.length > 0 && (
                <div className="rise mt-9 flex flex-wrap items-end gap-x-10 gap-y-6" style={{ animationDelay: "120ms" }}>
                  <dl className="flex gap-x-10">
                    <Stat n={total} label={total === 1 ? "session" : "sessions"} />
                    <Stat n={events} label={events === 1 ? "event" : "events"} note={older ? `in the newest ${sessions.length}` : undefined} />
                    <Stat n={apps.size} label={apps.size === 1 ? "app" : "apps"} />
                  </dl>
                  <Fortnight sessions={sessions} now={now} />
                </div>
              )}
            </header>

            <div className="mt-12 sm:mt-14">
              {DEMO ? (
                <BrowserHistory />
              ) : sessions.length ? (
                <>
                  <SessionList sessions={sessions} now={now} />
                  <ThisTab />
                </>
              ) : (
                <div className="rounded-2xl border border-line bg-surface/70 px-6 py-8 shadow-[var(--shadow-sm)]">
                  <p className="font-display text-[28px] leading-tight text-ink">Nothing written yet</p>
                  <p className="mt-2 max-w-[520px] font-serif text-[17px] leading-[1.6] text-ink-2">
                    From your next page on, each one you open lands in <span className="font-mono text-[13.5px]">{historyLabel()}</span>, a folder per tab. Come back here to retrace your
                    steps.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside aria-label="About the history" className="mt-16 border-t border-line pt-10 lg:mt-[10px] lg:border-t-0 lg:pt-0">
            <div className="lg:sticky lg:top-24">
              <FormatNotes dir={DEMO ? "~/.innernet/history" : historyLabel(HISTORY_DIR)} session={example} demo={DEMO} />
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter links={LINKS} />
    </div>
  );
}

function Stat({ n, label, note }: { n: number; label: string; note?: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1.5 text-[12.5px] text-muted">
        {label}
        {note && <span className="text-faint"> {note}</span>}
      </dt>
      <dd className="font-display text-[44px] leading-none tracking-[-0.01em] text-ink tabular-nums">{num(n)}</dd>
    </div>
  );
}

/** Events per day over the last fourteen days, as a row of quiet bars. */
function Fortnight({ sessions, now }: { sessions: Session[]; now: number }) {
  const days = 14;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const counts = new Array<number>(days).fill(0);
  for (const s of sessions)
    for (const e of s.events) {
      const i = Math.floor((Date.parse(e.at) - start.getTime()) / 864e5);
      if (i >= 0 && i < days) counts[i]++;
    }
  const max = Math.max(1, ...counts);
  const active = counts.filter(Boolean).length;
  return (
    <figure className="flex flex-col">
      <div role="img" aria-label={`Activity on ${active} of the last ${days} days`} className="flex h-[44px] items-end gap-[3px]">
        {counts.map((c, i) => (
          <span
            key={i}
            className={`w-[7px] rounded-[2px] ${c ? (i === days - 1 ? "bg-ink" : "bg-ink-2/55") : "bg-line-strong"}`}
            style={{ height: c ? `${Math.max(6, Math.round((c / max) * 44))}px` : "3px" }}
          />
        ))}
      </div>
      <figcaption className="mt-1.5 text-[12.5px] text-muted">last two weeks</figcaption>
    </figure>
  );
}
