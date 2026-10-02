import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Newsreader } from "next/font/google";
import { DEMO_BAR, DemoBanner } from "@/components/demo-banner";
import { DEMO } from "@/lib/mode";
import "./globals.css";

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader", axes: ["opsz"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "Innernet", template: "%s · Innernet" },
  description: "Your personal internet. Search your folders like the web, read your projects like an encyclopedia.",
  creator: "quirq",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
};

// Applies a saved light/dark choice before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem("innernet-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrument.variable} ${newsreader.variable} ${inter.variable} ${mono.variable}`}
      // Pages that fill the window take the demo's banner off their height.
      style={DEMO ? ({ "--demo-bar": DEMO_BAR } as React.CSSProperties) : undefined}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="grain min-h-dvh bg-bg text-ink">
        {DEMO && <DemoBanner />}
        {children}
      </body>
    </html>
  );
}
