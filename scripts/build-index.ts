// Crawl the configured roots and write data/index.json.
//   pnpm index                                      # uses innernet.config.json
//   INNERNET_ROOTS=~/a,~/b INNERNET_MAX_DEPTH=3 pnpm index   # other roots and depth, one run
//   INNERNET_OUT=/tmp/test.json pnpm index         # writes there; data/index.json is left alone
//
// Privacy rules this script keeps:
//   - It only ever reads README*, CLAUDE.md, AGENTS.md and project manifests. Never .env,
//     keys, or any other file content, and nothing at all inside secret-looking folders.
//   - Secret-looking file names are left out of the listings.
//   - Credential-shaped values in README text, manifests and commit subjects are
//     redacted (lib/text.ts redactSecrets), and git remotes lose any embedded login.
//   - Output stays on this machine (data/ is gitignored), and the indexer never reads
//     its own output back in.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MEDIA_EXT, normalizeIndex, SECRET_NAME, utc } from "../lib/normalize";
import { cleanLine, firstParagraph, markdownToText, readsAsInstructions, redactSecrets } from "../lib/text";
import type { Commit, GitInfo, IndexMeta, Manifest, Page, PageKind, SiteIndex } from "../lib/types";

const started = Date.now();
const projectDir = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(projectDir, "innernet.config.json"), "utf8")) as {
  roots: string[];
  maxDepth: number;
};
const rootSpecs = (process.env.INNERNET_ROOTS?.split(",") ?? config.roots).map((r) => r.trim()).filter(Boolean);
const maxDepth = Number(process.env.INNERNET_MAX_DEPTH ?? config.maxDepth ?? 6);
const outFile = path.resolve(process.env.INNERNET_OUT ?? path.join(projectDir, "data", "index.json"));
// Our own output is never indexed: it would count itself and mark every ancestor
// touched at index time.
const ownData = path.join(projectDir, "data");
const now = new Date();

// ---------------------------------------------------------------- rules

const PRUNE = new Set([
  "node_modules", "bower_components", "jspm_packages", "vendor", ".git", ".hg", ".svn",
  ".next", ".nuxt", ".svelte-kit", ".turbo", ".vercel", ".cache", ".parcel-cache", ".output",
  "dist", "build", "out", "coverage", "target", "DerivedData", "Pods",
  "__pycache__", "venv", ".venv", "site-packages", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".gradle", ".dart_tool", ".idea", ".vscode", ".expo", "storybook-static",
]);

const SECRET_DIR = /cred|secret|private|keys?$/i;

const CODE_DIR_NAMES = new Set([
  "src", "lib", "app", "apps", "components", "pages", "hooks", "utils", "util", "routes", "api",
  "server", "client", "scripts", "test", "tests", "__tests__", "styles", "public", "static",
  "assets", "types", "config", "middleware", "models", "services", "store", "stores", "packages",
  "contracts", "migrations", "templates", "layouts", "views", "controllers", "helpers", "core",
]);

const LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", ipynb: "Jupyter", rs: "Rust", go: "Go", sol: "Solidity", dart: "Dart",
  swift: "Swift", kt: "Kotlin", java: "Java", rb: "Ruby", php: "PHP", c: "C", h: "C",
  cpp: "C++", cc: "C++", hpp: "C++", cs: "C#", lua: "Lua", zig: "Zig", ex: "Elixir",
  sh: "Shell", zsh: "Shell", bash: "Shell", html: "HTML", css: "CSS", scss: "CSS",
  vue: "Vue", svelte: "Svelte", astro: "Astro", md: "Markdown", mdx: "MDX",
  sql: "SQL", glsl: "GLSL", wgsl: "WGSL", json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML",
};
const NON_CODE_LANGS = new Set(["Markdown", "MDX", "JSON", "YAML", "TOML", "HTML", "CSS"]);
const DOC_EXT = new Set(["md", "mdx", "html", "pdf", "txt", "docx", "doc", "rtf", "pages", "key", "pptx", "numbers", "csv", "xlsx"]);

