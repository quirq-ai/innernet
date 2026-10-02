# innernet

A personal internet. Search the folders on this machine the way you search the web, and
read every project as an article in **Innerpedia**, the encyclopedia of you.

```bash
pnpm install
pnpm index        # crawl ~/Programming into data/index.json (about a minute)
pnpm dev          # http://localhost:3470, bound to 127.0.0.1 only
```

## What is where

| Path | What |
| --- | --- |
| `scripts/build-index.ts` | The crawler. Reads folder structure, READMEs, CLAUDE.md / AGENTS.md, manifests and git history. |
| `innernet.config.json` | Roots to index and max depth. For one run, `INNERNET_ROOTS=~/a,~/b` replaces the roots and `INNERNET_MAX_DEPTH=3` the depth. |
| `data/index.json` | The index. Local only, gitignored. Rebuild any time; the server picks it up without a restart. `INNERNET_OUT=/tmp/test.json pnpm index` writes a test index there instead and leaves this one alone. |
| `lib/search.ts` | Server-side full-text search (MiniSearch), operators, snippets, suggestions. |
| `lib/data.ts` | Index loader, slug resolution (articles, stubs, disambiguation, categories, special pages). |
| `lib/text.ts` | Markdown-to-text clean-up and secret redaction, shared by the indexer and the server. |
| `lib/normalize.ts` | Brings any index up to the current rules on load: redaction, house style, UTC dates rolled up the tree. |
| `proxy.ts` | Refuses requests that are not addressed to localhost. |
| `app/` | Home `/`, results `/search`, Innerpedia `/wiki` and `/wiki/[slug]`, the field guide `/guide`, `/api/suggest`. |
| `components/guide/` | The field guide: chapters, plates (drawings from `public/guide/plates/<id>.svg`), the folder recipe. |
| `DESIGN.md` | The design spec: tokens, type, every page. |
| `CONTRIBUTING.md` | How to work on Innernet: setup, the checks, conventions, recipes, the pull request checklist. |

## The field guide

Open [/guide](http://localhost:3470/guide) (also `/wiki/Help:Contents`) for the illustrated walkthrough: how
the crawl, the index and the two readers work, what turns a folder into an article (with a
recipe that runs the indexer's rules in the browser), search operators and ranking, how to
contribute, and what stays private. Its numbers come from the live index and its code
excerpts from the code itself. To work on Innernet, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Search operators

`lang:rust` · `in:experiments` · `kind:repo` · `fw:next` · `is:article` · `is:stub`

## Privacy

Everything stays on this machine. The indexer reads only READMEs, CLAUDE.md, AGENTS.md
and project manifests (never `.env` or key files, and nothing inside secret-looking
folders), hides secret-looking file names, strips credentials from git remotes, and never
indexes its own `data/`. Credential-shaped values in README text, manifests and commit
subjects (tokens, keys, passwords in database URLs, private keys) are replaced with
`[redacted]` by `redactSecrets` in `lib/text.ts`, both when indexing and when the server
loads an older index (`lib/normalize.ts`).

The server answers only to this machine: `pnpm dev` and `pnpm start` bind to 127.0.0.1,
and `proxy.ts` refuses any request whose Host is not localhost, so a page elsewhere cannot
read the index through DNS rebinding. A Content-Security-Policy keeps the browser on the
same origin (under `next dev` it also allows the hot-reload websocket); the only request
the app makes is to its own `/api/suggest` route.

`next dev` records request URLs, search queries included, in `.next/dev/trace`. Delete
that file whenever you like; it is gitignored and recreated.

## Visual checks

`scripts/shot.sh "/wiki/linear-clone" out.png 1440 2400 dark` takes a headless screenshot
of the running dev server once fonts have loaded and the rise animations have finished,
and names any element that makes the page scroll sideways.
