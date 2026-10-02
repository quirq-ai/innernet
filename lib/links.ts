// URL builders. Slugs can hold spaces, parentheses, commas and other characters,
// so every link goes through here.

export const wikiHref = (slug: string) => `/wiki/${encodeURIComponent(slug)}`;

export const categoryHref = (name: string) => `/wiki/${encodeURIComponent(`Category:${name.replace(/ /g, "_")}`)}`;

export const searchHref = (q: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams({ q });
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "" && !(k === "p" && v === 1)) params.set(k, String(v));
  return `/search?${params.toString()}`;
};

/** Opens the folder in VS Code. Handled entirely by the OS; no request leaves the browser. */
export const vscodeHref = (absPath: string) => `vscode://file${encodeURI(absPath)}`;
