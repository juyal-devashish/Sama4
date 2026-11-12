import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { FIRST_VISIT_SCRIPT } from "@/lib/onboarding";

// Self-hosted (src/fonts, from Google Fonts) so builds never fetch fonts over the network:
// next/font/google's build-time fetch kept failing in CI and on Vercel.
// Each family is split like Google serves it: a latin file and a latin-ext file (for
// the "ā" in samā4), each limited by unicode-range so browsers only load what's used.
// (next/font needs literal option values, so the ranges are written out in each call.)
const poppinsLatin = localFont({
  src: [
    { path: "../fonts/poppins-400-latin.woff2", weight: "400" },
    { path: "../fonts/poppins-500-latin.woff2", weight: "500" },
    { path: "../fonts/poppins-600-latin.woff2", weight: "600" },
    { path: "../fonts/poppins-700-latin.woff2", weight: "700" },
  ],
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  fallback: ["system-ui", "sans-serif"],
});
const poppinsLatinExt = localFont({
  src: [
    { path: "../fonts/poppins-400-latin-ext.woff2", weight: "400" },
    { path: "../fonts/poppins-500-latin-ext.woff2", weight: "500" },
    { path: "../fonts/poppins-600-latin-ext.woff2", weight: "600" },
    { path: "../fonts/poppins-700-latin-ext.woff2", weight: "700" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});
const robotoLatin = localFont({
  src: "../fonts/roboto-variable-latin.woff2",
  weight: "400 500",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  fallback: ["system-ui", "sans-serif"],
});
const robotoLatinExt = localFont({
  src: "../fonts/roboto-variable-latin-ext.woff2",
  weight: "400 500",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

/** "latin, latin-ext, metric-matched fallback, …": each glyph comes from the file covering it. */
function stack(latin: { style: { fontFamily: string } }, ext: { style: { fontFamily: string } }) {
  const [main, ...fallbacks] = latin.style.fontFamily.split(",").map((f) => f.trim());
  const extra = ext.style.fontFamily.split(",")[0].trim();
  return [main, extra, ...fallbacks].join(", ");
}

const fontVariables = {
  "--font-poppins": stack(poppinsLatin, poppinsLatinExt),
  "--font-roboto": stack(robotoLatin, robotoLatinExt),
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "samā4",
  description:
    "News with context built in. Select any highlighted name, place or idea to see what it is without leaving the story.",
};

// Applies the saved theme before first paint so there is no light flash in dark mode.
// lib/storage.ts saves values as JSON (`"dark"`, quotes included), so parse before
// comparing; fall back to the raw string for anything saved before that.
const themeScript = `(function(){try{var t=localStorage.getItem('sama4_theme');try{t=JSON.parse(t)}catch(e){}if(!t){t=localStorage.getItem('sama4_dark_mode')==='true'?'dark':'system'}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Shows the first-visit splash from the first frame (lib/onboarding.ts). */}
        <script dangerouslySetInnerHTML={{ __html: FIRST_VISIT_SCRIPT }} />
      </head>
      <body style={fontVariables}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
