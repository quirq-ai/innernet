import Link from "next/link";
import { BrandCredit } from "@/components/quirq-credit";
import { ThemeToggle } from "@/components/theme-toggle";
import { timeAgo } from "@/lib/format";
import type { IndexMeta } from "@/lib/types";

// Small print at the foot of the home page: the way into Innerpedia, how fresh the
// index is, and how to refresh it.

export function HomeFooter({ meta, missing }: { meta: IndexMeta; missing: boolean }) {
  const roots = meta.roots.map((r) => r.label).join(", ");
  return (
    <footer className="relative px-4 pb-5 pt-10 text-[12.5px] text-muted sm:px-6">
      {/* Three columns with equal outer tracks, so the middle line sits on the page's centre
          axis. Below lg there is not room for three, so the lines stack, centred. */}
      <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        <nav aria-label="Elsewhere" className="flex items-center gap-1 lg:-ml-3 lg:justify-self-start">
          <Link href="/wiki" className="rounded-full px-3 py-1.5 text-ink-2 transition-colors hover:bg-bg-sunk hover:text-ink">
            <span className="font-display text-[16px] leading-none tracking-[-0.01em]">
              <em>Inner</em>pedia
            </span>
          </Link>
          <Link href="/guide" className="rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-bg-sunk hover:text-ink">
            Field guide
          </Link>
        </nav>
        <p className="text-center">
          {missing ? (
            "Nothing indexed yet"
          ) : (
            <>
              Indexed <time dateTime={meta.generatedAt}>{timeAgo(meta.generatedAt)}</time> from{" "}
              <span className="font-mono text-[11.5px] text-ink-2">{roots}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2 lg:-mr-2 lg:justify-self-end">
          {!missing && (
            <span>
              Refresh with <code className="rounded-md bg-bg-sunk px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2">pnpm index</code>
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
      <p className="mt-3 text-center">
        <BrandCredit />
      </p>
    </footer>
  );
}
