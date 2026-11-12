"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Tip } from "./Tip";

const TIP_WIDTH = 300;
const GUTTER = 16;
/** Height of the sticky story toolbar; a term under it doesn't count as visible. */
const TOOLBAR = 58;

type Box = { top: number; left: number; width: number; height: number };

/**
 * "Select any highlight": a pulse around one highlighted term and a tip just below it.
 * Rendered inside the story's scroll container (which is `position: relative`), so it
 * scrolls with the text. Prefers the first term already in view, else the first one.
 */
export function TermHint({
  container,
  storyKey,
  onDismiss,
}: {
  container: HTMLElement | null;
  /** Changes per story, so the target term is picked again. */
  storyKey: string;
  onDismiss: () => void;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Pick the term once per story, not on every scroll, so the tip doesn't jump around.
  useEffect(() => {
    if (!container) return;
    const terms = Array.from(container.querySelectorAll<HTMLElement>("article .term"));
    const c = container.getBoundingClientRect();
    const inView = terms.find((t) => {
      const r = t.getBoundingClientRect();
      return r.top >= c.top + TOOLBAR && r.bottom <= c.bottom - 80;
    });
    setTarget(inView ?? terms[0] ?? null);
  }, [container, storyKey]);

  // Measure relative to the scroll container; again whenever its size changes
  // (window resize, images loading, fonts swapping in).
  useLayoutEffect(() => {
    if (!container || !target) return;
    const measure = () => {
      const c = container.getBoundingClientRect();
      // A term that wraps has several boxes; point at the first line.
      const r = target.getClientRects()[0] ?? target.getBoundingClientRect();
      setBox({
        top: r.top - c.top + container.scrollTop,
        left: r.left - c.left,
        width: r.width,
        height: r.height,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    const article = container.querySelector("article");
    if (article) ro.observe(article);
    return () => ro.disconnect();
  }, [container, target]);

  if (!box || !container) return null;
  const maxLeft = container.clientWidth - Math.min(TIP_WIDTH, container.clientWidth - 2 * GUTTER);
  const tipLeft = Math.max(GUTTER, Math.min(box.left - 8, maxLeft - GUTTER));
  // Point the arrow at the middle of the term's first line, wherever the tip ended up.
  const arrowLeft = Math.max(12, Math.min(box.left + box.width / 2 - tipLeft - 5, TIP_WIDTH - 24));

  return (
    <>
      <span
        aria-hidden="true"
        className="hint-ring pointer-events-none absolute z-[5]"
        style={{
          top: box.top - 3,
          left: box.left - 3,
          width: box.width + 6,
          height: box.height + 6,
        }}
      />
      <Tip
        onDismiss={onDismiss}
        arrowLeft={arrowLeft}
        className="absolute z-[5]"
        style={{ top: box.top + box.height + 12, left: tipLeft }}
      >
        Select any highlight to see who or what it is, right beside the story.
      </Tip>
    </>
  );
}
