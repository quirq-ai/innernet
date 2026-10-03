// Run against the local app with the same UI configuration, demo mode and working
// directory. For a demo build, set INNERNET_DEMO=1 for this check as well.
// pnpm check:ui:routes -- http://localhost:3471
import assert from "node:assert/strict";
import http from "node:http";
import { getIndex } from "../lib/data";
import { search, suggest } from "../lib/search";
import { categoryHref, isRemote, searchHref, sourceHref, wikiHref } from "../lib/links";
import { DEMO, DEMO_ORG, DEMO_ORG_URL, DEMO_REPO_URL, INDEX_COMMAND } from "../lib/mode";
import { getUiConfig, uiText } from "../lib/ui-config";
import { formatUiTemplate, uiThemeVariables, type UiNavGroup, type UiNavId } from "../lib/ui-config-shared";

const base = new URL(process.argv.slice(2).find((argument) => argument !== "--") ?? "http://localhost:3470");
assert.ok(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Use a loopback HTTP URL");
assert.ok(!base.username && !base.password && base.pathname === "/" && !base.search && !base.hash, "Use only the app's origin");
const config = getUiConfig();
const loaded = getIndex();
let checks = 0;
function check(name: string, run: () => void) {
  run();
  checks++;
  console.log(`ok ${name}`);
}
function decode(value: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) =>
    entity.startsWith("#") ? String.fromCodePoint(Number.parseInt(entity.slice(entity[1] === "x" ? 2 : 1), entity[1] === "x" ? 16 : 10)) : entities[entity.toLowerCase()] ?? match,
  );
}
function clean(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}
// Next can return a 404 shell whose explanatory view travels in the React stream.
// Decode its JSON strings without executing any browser script.
function flightText(raw: string): string {
  const chunks: string[] = [];
  for (const script of raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const json = script[1].match(/self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/)?.[1];
    if (!json) continue;
    try {
      const payload: unknown = JSON.parse(json);
      if (Array.isArray(payload) && typeof payload[1] === "string") chunks.push(payload[1]);
    } catch { /* a browser bootstrap script, not a data chunk */ }
  }
  return chunks.join("");
}
function text(html: string): string {
  return decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}
function plain(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
function attr(tag: string, name: string): string | null {
  return decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "") || null;
}
function title(html: string): string {
  return text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}
