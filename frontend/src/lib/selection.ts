/** Rules for text a reader selects in a story to have explained. Pure, so it is tested. */

export const MIN_SELECTION_CHARS = 2;
export const MAX_SELECTION_CHARS = 120;
export const MAX_SELECTION_WORDS = 12;

/**
 * The selection as one clean line, or null if it isn't worth explaining: too short or
 * long, a whole sentence or more, or without any letters (numbers and punctuation).
 */
export function normalizeSelection(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < MIN_SELECTION_CHARS || text.length > MAX_SELECTION_CHARS) return null;
  if (text.split(" ").length > MAX_SELECTION_WORDS) return null;
  if (!hasLetters(text)) return null;
  return text;
}

/** True if the text has a letter in any script (cased letters, or CJK and Hangul). */
function hasLetters(text: string): boolean {
  return (
    Array.from(text).some((ch) => ch.toLowerCase() !== ch.toUpperCase()) ||
    /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)
  );
}
