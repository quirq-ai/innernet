import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SourcesSettings } from "@/components/sources-settings";
import { TopBar } from "@/components/top-bar";
import { DEMO } from "@/lib/mode";

export const metadata: Metadata = {
  title: "Sources",
  description: "Choose your local and GitHub sources, sync their pages, and find where Innernet keeps your data.",
};

export const dynamic = "force-dynamic";

export default function SourcesPage() {
  if (DEMO) notFound();

  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar />
      <main id="content" tabIndex={-1} className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-20 pt-10 focus:outline-none sm:px-6 sm:pt-14">
        <header className="mb-10">
          <h1 className="font-display text-[52px] leading-none tracking-[-0.02em] text-ink sm:text-[64px]">Sources</h1>
          <p className="mt-4 font-serif text-[18px] leading-relaxed text-ink-2">Choose what Innernet knows, and see where it keeps your data.</p>
          <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
            <a href="#choose-sources" className="link">Choose sources</a>
            <a href="#storage" className="link">Where your data lives</a>
          </nav>
        </header>
        <SourcesSettings />
      </main>
      <SiteFooter links={[{ href: "/", label: "Search" }, { href: "/wiki", label: "Innerpedia" }, { href: "/activity", label: "History" }, { href: "/#guide", label: "Field guide" }]} />
    </div>
  );
}
