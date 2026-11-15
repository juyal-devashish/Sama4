/** Pure focus helpers (tested): which elements Tab can reach, and where Tab goes next. */

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The element Tab (or Shift+Tab) should land on to stay inside a group of `count`
 * focusable elements, given the index of the current one (-1 if focus is outside).
 * Returns null when the browser's own order is already right.
 */
export function trapTarget(current: number, count: number, shift: boolean): number | null {
  if (count === 0) return null;
  if (current === -1) return shift ? count - 1 : 0;
  if (!shift && current === count - 1) return 0;
  if (shift && current === 0) return count - 1;
  return null;
}
