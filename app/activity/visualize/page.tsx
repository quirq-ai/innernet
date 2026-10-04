import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileExplorer } from "@/components/activity/file-explorer";
import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { HISTORY_DIR, historyLabel } from "@/lib/activity";
import { DEMO } from "@/lib/mode";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Activity files",
  description: "Browse the folders and files behind your activity, as raw text and structured JSON.",
};

export default function VisualizeActivityPage() {
  if (DEMO) notFound();
  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar />
      <main id="content" tabIndex={-1} className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-24 pt-10 focus:outline-none sm:px-6 sm:pt-14">
        <Link href="/activity" className="text-[13px] text-link hover:underline">← Activity</Link>
        <header className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Inside your history</p>
          <h1 className="mt-3 font-display text-[48px] leading-none tracking-[-0.02em] text-ink sm:text-[60px]">Activity files</h1>
          <p className="mt-4 max-w-[660px] font-serif text-[19px] leading-[1.6] text-ink-2">
            Open a session folder to see the files behind it. Read the original text, or explore the fields and values in each JSON record.
          </p>
        </header>
        <FileExplorer rootLabel={historyLabel()} rootPath={HISTORY_DIR} />
      </main>
      <SiteFooter links={[{ href: "/activity", label: "History" }, { href: "/sources", label: "Sources" }, { href: "/", label: "Search" }]} />
    </div>
  );
}
