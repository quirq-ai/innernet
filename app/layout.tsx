import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Newsreader } from "next/font/google";
import { DEMO_BAR, DemoBanner } from "@/components/demo-banner";
import { DEMO } from "@/lib/mode";
import { getUiConfig } from "@/lib/ui-config";
import { uiStyleSheet } from "@/lib/ui-theme";
import "./globals.css";
import "./themes/layouts.css";
import "./themes/editorial.css";
import "./themes/cyberpunk.css";
import "./themes/playful.css";

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader", axes: ["opsz"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const { brand } = getUiConfig();
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: brand.description, creator: brand.creator,
    icons: { icon: brand.icon, apple: brand.appleIcon },
    robots: { index: false, follow: false },
  };
}

export function generateViewport(): Viewport {
  const { theme } = getUiConfig();
  if (theme.defaultMode !== "system") return { themeColor: theme[theme.defaultMode].bg };
  return { themeColor: [
    { media: "(prefers-color-scheme: light)", color: theme.light.bg },
    { media: "(prefers-color-scheme: dark)", color: theme.dark.bg },
  ] };
}

// Only a fixed storage key and validated theme enum reach this script.
const themeScript = `try{var t=localStorage.getItem("innernet-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;else if(t==="system")delete document.documentElement.dataset.theme}catch(e){}try{var c=function(){var b=getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=b;m.removeAttribute("media")})};if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",c);else c();window.addEventListener("innernet-theme-change",c);new MutationObserver(c).observe(document.head,{childList:true});window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",c)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getUiConfig();
  const { theme } = config;
  return (
    <html lang={config.brand.language} suppressHydrationWarning
      data-theme={theme.defaultMode === "system" ? undefined : theme.defaultMode}
      data-ui-aurora={theme.effects.aurora ? "on" : "off"}
      data-ui-grain={theme.effects.grain ? "on" : "off"}
      data-ui-motion={theme.effects.motion ? "on" : "off"}
      data-ui-density={config.layout.density}
      data-ui-style={theme.style}
      className={`${instrument.variable} ${newsreader.variable} ${inter.variable} ${mono.variable}`}
      style={DEMO ? ({ "--demo-bar": DEMO_BAR } as React.CSSProperties) : undefined}>
      <head>
        <style id="innernet-ui-theme">{uiStyleSheet(config)}</style>
        <script id="innernet-theme-choice" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="grain min-h-dvh bg-bg text-ink">
        {DEMO && <DemoBanner />}
        {children}
      </body>
    </html>
  );
}
