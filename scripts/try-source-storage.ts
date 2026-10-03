// Source/storage inspection and opener boundaries:
//   node --import tsx --conditions=react-server scripts/try-source-storage.ts
// Every file is in an isolated fixture and every app-opening command is mocked.
import assert from "node:assert/strict";
import childProcess, { type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";

type SpawnCall = { command: string; args: string[]; options: SpawnOptions };

async function main() {
  const fixtureParent = fs.realpathSync(process.cwd());
  const project = fs.mkdtempSync(path.join(fixtureParent, ".source-storage-test-"));
  const history = path.join(project, "history");
  const session = "2026-10-03T10-20-30Z_test12";
  const missingSession = "2026-10-03T10-20-30Z_absent";
  const envKeys = ["INNERNET_PROJECT_ROOT", "INNERNET_HISTORY_DIR", "INNERNET_DB", "INNERNET_DB_DIR", "INNERNET_ROOTS", "INNERNET_MAX_DEPTH", "INNERNET_DIST_DIR", "QUIRQ_DIST_DIR"];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalSpawn = childProcess.spawn;
  const calls: SpawnCall[] = [];
  let unrefs = 0;
  let failNextSpawn = false;

  try {
    process.env.INNERNET_PROJECT_ROOT = project;
    process.env.INNERNET_HISTORY_DIR = history;
    process.env.INNERNET_DB = "off";
    process.env.INNERNET_DB_DIR = path.join(project, "database");
    for (const key of ["INNERNET_ROOTS", "INNERNET_MAX_DEPTH", "INNERNET_DIST_DIR", "QUIRQ_DIST_DIR"]) delete process.env[key];
    fs.mkdirSync(path.join(project, "data", "demo"), { recursive: true });
    fs.mkdirSync(path.join(history, session), { recursive: true });
    const configFile = path.join(project, "innernet.config.json");
    const writeConfig = (value: unknown) => fs.writeFileSync(configFile, JSON.stringify(value));
    const sessionFile = path.join(history, session, "innernet.jsonl");
    fs.writeFileSync(sessionFile, JSON.stringify({ at: "2026-10-03T10:20:30Z", app: "innernet", kind: "visit", url: "/" }) + "\n");
    fs.writeFileSync(path.join(project, "data", "demo", "index.json"), JSON.stringify({ meta: { generatedAt: "2026-10-01T00:00:00Z" } }));
    fs.writeFileSync(path.join(project, "data", "index.json"), "{}");
    writeConfig({ roots: ["./projects", "../sibling", "~/notes"], maxDepth: 3 });

    // Patch before importing the opener so both CJS and ESM see the safe stub.
    childProcess.spawn = ((command: string, args: string[], options: SpawnOptions) => {
      calls.push({ command, args, options });
      const child = new EventEmitter() as EventEmitter & { unref(): void };
      child.unref = () => { unrefs++; };
      const shouldFail = failNextSpawn;
      failNextSpawn = false;
      queueMicrotask(() => child.emit(shouldFail ? "error" : "spawn", shouldFail ? new Error("Fixture opener unavailable") : undefined));
      return child as ChildProcess;
    }) as typeof childProcess.spawn;
    syncBuiltinESMExports();

    const { localSourceConfig, writeSourceSelection } = await import("../lib/sources");
    const { sourceInfo, storageLocations, openStorageLocation } = await import("../lib/source-storage");
    assert.deepEqual(localSourceConfig(), {
      roots: [path.join(project, "projects"), path.resolve(project, "../sibling"), path.join(os.homedir(), "notes")],
      maxDepth: 3,
    }, "relative roots resolve from the configured project, independent of the process working directory");
    process.env.INNERNET_ROOTS = " ./override , ../other ";
    process.env.INNERNET_MAX_DEPTH = "2";
    assert.deepEqual(localSourceConfig(), { roots: [path.join(project, "override"), path.resolve(project, "../other")], maxDepth: 2 });
    delete process.env.INNERNET_ROOTS;
    delete process.env.INNERNET_MAX_DEPTH;

    writeSourceSelection({ local: false, remote: true });
    const initial = sourceInfo(session);
    assert.deepEqual(initial.selection, { local: false, remote: true });
    assert.equal(initial.remote.url, "https://github.com/quirq-ai");
    assert.equal(initial.remote.generatedAt, "2026-10-01T00:00:00Z");
    assert.equal(initial.storage.find((entry) => entry.id === "session")?.path, sessionFile);
    assert.equal(initial.storage.find((entry) => entry.id === "database")?.path, path.join(project, "database"));
    assert.equal(initial.browserStorage.length, 2);

    fs.writeFileSync(configFile, "{ malformed");
    const malformed = sourceInfo(session);
    assert.ok(malformed.local.error?.includes("Remote is still available"));
    assert.deepEqual(malformed.local.roots, []);
    assert.equal(malformed.local.maxDepth, null);
    assert.equal(malformed.remote.generatedAt, initial.remote.generatedAt, "malformed local config does not hide GitHub details");
    assert.deepEqual(malformed.storage, initial.storage, "malformed config still exposes its file for repair and all storage details");
    assert.deepEqual(malformed.selection, { local: false, remote: true });
    fs.unlinkSync(configFile);
    const missing = sourceInfo(session);
    assert.ok(missing.local.error);
    assert.equal(missing.storage.find((entry) => entry.id === "config")?.exists, false);
    writeConfig({ roots: ["./projects"], maxDepth: 3 });
    assert.equal(sourceInfo(session).local.error, undefined, "repairing config restores local source details without restarting");

    const buildPath = () => storageLocations(session).find((entry) => entry.id === "app-cache")!.path;
    assert.equal(buildPath(), path.join(project, ".next"));
    process.env.QUIRQ_DIST_DIR = ".quirq-build";
    assert.equal(buildPath(), path.join(project, ".quirq-build"));
    process.env.INNERNET_DIST_DIR = ".innernet-build";
    assert.equal(buildPath(), path.join(project, ".innernet-build"), "Innernet's explicit build directory takes precedence over the host setting");
    delete process.env.INNERNET_DIST_DIR;
    assert.equal(buildPath(), path.join(project, ".quirq-build"));

    await assert.rejects(openStorageLocation(session, configFile, "edit"), /Unknown storage location/);
    await assert.rejects(openStorageLocation(session, "../../other", "reveal"), /Unknown storage location/);
    await assert.rejects(openStorageLocation("../invalid", "history", "reveal"), /Bad session id/);
    await assert.rejects(openStorageLocation(session, "local-index", "edit"), /not available to edit/);
    await assert.rejects(openStorageLocation(session, "remote-index", "edit"), /not available to edit/);
    await assert.rejects(openStorageLocation(session, "history", "edit"), /not available to edit/);
    await assert.rejects(openStorageLocation(missingSession, "session", "edit"), /not available to edit/);
    assert.equal(calls.length, 0, "invalid targets and edits never launch an application");

    const expectedCommand = (action: "edit" | "reveal") => process.platform === "win32" ? action === "edit" ? "notepad.exe" : "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const expectedArgs = (destination: string, action: "edit" | "reveal") => process.platform === "darwin" && action === "edit" ? ["-t", destination] : [destination];
    await openStorageLocation(session, "config", "edit");
    assert.deepEqual(calls[0], { command: expectedCommand("edit"), args: expectedArgs(configFile, "edit"), options: { shell: false, stdio: "ignore", detached: true, windowsHide: false } });
    await openStorageLocation(session, "config", "reveal");
    assert.deepEqual(calls[1].args, expectedArgs(project, "reveal"));
    assert.equal(calls[1].command, expectedCommand("reveal"));
    await openStorageLocation(session, "session", "edit");
    assert.deepEqual(calls[2].args, expectedArgs(sessionFile, "edit"));
    await openStorageLocation(session, "history", "reveal");
    assert.deepEqual(calls[3].args, expectedArgs(history, "reveal"));
    await openStorageLocation(missingSession, "session", "reveal");
    assert.deepEqual(calls[4].args, expectedArgs(history, "reveal"), "a missing session reveals the nearest existing parent");
    await openStorageLocation(session, "app-cache", "reveal");
    assert.deepEqual(calls[5].args, expectedArgs(project, "reveal"), "a build cache not yet created reveals the project folder");
    assert.equal(unrefs, 6);

    failNextSpawn = true;
    await assert.rejects(openStorageLocation(session, "config", "edit"), /Fixture opener unavailable/);
    assert.equal(unrefs, 6, "a failed opener is not treated as an opened app");
    console.log("Source storage passed: relative roots, config repair, GitHub availability, build-path precedence, target whitelist, generated-file protection and mocked editor/folder commands. No real apps opened.");
  } finally {
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolved = fs.realpathSync(project);
    assert.equal(path.dirname(resolved), fixtureParent);
    assert.ok(path.basename(resolved).startsWith(".source-storage-test-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
