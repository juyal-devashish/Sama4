import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "samā4",
  description:
    "News with context built in. Select any highlighted name, place or idea to see what it is without leaving the story.",
};

// Applies the saved theme before first paint so there is no light flash in dark mode.
const themeScript = `(function(){try{var t=localStorage.getItem('sama4_theme');if(!t){t=localStorage.getItem('sama4_dark_mode')==='true'?'dark':'system'}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${poppins.variable} ${roboto.variable}`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
