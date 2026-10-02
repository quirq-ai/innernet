import Link from "next/link";
import { BrandCredit } from "@/components/quirq-credit";
import { getIndex } from "@/lib/data";
import { timeAgo } from "@/lib/format";

// Small print under results and Innerpedia pages: a few ways onward, how fresh the
// index is, and how to refresh it. Home has its own, centred version.

export interface FooterLink {
  href: string;
  label: string;
  prefetch?: boolean;
}

export function SiteFooter({ links }: { links: FooterLink[] }) {
  const { index, missing } = getIndex();
  const roots = index.meta.roots.map((r) => r.label).join(", ");
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-[12.5px] text-muted sm:px-6">
        <nav aria-label="More" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} prefetch={l.prefetch} className="-my-2 py-2 transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="max-sm:basis-full sm:ml-auto">
          {missing ? (
            "Nothing indexed yet"
          ) : (
            <>
              Indexed <time dateTime={index.meta.generatedAt}>{timeAgo(index.meta.generatedAt)}</time> from{" "}
              <span className="font-mono text-[11.5px] text-ink-2">{roots}</span>
            </>
          )}
          <span aria-hidden className="px-2 text-faint max-sm:hidden">
            ·
          </span>
          <span className="whitespace-nowrap max-sm:mt-2 max-sm:block">
            {missing ? "Build it" : "Refresh"} with <code className="rounded-md bg-bg-sunk px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2">pnpm index</code>
          </span>
        </p>
        <p className="basis-full text-center sm:text-right">
          <BrandCredit />
        </p>
      </div>
    </footer>
  );
}
