# UI: search your folders, read their stories

The Innernet UI gives the folders on your machine two familiar ways to be explored:
a search engine for finding things, and **Innerpedia**, an encyclopedia for understanding
them. The field guide explains the rules behind both while you use them.

The visual language is a private library: warm paper, clear type, blue links and enough
space to read. Light and dark themes share the same structure. On smaller screens,
results, article facts and navigation adapt to the space available.

[Project overview](../../README.md) · [Engine](../engine/README.md) ·
[Design conventions](../../DESIGN.md) · [Contributing](../../CONTRIBUTING.md)

## Find your way around

| View | Route | What it helps you do |
| --- | --- | --- |
| Home | `/` | Start a search, try an operator or return to a recently touched article. |
| Search results | `/search?q=…` | Read highlighted matches, filter by type, follow suggestions and inspect project facts. |
| Innerpedia | `/wiki` | Discover a featured article, recent activity, facts and categories from your index. |
| Articles and stubs | `/wiki/[slug]` | Read a project's README, structure, technology and history, or browse a folder with less context. |
| Categories | `/wiki/Category:Name` | Explore projects grouped by collection, language, framework and other shared properties. |
| Special pages | `/wiki/Special:Name` | Browse all pages, categories or statistics, or open a random article. |
| Field guide | `/guide` | Learn how indexing, articles, search and privacy work, with an interactive folder recipe. |

Shared folder names lead to disambiguation lists. Missing pages explain what happened
and offer a way onward. If no index exists yet, home and Innerpedia explain how to
create one instead of showing an empty search experience.

