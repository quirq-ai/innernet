# Architecture documents

Three linked documents that describe how Innernet is built, what data it keeps, and how activity reaches that data. They were written by reading the code and testing it on scratch folders, and every claim cites a file and line.

| Document | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Containers, the runtime paths of a search, a suggestion, a recorded visit and a wiki page, how the index is built, module layers and coupling, security controls, and ranked findings |
| [data.md](data.md) | Every field of `data/index.json`, what the crawler reads to fill it, filtering and redaction, the browsing history, the local and demo databases, how to forget each store, and what leaves the machine |
| [activity.md](activity.md) | How edits, commits, clones, renames, browsing and the passing of time change the index and what the app shows, from an 11-step experiment |

> **Snapshot of commit 4e9bece (3 October 2026).** `main` has since merged #32, #34 and #35, which add agents (dot folders such as `.claude` indexed with their instruction and memory files), the `/sources` page with remote GitHub repositories, and an optional remote database kept in step with the local one. The documents have not yet been updated for those changes; each one opens with a note listing what they affect. Line numbers refer to 4e9bece.

Diagrams are Mermaid, which GitHub renders, and SVG files in [figures/](figures), which follow the reader's light or dark setting.

## Findings

Each document ends its sections with findings: what is wrong, where, why it matters, the evidence, and the smallest fix. The most important ones at this snapshot:

- **Folders inside a secret-looking folder are crawled normally** (`scripts/build-index.ts`): `credentials/aws/README.md` is read and summarised, although the guide says such folders are never opened. See [architecture.md](architecture.md#f1).
- **Folder names and counts from a local index are in public assets** (`public/guide/plates/*.svg`, `film/`). See [data.md](data.md#d2).
- **Cloning, switching branches or copying counts as fresh work** in Recently touched, In the news and search ranking. See [activity.md](activity.md#a1).
