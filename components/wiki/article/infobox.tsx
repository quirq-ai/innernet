import { uiText } from "@/lib/ui-config";
import Link from "next/link";
import { Sigil, sigilGradient } from "@/components/sigil";
import { ancestors, getIndex } from "@/lib/data";
import { bytes, longDate, num, plural, timeAgo } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref, wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";
import { beyond, codeLanguages, descendants, remoteLink, splitTitle, typeLabel } from "./lead";
import { LABEL } from "./parts";

// The infobox: a sigil on a wash of its own colours, then the facts in label/value
// rows, grouped the way Wikipedia groups them.

type Row = { label: string; value: React.ReactNode };

function Location({ page }: { page: Page }) {
  const chain = ancestors(page);
  if (!chain.length) return <span className="font-mono text-[12px]">{page.root}</span>;
  return (
    <span className="font-mono text-[12px] leading-[1.6]">
      {chain.map((a, i) => (
        <span key={a.slug}>
          {i > 0 && <span aria-hidden className="text-faint">/</span>}
          <wbr />
          <Link href={wikiHref(a.slug)} className="link">
            {i === 0 ? a.root : a.name}
          </Link>
        </span>
      ))}
    </span>
  );
}

function Languages({ page }: { page: Page }) {
  const code = codeLanguages(page);
  const names = code.length ? code.slice(0, 2) : page.languages.slice(0, 1).map((l) => l.name);
  if (!names.length) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {names.map((n) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full" style={{ background: langColor(n) }} />
          {n}
        </span>
      ))}
    </span>
  );
}

export function Infobox({ page, compact = false, className = "" }: { page: Page; compact?: boolean; className?: string }) {
  const { categories } = getIndex();
  const [name, qualifier] = splitTitle(page.title);
  const m = page.manifest;
  const g = page.git;
  const remote = remoteLink(g?.remote ?? null);
  const past = beyond(page);
  const folders = descendants(page).length + 1 + (past && past !== "unknown" ? past.folders : 0);

  const groups: { head?: string; rows: (Row | false | null | undefined | "")[] }[] = [
    {
      rows: [
        { label: uiText("wiki.label.type"), value: typeLabel(page) },
        !compact && page.depth > 0 && { label: uiText("wiki.label.location"), value: <Location page={page} /> },
        page.languages.length > 0 && { label: page.languages.length > 1 && codeLanguages(page).length > 1 ? uiText("wiki.label.languages") : uiText("wiki.label.language"), value: <Languages page={page} /> },
        !compact &&
          page.frameworks.length > 0 && {
            label: uiText("wiki.label.frameworks"),
            value: (
              <span>
                {page.frameworks.slice(0, 5).map((f, i) => (
                  <span key={f}>
                    {i > 0 && ", "}
                    {categories.has(f) ? (
                      <Link href={categoryHref(f)} className="link">
                        {f}
                      </Link>
                    ) : (
                      f
                    )}
                  </span>
                ))}
              </span>
            ),
          },
      ],
    },
    {
      head: uiText("wiki.label.package"),
      rows: compact
        ? []
        : [
            m?.name ? { label: uiText("wiki.label.name"), value: <span className="font-mono text-[12px] [overflow-wrap:anywhere]">{m.name}</span> } : m && { label: uiText("wiki.label.manifest"), value: <span className="font-mono text-[12px]">{m.file}</span> },
            m?.version && { label: uiText("wiki.label.version"), value: <span className="font-mono text-[12px] [overflow-wrap:anywhere]">{m.version}</span> },
            m?.name && { label: uiText("wiki.label.manifest"), value: <span className="font-mono text-[12px] text-ink-2">{m.file}</span> },
          ],
    },
    {
      head: uiText("wiki.label.activity"),
      rows: [
        !compact && page.created && { label: uiText("wiki.label.created"), value: longDate(page.created) },
        page.modified && {
          label: uiText("wiki.label.lastTouched"),
          value: (
            <span>
              {longDate(page.modified)}
              <span className="block text-[12px] text-muted">{timeAgo(page.modified)}</span>
            </span>
          ),
        },
      ],
    },
    {
      head: uiText("wiki.label.contents"),
      rows: [
        {
          label: uiText("wiki.label.files"),
          value: (
            <span className="tabular-nums">
              {page.totalFiles ? num(page.totalFiles) : past === "unknown" ? "None of its own" : "None"}
              {page.totalFiles > 0 && folders > 1 && <span className="text-muted"> in {plural(folders, "folder")}</span>}
            </span>
          ),
        },
        page.totalBytes > 0 && { label: uiText("wiki.label.size"), value: <span className="tabular-nums">{bytes(page.totalBytes)}</span> },
      ],
    },
    {
      head: uiText("wiki.label.git"),
      rows: g
        ? [
            { label: uiText("wiki.label.commits"), value: <span className="tabular-nums">{num(g.commitCount)}</span> },
            g.branch && { label: uiText("wiki.label.branch"), value: <span className="font-mono text-[12px] [overflow-wrap:anywhere]">{g.branch}</span> },
            remote && {
              label: uiText("wiki.label.repository"),
              value: (
                <a href={remote.href} target="_blank" rel="noopener noreferrer" className="link font-mono text-[12px] [overflow-wrap:anywhere]">
                  {remote.label.split("/").map((part, i) => (
                    <span key={i}>
                      {i > 0 && "/"}
                      {i > 0 && <wbr />}
                      {part}
                    </span>
                  ))}
                </a>
              ),
            },
          ]
        : [],
    },
  ];

  const shown = groups.map((gr) => ({ ...gr, rows: gr.rows.filter((r): r is Row => !!r) })).filter((gr) => gr.rows.length);

  return (
    <aside aria-label={uiText("wiki.infoboxTitle", { name })} className={`ui-panel overflow-hidden rounded-2xl border border-line bg-surface shadow-soft ${className}`}>
      <div className={`relative isolate grid place-items-center overflow-hidden px-6 text-center ${compact ? "pb-4 pt-6" : "pb-5 pt-8"}`}>
        <div aria-hidden className="absolute inset-0 -z-10 scale-110 opacity-[0.22] blur-2xl" style={{ background: sigilGradient(page.slug, !page.isArticle) }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-linear-to-b from-transparent to-surface" />
        <Sigil seed={page.slug} name={page.name} kind={page.kind} muted={!page.isArticle} size={compact ? 60 : 88} className="shadow-soft" />
        <div className={`mt-4 font-display leading-[1.1] text-ink [overflow-wrap:anywhere] ${compact ? "text-[22px]" : "text-[26px]"}`}>
          {name}
          {qualifier && <span className="block pt-1 font-sans text-[12px] text-muted">{qualifier}</span>}
        </div>
      </div>
      <dl className="px-5 pb-4 text-[13px] leading-[1.45]">
        {shown.map((gr, i) => (
          <div key={i} className={i > 0 ? "mt-2.5 border-t border-line pt-3" : ""}>
            {gr.head && <div className={`${LABEL} mb-1`}>{gr.head}</div>}
            {gr.rows.map((r, row) => (
              <div key={row} className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 py-[5px]">
                <dt className="text-muted [overflow-wrap:anywhere]">{r.label}</dt>
                <dd className="text-ink">{r.value}</dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
    </aside>
  );
}
