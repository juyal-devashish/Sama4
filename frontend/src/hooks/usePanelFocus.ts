"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FOCUSABLE, trapTarget } from "@/lib/focus";

/** Below the `wide` breakpoint (tailwind.config.js) the margin is a drawer over the story. */
const DRAWER_QUERY = "(max-width: 1479px)";

/**
 * Focus handling for the explanation margin.
 *  - When it opens, focus moves into it (so keyboard and screen-reader users land on it).
 *  - When it is a drawer, Tab and Shift+Tab stay inside it until it closes.
 *  - When it closes, focus returns to what opened it (the term, or the Terms button).
 *
 * `openKey` changes when the panel switches to another term while open: focus is
 * pulled back into the new content. `fallbackSelector` finds the opener again when the
 * browser didn't focus it on click (Safari) or it has re-rendered.
 */
export function usePanelFocus(
  panelRef: RefObject<HTMLElement>,
  open: boolean,
  openKey: string,
  fallbackSelector: string | null,
) {
  const opener = useRef<HTMLElement | null>(null);
  const fallback = useRef<string | null>(null);
  const wasOpen = useRef(false);
  fallback.current = fallbackSelector ?? fallback.current;

  useEffect(() => {
    const panel = panelRef.current;
    if (open && !wasOpen.current) {
      const active = document.activeElement as HTMLElement | null;
      opener.current =
        active && !panel?.contains(active) && active !== document.body ? active : null;
    }
    if (open) panel?.focus({ preventScroll: true });
    if (!open && wasOpen.current) {
      const target =
        opener.current && opener.current.isConnected
          ? opener.current
          : fallback.current
            ? document.querySelector<HTMLElement>(fallback.current)
            : null;
      target?.focus({ preventScroll: true });
      opener.current = null;
    }
    wasOpen.current = open;
  }, [open, openKey, panelRef]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const drawer = () => window.matchMedia(DRAWER_QUERY).matches;
    const items = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
      );
    let tabbing = false;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawer()) return;
      tabbing = true;
      const list = items();
      const next = trapTarget(
        list.indexOf(document.activeElement as HTMLElement),
        list.length,
        e.shiftKey,
      );
      if (next !== null) {
        e.preventDefault();
        list[next].focus();
      } else if (document.activeElement === panel && list.length > 0) {
        // The panel itself holds focus on open; Tab goes to its first control.
        e.preventDefault();
        list[e.shiftKey ? list.length - 1 : 0].focus();
      }
    };
    // Backstop for anything the list above misjudges: if keyboard focus lands outside
    // the drawer, pull it back in. Mouse and touch are left alone.
    const onFocusIn = (e: FocusEvent) => {
      if (!tabbing || !drawer() || panel.contains(e.target as Node)) return;
      const list = items();
      (list[0] ?? panel).focus();
    };
    const onPointer = () => {
      tabbing = false;
    };
    // If the control that has focus is removed (the explanation finishes loading and the
    // content is replaced), focus falls to <body>: put it back on the panel.
    const observer = new MutationObserver(() => {
      if (tabbing && drawer() && !panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    });
    observer.observe(panel, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, panelRef]);
}
