// No network, clones or index writes. Run: node --import tsx scripts/try-remote-sources.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fetchSourceRepos, githubSelection } from "./build-demo-index";

const publicRepo = (name = "Hello-World", overrides: Record<string, unknown> = {}) => ({
  name,
  owner: { login: "octocat" },
  private: false,
  visibility: "public",
  archived: false,
  disabled: false,
  fork: false,
  size: 1,
  default_branch: "main",
  description: null,
  ...overrides,
});

async function main() {
  assert.deepEqual(githubSelection({}), { owner: "quirq-ai", repositories: [] });
  assert.deepEqual(githubSelection({ INNERNET_GITHUB_OWNER: " OctoCat ", INNERNET_GITHUB_REPOSITORIES: '["Hello-World", "hello-world", ".github"]' }), {
    owner: "octocat", repositories: ["hello-world", ".github"],
  });
  for (const owner of ["", "../octocat", "https://github.com/octocat", "-octocat", "octocat-", "a--b"]) {
    assert.throws(() => githubSelection({ INNERNET_GITHUB_OWNER: owner }), /must be a GitHub/);
  }
  for (const repositories of ["oops", '"innernet"', '[null]', '["../innernet"]', '["org/repo"]', '["."]', '[".."]', '[""]']) {
    assert.throws(() => githubSelection({ INNERNET_GITHUB_REPOSITORIES: repositories }), /INNERNET_GITHUB_REPOSITORIES/);
  }

  const originalFetch = globalThis.fetch;
  let requests: string[] = [];
  let respond: (url: string) => Response = () => { throw new Error("no mocked response"); };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.github.com/"));
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    requests.push(url);
    return respond(url);
  };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

  try {
    respond = () => json([publicRepo(), publicRepo("private", { private: true, visibility: "private" })]);
    assert.equal((await fetchSourceRepos({ owner: "octocat", repositories: [] })).length, 1);
    assert.deepEqual(requests, ["https://api.github.com/orgs/octocat/repos?type=public&per_page=100&page=1"]);

    requests = [];
    respond = (url) => url.includes("/orgs/") ? json({}, 404) : json([publicRepo()]);
    assert.equal((await fetchSourceRepos({ owner: "octocat", repositories: [] }))[0].name, "Hello-World");
    assert.deepEqual(requests, [
      "https://api.github.com/orgs/octocat/repos?type=public&per_page=100&page=1",
      "https://api.github.com/users/octocat/repos?type=owner&per_page=100&page=1",
    ]);

    requests = [];
    respond = (url) => json(url.endsWith("page=1") ? Array.from({ length: 100 }, (_, i) => publicRepo(`repo-${i}`)) : [publicRepo()]);
    assert.equal((await fetchSourceRepos({ owner: "octocat", repositories: [] })).length, 101);
    assert.equal(requests.length, 2);

    requests = [];
    respond = () => json(publicRepo());
    assert.deepEqual((await fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] })).map((r) => r.name), ["Hello-World"]);
    assert.deepEqual(requests, ["https://api.github.com/repos/octocat/hello-world"]);

    for (const [overrides, message] of [
      [{ private: true, visibility: "private" }, /not public/],
      [{ archived: true }, /archived/],
      [{ disabled: true }, /disabled/],
      [{ size: 0 }, /empty/],
      [{ default_branch: null }, /empty/],
      [{ owner: { login: "other-owner" } }, /outside the requested source/],
      [{ name: "renamed-repository" }, /outside the requested source/],
    ] as const) {
      respond = () => json(publicRepo("Hello-World", overrides));
      await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] }), message);
    }
    respond = () => json({}, 404);
    await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["missing"] }), /was not found or is not public/);
    requests = [];
    respond = () => json({}, 403);
    await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: [] }), /anonymous calls are limited/);
    assert.equal(requests.length, 1, "a rate limit must not trigger user-account fallback");

    // The same selection is fetched before cloning and again before publishing.
    let checks = 0;
    respond = () => json(publicRepo("Hello-World", ++checks === 1 ? {} : { private: true, visibility: "private" }));
    await fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] });
    await assert.rejects(fetchSourceRepos({ owner: "octocat", repositories: ["hello-world"] }), /not public/);
    console.log("Remote sources passed: defaults, validation, organizations, users, pagination, explicit repositories, anonymous requests and public recheck.");
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Exercise the actual CLI entry point without touching a cache or the network.
  const preload = "data:text/javascript," + encodeURIComponent("globalThis.fetch = async () => new Response('[]', { status: 200 });");
  const cli = spawnSync(process.execPath, ["--import", "tsx", "--import", preload, "scripts/build-demo-index.ts"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, INNERNET_GITHUB_OWNER: "octocat", INNERNET_GITHUB_REPOSITORIES: "[]", INNERNET_REMOTE_CACHE: ".remote-source-test-cache" },
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /no public, non-empty repositories found for octocat/);
  console.log("Remote CLI entry point passed with an isolated empty GitHub response.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