function firstHeading(html: string): string {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const image = heading.match(/<img\b[^>]*>/i)?.[0];
  return image ? attr(image, "alt") ?? "" : text(heading);
}
function labelled(html: string, element: string, label: string): string | null {
  for (const match of html.matchAll(new RegExp(`<${element}\\b([^>]*)>([\\s\\S]*?)<\\/${element}>`, "gi"))) {
    if ((attr(match[1], "aria-label") ?? "") === label) return match[2];
  }
  return null;
}
function links(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({ href: attr(match[1], "href"), label: text(match[2]) }));
}
async function request(route: string, expectedStatus = 200) {
  const url = new URL(route, base);
  assert.equal(url.origin, base.origin, "Smoke checks stay on the same local origin");
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const raw = await response.text();
  const html = clean(raw);
  check(`${route} responds ${expectedStatus}`, () => assert.equal(response.status, expectedStatus));
  if (response.headers.get("content-type")?.includes("text/html")) {
    check(`${route} retains browser privacy headers`, () => {
      const csp = response.headers.get("content-security-policy") ?? "";
      for (const rule of ["default-src 'self'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "frame-ancestors 'none'"]) assert.ok(csp.includes(rule), rule);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    });
  }
  return { response, html, flight: flightText(raw) };
}
const routes: Record<UiNavId, string> = {
  search: "/", wiki: "/wiki", guide: "/guide", random: wikiHref("Special:Random"),
  allPages: wikiHref("Special:AllPages"), categories: wikiHref("Special:Categories"), statistics: wikiHref("Special:Statistics"), top: "#top",
};
function checkNavigation(html: string, group: UiNavGroup) {
  check(`${group} footer follows configured navigation`, () => {
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? "";
    const nav = labelled(footer, "nav", uiText("moreNavigation", {}, config));
    assert.notEqual(nav, null);
    assert.deepEqual(links(nav ?? ""), config.navigation[group].map((id) => ({ href: routes[id], label: formatUiTemplate(config.navigation.labels[id], config) })));
  });
}
function checkPublicPath(value: string, label: string) {
  const url = new URL(value);
  assert.equal(url.origin, new URL(DEMO_ORG_URL).origin, label);
  assert.ok(url.pathname === `/${DEMO_ORG}` || url.pathname.startsWith(`/${DEMO_ORG}/`), label);
  assert.ok(!url.username && !url.password, label);
}
function checkBrandHeader(html: string, view: string) {
  check(`${view} header identity and external links follow configuration`, () => {
    const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? "";
    if (config.brand.headerLogo) {
      const logo = config.brand.headerLogo;
      const image = [...header.matchAll(/<img\b[^>]*>/gi)].find((match) => attr(match[0], "src") === logo.src)?.[0] ?? "";
      assert.equal(attr(image, "width"), String(logo.width));
      assert.equal(attr(image, "height"), String(logo.height));
      assert.equal(attr(image, "alt"), logo.alt);
    }
    const external = labelled(header, "nav", uiText("brand.linksLabel", {}, config)) ?? "";
    const sourceLabel = formatUiTemplate(config.brand.sourceLink.label, config);
    const source = [...external.matchAll(/<a\b[^>]*>/gi)].find((match) => attr(match[0], "aria-label") === sourceLabel)?.[0];
    assert.equal(!!source, config.brand.sourceLink.enabled);
    if (source) assert.equal(attr(source, "href"), config.brand.sourceLink.href);
    const publisher = [...external.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].find((match) => attr(match[0], "aria-label") === config.brand.attribution.name);
    assert.equal(!!publisher, config.brand.showPublisherLink && !!config.brand.attribution.logo);
    if (publisher) {
      assert.equal(attr(publisher[0], "href"), config.brand.attribution.href);
      assert.ok([...publisher[1].matchAll(/<img\b[^>]*>/gi)].some((match) => attr(match[0], "src") === config.brand.attribution.logo!.src));
    }
  });
}

async function main() {
  console.log(`Mode: ${DEMO ? "public demo" : "local"}`);
  console.log(`Index state: ${loaded.missing ? "missing" : loaded.index.pages.length ? `${loaded.index.pages.length} folders` : "empty"}`);
  if (DEMO) check("demo selects only the committed public repository index", () => {
    assert.equal(loaded.missing, false);
    assert.ok(loaded.index.pages.length > 0);
    assert.ok(loaded.index.meta.roots.length > 0);
    for (const root of loaded.index.meta.roots) checkPublicPath(root.path, root.label);
    for (const page of loaded.index.pages) {
      assert.ok(isRemote(page.path), page.slug);
      checkPublicPath(page.path, page.slug);
      assert.ok(!page.path.startsWith("/"), page.slug);
    }
  });
  const home = await request("/");
  check("home metadata, identity and icons come from configuration", () => {
    assert.equal(title(home.html), uiText(DEMO ? "demo.homeTitle" : "home.title", { org: DEMO_ORG }, config));
    assert.equal(firstHeading(home.html), config.brand.logo?.alt ?? config.brand.name);
    const htmlTag = home.html.match(/<html\b[^>]*>/)?.[0] ?? "";
    assert.equal(attr(htmlTag, "lang"), config.brand.language);
    const description = [...home.html.matchAll(/<meta\b[^>]*>/gi)].find((match) => attr(match[0], "name") === "description")?.[0] ?? "";
    assert.equal(attr(description, "content"), DEMO ? uiText("demo.homeDescription", { org: DEMO_ORG }, config) : config.brand.description);
    for (const [rel, href] of [["icon", config.brand.icon], ["apple-touch-icon", config.brand.appleIcon]]) {
      assert.ok([...home.html.matchAll(/<link\b[^>]*>/gi)].some((m) => attr(m[0], "rel") === rel && attr(m[0], "href") === href));
    }
  });
  checkBrandHeader(home.html, "home");
  check("public demo identification and acquisition links match the running mode", () => {
    const banner = labelled(home.html, "aside", uiText("demo.bannerLabel", {}, config));
    assert.equal(banner !== null, DEMO);
    if (!DEMO) return;
    const content = text(banner ?? "");
    for (const key of ["demo.badge", "demo.publicRepos", "demo.publicReposShort", "demo.runOwn", "demo.runOwnShort"]) {
      assert.ok(content.includes(plain(uiText(key, {}, config))), key);
    }
    assert.ok(links(banner ?? "").some((link) => link.href === DEMO_ORG_URL));
    assert.ok(links(banner ?? "").some((link) => link.href === DEMO_REPO_URL));
  });
  check("server HTML includes both palettes, font choices and layout values", () => {
    const style = home.html.match(/<style\b[^>]*id="innernet-ui-theme"[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
    assert.ok(style.includes("@media(prefers-color-scheme:dark)"));
    for (const mode of ["light", "dark"] as const) {
      for (const [key, value] of Object.entries(uiThemeVariables(config, mode))) assert.ok(style.includes(`${key}:${value};`), `${mode} ${key}`);
    }
    for (const [key, value] of [["max-width", config.layout.maxWidth], ["search-width", config.layout.searchWidth], ["article-width", config.layout.articleWidth]]) assert.ok(style.includes(`--ui-${key}:${value}px;`));
    const tag = home.html.match(/<html\b[^>]*>/)?.[0] ?? "";
    assert.equal(attr(tag, "data-theme"), config.theme.defaultMode === "system" ? null : config.theme.defaultMode);
    for (const effect of ["aurora", "grain", "motion"] as const) assert.equal(attr(tag, `data-ui-${effect}`), config.theme.effects[effect] ? "on" : "off");
    assert.equal(attr(tag, "data-ui-density"), config.layout.density);
    assert.equal(attr(tag, "data-ui-style"), config.theme.style);
  });
  check("home composition and exploration copy follow configuration", () => {
    const wrapper = home.html.match(/<div\b[^>]*data-home-layout[^>]*>/)?.[0] ?? "";
    assert.equal(attr(wrapper, "data-home-layout"), config.home.layout);
    assert.equal(home.html.includes('id="home-explore-heading"'), config.home.layout !== "centered");
    if (config.home.layout !== "centered") {
      assert.ok(text(home.html).includes(plain(uiText("home.eyebrow", {}, config))));
      assert.ok(text(home.html).includes(plain(uiText("home.sideTitle", {}, config))));
      assert.ok(text(home.html).includes(plain(uiText("home.sideDescription", {}, config))));
    }
  });
  check("home handles the current index state and feature choices", () => {
    if (loaded.missing) {
      assert.ok(text(home.html).includes(plain(uiText(DEMO ? "demo.missingDescription" : "home.missingDescription", {}, config))));
      assert.ok(!home.html.includes('role="combobox"'));
    } else {
      assert.ok(home.html.includes('role="combobox"'));
      const curious = links(home.html).some((link) => link.href === wikiHref("Special:Random") && link.label === uiText("home.curiousButton", {}, config));
      // Restrict the test to the hero because the footer may independently link Random.
      const section = home.html.match(/<section\b[^>]*data-home-hero[^>]*>[\s\S]*?<\/section>/)?.[0] ?? "";
      assert.equal(links(section).some((link) => link.href === wikiHref("Special:Random")), config.home.showCurious);
      if (config.home.showCurious) assert.ok(curious);
      assert.equal(links(section).some((link) => link.href === wikiHref("Special:Statistics")), config.home.showCounts);
      const input = section.match(/<input\b[^>]*role="combobox"[^>]*>/)?.[0] ?? "";
      assert.equal(/\bautofocus(?:=|\s|>)/i.test(input), config.home.autoFocus);
      assert.equal(/<kbd\b/.test(section), config.search.focusShortcut);
      for (const key of ["suggestions", "debounceMs", "focusShortcut"] as const) assert.ok(home.flight.includes(`"${key}":${JSON.stringify(config.search[key])}`), `search box ${key}`);
      assert.equal(home.html.includes('id="recent-heading"'), config.home.showRecent && loaded.articles.some((p) => p.depth > 0 && !p.partOf && p.modified));
      const shownQueries = config.home.showExamples ? config.home.exampleQueries.filter((q) => search(q, { perPage: 1, correct: false }).total > 0) : [];
      for (const query of config.home.exampleQueries) assert.equal(links(section).some((link) => link.href === searchHref(query) && link.label === plain(query)), shownQueries.includes(query));
    }
  });
  checkNavigation(home.html, "home");
  check("footer publisher credit uses the configured approved asset or stays hidden", () => {
    const footer = home.html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? "";
    const publisher = [...footer.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].find((match) => attr(match[0], "aria-label") === config.brand.attribution.name);
    assert.equal(!!publisher, config.brand.attribution.enabled && !!config.brand.attribution.logo);
    if (publisher) {
      const logo = config.brand.attribution.logo!;
      const image = publisher[1].match(/<img\b[^>]*>/i)?.[0] ?? "";
      assert.equal(attr(publisher[0], "href"), config.brand.attribution.href);
      assert.equal(attr(image, "src"), logo.src);
      assert.equal(attr(image, "width"), String(logo.width));
      assert.equal(attr(image, "height"), String(logo.height));
      assert.equal(attr(image, "alt"), logo.alt);
      assert.ok(text(footer).includes(config.brand.attribution.label));
    }
  });
  check("home freshness copy and refresh instructions reflect the selected index", () => {
    const footer = home.html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? "";
    const codes = [...footer.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)].map((match) => text(match[1]));
    assert.equal(codes.includes(INDEX_COMMAND), !loaded.missing && !DEMO);
    if (DEMO && !loaded.missing) {
      const roots = `github.com/${DEMO_ORG}`;
      const expected = plain(uiText("demo.indexedFrom", { age: "", roots }, config));
      assert.ok(text(footer).includes(expected));
      assert.ok(!codes.some((code) => /^pnpm index(?:\s|$)/.test(code)));
    }
  });

  const assetPaths = new Set([config.brand.icon, config.brand.appleIcon, config.brand.logo?.src, config.brand.encyclopediaLogo?.src, config.brand.headerLogo?.src, config.brand.attribution.enabled || config.brand.showPublisherLink ? config.brand.attribution.logo?.src : null].filter((value): value is string => !!value));
  for (const asset of assetPaths) await request(asset);
  check("configured product logo is rendered with its original proportions", () => {
    if (!config.brand.logo) return;
    const image = [...home.html.matchAll(/<img\b[^>]*>/gi)].find((match) => attr(match[0], "src") === config.brand.logo!.src)?.[0] ?? "";
    assert.equal(attr(image, "width"), String(config.brand.logo.width));
    assert.equal(attr(image, "height"), String(config.brand.logo.height));
    assert.equal(attr(image, "alt"), config.brand.logo.alt);
  });

  const query = loaded.index.pages.some((page) => !page.isArticle) ? "is:stub" : "is:article";
  const results = await request(searchHref(query));
  const expectedResults = search(query, { perPage: config.search.perPage });
  checkBrandHeader(results.html, "search");
  check("search metadata, visible tab order and page size follow configuration", () => {
    assert.equal(title(results.html), uiText("search.title", { query }, config));
    const nav = labelled(results.html, "nav", uiText("search.resultTypes", {}, config));
    assert.notEqual(nav, null);
    const ids = links(nav ?? "").map((link) => new URL(link.href!, base).searchParams.get("t") ?? "all");
    assert.deepEqual(ids, config.search.tabs);
    const labels = links(nav ?? "").map((link) => link.label);
    config.search.tabs.forEach((id, i) => assert.ok(labels[i].startsWith(uiText(`search.tab.${id}`, {}, config))));
    assert.equal([...results.html.matchAll(/<h3\b[^>]*id="result-\d+-t"/g)].length, expectedResults.hits.length);
  });
  if (!loaded.index.pages.length) check("search explains an index with no searchable folders", () => {
    assert.equal(expectedResults.total, 0);
    assert.ok(text(results.html).includes(plain(uiText("search.noResultsTitle", { query: uiText("search.filters", {}, config), filters: "" }, config))));
    assert.equal(labelled(results.html, "nav", uiText("search.pages", {}, config)), null);
  });
  checkNavigation(results.html, "search");
  if (expectedResults.pages > 1) {
    const pageTwo = await request(searchHref(query, { p: 2 }));
    check("pagination advances with configured page size and identity", () => {
      assert.equal([...pageTwo.html.matchAll(/<h3\b[^>]*id="result-\d+-t"/g)].length, search(query, { page: 2, perPage: config.search.perPage }).hits.length);
      const nav = labelled(pageTwo.html, "nav", uiText("search.pages", {}, config));
      assert.notEqual(nav, null);
      assert.ok(links(nav ?? "").some((link) => link.href === searchHref(query, { p: 1 })));
      if (!config.brand.logo) assert.ok(text(nav ?? "").includes(config.brand.name));
    });
  } else console.log("skip second page: add more fixture folders or reduce search.perPage");

  const article = loaded.articles[0];
  if (article) {
    const articleSearch = await request(searchHref(article.name));
    const best = search(article.name, { perPage: config.search.perPage }).best;
    check("knowledge panel visibility follows configuration", () => assert.equal(labelled(articleSearch.html, "aside", uiText("search.panelAbout", { title: best?.title ?? article.title }, config)) !== null, config.search.showKnowledgePanel && !!best));
  }
  const suggestionQuery = loaded.index.pages[0]?.name.slice(0, 3) ?? "inner";
  const suggestionResponse = await request(`/api/suggest?q=${encodeURIComponent(suggestionQuery)}`);
  check("same-origin suggestions respect enabled state, result shape and limit", () => {
    const items = JSON.parse(suggestionResponse.html) as unknown[];
    assert.deepEqual(items, config.search.suggestions ? suggest(suggestionQuery, config.search.suggestionLimit) : []);
    assert.ok(items.length <= config.search.suggestionLimit);
    assert.equal(suggestionResponse.response.headers.get("cache-control"), "no-store");
  });

  const wiki = await request("/wiki");
  checkBrandHeader(wiki.html, "encyclopedia");
  check("encyclopedia metadata follows the configured identity", () => assert.ok(title(wiki.html).includes(uiText("wiki.mainTitle", {}, config))));
  if (loaded.missing) check("encyclopedia explains a missing index", () => {
    assert.equal(firstHeading(wiki.html), plain(uiText("wiki.missingTitle", {}, config)));
    assert.ok(text(wiki.html).includes(plain(uiText("wiki.missingDescription", { indexCommand: INDEX_COMMAND }, config))));
  });
  if (!loaded.missing) check("encyclopedia front-page sections follow configured visibility and order", () => {
    const sectionIds: Record<string, string> = { welcome: "welcome", featured: "featured", news: "news", "did-you-know": "dyk", "on-this-day": "otd", browse: "browse", areas: "areas" };
    const rendered = [...wiki.html.matchAll(/<section\b[^>]*>/g)].map((match) => attr(match[0], "aria-labelledby")).filter((id): id is string => !!id && Object.values(sectionIds).includes(id));
    assert.deepEqual(rendered, config.wiki.mainSections.map((id) => sectionIds[id]).filter((id) => rendered.includes(id)));
  });
  checkNavigation(wiki.html, "wiki");
  if (article) {
    const view = await request(wikiHref(article.slug));
    check("article title, section order, contents and infobox follow configuration", () => {
      assert.equal(firstHeading(view.html), article.title);
      assert.ok(title(view.html).includes(config.brand.encyclopediaName));
      const ids = [...view.html.matchAll(/<section\b[^>]*id="(overview|structure|technology|history|see-also|external-links)"/g)].map((match) => match[1]);
      assert.deepEqual(ids, config.wiki.articleSections.filter((id) => ids.includes(id)));
      assert.equal(labelled(view.html, "nav", uiText("wiki.contents", {}, config)) !== null, config.wiki.showContents);
      assert.equal(labelled(view.html, "aside", uiText("wiki.infoboxTitle", { name: article.name }, config)) !== null, config.wiki.showInfobox);
    });
    check("article source links follow public or local index paths", () => {
      const source = links(view.html).filter((link) => link.href === sourceHref(article.path));
      if (config.wiki.articleSections.includes("external-links")) assert.ok(source.length > 0);
      if (DEMO) {
        assert.ok(isRemote(article.path));
        assert.ok(!links(view.html).some((link) => link.href?.startsWith("vscode://")));
        assert.ok(!links(view.html).some((link) => link.href?.startsWith("file://")));
      }
    });
  } else console.log("skip article: the current index has no articles");
  const stub = loaded.index.pages.find((page) => !page.isArticle);
  if (stub) {
    const view = await request(wikiHref(stub.slug));
    check("stub keeps its folder heading and configured encyclopedia metadata", () => {
      assert.equal(firstHeading(view.html), stub.title);
      assert.ok(title(view.html).includes(config.brand.encyclopediaName));
    });
  } else console.log("skip stub: the current index has no stubs");
  const category = loaded.categories.keys().next().value as string | undefined;
  if (category) await request(categoryHref(category));
  else console.log("skip category: the current index has no categories");
  for (const special of ["AllPages", "Categories", "Statistics", "DoesNotExist"]) await request(wikiHref(`Special:${special}`));
  const random = await request(wikiHref("Special:Random"), 307);
  check("random article selects an indexed article or returns to the encyclopedia", () => {
    const target = random.response.headers.get("location");
    if (!loaded.articles.length) assert.equal(target, "/wiki");
    else assert.ok(loaded.articles.some((page) => wikiHref(page.slug) === target));
  });
  const guide = await request("/guide");
  check("guide metadata and recipe visibility follow configuration", () => {
    assert.equal(title(guide.html), uiText("guideTitle", {}, config));
    assert.equal(guide.html.includes('type="range"'), config.guide.showRecipe);
  });
  check("authored guide artwork renders the configured encyclopedia byline", () => {
    const artwork = guide.html.match(/<div\b[^>]*data-plate="add-site"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    assert.ok(artwork.includes('class="fg-svg"'));
    const expected = plain(uiText("wiki.fromEncyclopedia", {}, config));
    const rendered = text(artwork);
    assert.ok(rendered.includes(expected));
    const original = "From Innerpedia, the encyclopedia of you";
    if (config.brand.encyclopediaName !== "Innerpedia" && !expected.includes(original)) assert.ok(!rendered.includes(original));
  });
  checkNavigation(guide.html, "guide");
  const missing = await request(wikiHref("__innernet_ui_smoke_missing_page__"), 404);
  check("missing page includes configured explanatory copy", () => {
    const expected = uiText("missingPageTitle", {}, config);
    if (firstHeading(missing.html)) assert.equal(firstHeading(missing.html), expected);
    else {
      assert.ok(missing.flight.includes(`"children":${JSON.stringify(expected)}`));
      assert.ok(missing.flight.includes(JSON.stringify(uiText("missingPageDescription", {}, config))));
    }
  });
  // Node fetch normalizes Host, so use the HTTP client for this header-specific check.
  const nonLocalStatus = await new Promise<number | undefined>((resolve, reject) => {
    const request = http.get(base, { headers: { Host: "example.com" }, timeout: 30_000 }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("Host-header check timed out")));
  });
  check(DEMO ? "public demo accepts non-local Host headers" : "local mode rejects non-local Host headers", () => assert.equal(nonLocalStatus, DEMO ? 200 : 403));
  console.log(`Passed ${checks} HTTP UI checks against ${base.origin}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
