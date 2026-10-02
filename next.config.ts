import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Innernet makes no requests beyond its own origin (DESIGN.md, principle 5); the
// Content-Security-Policy holds the browser to that. Development also needs eval for
// React's debugging and a websocket for hot reload.
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// The guide's film, poster and captions present in public/guide when the app was built.
// A server function on Vercel cannot see public/ (it is served from the CDN), so the
// guide falls back on this list when it cannot find a file itself.
const guideMedia = (() => {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), "public", "guide"))
      .filter((f) => /\.(mp4|jpg|vtt)$/.test(f))
      .join(",");
  } catch {
    return "";
  }
})();

// The guide (components/guide/source.ts) quotes these files of Innernet's own as it
// serves them, and counts the TypeScript files in its four component folders.
const GUIDE_SOURCES = [
  "scripts/build-index.ts",
  "scripts/try-search.ts",
  "scripts/shot.mjs",
  "lib/types.ts",
  "lib/text.ts",
  "lib/normalize.ts",
  "lib/data.ts",
  "lib/search.ts",
  "lib/links.ts",
  "app/page.tsx",
  "app/search/page.tsx",
  "app/wiki/*/page.tsx",
  "app/api/suggest/route.ts",
  "app/guide/page.tsx",
  "app/globals.css",
  "components/sigil.tsx",
  "components/home/*.tsx",
  "components/search/*.{ts,tsx}",
  "components/wiki/**/*.{ts,tsx}",
  "components/guide/*.{ts,tsx}",
  "proxy.ts",
  "next.config.ts",
  "innernet.config.json",
  "DESIGN.md",
  "CONTRIBUTING.md",
];

// Whether this build is the demo (lib/mode.ts). Written into the build, so the demo
// does not depend on VERCEL reaching the deployed functions at run time.
const demoBuild = process.env.INNERNET_DEMO === "1" || process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  env: { INNERNET_GUIDE_MEDIA: guideMedia, INNERNET_DEMO_BUILD: demoBuild ? "1" : "" },
  // What each server function carries when deployed: Vercel ships only traced files.
  // Every page reads the demo index, and the guide reads its sources and plates. The
  // local index, the film, its renders and the demo's clones never ship. (Turbopack
  // matches these patterns anywhere below the project, not only at its top, so they
  // name files exactly rather than whole folders.)
  outputFileTracingIncludes: {
    "/**": ["data/demo/index.json"],
    "/guide": [...GUIDE_SOURCES, "public/guide/plates/*.svg"],
  },
  outputFileTracingExcludes: {
    "/**": ["film/**", "brand/**", ".demo-cache/**", "data/index.json", "data/*.tmp", "data/demo/*.tmp", "public/guide/*.mp4"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
