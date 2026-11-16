"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and during hydration, true afterwards. Use it for anything that
 * depends on the reader's own clock or time zone: the server renders in UTC and may be
 * hours ahead, and a pre-rendered page carries the date of its build.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
