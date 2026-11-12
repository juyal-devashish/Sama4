/**
 * Pure text-highlighting logic for entity mentions. No React here, so it can be
 * unit-tested (see highlight.test.ts). Rendering lives in components/reader/ArticleText.tsx.
 */
import type { EntityInArticle } from "@/types";

export type Span = { start: number; end: number; entity: EntityInArticle };
export type Segment = { text: string; entity?: EntityInArticle; key: string };

/** Drop out-of-range and overlapping spans, keeping the earliest (then longest) one. */
export function cleanSpans<T extends { start: number; end: number }>(
  spans: T[],
  length: number,
): T[] {
  const sorted = spans
    .filter((s) => s.start >= 0 && s.end <= length && s.end > s.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: T[] = [];
  let lastEnd = -1;
  for (const s of sorted) {
    if (s.start >= lastEnd) {
      out.push(s);
      lastEnd = s.end;
    }
  }
  return out;
}

/**
 * Spans for highlighting the article body from the backend's stored offsets.
 * Only mentions whose text really sits at [start, end) are kept: older rows
 * (e.g. headline-only terms in short RSS teasers) can carry offsets that point at
 * unrelated text. Those entities still appear in the side panel and in summaries.
 */
export function bodySpans(content: string, entities: EntityInArticle[]): Span[] {
  const aligned = entities.filter(
    (e) => content.slice(e.start, e.end).toLowerCase() === e.text.toLowerCase(),
  );
  return cleanSpans(
    aligned.map((e) => ({ start: e.start, end: e.end, entity: e })),
    content.length,
  );
}

/** Split content[from, to) into plain and entity segments. Spans crossing the range are skipped. */
export function segmentRange(content: string, from: number, to: number, spans: Span[]): Segment[] {
  const segs: Segment[] = [];
  let cursor = from;
  for (const s of spans) {
    if (s.end <= from || s.start >= to) continue;
    if (s.start < from || s.end > to) continue; // crosses a paragraph break
    if (s.start > cursor) segs.push({ text: content.slice(cursor, s.start), key: `t${cursor}` });
    segs.push({ text: content.slice(s.start, s.end), entity: s.entity, key: `e${s.start}` });
    cursor = s.end;
  }
  if (cursor < to) segs.push({ text: content.slice(cursor, to), key: `t${cursor}` });
  return segs;
}

/** [start, end) offsets of each non-empty paragraph (split on newlines). */
export function paragraphRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  const breaks = /\s*\n\s*/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = breaks.exec(content)) !== null) {
    if (m.index > start) ranges.push([start, m.index]);
    start = m.index + m[0].length;
  }
  if (start < content.length) ranges.push([start, content.length]);
  return ranges;
}

const PRIORITY: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Unique entities by name (case-insensitive), keeping the highest-priority instance. */
export function uniqueEntities(entities: EntityInArticle[]): EntityInArticle[] {
  const map = new Map<string, EntityInArticle>();
  for (const e of entities) {
    const key = e.text.toLowerCase();
    const prev = map.get(key);
    if (!prev || (PRIORITY[e.priority] ?? 0) > (PRIORITY[prev.priority] ?? 0)) map.set(key, e);
  }
  return Array.from(map.values());
}

/** Find whole-word, case-insensitive mentions of entity names in text without offsets. */
export function findMentions(text: string, entities: EntityInArticle[]): Span[] {
  const found: Span[] = [];
  for (const entity of uniqueEntities(entities)) {
    const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Not \b: \b never matches next to a symbol, so names like "C++" or "U.S." would be missed.
    const re = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      found.push({ start: match.index, end: match.index + match[0].length, entity });
    }
  }
  return cleanSpans(found, text.length);
}
