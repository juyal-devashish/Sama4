"use client";

import { useMounted } from "@/hooks/useMounted";
import { formatFullDate, formatLongDate, formatWeekday } from "@/lib/utils";

const FORMATS = {
  weekday: formatWeekday,
  full: formatFullDate,
  long: formatLongDate,
} as const;

/**
 * Today's date in the reader's time zone. Rendered after mount, never on the server, so
 * a Saturday-evening reader in New York never sees the server's Sunday. Until then it
 * holds a non-breaking space so the line keeps its height.
 */
export function ClientDate({ format }: { format: keyof typeof FORMATS }) {
  const mounted = useMounted();
  return <>{mounted ? FORMATS[format]() : "\u00a0"}</>;
}
