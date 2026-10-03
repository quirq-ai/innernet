import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { getSearchBoxProps } from "@/components/search/search-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { PediaMark, Wordmark } from "@/components/wordmark";
import { getUiConfig, uiText } from "@/lib/ui-config";
import { getNavigation } from "@/lib/ui-navigation";
import { BrandHome, BrandLinks } from "@/components/brand-nav";

export function TopBar({ q = "", variant = "search" }: { q?: string; variant?: "search" | "wiki" }) {
  const config = getUiConfig();
  const links = getNavigation(variant === "wiki" ? "headerWiki" : "headerSearch");
  return (
    <header className="ui-topbar sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <a href="#content" className="sr-only rounded-full bg-surface text-[13.5px] text-ink shadow-lift focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:px-4 focus:py-2">
        {uiText("skipContent", {}, config)}
      </a>
      <div className="mx-auto flex h-16 max-w-[var(--ui-max-width)] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 max-w-[35%] shrink-0 items-center gap-3">
          <BrandHome />
          {config.brand.headerLogo && <span aria-hidden className="hidden h-6 w-px bg-line-strong sm:block" />}
          <div className={config.brand.headerLogo ? "hidden min-w-0 sm:block" : "min-w-0"}>{variant === "wiki" ? <PediaMark size={26} className="min-w-0 [&>span]:truncate" /> : <Wordmark size={27} className="min-w-0 [&>span]:truncate" />}</div>
        </div>
        <div className="min-w-0 max-w-[var(--ui-search-width)] flex-1">
          <SearchBox {...getSearchBoxProps(config)} defaultValue={q} placeholder={uiText(variant === "wiki" ? "search.wikiPlaceholder" : "search.placeholder", {}, config)} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 text-[13.5px]">
          <nav aria-label={uiText("siteNavigation", {}, config)} className="hidden max-w-[40vw] items-center overflow-x-auto whitespace-nowrap sm:flex">
            {links.filter((link) => link.href !== "/guide").map((link) => <Link key={link.href} href={link.href} prefetch={link.prefetch} className="block rounded-full px-3 py-1.5 text-muted hover:bg-bg-sunk hover:text-ink">{link.label}</Link>)}
          </nav>
          <BrandLinks guide={links.some((link) => link.href === "/guide")} />
          {config.theme.allowToggle && <ThemeToggle defaultMode={config.theme.defaultMode} labels={{ system: uiText("themeSystem", {}, config), light: uiText("themeLight", {}, config), dark: uiText("themeDark", {}, config) }} />}
        </div>
      </div>
    </header>
  );
}
