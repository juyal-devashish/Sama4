import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { FIRST_VISIT_SCRIPT } from "@/lib/onboarding";

export const metadata: Metadata = {
  // Each route sets its own title; this template brands it.
  title: { default: "Samā4 · News, explained inline", template: "%s · Samā4" },
  description:
    "News with context built in. Select any highlighted name, place or idea to see what it is without leaving the story.",
};

// Applies the saved theme before first paint so there is no light flash in dark mode.
// With nothing saved the app is light; "Match system" in Settings opts into the OS theme.
// lib/storage.ts saves values as JSON (`"dark"`, quotes included), so parse before
// comparing; fall back to the raw string for anything saved before that.
const themeScript = `(function(){try{var t=localStorage.getItem('sama4_theme');try{t=JSON.parse(t)}catch(e){}if(!t){t=localStorage.getItem('sama4_dark_mode')==='true'?'dark':'light'}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Shows the first-visit splash from the first frame (lib/onboarding.ts). */}
        <script dangerouslySetInnerHTML={{ __html: FIRST_VISIT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