const FRAMEWORKS: [string, string][] = [
  ["next", "Next.js"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"],
  ["@sveltejs/kit", "SvelteKit"], ["astro", "Astro"], ["vite", "Vite"], ["three", "Three.js"],
  ["@react-three/fiber", "React Three Fiber"], ["tailwindcss", "Tailwind CSS"],
  ["@tauri-apps/api", "Tauri"], ["electron", "Electron"], ["express", "Express"],
  ["fastify", "Fastify"], ["hono", "Hono"], ["@nestjs/core", "NestJS"], ["remotion", "Remotion"],
  ["fumadocs-core", "Fumadocs"], ["@clerk/nextjs", "Clerk"], ["drizzle-orm", "Drizzle"],
  ["@prisma/client", "Prisma"], ["ethers", "ethers.js"], ["viem", "viem"], ["wagmi", "wagmi"],
  ["hardhat", "Hardhat"], ["@anthropic-ai/sdk", "Anthropic SDK"],
  ["@anthropic-ai/claude-agent-sdk", "Claude Agent SDK"], ["openai", "OpenAI SDK"], ["ai", "AI SDK"],
  ["zustand", "Zustand"], ["gsap", "GSAP"], ["framer-motion", "Framer Motion"], ["motion", "Motion"],
  ["d3", "D3"], ["expo", "Expo"], ["react-native", "React Native"], ["@mui/material", "MUI"],
  ["@radix-ui/react-dialog", "Radix UI"], ["socket.io", "Socket.IO"], ["@supabase/supabase-js", "Supabase"],
  ["mongoose", "MongoDB"], ["pg", "PostgreSQL"], ["stripe", "Stripe"], ["@vercel/sandbox", "Vercel Sandbox"],
  ["@modelcontextprotocol/sdk", "MCP"], ["langchain", "LangChain"], ["hyperframes", "HyperFrames"],
];
const PY_FRAMEWORKS: [RegExp, string][] = [
  [/\bfastapi\b/i, "FastAPI"], [/\bflask\b/i, "Flask"], [/\bdjango\b/i, "Django"],
  [/\bstreamlit\b/i, "Streamlit"], [/\blangchain/i, "LangChain"], [/\bopenai\b/i, "OpenAI SDK"],
  [/\banthropic\b/i, "Anthropic SDK"], [/\btorch\b/i, "PyTorch"], [/\bpandas\b/i, "pandas"],
  [/\bagno\b/i, "Agno"], [/\bqdrant/i, "Qdrant"], [/\bpeewee\b/i, "Peewee"], [/\bweb3\b/i, "web3.py"],
  [/\bccxt\b/i, "ccxt"], [/\bselenium\b/i, "Selenium"], [/\bnumpy\b/i, "NumPy"],
];

// ---------------------------------------------------------------- helpers

const expand = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
const label = (p: string) => (p.startsWith(os.homedir()) ? "~" + p.slice(os.homedir().length) : p);
const iso = (ms: number | null) => (ms && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);
const extOf = (f: string) => {
  const i = f.lastIndexOf(".");
  return i > 0 ? f.slice(i + 1).toLowerCase() : "";
};
const pruned = (dir: string, name: string) =>
  PRUNE.has(name) || name.startsWith(".") || name.endsWith(".app") || name.endsWith(".xcassets") || path.join(dir, name) === ownData;

function readText(file: string, max = 14_000): string | null {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(max);
    const n = fs.readSync(fd, buf, 0, max, 0);
    fs.closeSync(fd);
    return buf.subarray(0, n).toString("utf8");
  } catch {
    return null;
  }
}

function stripCreds(url: string): string {
  let u = url.trim().replace(/\/\/[^/@\s]+@/, "//");
  const ssh = u.match(/^git@([^:]+):(.+?)(\.git)?$/);
  if (ssh) u = `https://${ssh[1]}/${ssh[2]}`;
  return u.replace(/\.git$/, "");
}

