// A quiet attribution shared by the two footer layouts.
export function QuirqCredit() {
  return (
    <span className="whitespace-nowrap text-[12px] text-muted">
      Powered by{" "}
      <a
        href="https://github.com/quirq-ai"
        aria-label="Quirq on GitHub"
        className="rounded-sm font-display text-[15px] leading-none text-ink-2 decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Quirq
      </a>
    </span>
  );
}
