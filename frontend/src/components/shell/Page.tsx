import Link from "next/link";
import { cn } from "@/lib/utils";
import { TRUST_LINKS } from "./trustLinks";

/** Scrolling page for the non-reader screens. */
export function Page({
  title,
  description,
  actions,
  before,
  children,
  width = "max-w-[880px]",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  before?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className="scroll-thin flex-1 overflow-y-auto bg-surface">
      <div className={cn("mx-auto px-6 pb-24 pt-10 sm:px-10", width)}>
        {before}
        <header className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-6">
          <div className="min-w-0">
            <h1 className="headline text-[40px] sm:text-[48px]">{title}</h1>
            {description && (
              <p className="mt-3 max-w-[60ch] text-[18px] leading-[1.4] text-text-secondary">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </header>
        {children}
        <footer className="mt-16 border-t border-border pt-6">
          <nav aria-label="About Samā4">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="label-ui text-text-secondary underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </footer>
      </div>
    </div>
  );
}
