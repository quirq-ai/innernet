import Link from "next/link";
import { BrandCredit } from "@/components/quirq-credit";
import { getIndex } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { getUiConfig, uiText } from "@/lib/ui-config";

export interface FooterLink { href: string; label: string; prefetch?: boolean; }

export function SiteFooter({ links }: { links: FooterLink[] }) {
  const { index, missing } = getIndex();
  const config = getUiConfig();
  const roots = index.meta.roots.map((r) => r.label).join(", ");
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[var(--ui-max-width)] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-[12.5px] text-muted sm:px-6">
        <nav aria-label={uiText("moreNavigation", {}, config)} className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => <Link key={link.href} href={link.href} prefetch={link.prefetch} className="-my-2 py-2 transition-colors hover:text-ink">{link.label}</Link>)}
        </nav>
        <p className="max-sm:basis-full sm:ml-auto">
          {missing ? uiText("nothingIndexed", {}, config) : uiText("indexedFrom", { age: timeAgo(index.meta.generatedAt), roots }, config)}
          <span aria-hidden className="px-2 text-faint max-sm:hidden">·</span>
          <span className="whitespace-nowrap max-sm:mt-2 max-sm:block">{uiText(missing ? "buildWith" : "refreshWith", {}, config)} <code className="rounded-md bg-bg-sunk px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2">pnpm index</code></span>
        </p>
        <div className="basis-full text-center sm:text-right"><BrandCredit /></div>
      </div>
    </footer>
  );
}
