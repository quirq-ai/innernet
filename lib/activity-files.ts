import "server-only";

import fs from "node:fs";
import path from "node:path";
import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { HISTORY_DIR, historyLabel } from "@/lib/activity";
import type { DirectoryListing, FileContents, FileEntry } from "@/lib/activity-files-types";

const DIRECTORY_PAGE = 200;
const FILE_PAGE = 256 * 1024;
const WHOLE_JSON = 4 * 1024 * 1024;

export class ActivityFilesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** URL-style relative names only: no drive names, ADS, Windows aliases or traversal. */
function segments(relative: string): string[] {
  if (relative === "") return [];
  const parts = relative.split("/");
  if (relative.length > 4096 || parts.some((part) => !part || part === "." || part === ".." || /[\\:\x00-\x1f\x7f]/.test(part) || /[. ]$/.test(part))) {
    throw new ActivityFilesError(400, "Choose a path inside the history folder.");
  }
  return parts;
}

function validCursor(cursor: number) {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new ActivityFilesError(400, "Invalid page position.");
}

function sameFile(a: fs.Stats, b: fs.Stats) {
  return a.dev === b.dev && a.ino === b.ino;
}

/** Reject links at every level, then verify the resolved destination as well. */
function locate(relative: string): { absolute: string; stat: fs.Stats } {
  const parts = segments(relative);
  const root = fs.lstatSync(HISTORY_DIR);
  if (root.isSymbolicLink() || !root.isDirectory()) throw new ActivityFilesError(409, "The history folder must be a regular folder, not a link.");
  const realRoot = fs.realpathSync(HISTORY_DIR);
  let absolute = HISTORY_DIR;
  let stat = root;
  for (const part of parts) {
    if (!stat.isDirectory()) throw new ActivityFilesError(409, "This location is not a folder.");
    absolute = path.join(absolute, part);
    stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new ActivityFilesError(403, "Links are listed but never opened.");
  }
  // lstat also rejects Windows junctions. realpath catches a parent changed between
  // checks, without allowing a symlink to another location inside or outside history.
  if (fs.realpathSync(absolute) !== path.join(realRoot, ...parts)) throw new ActivityFilesError(403, "Links are listed but never opened.");
  return { absolute, stat };
}

function entryKind(stat: fs.Stats): FileEntry["kind"] {
  return stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
}

function directorySnapshot(entries: fs.Dirent[]): string {
  const hash = createHash("sha256");
  for (const entry of entries) hash.update(`${entry.name}\0${entry.isDirectory() ? "d" : entry.isFile() ? "f" : entry.isSymbolicLink() ? "l" : "o"}\0`);
  return hash.digest("hex");
}

function checkSnapshot(cursor: number, expected: string | undefined, actual: string) {
  if (cursor > 0 && expected !== actual) throw new ActivityFilesError(409, "The folder contents changed between pages. Refresh the folder to see its current files.");
}

function failure(error: unknown): never {
  if (error instanceof ActivityFilesError) throw error;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") throw new ActivityFilesError(404, "This history location no longer exists. Refresh the folder.");
  if (code === "EACCES" || code === "EPERM") throw new ActivityFilesError(403, "This history location could not be opened with the app's permissions.");
  throw new ActivityFilesError(500, "This history location could not be read. Try refreshing the folder.");
}

/** One folder only. Descendants and file contents are fetched when opened. */
export function listActivityFiles(relative: string, cursor = 0, snapshot?: string): DirectoryListing {
  segments(relative);
  validCursor(cursor);
  try {
    let location: ReturnType<typeof locate>;
    try {
      location = locate(relative);
    } catch (error) {
      if (relative === "" && (error as NodeJS.ErrnoException).code === "ENOENT" && !fs.existsSync(HISTORY_DIR)) {
        const currentSnapshot = directorySnapshot([]);
        checkSnapshot(cursor, snapshot, currentSnapshot);
        return { kind: "directory", path: "", rootLabel: historyLabel(), entries: [], total: 0, snapshot: currentSnapshot, nextCursor: null };
      }
      throw error;
    }
    if (!location.stat.isDirectory()) throw new ActivityFilesError(409, "This location is not a folder.");
    const names = fs.readdirSync(location.absolute, { withFileTypes: true });
    // Session folders use ISO dates, so newest sessions come first. Keep folders
    // together and use a stable lexical order for paging, independent of locale.
    names.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
    const currentSnapshot = directorySnapshot(names);
    checkSnapshot(cursor, snapshot, currentSnapshot);
    if (cursor > names.length) throw new ActivityFilesError(400, "This page position no longer exists. Refresh the folder.");
    const entries: FileEntry[] = names.slice(cursor, cursor + DIRECTORY_PAGE).map((entry) => {
      const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
      const item: FileEntry = { name: entry.name, path: entryPath, kind: "other", bytes: null, modified: null };
      try {
        segments(entryPath);
        const stat = fs.lstatSync(path.join(location.absolute, entry.name));
        item.kind = entryKind(stat);
        item.bytes = stat.isFile() ? stat.size : null;
        item.modified = stat.mtime.toISOString();
      } catch {
        // A disappeared, inaccessible or non-portable name still remains visible.
      }
      return item;
    });
    const checked = locate(relative);
    if (!sameFile(location.stat, checked.stat)) throw new ActivityFilesError(409, "The folder changed while it was read. Refresh it.");
    const next = cursor + entries.length;
    return { kind: "directory", path: relative, rootLabel: historyLabel(), entries, total: names.length, snapshot: currentSnapshot, nextCursor: next < names.length ? next : null };
  } catch (error) {
    failure(error);
  }
}

