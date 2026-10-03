// Editable GitHub sources and snapshot isolation:
//   pnpm tsx --conditions=react-server scripts/try-remote-config.ts
// All files, history and database paths are confined to a temporary project.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_REMOTE, normalizeRemoteConfig, remoteActivityFields } from "../lib/remote-config";
import { MAX_EVENT_BYTES } from "../components/activity/shared";
import type { Page, SiteIndex } from "../lib/types";

function checkNormalization() {
  assert.deepEqual(normalizeRemoteConfig({ owner: "  QUIRQ-AI  ", repositories: [] }), DEFAULT_REMOTE);
  const expected = { owner: "quirq-ai", repositories: ["alpha", "innernet", "zeta"] };
  assert.deepEqual(normalizeRemoteConfig({
    owner: " https://github.com/Quirq-AI/ ",
    repositories: [" ZETA ", "https://github.com/QUIRQ-AI/Innernet.git", "ALPHA", "alpha", "https://github.com/quirq-ai/zeta/"],
  }), expected, "URLs, names, whitespace and case normalize to a sorted, unique repository list");
  assert.deepEqual(normalizeRemoteConfig(expected), expected, "canonical settings are idempotent");

  for (const owner of [
    "../quirq-ai", "quirq-ai/innernet", "-quirq-ai", "quirq-ai-", "quirq--ai", "",
    "https://example.com/quirq-ai", "http://github.com/quirq-ai", "https://github.com.evil.example/quirq-ai",
    "https://user:password@github.com/quirq-ai", "https://github.com/quirq-ai?tab=repositories",
    "https://github.com/quirq-ai#repos", "https://github.com:444/quirq-ai", "https://github.com/quirq-ai/innernet",
    "https://github.com/old/../quirq-ai", "https://github.com/old/%2e%2e/quirq-ai", "https://github.com/quirq%2dai", "https://github.com\\quirq-ai",
  ]) {
    assert.throws(() => normalizeRemoteConfig({ owner, repositories: [] }), `reject account input: ${owner}`);
  }
  for (const repository of [
    ".", "..", "../innernet", "folder/innernet", "folder\\innernet", "%2e%2e", "innernet__dot__git", "",
    "https://example.com/quirq-ai/innernet", "http://github.com/quirq-ai/innernet",
    "https://user:password@github.com/quirq-ai/innernet", "https://github.com/other-owner/innernet",
    "https://github.com/quirq-ai/innernet/tree/main", "https://github.com/quirq-ai/innernet?ref=main",
    "https://github.com/quirq-ai/old/../innernet", "https://github.com/quirq-ai/old/%2e%2e/innernet", "https://github.com/quirq-ai/inner%6eet", "https://github.com/quirq-ai\\innernet",
  ]) {
    assert.throws(() => normalizeRemoteConfig({ owner: "quirq-ai", repositories: [repository] }), `reject repository input: ${repository}`);
  }
  for (const malformed of [null, [], {}, { owner: 3, repositories: [] }, { owner: "quirq-ai", repositories: "innernet" }, { owner: "quirq-ai", repositories: [null] }]) {
    assert.throws(() => normalizeRemoteConfig(malformed), "reject malformed settings");
  }
  assert.throws(() => normalizeRemoteConfig({ owner: "quirq-ai", repositories: Array(51).fill("innernet") }), "bound the repository list");
}

function snapshot(owner: string, slug: string): SiteIndex {
  const root = `https://github.com/${owner}`;
  const page: Page = {
    slug, name: slug, title: slug, path: `${root}/${slug}`, relPath: slug, root, depth: 0,
    kind: "project", realm: "project", isArticle: true, parent: null, partOf: null, children: [], hiddenChildren: [],
    files: [], fileCount: 0, totalFiles: 0, bytes: 0, totalBytes: 0, created: null, modified: null,
    languages: [], markers: [], frameworks: [], manifest: null, summary: null, readme: `${slug} fixture repository`,
    readmeFile: null, agentNotes: null, git: null, categories: [], related: [], words: 3,
  };
  return {
    meta: {
      generatedAt: "2026-10-03T00:00:00.000Z", roots: [{ label: `github.com/${owner}`, path: root }],
      maxDepth: 1, counts: { pages: 1, articles: 1, repos: 1, stubs: 0, categories: 0 }, durationMs: 1,
      demo: { org: owner, repos: [] },
    },
    pages: [page], disambiguation: {},
  };
}

