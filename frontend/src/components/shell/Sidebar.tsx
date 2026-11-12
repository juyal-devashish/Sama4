"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Megaphone,
  Moon,
  Newspaper,
  Search,
  Settings,
  Sun,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedStories, useTheme } from "@/lib/preferences";

const NAV = [
  {
    href: "/",
    label: "Today",
    icon: Newspaper,
    match: (p: string) => p === "/" || p.startsWith("/article"),
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    match: (p: string) => p.startsWith("/search"),
    hint: "/",
  },
  { href: "/saved", label: "Saved", icon: Bookmark, match: (p: string) => p.startsWith("/saved") },
  {
    href: "/outlook",
    label: "Outlook",
    icon: TrendingUp,
    match: (p: string) => p.startsWith("/outlook"),
  },
  {
    href: "/early-access",
    label: "Early access",
    icon: Megaphone,
    match: (p: string) => p.startsWith("/early-access"),
  },
];

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const { saved } = useSavedStories();
  const { isDark, setTheme } = useTheme();

  return (
    <nav
      aria-label="Main"
      className="flex w-[72px] flex-shrink-0 flex-col border-r bg-background-secondary/60 px-3 py-4 xwide:w-[232px] xwide:px-4"
    >
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 px-1.5"
        aria-label="samā4, go to Today"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sama4-logo.jpg"
          alt=""
          className="h-8 w-8 flex-shrink-0 rounded-lg object-contain dark:brightness-110"
        />
        <span className="hidden font-display text-[19px] font-bold tracking-[-0.01em] xwide:inline">
          samā4
        </span>
      </Link>

      <ul className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, match, hint }) => {
          const active = match(pathname);
          const count = href === "/saved" && saved.length > 0 ? saved.length : null;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={label}
                className={cn(
                  "group flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 font-display text-[14px] font-medium transition-colors xwide:justify-start",
                  active
                    ? "bg-accent-primary text-on-accent"
                    : "text-text-secondary hover:bg-background-secondary hover:text-foreground",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                <span className="hidden flex-1 xwide:inline">{label}</span>
                {count !== null && (
                  <span
                    className={cn(
                      "hidden text-[12px] tabular-nums xwide:inline",
                      active ? "text-on-accent/80" : "text-text-tertiary",
                    )}
                  >
                    {count}
                  </span>
                )}
                {hint && !active && (
                  <kbd className="hidden rounded border px-1.5 font-body text-[11px] text-text-tertiary xwide:group-hover:inline-block">
                    {hint}
                  </kbd>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 text-[14px] font-medium text-text-secondary transition-colors hover:bg-background-secondary hover:text-foreground xwide:justify-start"
        >
          {isDark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
          <span className="hidden xwide:inline">{isDark ? "Light theme" : "Dark theme"}</span>
        </button>
        <Link
          href="/settings"
          title="Settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 font-display text-[14px] font-medium transition-colors xwide:justify-start",
            pathname.startsWith("/settings")
              ? "bg-accent-primary text-on-accent"
              : "text-text-secondary hover:bg-background-secondary hover:text-foreground",
          )}
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="hidden xwide:inline">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
