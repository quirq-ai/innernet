import "server-only";

import { getUiConfig, uiText } from "@/lib/ui-config";
import type { UiConfig } from "@/lib/ui-config-shared";
import type { SearchBoxLabels, SearchBoxSettings } from "@/components/search-box";
import type { Tab } from "@/lib/search";

// Resolve only the search box's settings and labels before crossing into the browser.
export function getSearchBoxProps(config: UiConfig = getUiConfig()) {
  const settings: SearchBoxSettings = {
    suggestions: config.search.suggestions,
    debounceMs: config.search.debounceMs,
    focusShortcut: config.search.focusShortcut,
  };
  const labels: SearchBoxLabels = {
    search: uiText("search.label", undefined, config),
    clear: uiText("search.clear", undefined, config),
    suggestions: uiText("search.suggestionsLabel", undefined, config),
    everything: uiText("search.everything", { query: "{query}" }, config),
    kinds: {
      repo: uiText("search.kind.repo", undefined, config),
      project: uiText("search.kind.project", undefined, config),
      docs: uiText("search.kind.docs", undefined, config),
      assets: uiText("search.kind.assets", undefined, config),
      code: uiText("search.kind.code", undefined, config),
      folder: uiText("search.kind.folder", undefined, config),
    },
  };
  return { settings, labels, placeholder: uiText("search.placeholder", undefined, config) };
}

export function getSearchTabs(config: UiConfig = getUiConfig()): { id: Tab; label: string }[] {
  return config.search.tabs.map((id) => ({ id, label: uiText(`search.tab.${id}`, undefined, config) }));
}