function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function parseManifest(dir: string, files: Set<string>): Manifest | null {
  if (files.has("package.json")) {
    try {
      const pkg = JSON.parse(readText(path.join(dir, "package.json"), 400_000) ?? "{}");
      return {
        file: "package.json",
        name: typeof pkg.name === "string" ? pkg.name : null,
        version: typeof pkg.version === "string" ? pkg.version : null,
        description: typeof pkg.description === "string" ? cleanLine(pkg.description) : null,
        scripts: Object.keys(pkg.scripts ?? {}).slice(0, 20),
        dependencies: Object.keys(pkg.dependencies ?? {}),
        devDependencies: Object.keys(pkg.devDependencies ?? {}),
      };
    } catch {
      /* fall through */
    }
  }
  for (const file of ["pyproject.toml", "Cargo.toml"] as const) {
    if (!files.has(file)) continue;
    const t = readText(path.join(dir, file), 60_000) ?? "";
    const field = (k: string) => t.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, "m"))?.[1] ?? null;
    const deps = [...t.matchAll(/^\s*"?([A-Za-z0-9_.-]+)\s*(?:[=<>~^!].*)?"?,?\s*$/gm)]
      .map((m) => m[1])
      .filter((d) => !/^(name|version|description|authors|readme|license|edition|requires-python|python)$/i.test(d));
    const description = field("description");
    return { file, name: field("name"), version: field("version"), description: description && cleanLine(description), scripts: [], dependencies: [...new Set(deps)].slice(0, 60), devDependencies: [] };
  }
  if (files.has("go.mod")) {
    const t = readText(path.join(dir, "go.mod"), 60_000) ?? "";
    const deps = [...t.matchAll(/^\s+([\w./-]+)\s+v[\w.+-]+/gm)].map((m) => m[1]);
    return { file: "go.mod", name: t.match(/^module\s+(\S+)/m)?.[1] ?? null, version: null, description: null, scripts: [], dependencies: deps, devDependencies: [] };
  }
  if (files.has("requirements.txt")) {
    const t = readText(path.join(dir, "requirements.txt"), 60_000) ?? "";
    const deps = t.split("\n").map((l) => l.trim().split(/[=<>~!\[;\s]/)[0]).filter((d) => d && !d.startsWith("#") && !d.startsWith("-"));
    return { file: "requirements.txt", name: null, version: null, description: null, scripts: [], dependencies: [...new Set(deps)], devDependencies: [] };
  }
  return null;
}

function gitInfo(dir: string): GitInfo | null {
  const log = git(dir, ["log", "--no-merges", "-n", "6000", "--format=%h%x1f%aI%x1f%an%x1f%s"]);
  const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const remoteRaw = git(dir, ["config", "--get", "remote.origin.url"]);
  // Counted the same way as the log above (no merges), so the total, the monthly chart
  // and the author list on one page agree.
  const countRaw = git(dir, ["rev-list", "--count", "--no-merges", "HEAD"]);
  // Root commits, so a history longer than the log cap still starts where it started.
  const roots = (git(dir, ["log", "--max-parents=0", "--format=%aI", "HEAD"]) ?? "").split("\n").filter(Boolean);
  const commits: Commit[] = (log ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author, subject] = line.split("\x1f");
      return { hash, date, author, subject: cleanLine((subject ?? "").slice(0, 160)) };
    });
  if (!commits.length && !branch) return null;

  const authors = new Map<string, number>();
  const monthly = new Map<string, number>();
  for (const c of commits) {
    authors.set(c.author, (authors.get(c.author) ?? 0) + 1);
    const m = c.date.slice(0, 7);
    monthly.set(m, (monthly.get(m) ?? 0) + 1);
  }
  const months: { month: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, count: monthly.get(key) ?? 0 });
  }
  const md = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const onThisDay = commits.filter((c) => c.date.slice(5, 10) === md && Number(c.date.slice(0, 4)) < now.getFullYear()).slice(0, 10);

  return {
    branch: branch && branch !== "HEAD" ? branch : null,
    remote: remoteRaw ? stripCreds(remoteRaw) : null,
    commitCount: Number(countRaw) || commits.length,
    firstCommit: utc([...roots, commits.at(-1)?.date].filter(Boolean).sort((a, b) => Date.parse(a!) - Date.parse(b!))[0]),
    lastCommit: utc(commits[0]?.date),
    recent: commits.slice(0, 15),
    authors: [...authors].map(([name, n]) => ({ name, commits: n })).sort((a, b) => b.commits - a.commits).slice(0, 8),
    authorCount: authors.size,
    monthly: months,
    onThisDay,
  };
}

