import { DEMO_ORG, DEMO_ORG_URL, DEMO_REPO_URL } from "@/lib/mode";
import { uiText } from "@/lib/ui-config";

// The one line every page of the demo opens with: what this is, whose folders these
// are, and where to get an Innernet of your own. Only rendered in the demo (lib/mode.ts).

/** Its height, which pages that fill the window subtract (see app/layout.tsx). */
export const DEMO_BAR = "36px";

export function DemoBanner() {
  const org = DEMO_ORG_URL.replace(/^https:\/\//, "");
  return (
    <aside aria-label={uiText("demo.bannerLabel")} className="relative z-50 border-b border-line bg-bg-sunk text-[12.5px] text-muted" style={{ height: DEMO_BAR }}>
      <div className="mx-auto flex h-full max-w-[var(--ui-max-width)] items-center justify-center gap-2.5 whitespace-nowrap px-4 sm:px-6">
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden className="size-[7px] rounded-full" style={{ background: "linear-gradient(135deg, var(--aurora-1), var(--aurora-2) 55%, var(--aurora-3))" }} />
          <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-2">{uiText("demo.badge")}</span>
        </span>
        <span aria-hidden className="text-faint">
          ·
        </span>
        <span className="min-w-0 truncate">
          <span className="hidden sm:inline">{uiText("demo.publicRepos")} </span>
          <span className="sm:hidden">{uiText("demo.publicReposShort")} </span>
          <a
            href={DEMO_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-2 decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            <span className="hidden font-mono text-[11.5px] sm:inline">{org}</span>
            <span className="sm:hidden">{DEMO_ORG}</span>
          </a>
        </span>
        <span aria-hidden className="text-faint">
          ·
        </span>
        <a href={DEMO_REPO_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 text-link transition-colors hover:text-link-hover hover:underline hover:underline-offset-4">
          <span className="hidden sm:inline">{uiText("demo.runOwn")}</span>
          <span className="sm:hidden">{uiText("demo.runOwnShort")}</span>
        </a>
      </div>
    </aside>
  );
}
