import "server-only";
import { getUiConfig } from "./ui-config";
import { formatUiTemplate, type UiNavGroup } from "./ui-config-shared";
import { wikiHref } from "./links";

const ROUTES = {
  search: "/", wiki: "/wiki", guide: "/guide", random: wikiHref("Special:Random"),
  allPages: wikiHref("Special:AllPages"), categories: wikiHref("Special:Categories"), statistics: wikiHref("Special:Statistics"), top: "#top",
};

export function getNavigation(group: UiNavGroup) {
  const config = getUiConfig();
  return config.navigation[group].map((id) => ({
    href: ROUTES[id], label: formatUiTemplate(config.navigation.labels[id], config), prefetch: id === "random" ? false : undefined,
  }));
}
