import Link from "next/link";
import { getUiConfig, uiText } from "@/lib/ui-config";
import type { BrandLogo } from "@/lib/ui-config-shared";

export function BrandLogoImage({ logo, className = "" }: { logo: BrandLogo; className?: string }) {
  return <img src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} className={`h-[1em] w-auto max-w-full object-contain ${className}`} />;
}

function Mark({ encyclopedia, size, href, className }: { encyclopedia: boolean; size: number | null; href: string | null; className: string }) {
  const config = getUiConfig();
  const { brand } = config;
  const name = encyclopedia ? brand.encyclopediaName : brand.name;
  const prefix = encyclopedia ? brand.encyclopediaItalicPrefix : brand.italicPrefix;
  const logo = encyclopedia ? brand.encyclopediaLogo : brand.logo;
  const emphasized = prefix && name.startsWith(prefix);
  const mark = (
    <span className={`inline-flex max-w-full items-center font-display tracking-[-0.01em] text-ink ${className}`} style={{ ...(size === null ? {} : { fontSize: size }), lineHeight: 1 }}>
      {logo ? <BrandLogoImage logo={logo} /> : emphasized ? <span className="min-w-0 [overflow-wrap:anywhere]"><em>{prefix}</em>{name.slice(prefix.length)}</span> : <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>}
    </span>
  );
  return href ? <Link href={href} aria-label={uiText(encyclopedia ? "wikiHomeLink" : "homeLink", {}, config)} className="inline-flex max-w-full items-center">{mark}</Link> : mark;
}

export function Wordmark({ size = 28, href = "/", className = "" }: { size?: number | null; href?: string | null; className?: string }) {
  return <Mark encyclopedia={false} size={size} href={href} className={className} />;
}

export function PediaMark({ size = 24, href = "/wiki", className = "" }: { size?: number | null; href?: string | null; className?: string }) {
  return <Mark encyclopedia size={size} href={href} className={className} />;
}
