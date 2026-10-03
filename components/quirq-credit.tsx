import { getUiConfig } from "@/lib/ui-config";

export function BrandCredit() {
  const { attribution } = getUiConfig().brand;
  if (!attribution.enabled || !attribution.logo) return null;
  const { logo } = attribution;
  return (
    <span className="inline-flex items-center justify-center gap-1.5 text-[12px] text-muted">
      {attribution.label}
      <a href={attribution.href} aria-label={attribution.name} className="inline-flex rounded-sm transition-opacity hover:opacity-75">
        <img src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} className="h-4 w-auto max-w-[120px] object-contain" />
      </a>
    </span>
  );
}
