"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A story's lead image. When there is none, or it fails to load, a printed-style
 * placeholder with the outlet's initial takes its place, so every story has a picture
 * and layouts never shift.
 */
export function StoryImage({
  src,
  source,
  className,
  loading,
}: {
  src: string | null | undefined;
  /** Outlet name, shown on the placeholder. */
  source: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  // A new story reuses this element: forget the previous story's failure.
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setFailed(false);
  }

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading={loading}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("flex-shrink-0 bg-background-secondary object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      data-testid="story-image-placeholder"
      className={cn(
        "flex flex-shrink-0 items-center justify-center overflow-hidden border border-border bg-background-secondary",
        className,
      )}
    >
      <span className="font-editorial text-[2.2em] leading-none text-text-tertiary">
        {source.trim().charAt(0).toUpperCase() || "S"}
      </span>
    </div>
  );
}
