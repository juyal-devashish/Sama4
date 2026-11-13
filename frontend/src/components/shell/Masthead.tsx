"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSavedStories, useTheme } from "@/lib/preferences";

const NAV = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/article") },
  { href: "/search", label: "Search", match: (p: string) => p.startsWith("/search") },
  { href: "/saved", label: "Saved", match: (p: string) => p.startsWith("/saved") },
  { href: "/outlook", label: "Outlook", match: (p: string) => p.startsWith("/outlook") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

function weekday(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function shortDate(date = new Date()) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * The broadsheet header on every page: a thin row of navigation, the samā4 nameplate
 * between the edition and the date, and a heavy ink rule underneath.
 */
export function Masthead() {
  const pathname = usePathname() ?? "/";
  const { saved } = useSavedStories();
  const { isDark, setTheme } = useTheme();

  return (
    <header className="flex-shrink-0 bg-background px-4 sm:px-6 xl:px-10">
      <div className="flex items-center justify-between gap-4 border-b border-border py-2">
        <p className="label-ui hidden truncate text-text-secondary md:block">
          The news, with the context built in
        </p>
        <nav aria-label="Main" className="-mx-1 min-w-0 overflow-x-auto">
          <ul className="flex items-center gap-1 sm:gap-2">
            {NAV.map(({ href, label, match }) => {
              const active = match(pathname);
              const count = href === "/saved" && saved.length > 0 ? saved.length : null;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "label-ui block whitespace-nowrap px-1.5 py-1 transition-colors sm:px-2",
                      active
                        ? "text-foreground underline decoration-1 underline-offset-[5px]"
                        : "text-text-secondary hover:text-foreground",
                    )}
                  >
                    {label}
                    {count !== null && <span className="tabular-nums"> ({count})</span>}
                  </Link>
                </li>
              );
            })}
            <li className="pl-1 sm:pl-2">
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                className="btn-outline whitespace-nowrap"
              >
                Theme
              </button>
            </li>
            <li>
              <Link
                href="/early-access"
                aria-current={pathname.startsWith("/early-access") ? "page" : undefined}
                className="btn-ink whitespace-nowrap"
              >
                Early access
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3">
        <p className="label-ui hidden leading-[1.6] text-text-secondary sm:block">
          The daily edition
          <br />
          News, explained inline
        </p>
        <Link
          href="/"
          aria-label="samā4, go to Today"
          className="col-start-2 font-editorial text-[40px] font-bold leading-none tracking-[-0.045em] sm:text-[48px]"
        >
          samā4
        </Link>
        <p
          className="label-ui hidden text-right leading-[1.6] text-text-secondary sm:block"
          suppressHydrationWarning
        >
          {weekday()}
          <br />
          {shortDate()}
        </p>
      </div>
      <div className="rule-thick" aria-hidden />
    </header>
  );
}