// ---------------------------------------------------------------- crawl

interface Raw {
  page: Page;
  langCounts: Map<string, number>;
  docs: number; // document files in the subtree
  minBirth: number;
  maxMtime: number;
  childRaws: Raw[];
  ancestors: string[]; // folder names from root down to parent
}

/** Counts what lies below a folder at the depth limit without indexing it, so totals,
 * dates and languages stay true to the disk. Capped, so one huge tree cannot stall a run. */
function tally(dirs: string[]) {
  const t = { folders: 0, files: 0, bytes: 0, docs: 0, minBirth: Infinity, maxMtime: 0, langs: new Map<string, number>() };
  const stack = [...dirs];
  let budget = 200_000;
  while (stack.length && budget > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.some((e) => e.isFile() && e.name === "pyvenv.cfg")) continue;
    t.folders++;
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!pruned(dir, e.name)) stack.push(path.join(dir, e.name));
        continue;
      }
      if (!e.isFile() || e.name.startsWith(".")) continue;
      budget--;
      t.files++;
      try {
        const st = fs.statSync(path.join(dir, e.name));
        t.bytes += st.size;
        if (st.birthtimeMs > 0) t.minBirth = Math.min(t.minBirth, st.birthtimeMs);
        t.maxMtime = Math.max(t.maxMtime, st.mtimeMs);
      } catch {
        /* unreadable file */
      }
      const ext = extOf(e.name);
      if (DOC_EXT.has(ext)) t.docs++;
      const lang = LANG[ext];
      if (lang) t.langs.set(lang, (t.langs.get(lang) ?? 0) + 1);
    }
  }
  return t;
}

const raws: Raw[] = [];

