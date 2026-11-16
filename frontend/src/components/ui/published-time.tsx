"use client";

import { useEffect, useState } from "react";
import { formatExactTime, formatTimeAgo } from "@/lib/utils";

/**
 * When a story was published: "5h ago", with the exact time on hover and for machines.
 * The server (or a cached page) renders the age as of then; after mount the reader's own
 * clock and time zone replace it, so a page served an hour ago doesn't keep saying "5h".
 */
export function PublishedTime({ at, className }: { at?: string; className?: string }) {
  const [text, setText] = useState(() => formatTimeAgo(at ?? ""));
  const [exact, setExact] = useState(() => formatExactTime(at));
  useEffect(() => {
    setText(formatTimeAgo(at ?? ""));
    setExact(formatExactTime(at));
  }, [at]);
  if (!at || !exact) return null;
  return (
    <time dateTime={at} title={exact} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
