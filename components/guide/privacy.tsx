import { getUiConfig, uiText } from "@/lib/ui-config";
import { redactSecrets } from "@/lib/text";
import { CHAPTERS } from "./chapters";
import { C, ChapterHead, Excerpt, Fine, Prose, SectionHead } from "./parts";
import { Figure, Plate } from "./plate";
import { cite } from "./source";

// Chapter V: what is read, what is only counted, what is blacked out, and who may ask.

const LEDGER: { title: string; mark: string; items: React.ReactNode[] }[] = [
  {
    title: "Read",
    mark: "R",
    items: [
      <>The README, its first 14,000 bytes.</>,
      <>
        <C>CLAUDE.md</C>, else <C>AGENTS.md</C>: its first paragraph of prose.
      </>,
      <>
        One manifest: <C>package.json</C>, <C>pyproject.toml</C>, <C>Cargo.toml</C>, <C>go.mod</C> or <C>requirements.txt</C>.
      </>,
      <>Git metadata from five commands: commits, branch, remote, count, first commit. Authors by name, never by email.</>,
    ],
  },
  {
    title: "Counted, never opened",
    mark: "C",
    items: [
      <>Every other file: its size, its dates and its extension, which becomes a language.</>,
      <>Source code, configuration, Dockerfiles, documents and images.</>,
      <>
        Dotfiles such as <C>.env</C>: not even counted, only noticed when one is <C>.git</C>.
      </>,
      <>Symlinks and Python virtualenvs: never followed.</>,
    ],
  },
  {
    title: "Blacked out",
    mark: "B",
    items: [
      <>
        Credential-shaped values become <C>[redacted]</C>: private keys, passwords in URLs, Stripe, Anthropic, OpenAI, GitHub, Slack, AWS and Google keys, JWTs, Bearer
        tokens, and long random <C>KEY=value</C> pairs.
      </>,
      <>
        File names such as <C>.env</C>, <C>*.pem</C>, <C>id_rsa</C> and anything with secret, token or password in it are never listed.
      </>,
      <>Folders named like cred, secret, private or keys: their README, notes and manifest are never opened, and their file names never listed.</>,
      <>Git remotes lose any login written into them.</>,
    ],
  },
  {
    title: "Refused",
    mark: "X",
    items: [
      <>Any request not addressed to localhost: a 403 before anything is read.</>,
      <>Scripts, styles, images and connections from any other origin.</>,
      <>Being framed by another page. Every page also asks search engines to look away.</>,
      <>Any write: every route is a read.</>,
    ],
  },
];

// Made-up credentials, assembled at run time so no scanner mistakes this file for a leak,
// and run through the same redactSecrets the indexer uses.
const SAMPLES = [
  `DATABASE_URL=postgres://admin:${["s3cret", "horse", "battery"].join("-")}@db.internal:5432/app`,
  `curl -H "Authorization: Bearer ${"9fQ2xLr7" + "Tz4mWk8sPa1v"}" https://api.example.test`,
  `GITHUB_TOKEN=${"gh" + "p_" + "A1b2C3d4E5f6G7h8I9j0" + "K1l2M3n4O5p6Q7r8"}`,
];

