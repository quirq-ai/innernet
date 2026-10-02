import Link from "next/link";
import { getIndex } from "@/lib/data";
import { longDate, num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { CHAPTERS } from "./chapters";
import { indexFacts } from "./data";
import { Figure, PLATE_IDS } from "./plate";
import { exists } from "./source";

// The title page: the aurora, the promise, the live counts, the explainer film as a
// frontispiece, and the contents.

const FILM = "public/guide/innernet-explainer.mp4";
const POSTER = "public/guide/film-poster.jpg";
const CAPTIONS = "public/guide/innernet-explainer.vtt";

const AURORA_MASK = "radial-gradient(ellipse min(760px, 110vw) min(520px, 70vh) at 50% 30%, #000 18%, transparent 100%)";

export function Hero() {
  const { index, missing } = getIndex();
  const { counts } = index.meta;
  const facts = indexFacts();

  return (
    <section id="top" aria-labelledby="guide-title" className="relative isolate scroll-mt-20 overflow-x-clip">
      <div className="aurora" aria-hidden style={{ maskImage: AURORA_MASK, WebkitMaskImage: AURORA_MASK }}>
        <span />
        <span />
        <span />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
        <p className="fg-smallcaps rise text-center">
          {missing ? "A field guide in five chapters" : <>A field guide in five chapters · Edition of {longDate(index.meta.generatedAt)}</>}
        </p>
        <h1 id="guide-title" className="rise mt-6 text-center font-display text-[58px] leading-[0.92] tracking-[-0.025em] text-ink sm:text-[104px]" style={{ animationDelay: "60ms" }}>
          The <em>Inner</em>net <span className="block">Field Guide</span>
        </h1>
        <p className="rise mx-auto mt-7 max-w-[600px] text-center font-serif text-[20px] leading-[1.5] text-ink-2 sm:text-[23px]" style={{ animationDelay: "120ms" }}>
          How the folders on this machine become a search engine and an encyclopedia, and how to add to both.
        </p>

        {!missing && (
          <dl className="rise mx-auto mt-10 grid max-w-[860px] grid-cols-3 gap-y-6 text-center sm:flex sm:flex-wrap sm:justify-center sm:gap-y-5" style={{ animationDelay: "180ms" }}>
            {[
              { n: counts.pages, label: "folders", href: wikiHref("Special:Statistics") },
              { n: counts.articles, label: "articles", href: wikiHref("Special:AllPages") },
              { n: counts.stubs, label: "stubs", href: searchHref("is:stub") },
              { n: counts.repos, label: "repositories", href: searchHref("kind:repo") },
              { n: facts.shared, label: "shared names", href: wikiHref("src") },
              { n: counts.categories, label: "categories", href: wikiHref("Special:Categories") },
            ].map((c, i) => (
              // The term comes first, as a list of terms must; the number is shown above it.
              <div key={c.label} className={`flex min-w-0 flex-col-reverse px-2 sm:min-w-[112px] sm:px-6 ${i > 0 ? "sm:border-l sm:border-line" : ""}`}>
                <dt className="fg-smallcaps mt-2">{c.label}</dt>
                <dd className="font-display text-[30px] leading-none tabular-nums text-ink sm:text-[34px]">
                  <Link href={c.href} className="transition-colors hover:text-link">
                    {num(c.n)}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="rise mx-auto mt-14 max-w-[1000px] sm:mt-16" style={{ animationDelay: "240ms" }}>
          <Film />
        </div>

        <Contents />
      </div>
    </section>
  );
}

function Film() {
  const ready = exists(FILM);
  const caption = ready ? (
    <>A short film of the whole guide, drawn from the same eight plates.{exists(CAPTIONS) ? " Captions are on the player." : ""}</>
  ) : (
    <>A short film of the whole guide is being drawn from the same eight plates. It will play here when it is ready.</>
  );
  return (
    <Figure fig="Frontispiece" title="The film" caption={caption} imprint={<><span>public/guide/innernet-explainer.mp4</span><span>16 : 9</span></>}>
      {ready ? (
        <video
          controls
          preload="metadata"
          playsInline
          poster={exists(POSTER) ? "/guide/film-poster.jpg" : undefined}
          src="/guide/innernet-explainer.mp4"
          className="block aspect-video w-full bg-bg-sunk"
        >
          {exists(CAPTIONS) && <track kind="captions" src="/guide/innernet-explainer.vtt" srcLang="en" label="English" default />}
        </video>
      ) : (
        <FilmPlaceholder />
      )}
    </Figure>
  );
}

/** A film still in the cutting room: a strip with sprocket holes, the reel of plates
 * it will be made from, and a quiet notice. */
function FilmPlaceholder() {
  return (
    <div className="fg-filmstrip relative isolate aspect-video w-full overflow-hidden">
      <div className="aurora opacity-60" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="absolute inset-x-0 top-[9%] bottom-[9%] grid place-items-center px-6 text-center">
        <div>
          <div className="fg-smallcaps">Reel one · in the cutting room</div>
          <div className="mt-3 font-display text-[34px] italic leading-[1.05] text-ink sm:mt-4 sm:text-[60px]">The film is being made</div>
          <ol className="mx-auto mt-6 hidden max-w-[560px] grid-cols-4 gap-x-6 gap-y-1.5 text-left font-mono text-[11.5px] text-muted sm:grid">
            {PLATE_IDS.map((id, i) => (
              <li key={id} className="whitespace-nowrap">
                <span className="text-faint">{String(i + 1).padStart(2, "0")}</span> {id}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Contents() {
  return (
    <nav aria-labelledby="contents-h" className="mx-auto mt-20 max-w-[860px] sm:mt-24">
      <h2 id="contents-h" className="fg-smallcaps text-center">
        Contents
      </h2>
      <ol className="mt-6 border-t border-line-strong">
        {CHAPTERS.map((c) => (
          <li key={c.id} className="border-b border-line" data-reveal>
            <a href={`#${c.id}`} className="group grid grid-cols-[52px_minmax(0,1fr)] items-baseline gap-x-4 py-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:py-5">
              <span className="font-display text-[30px] leading-none text-faint transition-colors group-hover:text-ink sm:text-[38px]">{c.numeral}</span>
              <span className="min-w-0">
                <span className="block font-display text-[26px] leading-tight text-ink transition-colors group-hover:text-link sm:text-[30px]">{c.title}</span>
                <span className="mt-1 block font-serif text-[16px] leading-snug text-muted">{c.blurb}</span>
              </span>
              <span className="fg-smallcaps col-start-2 mt-2 sm:col-start-auto sm:mt-0 sm:text-right">{c.figs}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
