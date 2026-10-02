import Link from "next/link";
import { sigilGradient } from "@/components/sigil";
import { allCategories, globePages, MAINTENANCE, type CategoryInfo } from "@/components/wiki/main/insights";
import { getIndex } from "@/lib/data";
import { num, timeAgo } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref, wikiHref } from "@/lib/links";

// The welcome banner: the Innerpedia globe, the greeting, live counts, and portals into
// the largest collections and languages.

export function Welcome() {
  const { index, categories } = getIndex();
  const { counts, generatedAt, roots } = index.meta;
  const cats = allCategories();
  const collections = cats.filter((c) => c.kind === "collection").slice(0, 5);
  const languages = cats.filter((c) => c.kind === "language").slice(0, 5);

  return (
    <section aria-labelledby="welcome" className="rise relative overflow-hidden rounded-[28px] border border-line bg-surface shadow-soft">
      <div className="grid gap-9 px-6 py-8 sm:px-10 sm:py-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,408px)] xl:gap-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
          <Globe lacking={categories.get(MAINTENANCE)?.length ?? 0} />
          <div className="min-w-0">
            <h1 id="welcome" className="font-display text-[38px] leading-[1.04] tracking-[-0.015em] text-balance text-ink sm:text-[54px]">
              Welcome to <em className="italic">Inner</em>pedia,
              <span className="block text-balance text-ink-2">the encyclopedia of you.</span>
            </h1>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
              <Link href={wikiHref("Special:AllPages")} className="link tabular-nums">
                {num(counts.articles)} articles
              </Link>{" "}
              about{" "}
              <Link href={wikiHref("Special:Statistics")} className="link tabular-nums">
                {num(counts.pages)} folders
              </Link>
              , <span className="tabular-nums">{num(index.pages.filter((p) => p.git && p.git.commitCount > 0).length)}</span> of them with a history in Git.
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              Written from <span className="font-mono text-[12px]">{roots.map((r) => r.label).join(", ")}</span>, {timeAgo(generatedAt)}.
            </p>
          </div>
        </div>

        <nav aria-label="Portals" className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-x-8 gap-y-6 border-t border-line pt-6 xl:border-l xl:border-t-0 xl:pl-10 xl:pt-1">
          <Portal label="Collections" items={collections} />
          <Portal label="Languages" items={languages} dots />
        </nav>
      </div>
    </section>
  );
}

function Portal({ label, items, dots = false }: { label: string; items: CategoryInfo[]; dots?: boolean }) {
  return (
    <div className="min-w-0">
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</h2>
      <ul className="space-y-0.5 text-[14.5px]">
        {items.map((c) => (
          <li key={c.name}>
            <Link href={categoryHref(c.name)} className="link flex items-center gap-2 py-[2px]">
              {dots && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: langColor(c.subject) }} />}
              <span className="truncate">{c.subject}</span>
              <span className="ml-auto hidden pl-2 text-[12px] tabular-nums text-muted min-[420px]:inline">{num(c.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Innerpedia's answer to the puzzle globe: a sphere of sigils, one per substantial
// project, laid out on lines of latitude and longitude and foreshortened towards the
// rim. One piece is missing, for the articles still waiting on a README.
const ROWS = 7;
const COLS = 8;
const STEP = Math.PI / 8; // 22.5 degrees
const MISSING = [5, 5]; // row, column: up and to the right, where Wikipedia's globe is unfinished

interface Tile {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function tiles(size: number, gap: number): Tile[] {
  const r = size / 2;
  const out: Tile[] = [];
  for (let row = 0; row < ROWS; row++) {
    const lat = (row - (ROWS - 1) / 2) * STEP;
    const top = r - r * Math.sin(lat + STEP / 2);
    const bottom = r - r * Math.sin(lat - STEP / 2);
    // Width at the row's equator-side edge; the sphere's clip trims the pole side.
    const span = r * Math.cos(Math.max(0, Math.abs(lat) - STEP / 2));
    for (let col = 0; col < COLS; col++) {
      const lon = (col - (COLS - 1) / 2) * STEP;
      const left = r + span * Math.sin(Math.max(-Math.PI / 2, lon - STEP / 2));
      const right = r + span * Math.sin(Math.min(Math.PI / 2, lon + STEP / 2));
      out.push({ key: `${row}-${col}`, x: left + gap / 2, y: top + gap / 2, w: right - left - gap, h: bottom - top - gap });
    }
  }
  return out;
}

function Globe({ lacking }: { lacking: number }) {
  const size = 132;
  const grid = tiles(size, 2.2);
  const pages = globePages(grid.length);
  const order = [...grid].sort((a, b) => b.w * b.h - a.w * a.h); // biggest projects on the biggest pieces
  const assigned = new Map(order.map((t, i) => [t.key, pages[i]]));
  const missingKey = `${MISSING[0]}-${MISSING[1]}`;

  return (
    <div className="relative size-[112px] shrink-0 sm:size-[132px]">
      {pages[0] && <span aria-hidden className="absolute inset-4 rounded-full opacity-40 blur-2xl" style={{ background: sigilGradient(pages[0].slug) }} />}
      <div className="absolute left-1/2 top-1/2 size-[132px] -translate-x-1/2 -translate-y-1/2 -rotate-12 scale-[0.8485] overflow-hidden rounded-full bg-ink/8 sm:scale-100">
        {grid.map((t) => {
          const box = { left: t.x, top: t.y, width: Math.max(0, t.w), height: Math.max(0, t.h), borderRadius: Math.min(4, t.w / 3) };
          if (t.w < 1.5) return null;
          if (t.key === missingKey && lacking)
            return (
              <Link
                key={t.key}
                href={categoryHref(MAINTENANCE)}
                title={`${num(lacking)} articles still lack a README. You can help.`}
                aria-label={`${num(lacking)} articles lacking a README`}
                className="absolute z-10 border border-dashed border-line-strong transition-colors before:absolute before:-inset-2 before:content-[''] hover:border-link"
                style={box}
              />
            );
          const p = assigned.get(t.key);
          if (!p) return null;
          const big = t.w >= 12;
          return big ? (
            <Link
              key={t.key}
              href={wikiHref(p.slug)}
              title={p.title}
              tabIndex={-1}
              aria-hidden
              className="absolute grid place-items-center transition-transform duration-200 hover:z-10 hover:scale-[1.25]"
              style={{ ...box, background: sigilGradient(p.slug) }}
            >
              <span aria-hidden className="font-display leading-none text-white/90" style={{ fontSize: Math.min(t.w, t.h) * 0.62 }}>
                {(p.name.replace(/^[^\p{L}\p{N}]+/u, "")[0] ?? "·").toUpperCase()}
              </span>
            </Link>
          ) : (
            <span key={t.key} aria-hidden className="absolute" style={{ ...box, background: sigilGradient(p.slug) }} />
          );
        })}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-radial-[circle_farthest-side_at_36%_30%] from-white/45 via-white/0 via-60% to-black/30"
      />
    </div>
  );
}
