// Run with: node --import tsx --conditions=react-server scripts/check-ui-config.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import defaults from "../innernet.ui.json";
import example from "../examples/atlas.ui.json";
import fullSchema from "../innernet.ui.schema.json";
import overrideSchema from "../innernet.ui.override.schema.json";
import { getUiConfig, resolveUiConfig, uiText, validateUiOverride } from "../lib/ui-config";
import { formatUiTemplate, uiThemeVariables } from "../lib/ui-config-shared";

let checks = 0;
function check(name: string, run: () => void) {
  run(); checks++; console.log(`ok ${name}`);
}
function rejects(value: unknown, field: string) {
  const filename = "invalid-test.json";
  assert.throws(() => resolveUiConfig(value, filename), (error: unknown) =>
    error instanceof Error && error.message.includes(filename) && error.message.includes(field),
  );
}

check("active disk configuration and selected override are valid", () => {
  const config = getUiConfig();
  assert.equal(config.version, 1);
  assert.ok(Object.isFrozen(config));
});

check("full and partial schemas keep the same field contract", () => {
  const expected = structuredClone(fullSchema) as Record<string, unknown>;
  function relax(node: unknown, preserve = false) {
    if (!node || typeof node !== "object") return;
    const value = node as Record<string, unknown>;
    if (!preserve && value.type === "object") delete value.required;
    for (const [key, child] of Object.entries(value)) {
      if (Array.isArray(child)) child.forEach((item) => relax(item, preserve));
      else relax(child, preserve || key === "if" || key === "then" || key === "else");
    }
  }
  relax(expected);
  expected.$id = overrideSchema.$id;
  expected.title = overrideSchema.title;
  expected.description = overrideSchema.description;
  assert.deepEqual(expected, overrideSchema);
});

