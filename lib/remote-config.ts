export interface RemoteConfig {
  owner: string;
  /** Empty means all public repositories owned by this account. */
  repositories: string[];
}

export const DEFAULT_REMOTE: RemoteConfig = { owner: "quirq-ai", repositories: [] };

function githubParts(value: string): string[] | null {
  if (!/^https?:\/\//i.test(value)) return null;
  if (/[\\%]/.test(value) || value.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("Use a GitHub URL without escaped or relative path segments.");
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a GitHub account or repository URL."); }
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) {
    throw new Error("Use a public https://github.com URL without credentials, a query, or a fragment.");
  }
  return url.pathname.replace(/\/$/, "").slice(1).split("/");
}

/** Canonical values are also safe individual path segments for the GitHub crawler. */
export function normalizeRemoteConfig(value: unknown): RemoteConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter your GitHub account and repositories.");
  const remote = value as Record<string, unknown>;
  if (typeof remote.owner !== "string") throw new Error("Enter a GitHub account.");
  const ownerInput = remote.owner.trim();
  const account = githubParts(ownerInput);
  if (account && account.length !== 1) throw new Error("Enter the GitHub account URL; add individual repositories in the list below.");
  const owner = (account?.[0] ?? ownerInput).toLowerCase();
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/.test(owner) || owner.includes("--")) throw new Error("Enter a valid GitHub organization or username.");
  if (!Array.isArray(remote.repositories) || remote.repositories.length > 50) throw new Error("Use a list of up to 50 repositories, or leave it empty for all public repositories.");
  const repositories = remote.repositories.map((entry: unknown) => {
    if (typeof entry !== "string") throw new Error("Repository names must be text.");
    const input = entry.trim();
    const parts = githubParts(input);
    if (parts && (parts.length !== 2 || parts[0].toLowerCase() !== owner)) throw new Error("Every repository URL must belong to the GitHub account above.");
    const name = (parts ? parts[1].replace(/\.git$/i, "") : input).toLowerCase();
    if (!/^[a-z\d._-]{1,100}$/.test(name) || name === "." || name === ".." || name.includes("__dot__")) throw new Error("Enter repository names or GitHub repository URLs, one per line.");
    return name;
  });
  return { owner, repositories: [...new Set(repositories)].sort() };
}

export function isDefaultRemote(remote: RemoteConfig): boolean {
  return remote.owner === DEFAULT_REMOTE.owner && remote.repositories.length === 0;
}

/** Activity lines are capped at 4 KB; the complete list lives in source settings. */
export function remoteActivityFields(remote: RemoteConfig) {
  return { githubAccount: remote.owner, repositoryCount: remote.repositories.length, repositories: remote.repositories.slice(0, 5) };
}
