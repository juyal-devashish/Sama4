"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSavedStories, useTheme } from "@/lib/preferences";
import { Logo } from "@/components/ui/logo";
import { NAV } from "./Sidebar";

function weekday(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function shortDate(date = new Date()) {
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * The broadsheet header on every page: the Samā4 nameplate between the edition and the
 * date, and a heavy ink rule underneath. On phones it also carries the row of navigation;
 * from 768px that moves to the Sidebar and the logo sits at the top of it.
 */
export function Masthead() {
  const pathname = usePathname() ?? "/";
  const { saved } = useSavedStories();
  const { isDark, setTheme } = useTheme();

  return (
    <header className="flex-shrink-0 bg-background px-4 sm:px-6 xl:px-10">
      <div className="flex items-center justify-center gap-4 border-b border-border py-2 md:hidden">
        <nav aria-label="Main" className="min-w-0">
          {/* Wraps onto a second line on phones rather than scrolling sideways. */}
          <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:gap-x-2">
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
          aria-label="Samā4, go to Today"
          className="col-start-2 flex items-center gap-3 font-editorial text-[40px] font-bold leading-none tracking-[-0.045em] sm:text-[48px]"
        >
          {/* Phones only: from 768px the owl heads the Sidebar. */}
          <span className="md:hidden">
            <Logo className="h-10 sm:h-12" />
          </span>
          Samā4
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
