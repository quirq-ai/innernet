// Local history browser boundaries and exact paging, with no real history touched:
//   node --conditions=react-server --import tsx scripts/try-activity-files.ts
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const request = (body: unknown, extra: Record<string, string> = {}) => new Request("http://127.0.0.1:3470/api/activity/files", {
  method: "POST",
  headers: { host: "127.0.0.1:3470", origin: "http://127.0.0.1:3470", "content-type": "application/json", ...extra },
  body: JSON.stringify(body),
});

async function main() {
  if (process.argv.includes("--demo-child")) {
    const { POST } = await import("../app/api/activity/files/route");
    assert.equal((await POST(request({ action: "list", path: "" }))).status, 404);
    console.log("Demo refuses history file browsing.");
    return;
  }

  const parent = fs.realpathSync(process.cwd());
  const fixture = fs.mkdtempSync(path.join(parent, ".activity-files-test-"));
  const history = path.join(fixture, "history");
  const outside = path.join(fixture, "outside-history");
  const envKeys = ["INNERNET_HISTORY_DIR", "INNERNET_DEMO", "INNERNET_DEMO_BUILD", "VERCEL"];
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
  const links: string[] = [];

  try {
    process.env.INNERNET_HISTORY_DIR = history;
    for (const key of envKeys.slice(1)) delete process.env[key];
    const { ActivityFilesError, listActivityFiles, readActivityFile } = await import("../lib/activity-files");
    const { POST } = await import("../app/api/activity/files/route");
    assert.equal(listActivityFiles("").total, 0, "history need not exist before the first event");
    fs.mkdirSync(path.join(history, "session", "nested"), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "private.json"), '{"outside":true}');
    const write = (name: string, text: string | Buffer) => fs.writeFileSync(path.join(history, name), text);
    const original = '{\n  "message": "hello 🌍", "array": [1, null, true], "unsafe": "<script>"\n}\n';
    write("session/nested/object.json", original);
    write("session/events.jsonl", '{"kind":"visit"}\nnot JSON\n\n{"kind":"search","q":"λ"}');
    write("session/broken.json", "{ malformed JSON");
    write("session/empty.json", "");
    write("session/note.txt", "An ordinary note.\n");

    assert.equal(listActivityFiles("").entries[0].kind, "directory");
    assert.equal(listActivityFiles("session/nested").entries[0].path, "session/nested/object.json");
    const object = readActivityFile("session/nested/object.json");
    assert.equal(object.content, original, "raw JSON is never normalized or escaped");
    assert.equal(object.complete, true);
    assert.equal(object.format, "json");
    assert.equal(object.bytes, Buffer.byteLength(original));
    assert.equal(readActivityFile("session/events.jsonl").content, '{"kind":"visit"}\nnot JSON\n\n{"kind":"search","q":"λ"}', "malformed JSONL, blank lines, and no final newline are preserved");
    assert.equal(readActivityFile("session/broken.json").content, "{ malformed JSON");
    assert.equal(readActivityFile("session/empty.json").content, "");
    assert.equal(readActivityFile("session/note.txt").format, "text");

    fs.mkdirSync(path.join(history, "many"));
    for (let index = 0; index < 407; index++) write(`many/${String(index).padStart(3, "0")}.json`, "{}");
    const names: string[] = [];
    let directoryCursor: number | null = 0;
    let directorySnapshot: string | undefined;
    while (directoryCursor !== null) {
      const page = listActivityFiles("many", directoryCursor, directorySnapshot);
      assert.equal(page.total, 407);
      assert.ok(page.entries.length <= 200);
      names.push(...page.entries.map((entry) => entry.name));
      directoryCursor = page.nextCursor;
      directorySnapshot = page.snapshot;
    }
    assert.equal(new Set(names).size, 407, "every entry appears once across directory pages");
    const firstDirectoryPage = listActivityFiles("many");
    assert.throws(() => listActivityFiles("many", firstDirectoryPage.nextCursor!), (error: unknown) => error instanceof ActivityFilesError && error.status === 409, "later pages require the directory snapshot");
    write("many/999.json", "{}");
    assert.throws(() => listActivityFiles("many", firstDirectoryPage.nextCursor!, firstDirectoryPage.snapshot), (error: unknown) => error instanceof ActivityFilesError && error.status === 409, "inserting an entry cannot duplicate an earlier page's last entry");
    fs.unlinkSync(path.join(history, "many", "999.json"));
    const beforeRemoval = listActivityFiles("many");
    fs.unlinkSync(path.join(history, "many", "406.json"));
    assert.throws(() => listActivityFiles("many", beforeRemoval.nextCursor!, beforeRemoval.snapshot), (error: unknown) => error instanceof ActivityFilesError && error.status === 409, "deleting an entry cannot skip an unread entry");
    write("many/406.json", "{}");
    const beforeAppend = listActivityFiles("many");
    write("many/405.json", '{"changed":"contents only"}');
    assert.doesNotThrow(() => listActivityFiles("many", beforeAppend.nextCursor!, beforeAppend.snapshot), "changing file contents does not invalidate folder paging");

    function readAll(name: string) {
      const pages: ReturnType<typeof readActivityFile>[] = [];
      let cursor: number | null = 0;
      while (cursor !== null) {
        const page = readActivityFile(name, cursor);
        assert.equal(page.cursor, cursor);
        assert.equal(page.binary, false);
        pages.push(page);
        if (page.nextCursor !== null) assert.ok(page.nextCursor > cursor);
        cursor = page.nextCursor;
      }
      return { pages, text: pages.map((page) => page.content).join("") };
    }

    const utf8 = "a".repeat(256 * 1024 - 2) + "🌍漢字".repeat(40000);
    write("unicode.txt", utf8);
    const unicode = readAll("unicode.txt");
    assert.equal(unicode.text, utf8, "UTF-8 characters split by byte limits are not corrupted");
    assert.ok(unicode.pages.length > 1);
    assert.equal(unicode.pages[0].complete, false);
    assert.equal(unicode.pages.at(-1)?.complete, false, "the last page alone is not the entire file");

    const lines = Array.from({ length: 15000 }, (_, index) => JSON.stringify({ index, message: "hello 🌍" }) + "\n").join("");
    write("many-lines.jsonl", lines);
    const linePages = readAll("many-lines.jsonl");
    assert.equal(linePages.text, lines);
    for (const page of linePages.pages) {
      assert.ok(page.content.endsWith("\n"));
      for (const line of page.content.trimEnd().split("\n")) assert.doesNotThrow(() => JSON.parse(line));
    }
    const longLine = JSON.stringify({ value: "🌍".repeat(200000) }) + "\n{broken}\n";
    write("long-line.jsonl", longLine);
    const longPages = readAll("long-line.jsonl");
    assert.equal(longPages.text, longLine, "oversized JSONL lines never lose any bytes");
    assert.match(longPages.pages[0].notice ?? "", /line exceeds/);
    assert.match(longPages.pages[1].notice ?? "", /line exceeds/);
    assert.equal(longPages.pages[0].partialLine, true);
    assert.equal(longPages.pages[1].partialLine, true);
    assert.equal(readActivityFile("session/events.jsonl").partialLine, undefined);

    const smallJson = JSON.stringify({ value: "x".repeat(1024 * 1024) });
    write("whole.json", smallJson);
    assert.equal(readActivityFile("whole.json").content, smallJson, "JSON up to 4 MiB can be formatted as a whole");
    const hugeJson = JSON.stringify({ value: "x".repeat(4 * 1024 * 1024) });
    write("huge.json", hugeJson);
    const hugePages = readAll("huge.json");
    assert.equal(hugePages.text, hugeJson);
    assert.match(hugePages.pages[0].notice ?? "", /byte pages/);

    const binary = Buffer.alloc(300000);
    for (let index = 0; index < binary.length; index++) binary[index] = index % 256;
    write("binary.bin", binary);
    let binaryCursor: number | null = 0;
    const decoded: number[] = [];
    while (binaryCursor !== null) {
      const page = readActivityFile("binary.bin", binaryCursor);
      assert.equal(page.binary, true);
      for (const row of page.content.split("\n")) decoded.push(...row.slice(10, 57).trim().split(" ").map((hex) => Number.parseInt(hex, 16)));
      binaryCursor = page.nextCursor;
    }
    assert.deepEqual(Buffer.from(decoded), binary, "binary previews expose every original byte without decoding loss");
    write("binary.json", Buffer.alloc(1024 * 1024));
    assert.equal(readActivityFile("binary.json").nextCursor, 256 * 1024, "binary files named JSON still use bounded hex pages");

    for (const bad of ["..", "../outside-history/private.json", "session/../nested", "/absolute", "C:/Windows", "C:relative", "session\\nested", "session//nested", "session/nested/", "session/nested/object.json:secret", "session.", "session ", "session/\u0000name"]) {
      assert.throws(() => listActivityFiles(bad), ActivityFilesError);
      assert.throws(() => readActivityFile(bad), ActivityFilesError);
    }
    for (const cursor of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => readActivityFile("unicode.txt", cursor), ActivityFilesError);
    assert.throws(() => readActivityFile("unicode.txt", Buffer.byteLength(utf8) + 1), ActivityFilesError);
    assert.throws(() => readActivityFile("session"), ActivityFilesError);
    assert.throws(() => listActivityFiles("unicode.txt"), ActivityFilesError);
    assert.throws(() => readActivityFile("missing"), (error: unknown) => error instanceof ActivityFilesError && error.status === 404 && !error.message.includes(fixture));

    const link = path.join(history, "session", "outside-link");
    fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
    links.push(link);
    assert.equal(listActivityFiles("session").entries.find((entry) => entry.name === "outside-link")?.kind, "link");
    assert.throws(() => listActivityFiles("session/outside-link"), ActivityFilesError);
    assert.throws(() => readActivityFile("session/outside-link/private.json"), ActivityFilesError);

    const fileLink = path.join(history, "file-link.json");
    try {
      fs.symlinkSync(path.join(outside, "private.json"), fileLink, "file");
      links.push(fileLink);
      assert.throws(() => readActivityFile("file-link.json"), ActivityFilesError);
    } catch (error) {
      if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      console.log("File symlink creation needs Windows privileges; nested directory junction protection was verified.");
    }

    const body = { action: "read", path: "session/nested/object.json" };
    const response = await POST(request(body));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).data.content, original);
    assert.equal((await POST(request(body, { origin: "https://elsewhere.test" }))).status, 403);
    assert.equal((await POST(request(body, { host: "public.example" }))).status, 403);
    assert.equal((await POST(request(body, { "sec-fetch-site": "cross-site" }))).status, 403);
    assert.equal((await POST(request(body, { "content-type": "text/plain" }))).status, 415);
    assert.equal((await POST(request({ action: "delete", path: "" }))).status, 400);
    assert.equal((await POST(request({ action: "list", path: "", cursor: "0" }))).status, 400);
    assert.equal((await POST(request({ action: "list", path: "many", cursor: 200 }))).status, 409);
    assert.equal((await POST(request({ action: "list", path: "many", cursor: 200, snapshot: beforeAppend.snapshot }))).status, 200);
    assert.equal((await POST(request({ action: "read", path: "x".repeat(9000) }))).status, 413);
    const denied = await POST(request({ action: "read", path: "../outside-history/private.json" }));
    assert.equal(denied.status, 400);
    assert.ok(!(await denied.text()).includes(fixture));
    const noOrigin = request(body);
    noOrigin.headers.delete("origin");
    assert.equal((await POST(noOrigin)).status, 403);
    childProcess.execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", fileURLToPath(import.meta.url), "--demo-child"], {
      env: { ...process.env, INNERNET_DEMO: "1" }, stdio: "pipe", windowsHide: true,
    });
    // The configured history root itself must not redirect to another folder.
    const savedHistory = path.join(fixture, "saved-history");
    assert.equal(path.dirname(fs.realpathSync(history)), fs.realpathSync(fixture));
    assert.equal(path.dirname(path.resolve(savedHistory)), fs.realpathSync(fixture));
    fs.renameSync(history, savedHistory);
    try {
      fs.symlinkSync(outside, history, process.platform === "win32" ? "junction" : "dir");
      assert.throws(() => listActivityFiles(""), ActivityFilesError);
      assert.throws(() => readActivityFile("private.json"), ActivityFilesError);
    } finally {
      if (fs.lstatSync(history, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(history);
      assert.equal(path.dirname(fs.realpathSync(savedHistory)), fs.realpathSync(fixture));
      fs.renameSync(savedHistory, history);
    }
    console.log("Activity files passed: nested files, exact JSON/JSONL and UTF-8 paging, malformed and binary content, directory paging, traversal and link restrictions, origin/body guards, and demo refusal. No real history changed.");
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Remove known fixture links themselves, never recurse through their targets.
    for (const link of links) if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
    const resolved = fs.realpathSync(fixture);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith(".activity-files-test-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