export function Privacy() {
  const config = getUiConfig();
  return (
    <section aria-labelledby="privacy-title">
      <ChapterHead chapter={CHAPTERS[4]} kicker={uiText("guide.privacy.branding1")}>
        <Prose>
          <p> {uiText("guide.privacy.branding2")} </p>
        </Prose>
      </ChapterHead>

      <Plate
        id="privacy"
        fig={11}
        title="Private by design"
        className="mt-10"
        alt={uiText("guide.privacyDiagramAlt", {}, config)}
        caption={uiText("guide.privacyDiagramCaption", {}, config)}
      />

      <SectionHead id="ledger" mark="V.1" title="The ledger" />
      <Figure
        fig={12}
        title="What crosses the line"
        className="mt-10"
        bodyClassName="grid sm:grid-cols-2 xl:grid-cols-4"
        caption={<>What crosses the line. Four columns, from what the indexer reads to what the server refuses outright.</>}
        imprint={
          <>
            <span>{cite("scripts/build-index.ts", "function crawl(")}</span>
            <span>{cite("lib/text.ts", "export function redactSecrets")}</span>
          </>
        }
      >
        {LEDGER.map((col, i) => (
          <div key={col.title} className={`min-w-0 border-line px-5 pb-6 pt-5 ${i > 0 ? "max-sm:border-t" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:max-xl:border-t" : ""} ${i === 2 ? "xl:border-l" : ""}`}>
            <div className="flex items-baseline gap-3">
              <span aria-hidden className="font-display text-[34px] italic leading-none text-faint">
                {col.mark}
              </span>
              <h4 className="font-display text-[23px] leading-tight text-ink">{col.title}</h4>
            </div>
            <ul className="mt-4 space-y-3">
              {col.items.map((it, j) => (
                <li key={j} className="relative pl-4 text-[13.5px] leading-[1.55] text-ink-2">
                  <span aria-hidden className="absolute left-0 top-[9px] h-px w-2 bg-line-strong" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Figure>

      <Prose className="mt-12">
        <p>
          Redaction runs twice: when the index is written, and again whenever the server loads it, so an index written by an older version is cleaned by the rules of
          today. Agent notes that held a credential are dropped altogether. These three lines were run through the same function as this page was served:
        </p>
      </Prose>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-bg-sunk/50" data-reveal>
        <div className="grid border-b border-line max-md:hidden md:grid-cols-2">
          <div className="fg-label px-4 py-2">In a README</div>
          <div className="fg-label border-l border-line px-4 py-2">In the index</div>
        </div>
        {SAMPLES.map((s, i) => (
          <div key={s} className={`grid md:grid-cols-2 ${i > 0 ? "border-t border-line" : ""}`}>
            <div className="min-w-0 px-4 py-3">
              {/* On a phone the pair stacks, so each half names itself. */}
              <div className="fg-label mb-1 md:hidden">In a README</div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                <code>{s}</code>
              </pre>
            </div>
            <div className="min-w-0 border-line bg-surface px-4 py-3 max-md:border-t md:border-l">
              <div className="fg-label mb-1 md:hidden">In the index</div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink [overflow-wrap:anywhere]">
                <code>
                  {redactSecrets(s)
                    .split(/(\[redacted\])/)
                    .map((part, j) => (part === "[redacted]" ? <mark key={j}>{part}</mark> : <span key={j}>{part}</span>))}
                </code>
              </pre>
            </div>
          </div>
        ))}
      </div>

      <SectionHead id="localhost" mark="V.2" title="Only localhost" />
      <Prose className="mt-8">
        <p>
          <C>pnpm dev</C> and <C>pnpm start</C> listen on 127.0.0.1, so no other machine can reach the server. A page on the web can still try a trick called DNS
          rebinding, pointing a name of its own at 127.0.0.1 and asking from inside your browser. It cannot change the name it asks by, though, and{" "}
          <C>proxy.ts</C> answers anything not addressed to localhost with a 403, on every path, before a single file is read:
        </p>
      </Prose>
      <Excerpt file="proxy.ts" from="const LOCAL" lines={6} mark={["const LOCAL", "403"]} className="mt-6" />
      <Prose className="mt-8">
        <p>
          In the browser, a Content-Security-Policy holds every page to its own origin; under <C>next dev</C> it also lets the hot-reload websocket through. The fonts are served by the app itself, the pages ask search engines to look
          away, and apart from moving between pages, the only request a page makes is the search box asking <C>/api/suggest</C> for suggestions as you type.
        </p>
      </Prose>
      <Excerpt file="next.config.ts" from="const csp = [" lines={11} mark={["default-src", "frame-ancestors"]} className="mt-6" />
      <Fine className="mt-6 max-w-[680px]">
        One caveat: <C>next dev</C> records request URLs, search queries included, in <C>.next/dev/trace</C>. It is gitignored and recreated; delete it whenever you
        like.
      </Fine>
    </section>
  );
}
