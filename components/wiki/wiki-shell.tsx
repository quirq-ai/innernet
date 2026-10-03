import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { getNavigation } from "@/lib/ui-navigation";

export function WikiShell({ children, q = "" }: { children: React.ReactNode; q?: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar variant="wiki" q={q} />
      <div id="content" tabIndex={-1} className="mx-auto w-full max-w-[var(--ui-max-width)] flex-1 px-4 pb-24 pt-8 focus:outline-none sm:px-6">{children}</div>
      <SiteFooter links={getNavigation("wiki")} />
    </div>
  );
}
