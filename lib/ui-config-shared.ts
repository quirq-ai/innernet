// Plain configuration types and formatters, safe to import in browser components.
export interface BrandLogo { src: string; alt: string; width: number; height: number }
export type UiMode = "system" | "light" | "dark";
export type UiStyle = "classic" | "editorial" | "cyberpunk" | "playful";
export type UiHomeLayout = "centered" | "editorial" | "console" | "bento";
export type UiFont = "instrument" | "newsreader" | "inter" | "jetbrains" | "system-serif" | "system-sans" | "system-mono";
export type UiTabId = "all" | "articles" | "repos" | "docs" | "folders";
export type UiNavId = "search" | "wiki" | "guide" | "random" | "allPages" | "categories" | "statistics" | "top";
export type UiNavGroup = "home" | "search" | "wiki" | "guide" | "headerSearch" | "headerWiki";
export type UiArticleSection = "overview" | "structure" | "technology" | "history" | "see-also" | "external-links";
export type UiMainSection = "welcome" | "featured" | "news" | "did-you-know" | "on-this-day" | "browse" | "areas";
export interface UiShadow { x: number; y: number; blur: number; spread: number; color: string }
export type UiColorToken = "bg" | "bg-sunk" | "surface" | "ink" | "ink-2" | "muted" | "faint" | "line" | "line-strong" | "link" | "link-hover" | "visited" | "mark-bg" | "mark-ink" | "notice-bg" | "notice-line" | "good" | "ring" | "aurora-1" | "aurora-2" | "aurora-3";
export type UiPalette = Record<UiColorToken, string> & {
  "aurora-opacity": number; "shadow-sm": UiShadow[]; shadow: UiShadow[]; "shadow-lg": UiShadow[];
};
export interface UiConfig {
  $schema: string;
  version: 1;
  brand: {
    name: string; encyclopediaName: string; tagline: string; description: string;
    language: string; creator: string; logo: BrandLogo | null; encyclopediaLogo: BrandLogo | null;
    icon: string; appleIcon: string; italicPrefix: string; encyclopediaItalicPrefix: string;
    headerLogo: BrandLogo | null; showPublisherLink: boolean;
    sourceLink: { enabled: boolean; label: string; href: string };
    attribution: { enabled: boolean; label: string; name: string; href: string; logo: BrandLogo | null };
  };
  theme: {
    style: UiStyle; defaultMode: UiMode; allowToggle: boolean; light: UiPalette; dark: UiPalette;
    fonts: { display: UiFont; serif: UiFont; sans: UiFont; mono: UiFont };
    effects: { aurora: boolean; grain: boolean; motion: boolean };
  };
  layout: { maxWidth: number; searchWidth: number; articleWidth: number; density: "comfortable" | "compact" };
  navigation: Record<UiNavGroup, UiNavId[]> & { labels: Record<UiNavId, string> };
  home: {
    layout: UiHomeLayout; showCounts: boolean; showExamples: boolean; exampleQueries: string[]; showRecent: boolean;
    recentLimit: number; showCurious: boolean; autoFocus: boolean;
  };
  search: {
    suggestions: boolean; suggestionLimit: number; debounceMs: number; focusShortcut: boolean;
    perPage: number; showKnowledgePanel: boolean; tabs: UiTabId[];
  };
  wiki: { showContents: boolean; showInfobox: boolean; articleSections: UiArticleSection[]; mainSections: UiMainSection[] };
  guide: { showRecipe: boolean };
  copy: Record<string, string>;
}
export type UiTextValues = Record<string, string | number>;

/** Plain interpolation; it never interprets HTML, code or CSS. */
export function formatUiTemplate(template: string, config: UiConfig, values: UiTextValues = {}): string {
  const tokens: UiTextValues = {
    app: config.brand.name, wiki: config.brand.encyclopediaName,
    publisher: config.brand.attribution.name, tagline: config.brand.tagline, ...values,
  };
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) =>
    Object.hasOwn(tokens, key) ? String(tokens[key]) : match,
  );
}
export function formatUiText(config: UiConfig, key: string, values: UiTextValues = {}): string {
  const template = config.copy[key];
  if (typeof template !== "string") throw new Error(`Unknown UI copy key: ${key}`);
  return formatUiTemplate(template, config, values);
}
const FONT_VALUES: Record<UiFont, string> = {
  instrument: 'var(--font-instrument), "Iowan Old Style", Georgia, serif',
  newsreader: 'var(--font-newsreader), "Iowan Old Style", Georgia, serif',
  inter: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  jetbrains: 'var(--font-jetbrains), ui-monospace, "SF Mono", Menlo, monospace',
  "system-serif": '"Iowan Old Style", Georgia, serif',
  "system-sans": "ui-sans-serif, system-ui, sans-serif",
  "system-mono": 'ui-monospace, "SF Mono", Menlo, monospace',
};
/** Converts validated values into the existing CSS variables. */
export function uiThemeVariables(config: UiConfig, mode: "light" | "dark"): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [token, value] of Object.entries(config.theme[mode])) {
    result[`--${token}`] = Array.isArray(value)
      ? value.map((s) => `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`).join(", ")
      : String(value);
  }
  for (const [role, font] of Object.entries(config.theme.fonts)) result[`--ui-font-${role}`] = FONT_VALUES[font];
  return result;
}
