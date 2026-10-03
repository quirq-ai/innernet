import Link from "next/link";
import { BrandLogoImage } from "@/components/wordmark";
import { getUiConfig, uiText } from "@/lib/ui-config";
import { formatUiTemplate } from "@/lib/ui-config-shared";

/** The configured local artwork as the way home, preserving its proportions. */
export function BrandHome({ size = 28 }: { size?: number }) {
  const config = getUiConfig();
  if (!config.brand.headerLogo) return null;
  return (
    <Link href="/" aria-label={uiText("homeLink", {}, config)} className="inline-flex max-w-16 shrink-0 items-center rounded-[9px] transition-opacity hover:opacity-80" style={{ fontSize: size }}>
      <BrandLogoImage logo={config.brand.headerLogo} />
    </Link>
  );
}

/** Ordinary links, with local branding assets and no browser fetches. */
export function BrandLinks({ className = "", guide = true }: { className?: string; guide?: boolean }) {
  const config = getUiConfig();
  const { attribution, sourceLink, showPublisherLink } = config.brand;
  const publisher = showPublisherLink && attribution.logo;
  if (!guide && !publisher && !sourceLink.enabled) return null;
  return (
    <nav aria-label={uiText("brand.linksLabel", {}, config)} className={`flex items-center gap-1 ${className}`}>
      {guide && (
        <Link href="/guide" className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-ink hover:text-ink">
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5.5c3-1.4 6-1.4 9 0v14c-3-1.4-6-1.4-9 0Z" />
            <path d="M12 5.5c3-1.4 6-1.4 9 0v14c-3-1.4-6-1.4-9 0" />
          </svg>
          {formatUiTemplate(config.navigation.labels.guide, config)}
        </Link>
      )}
      {publisher && (
        <a href={attribution.href} target="_blank" rel="noopener noreferrer" aria-label={attribution.name} className="hidden rounded-full px-2.5 py-1.5 transition-opacity hover:opacity-75 md:block">
          <img src={publisher.src} alt={publisher.alt} width={publisher.width} height={publisher.height} className="h-5 w-auto max-w-20 object-contain" />
        </a>
      )}
      {sourceLink.enabled && (
        <a href={sourceLink.href} target="_blank" rel="noopener noreferrer" aria-label={formatUiTemplate(sourceLink.label, config)} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-bg-sunk hover:text-ink">
          <svg aria-hidden width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
      )}
    </nav>
  );
}
