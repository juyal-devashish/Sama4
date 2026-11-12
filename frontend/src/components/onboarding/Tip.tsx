"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { isTypingTarget } from "@/components/shell/AppShell";
import { cn } from "@/lib/utils";

/**
 * A one-line, non-modal tip: announced politely, never steals focus, never traps it.
 * The × dismisses it, and so does Escape (outside a text field) unless `escape` is off:
 * a tip inside a panel leaves Escape to close the panel. `arrow` points at what it's about.
 */
export function Tip({
  children,
  onDismiss,
  arrow = "top",
  escape = true,
  arrowLeft = 20,
  className,
  style,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  arrow?: "top" | "bottom";
  escape?: boolean;
  /** Arrow position from the tip's left edge, in px, so it can point at its target. */
  arrowLeft?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isTypingTarget(e.target)) dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escape]);

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: arrow === "top" ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative flex max-w-[300px] items-start gap-2 rounded-xl bg-accent-primary py-2.5 pl-4 pr-2 text-[14px] leading-snug text-on-accent shadow-[var(--shadow-panel)]",
        className,
      )}
      style={style}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute h-2.5 w-2.5 rotate-45 bg-accent-primary",
          arrow === "top" ? "-top-1" : "-bottom-1",
        )}
        style={{ left: arrowLeft }}
      />
      <p className="relative py-0.5">{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss tip"
        className="relative -my-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-on-accent/80 transition-colors hover:bg-white/15 hover:text-on-accent"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </motion.div>
  );
}
