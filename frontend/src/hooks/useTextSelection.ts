"use client";

import { useEffect, useState } from "react";
import { normalizeSelection } from "@/lib/selection";

export interface TextSelection {
  text: string;
  /** Where the selection is on screen (viewport coordinates), to place the button. */
  rect: { top: number; left: number; bottom: number; width: number };
}

/**
 * The text the reader has selected inside elements marked `data-explainable`, if it is
 * worth explaining. Ignores selections inside a highlighted term, which already has
 * its own explanation. Debounced, because phones fire selectionchange continuously.
 */
export function useTextSelection(): TextSelection | null {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return setSelection(null);
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      if (!el?.closest("[data-explainable]") || el.closest(".term")) return setSelection(null);
      const text = normalizeSelection(sel.toString());
      if (!text) return setSelection(null);
      const r = range.getBoundingClientRect();
      setSelection({ text, rect: { top: r.top, left: r.left, bottom: r.bottom, width: r.width } });
    };
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 150);
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, []);

  return selection;
}
