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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedStories, useTheme } from "@/lib/preferences";
import { Logo } from "@/components/ui/logo";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

/** Every destination in the app. Masthead (phones) and Sidebar (desktop) both read this. */
export const NAV: NavItem[] = [
  {
    href: "/",
    label: "Today",
    icon: Newspaper,
    match: (p) => p === "/" || p.startsWith("/article"),
  },
  { href: "/search", label: "Search", icon: Search, match: (p) => p.startsWith("/search") },
  { href: "/saved", label: "Saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
  { href: "/outlook", label: "Outlook", icon: TrendingUp, match: (p) => p.startsWith("/outlook") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") },
];

const EARLY_ACCESS: NavItem = {
  href: "/early-access",
  label: "Early access",
  icon: Megaphone,
  match: (p) => p.startsWith("/early-access"),
};

const row =
  "relative flex h-10 items-center justify-center gap-3 px-3 transition-colors xwide:justify-start";

function RailLink({ item, active, count }: { item: NavItem; active: boolean; count?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={count ? `${item.label} (${count})` : item.label}
      title={item.label}
      className={cn(
        row,
        "label-ui",
        active
          ? "bg-background-secondary text-foreground"
          : "text-text-secondary hover:bg-background-secondary hover:text-foreground",
      )}
    >
      {/* The current page is marked by a blue bar on the rail's edge. */}
      {active && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent-secondary" />
      )}
      <Icon size={17} strokeWidth={active ? 2.1 : 1.7} className="flex-shrink-0" aria-hidden />
      <span className="hidden flex-1 xwide:inline">{item.label}</span>
      {count ? (
        <>
          <span className="hidden tabular-nums text-text-tertiary xwide:inline">{count}</span>
          <span
            aria-hidden
            className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-accent-secondary xwide:hidden"
          />
        </>
      ) : null}
    </Link>
  );
}

/**
 * Desktop navigation: a rail down the left edge. Icons only from 768px, with labels
 * from 1720px. Phones keep the masthead's row of links instead.
 */
export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const { saved } = useSavedStories();
  const { isDark, setTheme } = useTheme();
  const themeLabel = isDark ? "Switch to light theme" : "Switch to dark theme";
  const earlyActive = EARLY_ACCESS.match(pathname);

  const main = NAV.filter((n) => n.href !== "/settings");
  const settings = NAV.find((n) => n.href === "/settings")!;

  return (
    <nav
      aria-label="Main"
      className="hidden w-[72px] flex-shrink-0 flex-col border-r border-border bg-background py-4 md:flex xwide:w-[220px]"
    >
      <Link
        href="/"
        aria-label="Samā4, go to Today"
        className="mx-3 mb-6 flex h-12 items-center justify-center xwide:justify-start xwide:px-1"
      >
        {/* The masthead beside it carries the name; the rail carries the mark. */}
        <Logo className="h-10 flex-shrink-0" />
      </Link>

      <ul className="flex flex-col gap-0.5">
        {main.map((item) => (
          <li key={item.href}>
            <RailLink
              item={item}
              active={item.match(pathname)}
              count={item.href === "/saved" && saved.length > 0 ? saved.length : undefined}
            />
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        <RailLink item={settings} active={settings.match(pathname)} />
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={themeLabel}
          title={themeLabel}
          className={cn(
            row,
            "label-ui text-text-secondary hover:bg-background-secondary hover:text-foreground",
          )}
        >
          {isDark ? (
            <Sun size={17} strokeWidth={1.7} aria-hidden />
          ) : (
            <Moon size={17} strokeWidth={1.7} aria-hidden />
          )}
          <span className="hidden xwide:inline">{isDark ? "Light theme" : "Dark theme"}</span>
        </button>
        <div className="px-3 pt-3">
          <Link
            href={EARLY_ACCESS.href}
            aria-current={earlyActive ? "page" : undefined}
            aria-label={EARLY_ACCESS.label}
            title={EARLY_ACCESS.label}
            className="btn-ink h-10 w-full px-0 xwide:px-3"
          >
            <Megaphone size={15} strokeWidth={1.8} aria-hidden className="xwide:hidden" />
            <span className="hidden xwide:inline">Early access</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
