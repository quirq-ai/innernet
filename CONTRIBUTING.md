# Contributing to innernet

Innernet is small enough to hold in your head: one crawler, a JSON index, one search
engine and an encyclopedia drawn from it. This page is how to work on it. For how it
behaves (the crawl rules, ranking, operators, every kind of Innerpedia page), read the
field guide in the app at [/guide](http://localhost:3470/guide). For how it should look
and sound, read [DESIGN.md](DESIGN.md).

## Setup

Fork [quirq-ai/innernet](https://github.com/quirq-ai/innernet) on GitHub, then clone your
fork and make a `jobs/` branch. Replace `YOUR_GITHUB_USER` with your account:

```bash
git clone https://github.com/YOUR_GITHUB_USER/innernet.git
cd innernet
git remote add upstream https://github.com/quirq-ai/innernet.git
git switch -c jobs/improve-innernet
pnpm install
pnpm dev
```

Open [localhost:3470](http://localhost:3470). The UI works without an index. To explore
your own folders, choose roots and depth in `innernet.config.json` before `pnpm index`;
the default root is `~/Programming`. See the [engine setup](docs/engine/README.md#build-an-index).

- Run the dev server from this folder. Local mode reads `data/index.json` relative to
  the working directory, whatever destination the indexer was told.
- The first `pnpm dev` or `pnpm build` needs the network once, to fetch the fonts. After
  that `next/font` serves them from the app's own origin.
- Re-index whenever you like. The server notices the new file on the next request; there
  is nothing to restart.

Use `pnpm dev:demo` to preview the committed public index without crawling your own
folders. `pnpm index:demo` refreshes it using only public quirq-ai repositories, with
GitHub URLs replacing local paths. Local mode rejects non-localhost Host headers;
demo mode accepts public hosts and reads only `data/demo/index.json`. Vercel builds
select demo mode automatically. Preserve this boundary when changing deployment or
index loading. See [public demo](docs/engine/README.md#public-demo).

For configuration work, preview the complete replacement preset with
`INNERNET_UI_CONFIG=examples/atlas.ui.json pnpm dev`. It changes the supported UI
settings, replaces the header artwork and browser icons, and hides the default publisher
link, source link and footer credit. The [UI guide](docs/ui/README.md#customization)
covers partial overrides and the two JSON schemas.

## The loop

Edit, let hot reload show you the page, then check the part you touched. There is no
separate lint or format tooling; use these checks.

| What you changed | Check | Expect |
| --- | --- | --- |
| Anything | `pnpm -s typecheck` | a clean exit, about a second |
| UI configuration | `pnpm check:ui` | default/override schemas, invalid settings, unsafe values and reload behavior pass |
| UI configuration integration | `pnpm check:ui:routes -- http://localhost:3470` | routes, metadata, navigation and configured controls render against the current local index |
| Search, ranking, operators | `pnpm tsx --conditions=react-server scripts/try-search.ts "linear clone"` | results, the knowledge-panel pick, did-you-mean and suggestions, printed |
| Anything you can see | `scripts/shot.sh "/wiki/innernet" out.png 1440 2400 dark` | a settled screenshot, and the names of any elements that scroll the page sideways |
| The indexer | `INNERNET_ROOTS=~/some/small/dir INNERNET_OUT=/tmp/innernet-test.json pnpm index` | a test index, with your real one left alone |
| Copy | `rg -n "[\x{2013}\x{2014}]" -g '!node_modules' -g '!.next' -g '!data' .` | no matches |

A few things worth knowing about these tools:

- `try-search` needs `--conditions=react-server`, because `lib/search.ts` and
  `lib/data.ts` import `server-only`. Any terminal script that imports them does too.
- `shot.sh` always talks to `http://localhost:3470`. Its last two arguments are the
  height and `light` or `dark` (it sets `prefers-color-scheme`). A narrow width gives
  the narrow layout but not a phone user agent. Pass a tall height to see a whole page.
- Local mode cannot show an index written with `INNERNET_OUT`. Inspect that file with
  `node`, or point `INNERNET_ROOTS` at a small folder and let it write the real one when
  you are happy to rebuild. Terminal scripts can search it, though: `lib/data.ts` reads
  `data/index.json` under the working directory, so write the test index to
  `/tmp/t/data/index.json` and run `try-search` from `/tmp/t`, with this folder's
  `node_modules/.bin/tsx --conditions=react-server` and this folder's `scripts/try-search.ts`.
- `INNERNET_MAX_DEPTH=3` overrides the depth in `innernet.config.json` for one run, as
  `INNERNET_ROOTS` does the roots.
- `check:ui:routes` checks the configured routes and controls against a running server.
  Use the same `INNERNET_UI_CONFIG` and demo-mode environment for the checker as for
  the server, so both expect the same UI and index.

## Conventions

**Server first.** Pages are Server Components that read `lib/data.ts` and
`lib/search.ts`. The site has four client components (the search box, the theme toggle,
the home hero search and the contents rail), the field guide four more of its own (the
copy button, the folder recipe, the reveal motion and the progress ruler), and there is
one browser request, the search box calling our own `/api/suggest`. Keep it that way: no
browser fetches, no external requests, no new client components without a reason only
the browser can satisfy.

**Shared code stays shared.** The indexer imports `lib/text.ts`, `lib/normalize.ts` and
`lib/types.ts`, and `lib/links.ts`, `lib/format.ts` and `lib/lang-colors.ts` are meant to
be importable from anywhere. Keep all six free of `server-only` and of Next imports.

**Tokens, not values.** Colors, shadows and font roles live in `innernet.ui.json`.
`lib/ui-theme.ts` emits validated CSS variables and `app/globals.css` maps them to
utilities. Components use tokens, never hex values. Add both light/dark values and
schema definitions for a new token. Check both themes.

**Configuration is data.** Branding, supported layouts, copy, navigation and UI controls
use `getUiConfig()` on the server. Pass only necessary serializable settings to client
components. Stable route IDs and engine semantics stay in code. Keep defaults, both
schemas and types aligned, and run `pnpm check:ui`. See the
[UI customization guide](docs/ui/README.md#customization).

**Approved branding.** Always spell quirq in lowercase. The approved asset at
`public/brand/quirq/app-icon.svg` supplies the default `brand.headerLogo` and
`brand.attribution.logo`; preserve its artwork and proportions. Header publisher
visibility uses `brand.showPublisherLink`, footer credit uses `attribution.enabled`,
and the source link uses `brand.sourceLink`. Keep these independently configurable.
Ask for the approved asset's path or URL if it is unavailable rather than inventing
a logo or substituting a text wordmark.

**Links through `lib/links.ts`.** `wikiHref`, `categoryHref`, `searchHref` and
`vscodeHref` handle encoding, underscores and empty parameters for you.

**Index text is never HTML.** Snippets and leads are segment arrays rendered as React
nodes; READMEs go through react-markdown with `skipHtml`. Nothing from the index goes
near `dangerouslySetInnerHTML`.

**Privacy is a feature.** The indexer reads READMEs, CLAUDE.md or AGENTS.md, manifests
and git metadata, and nothing else. If you need a new kind of input, read names rather
than contents where you can, and run anything textual through `redactSecrets` and
`cleanLine` in `lib/text.ts`.

**House style.** Encyclopedia voice in article prose ("is a", "was created in"). Plain,
warm, a little wry. No exclamation marks. No em or en dashes anywhere, in copy, comments
or code: use commas, colons, middots or full stops.

## Recipes

### Add a search operator

1. In `lib/search.ts`, add the key to `ParsedQuery.filters` and `OPS`, to the operator
   regex in `parseQuery()`, to the copy of that regex in `correction()`, and its test to
   `matchesFilters()`.
2. In `components/search/query-tools.ts`, add it to `OP_RE` and add a copy key to
   `OP_LABEL`. Define its label in `innernet.ui.json` and both UI schemas. Typecheck
   and `pnpm check:ui` help check the contract.
3. Chips appear on their own. If it earns a place, add an example to
   `home.exampleQueries` in `innernet.ui.json` and to the operator lists in the engine
   README and DESIGN.md.

Values arrive lowercased and may be quoted (`in:"two words"`). If you add `lang:`
aliases, add them to both `LANG_ALIASES` copies (`lib/search.ts` and
`components/search/query-tools.ts`).

### Add a Special page

1. Routing is done: any `/wiki/Special:Name` reaches `SpecialView`.
2. For a page that redirects (like Random), handle it in `app/wiki/[slug]/page.tsx`
   before rendering.
3. For a page that renders, add a branch to `SpecialView` in
   `components/wiki/special-view.tsx` (branches test `key`, the name lowercased with
   spaces and underscores removed), add it to `SPECIALS` in the same file, and build the
   view like `StatisticsView` with `PageTitle prefix="Special: "`. Put heavy computation
   in `components/wiki/main/insights.ts` behind `once()`.
4. To expose it in navigation, add a stable route ID to `lib/ui-navigation.ts` and
   `lib/ui-config-shared.ts`, define its label and allowed ID in both UI schemas, and
   add it to the appropriate `navigation` arrays in `innernet.ui.json`. Add an entry
   to `AREAS` in `components/wiki/main/browse.tsx` as `slug: "Special:Name"`.

### Add a framework detector

1. For JavaScript, add `["package-name", "Display Name"]` to `FRAMEWORKS` in
   `scripts/build-index.ts`. It matches a dependency or devDependency name exactly.
2. For every other manifest (pyproject, Cargo, go.mod, requirements.txt), add
   `[/\bname\b/i, "Display Name"]` to `PY_FRAMEWORKS`.
3. If it deserves its own noun, add one to `NOUNS` in
   `components/wiki/article/lead.ts` (most specific first) and to `APP_FRAMEWORKS` in
   `components/search/query-tools.ts`.
4. Re-index. The category, the `fw:` operator, search weight, See also, the infobox and
   the result chips all follow.

### Add an article section

1. If it needs new data, add an optional field to `Page` in `lib/types.ts`, fill it in
   `crawl()` in `scripts/build-index.ts`, and backfill it in `normalizeIndex()` if it can
   be worked out without the disk (older indexes still load).
2. Create `components/wiki/article/<name>.tsx` exporting `hasX(page)` and `X({ page })`,
   patterned on `technology.tsx`, with `Sub` from `parts.tsx` for labelled blocks.
3. Add its ID to `UiArticleSection` in `lib/ui-config-shared.ts`, both UI schemas and
   `wiki.articleSections` in `innernet.ui.json`. In `components/wiki/article-view.tsx`,
   register its renderer and contents entry in the section map, and reserve its anchor
   in `SECTION_IDS` so a README heading cannot claim it. The configured array controls
   section order; a section shows only when it has something to say.
4. Stubs have their own view in `components/wiki/stub-view.tsx`.

## How to verify

- `pnpm -s typecheck` passes.
- The pages you touched look right in light and dark, at 1440 and at 390 wide, with no
  sideways scroll (`shot.sh` names the culprit if there is one).
- Search changes: try-search on a few queries, including one with a typo and one with
  only operators.
- Indexer changes: a test index of a small folder, inspected with `node`, before a full
  `pnpm index`.
- Nothing new reaches the browser: no new requests in the network panel, no new client
  components.
- Hit a page that should not exist and a Special page that does not: the first is a 404,
  the second a polite list.
- Mode or deployment changes: local mode rejects a public Host header, demo mode
  accepts it, and demo data contains public GitHub URLs rather than local paths.

## Open a pull request

Keep your work on a `jobs/` branch in your fork. Use `upstream` to fetch changes from
quirq-ai/innernet and keep your fork current. Push the branch to your fork's `origin`:

```bash
git push -u origin jobs/improve-innernet
```

Open a pull request with **quirq-ai/innernet** as the base repository, **main** as the
base branch, and your fork's `jobs/` branch as the head. Describe the resulting behavior
and the checks you ran, and include screenshots for visible changes. Branches belong
in your fork; do not push contribution branches to the upstream repository.

## Pull request checklist

- [ ] The head is a `jobs/` branch in your fork and the base is `quirq-ai/innernet:main`.
- [ ] Typecheck passes, and `pnpm check:ui` passes for configuration changes.
- [ ] Screenshots in light and dark, desktop and phone width, for anything visible.
- [ ] Every page touched still renders with an empty or missing local `data/index.json`.
- [ ] No em or en dashes, no exclamation marks, encyclopedia voice in prose.
- [ ] Colours from tokens, links from `lib/links.ts`, index text as React nodes.
- [ ] No new browser requests, no new reads from disk beyond names and the files listed above.
- [ ] README.md, DESIGN.md and the [/guide](http://localhost:3470/guide) page updated if behaviour changed.
- [ ] Local `data/index.json`, temporary indexes, `.demo-cache/` and `.next/` are left
  out of the commit. Changes to the committed `data/demo/index.json` contain public
  repository data only.
