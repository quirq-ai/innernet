/** Plain response types shared by the local history browser and its route. */
export type FileEntry = {
  name: string;
  /** A slash-separated path relative to the history folder. */
  path: string;
  kind: "directory" | "file" | "link" | "other";
  bytes: number | null;
  modified: string | null;
};

export type DirectoryListing = {
  kind: "directory";
  path: string;
  rootLabel: string;
  entries: FileEntry[];
  total: number;
  /** Detects changed entry names or kinds between directory pages. */
  snapshot: string;
  /** The entry offset for the next page. */
  nextCursor: number | null;
};

export type FileContents = {
  kind: "file";
  path: string;
  name: string;
  bytes: number;
  modified: string;
  /** UTF-8 text, or a hexadecimal dump when binary is true. */
  content: string;
  binary: boolean;
  /** Byte offsets, independent of the number of characters displayed. */
  cursor: number;
  nextCursor: number | null;
  format: "json" | "jsonl" | "text";
  /** True only when this response contains the entire file. */
  complete: boolean;
  /** A JSONL record continues on an adjacent byte page. */
  partialLine?: boolean;
  notice?: string;
};