function crawl(dir: string, rootLabel: string, rootPath: string, depth: number, ancestors: string[]): Raw | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const name = depth === 0 ? path.basename(dir) : path.basename(dir);
  const fileNames: string[] = [];
  const fileSet = new Set<string>();
  const subdirs: string[] = [];
  const hidden: string[] = [];
  let bytes = 0;
  let minBirth = Infinity;
  let maxMtime = 0;
  const langCounts = new Map<string, number>();
  let isVenv = false;

  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (pruned(dir, e.name)) {
        if (!e.name.startsWith(".") || e.name === ".git") hidden.push(e.name);
        if (e.name === ".git") fileSet.add(".git");
        continue;
      }
      subdirs.push(e.name);
    } else if (e.isFile()) {
      fileSet.add(e.name);
      if (e.name === "pyvenv.cfg") isVenv = true;
      if (e.name.startsWith(".")) continue;
      try {
        const st = fs.statSync(path.join(dir, e.name));
        bytes += st.size;
        if (st.birthtimeMs > 0) minBirth = Math.min(minBirth, st.birthtimeMs);
        maxMtime = Math.max(maxMtime, st.mtimeMs);
      } catch {
        /* unreadable file */
      }
      const ext = extOf(e.name);
      const lang = LANG[ext];
      if (lang) langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
      fileNames.push(e.name);
    }
  }
  if (isVenv && depth > 0) return null;
  // .git can also be a file (worktrees, submodules)
  const hasGit = fileSet.has(".git");

  // A secret-looking folder is listed by name only: no file names, nothing read.
  const secretDir = SECRET_DIR.test(name);
  const visibleFiles = secretDir ? [] : fileNames.filter((f) => !SECRET_NAME.some((re) => re.test(f)));
  visibleFiles.sort((a, b) => a.localeCompare(b));

  const readmeFile = secretDir ? null : (fileNames.find((f) => /^readme(\.(md|mdx|markdown|txt|rst))?$/i.test(f)) ?? null);
  const readmeRaw = readmeFile ? readText(path.join(dir, readmeFile)) : null;
  const readme = readmeRaw ? redactSecrets(readmeRaw.replace(/\r\n/g, "\n").trim()) || null : null;
  const agentFile = secretDir ? undefined : ["CLAUDE.md", "AGENTS.md"].find((f) => fileSet.has(f));
  const agentNotes = agentFile ? firstParagraph(readText(path.join(dir, agentFile), 20_000) ?? "") : null;
  const manifest = secretDir ? null : parseManifest(dir, fileSet);

  const markers: string[] = [];
  if (hasGit) markers.push("git");
  for (const f of ["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "pubspec.yaml", "Dockerfile", "docker-compose.yml", "CLAUDE.md", "AGENTS.md", "foundry.toml"]) {
    if (fileSet.has(f)) markers.push(f);
  }
  if (readmeFile) markers.push("README");
  for (const f of fileNames) {
    const m = f.match(/^(next|vite|astro|svelte|nuxt|tailwind|hardhat|remotion|vitest|playwright)\.config\./);
    if (m && !markers.includes(m[1])) markers.push(m[1]);
  }

  const frameworks = new Set<string>();
  if (manifest?.file === "package.json") {
    const all = new Set([...manifest.dependencies, ...manifest.devDependencies]);
    for (const [dep, fw] of FRAMEWORKS) if (all.has(dep)) frameworks.add(fw);
  } else if (manifest) {
    const blob = manifest.dependencies.join(" ");
    for (const [re, fw] of PY_FRAMEWORKS) if (re.test(blob)) frameworks.add(fw);
  }
  if (fileSet.has("pubspec.yaml")) frameworks.add("Flutter");
  if (fileSet.has("foundry.toml")) frameworks.add("Foundry");

  const relPath = path.relative(rootPath, dir);
  const page: Page = {
    slug: "",
    name,
    title: name,
    path: dir,
    relPath,
    root: rootLabel,
    depth,
    kind: "folder",
    isArticle: false,
    parent: null,
    partOf: null,
    children: [],
    hiddenChildren: hidden.sort(),
    files: visibleFiles.slice(0, 24),
    fileCount: fileNames.length,
    totalFiles: fileNames.length,
    bytes,
    totalBytes: bytes,
    created: null,
    modified: null,
    languages: [],
    markers,
    frameworks: [...frameworks],
    manifest,
    summary: null,
    readme,
    readmeFile,
    agentNotes,
    git: hasGit ? gitInfo(dir) : null,
    categories: [],
    related: [],
    words: readme ? markdownToText(readme).split(" ").length : 0,
  };

  const docs = fileNames.filter((f) => DOC_EXT.has(extOf(f))).length;
  const raw: Raw = { page, langCounts, docs, minBirth, maxMtime, childRaws: [], ancestors };
  raws.push(raw);
  // A repository is as old as its first commit and was touched at its last, and so are
  // the folders that hold it.
  if (page.git?.firstCommit) raw.minBirth = Math.min(raw.minBirth, Date.parse(page.git.firstCommit));
  if (page.git?.lastCommit) raw.maxMtime = Math.max(raw.maxMtime, Date.parse(page.git.lastCommit));

  subdirs.sort((a, b) => a.localeCompare(b));
  if (depth < maxDepth) {
    for (const sub of subdirs) {
      const child = crawl(path.join(dir, sub), rootLabel, rootPath, depth + 1, [...ancestors, name]);
      if (child) raw.childRaws.push(child);
    }
  } else if (subdirs.length) {
    // At the limit: not indexed, but counted, so this folder is never called empty.
    const t = tally(subdirs.map((sub) => path.join(dir, sub)));
    if (t.folders) {
      page.deeper = { names: subdirs, folders: t.folders, files: t.files };
      page.totalFiles += t.files;
      page.totalBytes += t.bytes;
      raw.docs += t.docs;
      raw.minBirth = Math.min(raw.minBirth, t.minBirth);
      raw.maxMtime = Math.max(raw.maxMtime, t.maxMtime);
      for (const [k, v] of t.langs) raw.langCounts.set(k, (raw.langCounts.get(k) ?? 0) + v);
    }
  }

  // Roll the subtree up into this folder.
  for (const c of raw.childRaws) {
    page.totalFiles += c.page.totalFiles;
    page.totalBytes += c.page.totalBytes;
    raw.docs += c.docs;
    raw.minBirth = Math.min(raw.minBirth, c.minBirth);
    raw.maxMtime = Math.max(raw.maxMtime, c.maxMtime);
    for (const [k, v] of c.langCounts) raw.langCounts.set(k, (raw.langCounts.get(k) ?? 0) + v);
  }
  page.docFiles = raw.docs;
  page.modified = iso(raw.maxMtime || null);
  // Files copied in keep an older mtime than their birth; the older one is the truth.
  page.created = iso(Number.isFinite(raw.minBirth) ? Math.min(raw.minBirth, raw.maxMtime || Infinity) : null);
  page.languages = [...raw.langCounts].map(([n, files]) => ({ name: n, files })).sort((a, b) => b.files - a.files).slice(0, 8);

  // Kind.
  const direct = fileNames.length;
  const share = (set: Set<string>) => (direct ? fileNames.filter((f) => set.has(extOf(f))).length / direct : 0);
  if (hasGit) page.kind = "repo";
  else if (manifest || markers.includes("pubspec.yaml") || (readme && page.words >= 25)) page.kind = "project";
  else if (direct >= 2 && share(DOC_EXT) >= 0.6) page.kind = "docs";
  else if ((direct >= 3 && share(MEDIA_EXT) >= 0.6) || (direct > 0 && !subdirs.length && share(MEDIA_EXT) === 1)) page.kind = "assets";
  else if (CODE_DIR_NAMES.has(name.toLowerCase()) || (direct > 0 && fileNames.filter((f) => LANG[extOf(f)] && !NON_CODE_LANGS.has(LANG[extOf(f)])).length / direct >= 0.5)) page.kind = "code";
  if (agentNotes && page.kind !== "repo") page.kind = "project";
  page.isArticle = depth === 0 || page.kind === "repo" || page.kind === "project" || (page.kind === "docs" && direct >= 4) || !!agentNotes;

  // Agent notes describe the project only sometimes; orders to an agent are no summary.
  page.summary = (readme && firstParagraph(readme)) || manifest?.description || (agentNotes && !readsAsInstructions(agentNotes) ? agentNotes : null);
  return raw;
}

