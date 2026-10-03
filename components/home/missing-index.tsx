// Shown in place of the search box before the first `pnpm index`: plain words, one command.

export function MissingIndex() {
  return (
    <div className="rise w-full max-w-[460px] rounded-2xl border border-line bg-surface/80 p-6 text-center shadow-soft backdrop-blur-sm" style={{ animationDelay: "120ms" }}>
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted">{uiText("home.missingTitle")}</h2>
      <p className="mx-auto mt-3 max-w-[340px] text-balance font-serif text-[17px] leading-[1.55] text-ink-2">
        {uiText(DEMO ? "demo.missingDescription" : "home.missingDescription")}
      </p>
      <code className="mt-5 inline-flex items-center gap-2.5 rounded-xl border border-line bg-bg-sunk px-4 py-2.5 font-mono text-[14px] text-ink">
        <span aria-hidden className="select-none text-faint">$</span>{INDEX_COMMAND}
      </code>
      <p className="mt-4 text-[12.5px] text-muted">
        {uiText(DEMO ? "demo.missingRoots" : "home.missingRoots", { org: DEMO_ORG })}
      </p>
    </div>
  );
}
import { DEMO, DEMO_ORG, INDEX_COMMAND } from "@/lib/mode";
import { uiText } from "@/lib/ui-config";
