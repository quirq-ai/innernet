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
After that, `next/font` serves them locally. For a production build, run `pnpm build`,
then `pnpm start` from the same directory.

## Appearance and branding

The UI uses Next.js, React and TypeScript, with Tailwind CSS utilities backed by shared
design tokens in [`app/globals.css`](../../app/globals.css). Colours belong in those
tokens so every surface stays consistent across both themes.

| Typeface | Role |
| --- | --- |
| Instrument Serif | Wordmarks, article titles, headings and large numbers. |
| Newsreader | Encyclopedia prose and longer passages. |
| Inter | Controls, search results and interface labels. |
| JetBrains Mono | Paths, commands, file names and technical facts. |

The theme follows the operating system unless the reader chooses light or dark with
the theme toggle. That choice is saved locally and applied before the page paints.
Motion respects `prefers-reduced-motion`. Focus rings, semantic landmarks, labelled
controls and keyboard navigation are part of the design.

Always spell **quirq** entirely in lowercase, including interface copy, accessible
labels, metadata and documentation. Use the approved quirq logo for branding, preserve
its artwork and proportions, and ask for its file path or URL if it is unavailable.
Do not invent a logo or replace it with a text-only wordmark.

## Customization

Appearance and interface behavior currently live in code: tokens in `app/globals.css`,
fonts and page metadata in `app/layout.tsx`, and copy and layout in the route and
component files. [`innernet.config.json`](../../innernet.config.json) configures the
crawler's roots and depth; it does not customize the UI.

The [JSON customization feature](https://github.com/quirq-ai/innernet/issues/2) will
give branding and UI settings a documented schema so people can change their instance
without editing components. It is planned work, not an available configuration API yet.

## Explore the source

| Path | Responsibility |
| --- | --- |
| [`app/`](../../app) | Routes, page metadata, root layout and shared CSS. |
| [`components/top-bar.tsx`](../../components/top-bar.tsx) · [`components/site-footer.tsx`](../../components/site-footer.tsx) | Shared navigation and small print. |
| [`components/home/`](../../components/home) · [`components/search/`](../../components/search) | Home, results, panels and search controls. |
| [`components/wiki/`](../../components/wiki) | Articles, stubs, categories and special pages. |
| [`components/guide/`](../../components/guide) | The field guide and its interactive examples. |
| [`components/theme-toggle.tsx`](../../components/theme-toggle.tsx) · [`components/wordmark.tsx`](../../components/wordmark.tsx) | Theme choice and product identity. |
| [`lib/links.ts`](../../lib/links.ts) | URL helpers for search, articles, categories and editor links. |

Before opening a PR, run `pnpm -s typecheck`. For visible changes, check light and dark
themes at desktop and phone widths, including an empty or missing index. Follow the
[contribution checklist](../../CONTRIBUTING.md#pull-request-checklist) and
[design conventions](../../DESIGN.md) for the complete workflow.