// ---------------------------------------------------------------- run

const roots: { label: string; path: string }[] = [];
for (const spec of rootSpecs) {
  const abs = path.resolve(expand(spec));
  if (!fs.existsSync(abs)) {
    console.warn(`skip missing root ${spec}`);
    continue;
  }
  roots.push({ label: label(abs), path: abs });
  crawl(abs, label(abs), abs, 0, []);
}

// Slugs. Unique folder names keep their bare name. Shared names get a Wikipedia-style
// qualifier from their ancestors, unless one folder is clearly the primary topic (a root,
// or the only article and shallower than every other namesake): it keeps the bare name
// and the others are listed at "<name>_(disambiguation)".
const byName = new Map<string, Raw[]>();
for (const r of raws) {
  const key = r.page.name.toLowerCase();
  byName.set(key, [...(byName.get(key) ?? []), r]);
}
const taken = new Set<string>();
const base = (s: string) => s.replace(/\s+/g, "_");
const disambiguation: SiteIndex["disambiguation"] = {};
const primaryOf = (group: Raw[]): Raw | null => {
  const root = group.find((r) => r.page.depth === 0);
  if (root) return root;
  // The shallowest article, when no other article sits at the same depth.
  const arts = group.filter((r) => r.page.isArticle).sort((a, b) => a.page.depth - b.page.depth);
  if (!arts.length || (arts[1] && arts[1].page.depth === arts[0].page.depth)) return null;
  const a = arts[0];
  return group.every((r) => r === a || r.page.depth > a.page.depth) ? a : null;
};
const primaries = new Map<Raw[], Raw | null>();
for (const group of byName.values()) {
  const primary = group.length === 1 ? group[0] : primaryOf(group);
  primaries.set(group, primary);
  if (primary) {
    primary.page.slug = base(primary.page.name);
    taken.add(primary.page.slug.toLowerCase());
  }
}
for (const group of byName.values()) {
  if (group.length === 1) continue;
  const primary = primaries.get(group) ?? null;
  for (const r of group) {
    if (r === primary) continue;
    const anc = [...r.ancestors].reverse();
    let slug = "";
    let qualifier = "";
    for (let n = 1; n <= anc.length; n++) {
      qualifier = anc.slice(0, n).join(", ");
      slug = `${base(r.page.name)}_(${base(qualifier)})`;
      if (!taken.has(slug.toLowerCase())) break;
    }
    if (!slug || taken.has(slug.toLowerCase())) {
      const stem = slug || base(r.page.name);
      let i = 2;
      while (taken.has(`${stem}_${i}`.toLowerCase())) i++;
      slug = `${stem}_${i}`;
    }
    taken.add(slug.toLowerCase());
    r.page.slug = slug;
    r.page.title = qualifier ? `${r.page.name} (${qualifier})` : r.page.name;
  }
  // Articles first, then shallow, then recent.
  const sorted = [...group].sort(
    (a, b) => Number(b.page.isArticle) - Number(a.page.isArticle) || a.page.depth - b.page.depth || (b.page.modified ?? "").localeCompare(a.page.modified ?? ""),
  );
  disambiguation[base(group[0].page.name)] = { primary: primary?.page.slug ?? null, slugs: sorted.map((r) => r.page.slug) };
}

