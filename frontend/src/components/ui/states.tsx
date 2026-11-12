import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-8 py-16 text-center", className)}
    >
      {Icon && <Icon size={28} strokeWidth={1.5} className="mb-4 text-text-tertiary" aria-hidden />}
      <h2 className="font-display text-[17px] font-semibold">{title}</h2>
      {children && (
        <p className="mt-1.5 max-w-[42ch] text-[14px] leading-relaxed text-text-secondary">
          {children}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title={`Couldn't load ${what}`}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-lg border px-4 text-[14px] font-medium hover:bg-background-secondary"
          >
            Try again
          </button>
        )
      }
    >
      The samā4 server didn&apos;t respond. Check that the backend is running, then try again.
    </EmptyState>
  );
}

export function SecondaryButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-background-secondary disabled:opacity-50",
        className,
      )}
    />
  );
}

export function PrimaryButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg bg-accent-primary px-4 text-[13px] font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50",
        className,
      )}
    />
  );
}
