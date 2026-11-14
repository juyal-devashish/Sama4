import { formatExactTime, formatTimeAgo } from "@/lib/utils";

/** When a story was published: "5h ago", with the exact time on hover and for machines. */
export function PublishedTime({ at, className }: { at?: string; className?: string }) {
  const exact = formatExactTime(at);
  if (!at || !exact) return null;
  return (
    <time dateTime={at} title={exact} className={className} suppressHydrationWarning>
      {formatTimeAgo(at)}
    </time>
  );
}