check("shipped defaults are valid and immutable", () => {
  const config = resolveUiConfig();
  assert.deepEqual(config, defaults);
  assert.ok(Object.isFrozen(config) && Object.isFrozen(config.theme.light));
});
const examplesDir = path.join(process.cwd(), "examples");
const templateNames = new Set<string>();
for (const filename of fs.readdirSync(examplesDir).filter((file) => file.endsWith(".ui.json")).sort()) {
  check(`${filename} template validates and includes its local artwork`, () => {
    const value: unknown = JSON.parse(fs.readFileSync(path.join(examplesDir, filename), "utf8"));
    const config = resolveUiConfig(value, `examples/${filename}`);
    assert.ok(!templateNames.has(config.brand.name), "Template identities must be distinct");
    templateNames.add(config.brand.name);
    const assets = [config.brand.icon, config.brand.appleIcon, config.brand.headerLogo?.src, config.brand.logo?.src, config.brand.encyclopediaLogo?.src];
    for (const asset of assets) {
      if (asset) assert.ok(fs.statSync(path.join(process.cwd(), "public", asset)).isFile(), `Missing template artwork: ${asset}`);
    }
    const schemaReference = path.resolve(examplesDir, config.$schema);
    assert.ok(fs.statSync(schemaReference).isFile(), "Template schema reference must resolve");
  });
}
check("partial overrides merge objects and replace arrays", () => {
  validateUiOverride(example, "examples/atlas.ui.json");
  const config = resolveUiConfig(example, "examples/atlas.ui.json");
  assert.equal(config.brand.name, "atlas");
  assert.equal(config.brand.creator, "atlas");
  assert.equal(config.brand.language, defaults.brand.language);
  assert.equal(config.theme.light.bg, "#f2f7f2");
  assert.equal(config.theme.dark.bg, "#0d1711");
  assert.deepEqual(config.search.tabs, ["all", "repos", "folders"]);
  assert.deepEqual(config.wiki.mainSections, ["browse", "welcome", "featured"]);
  assert.equal(config.search.perPage, 3);
  assert.equal(config.copy["wiki.contents"], defaults.copy["wiki.contents"]);
});
check("partial schema preserves conditional logo requirements", () => {
  validateUiOverride({ brand: { attribution: { label: "Made by" } } });
  rejects({ brand: { name: "quirq" } }, "/brand/logo");
  validateUiOverride({ brand: { name: "quirq", logo: { src: "/brand/approved-quirq.svg", alt: "quirq", width: 20, height: 20 } } });
});
check("plain copy and navigation templates share brand interpolation", () => {
  const config = resolveUiConfig(example);
  assert.equal(uiText("home.title", {}, config), "atlas · Your local project atlas");
  assert.equal(formatUiTemplate("{app} / {wiki} / {publisher} / {count}", config, { count: 4 }), "atlas / atlaspedia / quirq / 4");
  assert.equal(formatUiTemplate("{unknown}", config), "{unknown}");
  assert.throws(() => uiText("missing.copy.key", {}, config), /Unknown UI copy key/);
});
check("header navigation overrides are independent of footer navigation", () => {
  const config = resolveUiConfig({ navigation: { headerSearch: ["wiki", "guide"], headerWiki: [] } });
  assert.deepEqual(config.navigation.headerSearch, ["wiki", "guide"]);
  assert.deepEqual(config.navigation.headerWiki, []);
  assert.deepEqual(config.navigation.wiki, defaults.navigation.wiki);
});
check("empty copy labels and interpolation values remain valid plain text", () => {
  const config = resolveUiConfig({ copy: { "search.kind.folder": "" } });
  assert.equal(uiText("search.kind.folder", {}, config), "");
  assert.equal(formatUiTemplate("before{name}after", config, { name: "" }), "beforeafter");
});
check("theme values serialize into local CSS tokens", () => {
  const vars = uiThemeVariables(resolveUiConfig(), "light");
  assert.equal(vars["--bg"], "#f7f5f0");
  assert.equal(vars["--shadow-sm"], "0px 1px 2px 0px rgb(28 27 24 / 0.05)");
  assert.ok(vars["--ui-font-display"].startsWith("var(--font-instrument)"));
});
check("visual styles and home compositions can be combined independently", () => {
  for (const style of ["classic", "editorial", "cyberpunk", "playful"]) {
    for (const layout of ["centered", "editorial", "console", "bento"]) {
      const config = resolveUiConfig({ theme: { style }, home: { layout } });
      assert.equal(config.theme.style, style);
      assert.equal(config.home.layout, layout);
      assert.deepEqual(config.search, defaults.search);
    }
  }
});
for (const [name, value, field] of [
  ["unknown root field", { branding: {} }, "/branding"],
  ["unknown nested field", { search: { typo: true } }, "/search/typo"],
  ["unknown copy field", { copy: { missing: "x" } }, "/copy/missing"],
  ["unknown visual style", { theme: { style: "arbitrary-css" } }, "/theme/style"],
  ["unknown home layout", { home: { layout: "arbitrary-html" } }, "/home/layout"],
  ["unsafe CSS declaration", { theme: { light: { bg: "red; background:url(https://example.com)" } } }, "/theme/light/bg"],
  ["unsafe image URL", { brand: { logo: { src: "https://example.com/logo.svg", alt: "Logo", width: 20, height: 20 } } }, "/brand/logo"],
  ["asset path traversal", { brand: { icon: "/../logo.svg" } }, "/brand/icon"],
  ["script link", { brand: { attribution: { href: "javascript:alert(1)" } } }, "/brand/attribution/href"],
  ["HTML copy", { copy: { "home.searchButton": "<script>alert(1)</script>" } }, "/copy/home.searchButton"],
  ["out of bounds page size", { search: { perPage: 0 } }, "/search/perPage"],
  ["missing all tab", { search: { tabs: ["repos"] } }, "/search/tabs"],
  ["duplicate tabs", { search: { tabs: ["all", "all"] } }, "/search/tabs"],
  ["unknown section", { wiki: { mainSections: ["made-up"] } }, "/wiki/mainSections"],
  ["unsupported version", { version: 2 }, "/version"],
  ["quirq spelling", { brand: { creator: "Quirq" } }, "/brand/creator"],
  ["quirq text fallback", { brand: { name: "quirq" } }, "/brand/logo"],
  ["quirq attribution spelling", { brand: { attribution: { name: "QUIRQ" } } }, "/brand/attribution/name"],
  ["layout wider than its container", { layout: { maxWidth: 640, searchWidth: 800 } }, "/layout/searchWidth"],
  ["prototype field", JSON.parse('{"__proto__":{"polluted":true}}'), "/__proto__"],
] as const) check(`rejects ${name} with filename and field path`, () => rejects(value, field));

check("file overrides reload on modification and cache unchanged reads", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-ui-check-"));
  const filename = path.join(dir, "custom.json");
  const previous = process.env.INNERNET_UI_CONFIG;
  try {
    fs.writeFileSync(filename, JSON.stringify({ brand: { name: "Library" } }));
    process.env.INNERNET_UI_CONFIG = filename;
    const first = getUiConfig();
    assert.equal(first.brand.name, "Library");
    assert.equal(getUiConfig(), first);
    fs.writeFileSync(filename, JSON.stringify({ brand: { name: "Archive" } }));
    const changed = new Date(Date.now() + 1000);
    fs.utimesSync(filename, changed, changed);
    assert.equal(getUiConfig().brand.name, "Archive");
    fs.writeFileSync(filename, "{ malformed");
    const broken = new Date(Date.now() + 2000);
    fs.utimesSync(filename, broken, broken);
    assert.throws(() => getUiConfig(), (error: unknown) => error instanceof Error && error.message.includes(filename));
  } finally {
    if (previous === undefined) delete process.env.INNERNET_UI_CONFIG;
    else process.env.INNERNET_UI_CONFIG = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
console.log(`UI configuration: ${checks} checks passed.`);
