import "server-only";
import { uiThemeVariables, type UiConfig } from "./ui-config-shared";


function declarations(values: Record<string, string>) {
  return Object.entries(values).map(([key, value]) => `${key}:${value};`).join("");
}

export function uiStyleSheet(config: UiConfig) {
  const light = declarations(uiThemeVariables(config, "light"));
  const dark = declarations(uiThemeVariables(config, "dark"));
  const layout = `--ui-max-width:${config.layout.maxWidth}px;--ui-search-width:${config.layout.searchWidth}px;--ui-article-width:${config.layout.articleWidth}px;`;
  return `:root{${light}${layout}color-scheme:light;}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}color-scheme:dark;}}:root[data-theme="dark"]{${dark}color-scheme:dark;}:root[data-theme="light"]{${light}color-scheme:light;}`;
}
