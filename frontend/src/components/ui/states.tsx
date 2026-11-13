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
      {Icon && (
        <Icon size={26} strokeWidth={1.25} className="mb-4 text-text-tertiary" aria-hidden />
      )}
      <h2 className="headline text-[24px]">{title}</h2>
      {children && (
        <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-text-secondary">
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
            <button type="button" onClick={onRetry} className="btn-outline">
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
  return <button type="button" {...props} className={cn("btn-outline", className)} />;
}

export function PrimaryButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cn("btn-ink", className)} />;
}
