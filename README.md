<p align="center">
  <img src="app/icon.svg" alt="Innernet sigil" width="64" height="64">
</p>

<h1 align="center"><em>inner</em>net</h1>

<p align="center">
  <strong>A personal internet, made from your folders.</strong><br>
  Search what you have built. Read the encyclopedia of you.<br>
  <sub>Powered by <a href="https://github.com/quirq-ai">quirq</a></sub>
</p>

<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="#search-your-folders">Search</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="#contributing">Contributing</a>
</p>

Innernet turns the folders on your machine into a small, connected web. Find a project
by its name, language, framework or README text, then open its **Innerpedia** article
to see what it does, how it is organised and how it has changed.

Your existing folders are the source material. One local JSON index powers both readers.

| Explore | What you will find |
| --- | --- |
| **Search** · `/` and `/search` | A familiar search box, highlighted results, live suggestions, spelling corrections and project knowledge panels. |
| **Innerpedia** · `/wiki` | Project articles with README overviews, folder trees, technology, Git history and related projects. Browse categories, statistics or a random article. |
| **Field guide** · `/#guide` | The second half of the home page: an illustrated walkthrough of the crawl, search and privacy rules, an interactive recipe for turning a folder into an article, and a prompt that hands Innernet to an AI assistant. |
| **History** · `/activity` | Every page you opened, one session per browser tab, kept as plain files on this machine. The header's arrows step back and forward. |

## The public demo (Vercel)

The same app runs as a public demo at https://innernet-nine.vercel.app. Instead of this
machine, it indexes the open-source repositories of github.com/quirq-ai:

```bash
pnpm index:demo   # clone the public quirq-ai repos (anonymous HTTPS) and build data/demo/index.json
pnpm dev:demo     # preview the demo locally
```

`data/demo/index.json` is committed, and every path in it is a GitHub URL. Vercel builds
always run the demo (`VERCEL=1`); locally `INNERNET_DEMO=1` switches it on (`lib/mode.ts`).
In the demo the localhost guard is off, a banner says what you are looking at, folders
link to GitHub instead of VS Code, and the guide plays the committed 720p film.

## How it works

```mermaid
flowchart LR
    folders["Your folders"] --> crawler["Crawler<br>READMEs, manifests, Git metadata"]
    crawler --> index["Local index<br>data/index.json"]
    index --> search["Search<br>Find a project"]
    index --> wiki["Innerpedia<br>Read its story"]
```

The crawler records folder structure, project descriptions, languages, dependencies and
Git history. Innerpedia assembles articles from that information; folders with less
project context become **stubs**. Shared names get disambiguation pages, and categories
connect projects across your directory tree.

Search runs on the server with MiniSearch. The app uses Next.js, React, TypeScript and
Tailwind CSS, with Markdown rendered by react-markdown and remark-gfm.

## Get started

You need **Node.js 20.9 or newer** and **pnpm**. Run the commands from the repository
directory so the server can find its index.

**1. Install**

```bash
git clone https://github.com/quirq-ai/innernet.git
cd innernet
pnpm install
```

**2. Choose your folders**

Edit [`innernet.config.json`](innernet.config.json) before indexing. The defaults are:

```json
{
  "roots": ["~/Programming"],
  "maxDepth": 6
}
```

Add or replace roots with the folders you want to explore. `maxDepth` controls how many
levels of folders get their own pages.

**3. Index and open**

```bash
pnpm index
pnpm dev
```

