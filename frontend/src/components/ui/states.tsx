"use client";

import { useEffect, useSyncExternalStore } from "react";
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

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** navigator.onLine as state (true during server rendering). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function ErrorState({ what, onRetry }: { what: string; onRetry?: () => void }) {
  const online = useOnline();

  // Back online: load again without making the reader press anything.
  useEffect(() => {
    if (!onRetry) return;
    window.addEventListener("online", onRetry);
    return () => window.removeEventListener("online", onRetry);
  }, [onRetry]);

  return (
    <div role="alert">
      <EmptyState
        title={online ? `Couldn't load ${what}` : "You're offline"}
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
        {online
          ? "samā4 couldn't reach its server. This is usually brief; try again in a moment."
          : `Reconnect to the internet and samā4 will load ${what} again by itself.`}
      </EmptyState>
    </div>
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