The search box offers live suggestions, arrow-key selection and `/` to focus it.
Search results include spelling corrections and a project knowledge panel when the
engine finds a suitable match. See the [search examples](../engine/README.md#search-your-folders)
for the supported operators.

## How the UI meets the engine

The UI reads the engine's local index through server-side modules. Pages call
[`lib/data.ts`](../../lib/data.ts) for folders and article routing, and
[`lib/search.ts`](../../lib/search.ts) for search results, suggestions and summaries.
Those modules belong to the [engine](../engine/README.md); the UI turns their output
into pages and controls.

Most of the app renders on the server. Browser components handle interactions that
need a browser: the search box, theme choice, article contents rail and parts of the
field guide. Suggestions call the same-origin `/api/suggest` route; they do not send
your query to an external search service.

Index text is treated as content. Search highlights render as React nodes, and README
overviews use react-markdown with remark-gfm. Raw HTML and README images are not
rendered, and relative README links are made inert.

## Run the UI

Use **Node.js 20.9 or newer** and **pnpm**. From the repository root:

```bash
pnpm install
pnpm dev
```

Open [localhost:3470](http://localhost:3470). The development server binds to
`127.0.0.1`; run it from the repository root so it can find `data/index.json`.
For your own folders, follow the [engine setup](../engine/README.md) and run
`pnpm index`. The UI also renders without an index, so you can inspect that state first.

The first development run or build needs network access to fetch the bundled fonts.
After that, `next/font` serves them from the app's own origin. For a production build,
run `pnpm build`, then `pnpm start` from the same directory.

### Preview the public demo

The [public demo](https://innernet-nine.vercel.app) uses the committed
`data/demo/index.json`, built only from public repositories in
[quirq-ai](https://github.com/quirq-ai). To preview it locally:

```bash
pnpm dev:demo
```

Run `pnpm index:demo` when you need to refresh that public index. Demo mode selects
it instead of your local `data/index.json`; Vercel builds select demo mode automatically.
Local mode rejects non-localhost Host headers, while demo mode accepts public hosts.
The [engine guide](../engine/README.md#public-demo) explains that boundary.

## Appearance and branding

The UI uses Next.js, React and TypeScript. The root layout reads colours and fonts
from [`innernet.ui.json`](../../innernet.ui.json) and emits shared design tokens.
Tailwind utilities in [`app/globals.css`](../../app/globals.css) use those tokens
across both themes.

| Typeface | Role |
| --- | --- |
| Instrument Serif | Wordmarks, article titles, headings and large numbers. |
| Newsreader | Encyclopedia prose and longer passages. |
| Inter | Controls, search results and interface labels. |
| JetBrains Mono | Paths, commands, file names and technical facts. |

The default theme is configurable and initially follows the operating system.
Readers can choose system, light or dark with the theme toggle when it is enabled.
That choice is saved locally and applied before the page paints.
Motion respects `prefers-reduced-motion`. Focus rings, semantic landmarks, labelled
controls and keyboard navigation are part of the design.

Always spell **quirq** entirely in lowercase, including interface copy, accessible
labels, metadata and documentation. Use the approved quirq logo for branding, preserve
its artwork and proportions, and ask for its file path or URL if it is unavailable.
Do not invent a logo or replace it with a text-only wordmark.

## Customization

[`innernet.ui.json`](../../innernet.ui.json) is the complete, versioned UI configuration.
It controls branding, themes, navigation, supported layouts, interface copy and interaction
settings. [`innernet.ui.schema.json`](../../innernet.ui.schema.json) describes the resolved
configuration. The engine's [`innernet.config.json`](../../innernet.config.json) continues
to configure indexing roots and depth separately.

Edit the default UI file directly, or provide a partial override with `INNERNET_UI_CONFIG`.
Try the included [atlas example](../../examples/atlas.ui.json):

```bash
INNERNET_UI_CONFIG=examples/atlas.ui.json pnpm dev
```

This changes the names, colours, fonts, density, search settings and encyclopedia panels
while using the same index. It replaces the header artwork and browser icons with the
atlas compass, changes creator metadata, and removes the default publisher link,
source link and footer credit, so the configured product identity can stand on its own.
Copy that example into your own JSON file and point the
variable at it. Relative paths resolve from the repository root; an absolute file path
also works. A partial file can be as small as:

```json
{
  "$schema": "./innernet.ui.override.schema.json",
  "version": 1,
  "brand": {
    "name": "My library",
    "encyclopediaName": "My encyclopedia",
    "tagline": "Everything I have made",
    "italicPrefix": "",
    "encyclopediaItalicPrefix": "",
    "headerLogo": null,
    "showPublisherLink": false,
    "sourceLink": { "enabled": false },
    "attribution": { "enabled": false }
  },
  "theme": {
    "light": { "link": "#246b46" },
    "effects": { "aurora": false }
  },
  "copy": { "home.searchButton": "Find a project" }
}
```

Use the [override schema](../../innernet.ui.override.schema.json) for partial files;
adjust its relative `$schema` path to the location of your file. Objects merge by key
with the defaults, so changing one colour keeps the other colours. Arrays replace the
whole list: their order determines display order, and omitted entries are hidden.
Invalid values, unsupported version numbers and unknown fields report the file name
and field path.

Saved changes appear on the next full page load. They do not require `pnpm index`.
Changing the environment variable requires restarting the UI process. This works with
`pnpm start` as well as `pnpm dev`.

For deployments, keep the override inside the repository and set `INNERNET_UI_CONFIG`
to its repository-relative path at both build time and runtime. The selected file is
included in deployment tracing. An override stored elsewhere on your development
machine will not be available to deployed server functions.

### Settings at a glance

| Section | Shape and supported settings |
| --- | --- |
| `brand` | Names, tagline, description, document `language`, `creator`, wordmark italic prefixes, product and encyclopedia logos, `headerLogo`, browser `icon`, `appleIcon`, `showPublisherLink`, `sourceLink` and an `attribution` object. |
| `theme` | `defaultMode`: `system`, `light` or `dark`; `allowToggle`; `light` and `dark` palettes; `fonts` for `display`, `serif`, `sans` and `mono`; `effects` booleans for `aurora`, `grain` and `motion`. |
| `layout` | `maxWidth`, `searchWidth` and `articleWidth` in pixels; `density`: `comfortable` or `compact`. Content widths cannot exceed `maxWidth`. |
| `navigation` | Ordered footer arrays for `home`, `search`, `wiki` and `guide`; header arrays `headerSearch` and `headerWiki`; and a `labels` object keyed by navigation ID. |
| `home` | `showCounts`, `showExamples`, `showRecent`, `showCurious`, `autoFocus`, `recentLimit` and an `exampleQueries` array. |
| `search` | `suggestions`, `suggestionLimit`, `debounceMs`, `focusShortcut`, `perPage`, `showKnowledgePanel` and an ordered `tabs` array. |
| `wiki` | `showContents`, `showInfobox`, and ordered `mainSections` and `articleSections` arrays. Article sections with no indexed content remain absent. |
| `guide` | `showRecipe` controls the interactive folder recipe. |
| `copy` | Plain strings keyed by the existing copy IDs in the default JSON, including headings, buttons, accessible labels, notices and metadata titles. |

Navigation IDs are `search`, `wiki`, `guide`, `random`, `allPages`, `categories`,
`statistics` and `top`. Footer arrays belong to their named page groups; `headerSearch`
and `headerWiki` control the links beside the shared search bar. Their routes stay fixed;
use `navigation.labels` to rename them.
Search tab IDs are `all`, `articles`, `repos`, `docs` and `folders`; `all` must remain in
the list. Tab labels live in `copy`, such as `search.tab.repos`.

Encyclopedia main section IDs are `welcome`, `featured`, `news`, `did-you-know`,
`on-this-day`, `browse` and `areas`. Article section IDs are `overview`, `structure`,
`technology`, `history`, `see-also` and `external-links`. For example,
`"articleSections": ["overview", "external-links"]` shows those two sections in that
order and leaves the other article sections out. The article contents list follows the
same order. Indexed page titles, categories and search operators keep their engine
identifiers even when interface labels change.

Copy supports `{app}`, `{wiki}`, `{publisher}` and `{tagline}` for the configured
identity, plus the per-message placeholders already shown in the defaults. For example,
`"wiki.welcomeTitle": "Welcome to {wiki},"` follows encyclopedia name changes.
Strings render as plain text. The configuration controls the constructed UI regions;
new components, routes, arbitrary HTML and CSS still require code changes. The field
guide's longer engine explanations remain authored prose, with the configured brand
names inserted where they appear.

### Colours, fonts and assets

Both theme palettes include the existing colour roles, aurora opacity and shadows.
Colours accept hex, `rgb(...)` or `oklch(...)` in the formats defined by the schema.
Shadows are arrays of objects with numeric `x`, `y`, `blur` and `spread` values and a
`color`. The schema bounds dimensions, limits and list lengths; the defaults are a
complete reference for every available key.

Font roles select from `instrument`, `newsreader`, `inter`, `jetbrains`, `system-serif`,
`system-sans` and `system-mono`. The four named families are bundled by `next/font`;
arbitrary font names and external font URLs are unsupported. The `language` setting
sets the document language; customize `copy` to change the supported interface text.

Put your images in `public/` and use local URLs such as `/brand/library.svg`. A logo
has this shape:

```json
{
  "src": "/brand/library.svg",
  "alt": "My library",
  "width": 240,
  "height": 80
}
```

Set that object as `brand.logo` or `brand.encyclopediaLogo`. Width and height should
match the artwork's proportions. Use `null` to show the configured product name
instead. A product or encyclopedia named quirq requires approved artwork.
`brand.icon` and `brand.appleIcon` are local image URLs too. Images are served locally,
so changing branding introduces no automatic requests to an external asset host.

`brand.headerLogo` accepts the same logo object and is the artwork linking home in
the shared header. Set it to `null` to remove that artwork. The default header uses the
approved **quirq** asset at `/brand/quirq/app-icon.svg`.

Attribution has `enabled`, `label`, `name`, `href` and `logo` fields. The default footer
credit uses the same approved quirq artwork and links to `https://quirq.ai`. Set
`attribution.enabled` to `false` to hide the credit, or configure your own publisher.
A missing attribution logo hides the credit rather than substituting a text wordmark.
`brand.showPublisherLink` separately controls the header's publisher link, which uses
`attribution.href` and `attribution.logo`. `brand.sourceLink` has `enabled`, `label`
and `href` fields for the header's source link; its label supports the copy placeholders.

Start with [atlas](../../examples/atlas.ui.json) to replace the product's identity and
header artwork, creator metadata and browser icons, while removing the publisher link,
source link and footer credit. To supply your own artwork, configure the product,
encyclopedia, header and attribution logos separately. Choose `creator`, `icon` and
`appleIcon` too when replacing metadata defaults. Always keep quirq lowercase and
preserve its approved artwork and proportions when using it.

## Explore the source

| Path | Responsibility |
| --- | --- |
| [`app/`](../../app) | Routes, page metadata, root layout and shared CSS. |
| [`components/top-bar.tsx`](../../components/top-bar.tsx) · [`components/site-footer.tsx`](../../components/site-footer.tsx) | Shared navigation and small print. |
| [`components/home/`](../../components/home) · [`components/search/`](../../components/search) | Home, results, panels and search controls. |
| [`components/wiki/`](../../components/wiki) | Articles, stubs, categories and special pages. |
| [`components/guide/`](../../components/guide) | The field guide and its interactive examples. |
| [`components/theme-toggle.tsx`](../../components/theme-toggle.tsx) · [`components/wordmark.tsx`](../../components/wordmark.tsx) | Theme choice and product identity. |
| [`components/brand-nav.tsx`](../../components/brand-nav.tsx) · [`components/quirq-credit.tsx`](../../components/quirq-credit.tsx) | Header artwork, publisher and source links, and footer credit. |
| [`lib/ui-config.ts`](../../lib/ui-config.ts) · [`lib/ui-config-shared.ts`](../../lib/ui-config-shared.ts) | Validated configuration loading, types and plain-text templates. |
| [`lib/ui-theme.ts`](../../lib/ui-theme.ts) · [`lib/ui-navigation.ts`](../../lib/ui-navigation.ts) | Theme variables and configured navigation. |
| [`lib/links.ts`](../../lib/links.ts) | URL helpers for search, articles, categories and editor links. |

Before opening a PR, run `pnpm -s typecheck` and the configuration checks with
`pnpm -s check:ui`. For visible changes, check light and dark
themes at desktop and phone widths, including an empty or missing index. Follow the
[contribution checklist](../../CONTRIBUTING.md#pull-request-checklist) and
[design conventions](../../DESIGN.md) for the complete workflow.
