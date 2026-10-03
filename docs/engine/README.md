# The Innernet engine

The engine turns local folders into one searchable JSON index. It discovers projects,
records their context, connects related folders and supplies the data used by Search
and Innerpedia. The [UI](../ui/README.md) presents that data as results and articles.

Engine and UI describe responsibilities within this repository, sharing one
application and dependency set. They are not standalone packages.
Indexing roots and depth use `innernet.config.json`; the separate `innernet.ui.json`
controls presentation without changing the index or search operators.

## Build an index

Use Node.js 20.9 or newer and pnpm. From the repository directory:

```bash
pnpm install
```

Choose your roots below before running `pnpm index`. The crawler writes
`data/index.json`. To use it in the app, run `pnpm dev` from the same repository
directory and open [localhost:3470](http://localhost:3470).

### Choose the roots and depth

Edit [`innernet.config.json`](../../innernet.config.json). Its defaults are:

```json
{
  "roots": ["~/Programming"],
  "maxDepth": 6
}
```

Roots may use `~` for your home directory. Each root is depth zero. `maxDepth` limits
pages; deeper folders still contribute counts, language totals and dates.

Build the index with your chosen configuration:

```bash
pnpm index
```

Override the configuration for one run:

```bash
INNERNET_ROOTS="~/projects,~/notes" INNERNET_MAX_DEPTH=3 pnpm index
```

Build a trial index without replacing the app's index:

```bash
INNERNET_ROOTS="~/projects" INNERNET_OUT=/tmp/innernet-test.json pnpm index
```

`INNERNET_OUT` only changes the crawler's destination. In local mode, the app reads
`data/index.json` relative to its working directory, so it will not display that trial
index. Inspect the trial file directly. Run the server from the repository directory.

Run `pnpm index` after your folders change. The server notices the updated file on the
next request and rebuilds its search engine without a restart. The crawler writes a
temporary file and renames it into place so the server does not read a partial index.

## Public demo

The demo is a separate, public index of [quirq-ai](https://github.com/quirq-ai)
repositories. Preview the committed index with `pnpm dev:demo`. Refresh it with:

```bash
pnpm index:demo
```

[`scripts/build-demo-index.ts`](../../scripts/build-demo-index.ts) fetches the public
repository list from GitHub without authentication. It clones only public repositories
into the gitignored `.demo-cache/`, removes cached repositories no longer on that list,
and runs the crawler against those clones. GitHub URLs replace local paths, and the
build fails if the resulting index still names this machine. It writes
`data/demo/index.json`, which is intended to be committed.

`INNERNET_DEMO=1` selects that file instead of `data/index.json`. Vercel selects demo
mode automatically, and a demo build retains the mode at runtime. The server never
falls back to the local index in demo mode. Local mode permits localhost Host headers
only; demo mode accepts public hosts because its index contains public repositories.
Deployment tracing includes the demo index and excludes the local index and clone cache.

## What the crawler records

The crawler walks folder structure and records file names, counts, sizes and dates.
File extensions indicate languages and document or media collections. Project context
comes from READMEs, agent notes, manifests and local Git metadata.

- A repository has its own `.git`; a project may be identified by a manifest,
  a substantial README or agent notes.
- Roots and folders with sufficient project context become articles; others are stubs.
- Shared folder names receive qualified slugs and disambiguation lists.
- Categories connect articles by collection, language, framework, year and other
  metadata. Related projects are selected from shared names, dependencies and context.

Document classification uses file names and extensions. It does not extract PDF,
Word or arbitrary source file contents for full-text search.

## The index contract

[`lib/types.ts`](../../lib/types.ts) defines the plain JSON structure shared by the
crawler and the readers:

| Field | Contains |
| --- | --- |
| `meta` | Generation time, roots, maximum depth, counts and crawl duration. |
| `pages` | Folder identity, kind, article status, structure, text, technology and Git facts. |
| `disambiguation` | Shared names, their primary topic when one exists, and matching slugs. |

[`lib/normalize.ts`](../../lib/normalize.ts) applies redaction, text clean-up and date
rollups before writing and loading older indexes. It derives missing fields from the index.

[`lib/data.ts`](../../lib/data.ts) loads and caches the file, builds lookup maps and
resolves article, stub, category, disambiguation and special-page slugs. A missing
index produces empty data so the UI can explain how to build one.

## Search your folders

[`lib/search.ts`](../../lib/search.ts) uses MiniSearch on the server. It searches names,
paths, descriptions, README text, dependencies, categories, languages, frameworks and
agent notes. Ranking favours useful project context, with prefix and fuzzy matching.
The response includes highlighted snippets, tab counts, spelling suggestions and a
knowledge-panel candidate when there is a clear match.

| Operator | Example | Narrows results to |
| --- | --- | --- |
| `lang:` | `lang:rust` | Folders whose leading languages include Rust. |
| `in:` | `in:experiments` | Folders inside a matching ancestor in their relative path. |
| `kind:` | `kind:repo` | A folder kind: `repo`, `project`, `docs`, `assets`, `code` or `folder`. |
| `fw:` | `fw:next` | A detected framework, such as Next.js. |
| `is:` | `is:article` or `is:stub` | Articles or stubs. |

Combine operators with free text: `chat lang:ts fw:next`. Quote values containing
spaces: `in:"side projects"`.

Check a query from the repository directory:

```bash
pnpm tsx --conditions=react-server scripts/try-search.ts "chat lang:ts"
```

`lib/data.ts` and `lib/search.ts` import `server-only`, so terminal consumers need
`--conditions=react-server`. The UI calls them directly. `/api/suggest` is the browser
suggestion endpoint; there is no general HTTP search API.

## Privacy boundaries

- Content reads are limited to READMEs, `CLAUDE.md` or `AGENTS.md`, project manifests
  and Git metadata. Parsed manifests are `package.json`, `pyproject.toml`, `Cargo.toml`,
  `go.mod` and `requirements.txt`; `.env`, key files and other content are not read.
- The crawler skips dependency and generated folders, symlinks and its own `data/`.
  Secret-looking file names are hidden from listings.
- Credentials are stripped from Git remotes. Credential-shaped text is redacted
  during indexing and when an older index is loaded.
- The local index contains local paths and project text. It stays local and is
  gitignored. The local server binds to loopback and rejects non-localhost Host headers.
  The [public demo](#public-demo) uses its separate public-only index and accepts
  public Host headers.
- The UI's Content-Security-Policy restricts resources to the same origin, with
  development websockets allowed for hot reload. Suggestions use `/api/suggest`.

During development, Next.js records request URLs, including search queries, in
`.next/dev/trace`. That file is gitignored and can be deleted.

## Working on the engine

| Source | Responsibility |
| --- | --- |
| [`scripts/build-index.ts`](../../scripts/build-index.ts) | Configuration, crawl rules, classification, relationships and atomic output. |
| [`scripts/build-demo-index.ts`](../../scripts/build-demo-index.ts) · [`lib/mode.ts`](../../lib/mode.ts) | Public-only demo indexing and mode-specific index selection. |
| [`lib/types.ts`](../../lib/types.ts) | Shared index and page types. |
| [`lib/text.ts`](../../lib/text.ts) | Markdown-to-text extraction, summaries, clean-up and redaction. |
| [`lib/normalize.ts`](../../lib/normalize.ts) | Normalisation of new and older indexes. |
| [`lib/data.ts`](../../lib/data.ts) | File loading, caching, lookups and slug resolution. |
| [`lib/search.ts`](../../lib/search.ts) | Query parsing, filters, ranking, snippets and suggestions. |
| [`scripts/try-search.ts`](../../scripts/try-search.ts) | Terminal query checks. |

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) for checks and extension recipes.
For crawler changes, build and inspect a small trial index before a full crawl.
Run `pnpm -s typecheck`; for search changes, also try a typo and an operator-only query.