// Parent / child links, and the nearest enclosing project.
for (const r of raws) {
  r.page.children = r.childRaws.map((c) => c.page.slug);
  for (const c of r.childRaws) c.page.parent = r.page.slug;
}
const rawByPath = new Map(raws.map((r) => [r.page.path, r]));
for (const r of raws) {
  let dir = path.dirname(r.page.path);
  while (rawByPath.has(dir)) {
    const anc = rawByPath.get(dir)!;
    if (anc.page.manifest && anc.page.depth > 0) {
      r.page.partOf = anc.page.slug;
      break;
    }
    dir = path.dirname(dir);
  }
}

// Categories (articles only).
const articleChildCount = new Map<Raw, number>();
for (const r of raws) articleChildCount.set(r, r.childRaws.filter((c) => c.page.isArticle).length);
const titleBySlug = new Map(raws.map((r) => [r.page.slug, r.page.title]));
const isCollection = (r: Raw) =>
  r.page.depth > 0 &&
  (articleChildCount.get(r) ?? 0) >= 3 &&
  !CODE_DIR_NAMES.has(r.page.name.toLowerCase()) &&
  !r.page.partOf &&
  (r.page.kind === "folder" || r.page.kind === "docs" || r.page.kind === "assets" || !r.page.manifest);
for (const r of raws) {
  const p = r.page;
  if (!p.isArticle) continue;
  const cats = new Set<string>();
  // Collections: any ancestor folder holding three or more articles.
  let dir = path.dirname(p.path);
  while (rawByPath.has(dir)) {
    const anc = rawByPath.get(dir)!;
    if (isCollection(anc)) cats.add(anc.page.name);
    dir = path.dirname(dir);
  }
  const code = p.languages.find((l) => !NON_CODE_LANGS.has(l.name));
  if (code && p.kind !== "docs") cats.add(`${code.name} projects`);
  for (const fw of p.frameworks) cats.add(fw);
  if (p.kind === "repo") cats.add("Git repositories");
  if (p.kind === "docs") cats.add("Document collections");
  const year = p.created?.slice(0, 4);
  if (year && p.kind !== "folder") cats.add(`Started in ${year}`);
  if (p.markers.includes("CLAUDE.md") || p.markers.includes("AGENTS.md")) cats.add("Agent-ready projects");
  if (!p.readme) cats.add("Articles lacking a README");
  if (p.partOf) cats.add(`Parts of ${titleBySlug.get(p.partOf) ?? p.partOf}`);
  p.categories = [...cats];
}