Open **[localhost:3470](http://localhost:3470)**, search for a familiar project, or visit
**[Innerpedia](http://localhost:3470/wiki)** and the **[field guide](http://localhost:3470/#guide)**.
Both `pnpm dev` and `pnpm start` bind to `127.0.0.1`.

The first dev run or build needs network access to fetch fonts. Afterward, the fonts
are served locally.

### Keep the index fresh

Run `pnpm index` after your folders change. The server picks up the new index on the
next request without a restart.

For a single run, override the configured roots and depth:

```bash
INNERNET_ROOTS="~/projects,~/notes" INNERNET_MAX_DEPTH=3 pnpm index
```

To inspect a trial index without replacing the app's index:

```bash
INNERNET_ROOTS="~/projects" INNERNET_OUT=/tmp/innernet-test.json pnpm index
```

The app always reads `data/index.json` from its working directory; `INNERNET_OUT` only
changes where the crawler writes.

## Search your folders

Start with ordinary words, then narrow the results with operators. Search covers
project names, paths, descriptions, README text, dependencies and agent notes.

| Try | Finds |
| --- | --- |
| `lang:rust` | Folders whose leading languages include Rust. |
| `in:experiments` | Folders inside a matching ancestor folder. |
| `kind:repo` | Git repositories. |
| `fw:next` | Projects using Next.js. |
| `is:article` | Innerpedia articles. |
| `is:stub` | Folders with less project context. |

Combine them with free text, such as `chat lang:ts fw:next`. Quote values containing
spaces, such as `in:"side projects"`. Results can also be filtered using the
**Projects**, **Repositories**, **Documents** and **Folders** tabs.

## History

Innernet writes down what you open, in plain files on this machine. There is no
database, no index file and no schema registry: a session is a folder, and each app
that takes part writes its own JSON Lines file inside it.

```text
~/.innernet/history/                  set INNERNET_HISTORY_DIR to keep it elsewhere
  2026-10-03T05-12-07Z_k3f9a2/        one folder per browser tab: its start time (UTC) and a short id
    innernet.jsonl                    one JSON object per line, appended by Innernet
    <any-app>.jsonl                   any other app or tool adds its own file
```

Every line is `{"at":"<ISO time>","app":"<name>","kind":"<verb>", ...}` plus whatever
fields the app likes. Innernet writes `visit`, `search`, `back` and `forward`:

```json
{"at":"2026-10-03T05:12:09.512Z","app":"innernet","kind":"visit","url":"/wiki/galileo","title":"galileo"}
{"at":"2026-10-03T05:12:31.020Z","app":"innernet","kind":"search","q":"agent","url":"/search?q=agent"}
```

Reading a session means reading every `*.jsonl` in its folder and sorting by `at`.
App names are lowercase letters, digits, `-` and `_`; lines over 4 KB, lines that are
not JSON and lines without a valid `at` and `kind` are skipped. To add your own
activity, append a line to a file named after your app. This joins the newest session:

```bash
echo '{"at":"'$(date -u +%FT%TZ)'","app":"notes","kind":"edit","file":"todo.md"}' >> "$(ls -d ~/.innernet/history/*/ | tail -1)notes.jsonl"
```

**[/activity](http://localhost:3470/activity)**, the clock in the header, shows the
sessions newest first, each opening onto its events merged across apps. The header's
arrows step back and forward through the pages of the current tab. The browser writes
through the app's own `/api/activity` route, which accepts only same-origin requests
on localhost, and browsers driven by automation are not recorded. Delete a session's
folder to forget it. On the public demo nothing is sent to or stored on the server: the
same events stay in the visitor's own `localStorage`.

## Privacy

Innernet is built to read and serve your project context on your machine.

- **Local index.** `data/index.json` contains local paths and project text. It is
  gitignored, and the crawler skips its own `data/`, dependency folders, generated
  folders and symlinks.
- **Limited content reads.** The crawler reads READMEs, `CLAUDE.md` or `AGENTS.md`,
  project manifests and Git metadata, plus a repository's or project's own logo image,
  found by name (`logo`, `icon`, `mark`, `favicon` and the like, up to 64 KB for SVG
  and 96 KB for other images) under the same secret-folder and secret-name rules, with
  symlinks never followed. It does not read `.env`, key files or arbitrary source and
  document contents. The Documents tab classifies folders by file names and types.
- **Redaction.** Secret-looking file names are hidden, credentials are stripped from
  Git remotes, and credential-shaped text becomes `[redacted]` during indexing and
  when an older index is loaded.
- **Local serving.** The server binds to loopback, rejects non-localhost Host headers
  and sets a Content-Security-Policy that keeps the browser on the same origin.
  Development also allows websockets for hot reload. The browser calls only two of the
  app's own routes: `/api/suggest` for suggestions, and `/api/activity` to write the
  [history](#history), which accepts same-origin requests on localhost only. The public
  demo sends nothing to `/api/activity` (it answers 404 there) and keeps each visitor's
  history in their own `localStorage`.

During development, Next.js records request URLs, including search queries, in
`.next/dev/trace`. That file is gitignored and can be deleted.

## Contributing

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** for the development loop and PR checklist,
**[DESIGN.md](DESIGN.md)** for visual and writing conventions, and the
**[field guide](http://localhost:3470/#guide)** for an explanation of the app's rules.

Run the required check before opening a PR:

```bash
pnpm -s typecheck
```

<details>
<summary><strong>Explore the source</strong></summary>

| Path | Responsibility |
| --- | --- |
| [`scripts/build-index.ts`](scripts/build-index.ts) | Crawl configured roots and write the index. |
| [`innernet.config.json`](innernet.config.json) | Set roots and maximum depth. |
| `data/index.json` | Local, generated index. Rebuild with `pnpm index`; never commit it. |
| [`lib/search.ts`](lib/search.ts) | MiniSearch, operators, ranking, snippets and suggestions. |
| [`lib/data.ts`](lib/data.ts) | Load the index and resolve articles, stubs, categories and other pages. |
| [`lib/text.ts`](lib/text.ts) · [`lib/normalize.ts`](lib/normalize.ts) | Clean and redact text; bring older indexes up to current rules. |
| [`lib/logo.ts`](lib/logo.ts) | Serve each project's logo from the index at `/api/logo/<hash>`, so pages link to it instead of inlining it. |
| [`lib/activity.ts`](lib/activity.ts) | Read and append the history: one folder per session, one JSON Lines file per app. |
| [`app/`](app) · [`components/`](components) | Search, Innerpedia, the field guide and the history. |
| [`proxy.ts`](proxy.ts) · [`next.config.ts`](next.config.ts) | Localhost checks and browser security headers. |
| [`scripts/shot.sh`](scripts/shot.sh) | Capture settled app screenshots and report horizontal overflow. |

For UI changes, use the screenshot workflow in [CONTRIBUTING.md](CONTRIBUTING.md)
to check both themes at desktop and phone widths.

</details>