async function main() {
  checkNormalization();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-remote-config-"));
  const overrides: Record<string, string> = {
    INNERNET_PROJECT_ROOT: project,
    INNERNET_DB: "off",
    INNERNET_DB_DIR: path.join(project, "db"),
    INNERNET_HISTORY_DIR: path.join(project, "history"),
    INNERNET_DEMO: "0", INNERNET_DEMO_BUILD: "0", VERCEL: "0",
  };
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  try {
    fs.mkdirSync(path.join(project, "data", "demo"), { recursive: true });
    fs.writeFileSync(path.join(project, "innernet.config.json"), JSON.stringify({ roots: [project], maxDepth: 1 }));
    const sources = await import("../lib/sources");
    const { getIndex } = await import("../lib/data");
    const { sourceInfo } = await import("../lib/source-storage");
    const { appendEvent } = await import("../lib/activity");
    const session = "2026-10-03T00-00-00Z_remotecheck";
    const onlyRemote = { local: false, remote: true };
    const custom = normalizeRemoteConfig({ owner: "Octocat", repositories: ["Hello-World"] });
    const subset = normalizeRemoteConfig({ owner: "quirq-ai", repositories: ["innernet"] });
    const writeSnapshot = (file: string, owner: string, slug: string) => fs.writeFileSync(file, JSON.stringify(snapshot(owner, slug)));

    assert.equal(sources.SOURCE_SETTINGS_FILE, path.join(project, "data", "sources.json"));
    assert.deepEqual(sources.readSourceSelection(), { local: true, remote: false });
    assert.deepEqual(sources.readRemoteConfig(), DEFAULT_REMOTE, "existing installations retain the default account");
    fs.writeFileSync(sources.SOURCE_SETTINGS_FILE, JSON.stringify(onlyRemote));
    assert.deepEqual(sources.readSourceSelection(), onlyRemote);
    assert.deepEqual(sources.readRemoteConfig(), DEFAULT_REMOTE, "legacy boolean-only settings remain supported");

    const canonical = normalizeRemoteConfig({ owner: "Quirq-AI", repositories: ["ZETA", "alpha", "ALPHA"] });
    const same = normalizeRemoteConfig({ owner: "https://github.com/quirq-ai", repositories: ["https://github.com/quirq-ai/alpha.git", "zeta"] });
    assert.equal(sources.remoteOutputFile(canonical), sources.remoteOutputFile(same), "equivalent canonical settings reuse their snapshot");
    const files = [DEFAULT_REMOTE, canonical, custom, subset].map((config) => sources.remoteOutputFile(config));
    assert.equal(new Set(files).size, files.length, "different accounts and repository lists have separate snapshots");
    for (const file of files) assert.equal(path.dirname(file), path.join(project, "data"));
    assert.equal(sources.remoteOutputFile(DEFAULT_REMOTE), sources.REMOTE_INDEX_FILE);

    writeSnapshot(sources.BUNDLED_REMOTE_INDEX_FILE, "quirq-ai", "bundledfixture");
    assert.equal(sources.remoteIndexFile(), sources.BUNDLED_REMOTE_INDEX_FILE);
    assert.equal(sourceInfo(session).remote.needsSync, false);
    assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:bundledfixture"]);
    writeSnapshot(sources.REMOTE_INDEX_FILE, "quirq-ai", "defaultfixture");
    assert.equal(sources.remoteIndexFile(), sources.REMOTE_INDEX_FILE);
    const original = getIndex();
    assert.deepEqual(original.index.pages.map((page) => page.slug), ["github:defaultfixture"]);

    sources.writeSourceSelection(onlyRemote, custom);
    assert.deepEqual(JSON.parse(fs.readFileSync(sources.SOURCE_SETTINGS_FILE, "utf8")), { ...onlyRemote, remoteConfig: custom });
    assert.deepEqual(sources.readSourceSelection(), onlyRemote, "adding remote settings does not change source booleans");
    assert.deepEqual(sources.readRemoteConfig(), custom);
    assert.equal(sources.remoteIndexFile(), sources.remoteOutputFile(custom), "custom accounts never use the previous or bundled default snapshot");
    let details = sourceInfo(session);
    assert.equal(details.remote.owner, "octocat");
    assert.deepEqual(details.remote.repositories, ["hello-world"]);
    assert.equal(details.remote.needsSync, true);
    assert.equal(details.remote.generatedAt, null);
    assert.equal(details.storage.find((location) => location.id === "remote-index")?.exists, false);
    const unsynced = getIndex();
    assert.notEqual(unsynced.version, original.version);
    assert.equal(unsynced.missing, true);
    assert.deepEqual(unsynced.index.pages, [], "changing accounts removes stale pages before the next sync");

    writeSnapshot(sources.remoteOutputFile(custom), "octocat", "customfixture");
    const synced = getIndex();
    assert.notEqual(synced.version, unsynced.version);
    assert.deepEqual(synced.index.pages.map((page) => page.slug), ["github:customfixture"], "the new target's snapshot loads without a restart");
    details = sourceInfo(session);
    assert.equal(details.remote.needsSync, false);
    assert.equal(details.remote.generatedAt, "2026-10-03T00:00:00.000Z");
    assert.equal(details.storage.find((location) => location.id === "remote-index")?.exists, true);

    sources.writeSourceSelection({ local: true, remote: true });
    assert.deepEqual(sources.readRemoteConfig(), custom, "changing only booleans preserves the saved account and repositories");
    sources.writeSourceSelection(onlyRemote, subset);
    assert.equal(sources.remoteIndexFile(), sources.remoteOutputFile(subset));
    assert.deepEqual(getIndex().index.pages, [], "a repository subset cannot fall back to the full account snapshot");
    assert.equal(sourceInfo(session).remote.needsSync, true);
    writeSnapshot(sources.remoteOutputFile(subset), "quirq-ai", "subsetfixture");
    assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:subsetfixture"]);

    sources.writeSourceSelection(onlyRemote, custom);
    assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:customfixture"], "returning to a saved target reuses only its own snapshot");
    fs.unlinkSync(sources.remoteOutputFile(custom));
    assert.deepEqual(getIndex().index.pages, [], "a removed custom snapshot does not leave cached or default pages behind");
    assert.equal(sourceInfo(session).remote.needsSync, true);
    sources.writeSourceSelection(onlyRemote, DEFAULT_REMOTE);
    fs.unlinkSync(sources.REMOTE_INDEX_FILE);
    assert.equal(sources.remoteIndexFile(), sources.BUNDLED_REMOTE_INDEX_FILE);
    assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:bundledfixture"], "only the default account with all repositories uses the bundled fallback");

    for (const invalid of [
      JSON.stringify({ ...onlyRemote, remoteConfig: { owner: "../other", repositories: [] } }),
      JSON.stringify({ ...onlyRemote, remoteConfig: { owner: "octocat", repositories: ["https://github.com/other-owner/repo"] } }),
      JSON.stringify({ ...onlyRemote, remoteConfig: null }),
      JSON.stringify({ ...onlyRemote, remoteConfig: false }),
      JSON.stringify({ ...onlyRemote, remoteConfig: [] }),
      '{"local":false,"remote":true,"remoteConfig":',
    ]) {
      fs.writeFileSync(sources.SOURCE_SETTINGS_FILE, invalid);
      assert.throws(() => sources.readRemoteConfig(), "a malformed saved target must never silently select quirq-ai");
      assert.throws(() => sources.remoteIndexFile(), "a malformed target has no default snapshot");
      assert.deepEqual(getIndex().index.pages, [], "bad source settings remove remote pages until repaired");
      const broken = sourceInfo(session);
      assert.ok(broken.remote.error, "Sources explains malformed saved settings");
      assert.equal(broken.remote.owner, "", "an invalid target does not claim to be the default account");
      assert.deepEqual(broken.remote.repositories, []);
      assert.equal(broken.storage.find((location) => location.id === "selection")?.path, sources.SOURCE_SETTINGS_FILE, "storage remains reachable for repairing the settings file");
      sources.writeSourceSelection(onlyRemote, subset);
      assert.deepEqual(sources.readRemoteConfig(), subset, "an explicit valid save repairs malformed settings");
      assert.equal(sourceInfo(session).remote.error, undefined);
      assert.deepEqual(getIndex().index.pages.map((page) => page.slug), ["github:subsetfixture"]);
    }

    const maximum = normalizeRemoteConfig({
      owner: "a".repeat(39),
      repositories: Array.from({ length: 50 }, (_, index) => `repo${String(index).padStart(2, "0")}${"x".repeat(94)}`),
    });
    const audit = remoteActivityFields(maximum);
    assert.equal(audit.githubAccount, maximum.owner);
    assert.equal(audit.repositoryCount, 50, "activity records the full selected repository count");
    assert.deepEqual(audit.repositories, maximum.repositories.slice(0, 5), "activity bounds the repository sample");
    const event = {
      at: "2026-10-03T00:00:00.000Z", app: "innernet", kind: "sync", status: "completed", title: "Sources synced",
      command: "pnpm index && pnpm index:demo", local: true, remote: true, pages: 9999, durationMs: 300000, ...audit,
    };
    assert.ok(Buffer.byteLength(JSON.stringify(event) + "\n") <= MAX_EVENT_BYTES, "the largest valid remote selection fits an activity event");
    assert.deepEqual(appendEvent(session, "innernet", event), { ok: true }, "activity accepts the largest remote selection's summary");
    const recorded = JSON.parse(fs.readFileSync(path.join(project, "history", session, "innernet.jsonl"), "utf8"));
    assert.equal(recorded.repositoryCount, 50);
    assert.equal(recorded.repositories.length, 5);
    console.log("Remote configuration passed: normalization, validation, persistence, isolated snapshots, target switching, live reload, sync status, invalid-file repair and bounded activity.");
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolved = fs.realpathSync(project);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("innernet-remote-config-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