/** Extend a page by at most three bytes to avoid cutting a UTF-8 character. */
function textBoundary(buffer: Buffer, limit: number): number {
  if (limit >= buffer.length) return buffer.length;
  let start = limit;
  while (start > Math.max(0, limit - 3) && (buffer[start] & 0xc0) === 0x80) start--;
  const lead = buffer[start];
  const length = lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 1;
  return start < limit && start + length > limit && start + length <= buffer.length ? start + length : limit;
}

function hexDump(buffer: Buffer, offset: number): string {
  const lines: string[] = [];
  for (let start = 0; start < buffer.length; start += 16) {
    const row = buffer.subarray(start, start + 16);
    const hex = [...row].map((byte) => byte.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const printable = [...row].map((byte) => byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".").join("");
    lines.push(`${(offset + start).toString(16).padStart(8, "0")}  ${hex}  ${printable}`);
  }
  return lines.join("\n");
}

/** Bounded reads, always from an already-checked file descriptor. No writes. */
export function readActivityFile(relative: string, cursor = 0): FileContents {
  segments(relative);
  validCursor(cursor);
  try {
    const location = locate(relative);
    if (!location.stat.isFile()) throw new ActivityFilesError(409, "Choose a regular file to view its contents.");
    const fd = fs.openSync(location.absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const stat = fs.fstatSync(fd);
      const checked = locate(relative);
      if (!stat.isFile() || !sameFile(location.stat, stat) || !sameFile(checked.stat, stat)) throw new ActivityFilesError(409, "The file changed while it was opened. Refresh the folder.");
      if (cursor > stat.size) throw new ActivityFilesError(400, "This page position no longer exists. Refresh the file.");
      const extension = path.extname(relative).toLowerCase();
      const format = extension === ".json" ? "json" : extension === ".jsonl" || extension === ".ndjson" ? "jsonl" : "text";
      const limit = format === "json" && cursor === 0 && stat.size <= WHOLE_JSON ? stat.size : FILE_PAGE;
      const buffer = Buffer.alloc(Math.min(limit + 3, stat.size - cursor));
      let read = 0;
      while (read < buffer.length) {
        const count = fs.readSync(fd, buffer, read, buffer.length - read, cursor + read);
        if (!count) break;
        read += count;
      }
      const available = buffer.subarray(0, read);
      let end = textBoundary(available, Math.min(limit, read));
      if (format === "jsonl" && cursor + end < stat.size) {
        const newline = available.lastIndexOf(10, end - 1);
        if (newline >= 0) end = newline + 1;
      }
      let chunk = available.subarray(0, end);
      const binary = !isUtf8(chunk) || chunk.includes(0) || chunk.some((byte) => byte < 9 || (byte > 13 && byte < 32));
      // A binary file named .json must not expand a whole 4 MiB read into a giant
      // hex dump. It uses the same small byte pages as other binary files.
      if (binary && end > FILE_PAGE) {
        end = FILE_PAGE;
        chunk = available.subarray(0, end);
      }
      const next = cursor + end;
      const nextCursor = next < stat.size && end > 0 ? next : null;
      const notices: string[] = [];
      let partialLine = false;
      if (binary) notices.push("Binary or non-UTF-8 data is shown as hexadecimal bytes and printable characters.");
      if (format === "json" && !binary && (cursor > 0 || nextCursor !== null)) notices.push("Only part of this JSON file is shown. Files over 4 MiB use byte pages, which may contain only part of a JSON value.");
      if (format === "jsonl") {
        const previous = Buffer.alloc(1);
        const startsMidLine = cursor > 0 && fs.readSync(fd, previous, 0, 1, cursor - 1) === 1 && previous[0] !== 10;
        const endsMidLine = nextCursor !== null && chunk.length > 0 && chunk[chunk.length - 1] !== 10;
        partialLine = startsMidLine || endsMidLine;
        if (partialLine) notices.push("A line exceeds this page: its remaining bytes are on the adjacent page. All content is preserved.");
      }
      if (read < buffer.length) notices.push("The file became shorter while it was read. Refresh to see its current contents.");
      return {
        kind: "file", path: relative, name: path.basename(relative), bytes: stat.size, modified: stat.mtime.toISOString(),
        content: binary ? hexDump(chunk, cursor) : chunk.toString("utf8"), binary, cursor, nextCursor, format,
        complete: cursor === 0 && nextCursor === null && read === buffer.length,
        ...(partialLine ? { partialLine: true } : {}),
        ...(notices.length ? { notice: notices.join(" ") } : {}),
      };
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    failure(error);
  }
}
