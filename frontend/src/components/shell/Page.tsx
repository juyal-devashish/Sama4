import { cn } from "@/lib/utils";

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
      <div className={cn("mx-auto px-10 pb-24 pt-10", width)}>
        {before}
        <header className="flex items-end justify-between gap-6 pb-8">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
            {description && (
              <p className="mt-1.5 max-w-[62ch] text-[15px] leading-relaxed text-text-secondary">{description}</p>
            )}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