// See also: similarity over frameworks, dependencies, categories, name tokens and siblings.
const articles = raws.filter((r) => r.page.isArticle && r.page.depth > 0);
const features = new Map<Raw, Set<string>>();
for (const r of articles) {
  const f = new Set<string>();
  for (const fw of r.page.frameworks) f.add(`fw:${fw}`);
  for (const d of r.page.manifest?.dependencies.slice(0, 40) ?? []) f.add(`dep:${d}`);
  for (const c of r.page.categories) if (!c.startsWith("Started") && !c.startsWith("Articles lacking")) f.add(`cat:${c}`);
  for (const t of r.page.name.toLowerCase().split(/[-_\s.]+/)) if (t.length > 2) f.add(`tok:${t}`);
  features.set(r, f);
}
for (const a of articles) {
  const fa = features.get(a)!;
  const scored: { slug: string; score: number }[] = [];
  for (const b of articles) {
    if (a === b || a.page.path.startsWith(b.page.path + path.sep) || b.page.path.startsWith(a.page.path + path.sep)) continue;
    const fb = features.get(b)!;
    let inter = 0;
    for (const x of fa) if (fb.has(x)) inter += x.startsWith("tok:") ? 2 : x.startsWith("fw:") ? 1.5 : 1;
    if (!inter) continue;
    let score = inter / (fa.size + fb.size - inter + 1);
    if (path.dirname(a.page.path) === path.dirname(b.page.path)) score += 0.05;
    if (b.page.readme) score += 0.03;
    // Packages inside some other project are rarely what "see also" wants.
    if (b.page.partOf && b.page.partOf !== a.page.partOf && b.page.partOf !== a.page.slug) score *= 0.35;
    scored.push({ slug: b.page.slug, score });
  }
  a.page.related = scored.sort((x, y) => y.score - x.score).filter((s) => s.score > 0.12).slice(0, 8).map((s) => s.slug);
}

const pages = raws.map((r) => r.page);
const meta: IndexMeta = {
  generatedAt: now.toISOString(),
  roots,
  maxDepth,
  deeperCounted: true,
  counts: {
    pages: pages.length,
    articles: pages.filter((p) => p.isArticle).length,
    repos: pages.filter((p) => p.kind === "repo").length,
    stubs: pages.filter((p) => !p.isArticle).length,
    categories: new Set(pages.flatMap((p) => p.categories)).size,
  },
  durationMs: Date.now() - started,
};
const index = normalizeIndex({ meta, pages, disambiguation });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
// Write then rename, so the server never reads a half-written index.
const tmpFile = `${outFile}.${process.pid}.tmp`;
fs.writeFileSync(tmpFile, JSON.stringify(index));
fs.renameSync(tmpFile, outFile);
console.log(
  `indexed ${meta.counts.pages} folders (${meta.counts.articles} articles, ${meta.counts.repos} repos, ${meta.counts.categories} categories) from ${roots.map((r) => r.label).join(", ")} in ${meta.durationMs} ms`,
);
