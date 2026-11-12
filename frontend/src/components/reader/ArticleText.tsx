"use client";

import { Fragment } from "react";
import { entityColor } from "@/lib/utils";
import type { EntityInArticle } from "@/types";

export interface SelectedTerm {
  id: string;
  name: string;
  type: string;
}

type Segment = { text: string; entity?: EntityInArticle; key: string };

function Term({
  entity,
  text,
  active,
  onSelect,
}: {
  entity: EntityInArticle;
  text: string;
  active: boolean;
  onSelect: (e: EntityInArticle) => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      className="term"
      data-priority={entity.priority}
      aria-pressed={active}
      title={`Explain ${entity.text}`}
      style={{ ["--term-color" as string]: entityColor(entity.type) }}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(entity);
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onSelect(entity);
        }
      }}
    >
      {text}
    </span>
  );
}

function renderSegments(
  segments: Segment[],
  activeId: string | undefined,
  onSelect: (e: EntityInArticle) => void
) {
  return segments.map((s) =>
    s.entity ? (
      <Term
        key={s.key}
        entity={s.entity}
        text={s.text}
        active={s.entity.id === activeId}
        onSelect={onSelect}
      />
    ) : (
      <Fragment key={s.key}>{s.text}</Fragment>
    )
  );
}

/** Drop out-of-range and overlapping spans, keeping the earliest (then longest) one. */
function cleanSpans<T extends { start: number; end: number }>(spans: T[], length: number): T[] {
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

function segmentRange(
  content: string,
  from: number,
  to: number,
  spans: { start: number; end: number; entity: EntityInArticle }[]
): Segment[] {
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

/** Full article body. Entities carry character offsets into `content`. */
export function ArticleBody({
  content,
  entities,
  activeId,
  onSelect,
}: {
  content: string;
  entities: EntityInArticle[];
  activeId?: string;
  onSelect: (e: EntityInArticle) => void;
}) {
  const spans = cleanSpans(
    entities.map((e) => ({ start: e.start, end: e.end, entity: e })),
    content.length
  );

  const paragraphs: [number, number][] = [];
  const breaks = /\s*\n\s*/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = breaks.exec(content)) !== null) {
    if (m.index > start) paragraphs.push([start, m.index]);
    start = m.index + m[0].length;
  }
  if (start < content.length) paragraphs.push([start, content.length]);

  return (
    <div className="space-y-6">
      {paragraphs.map(([from, to]) => (
        <p key={from}>{renderSegments(segmentRange(content, from, to, spans), activeId, onSelect)}</p>
      ))}
    </div>
  );
}

const PRIORITY: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Unique entities by name, keeping the highest-priority instance. */
export function uniqueEntities(entities: EntityInArticle[]): EntityInArticle[] {
  const map = new Map<string, EntityInArticle>();
  for (const e of entities) {
    const key = e.text.toLowerCase();
    const prev = map.get(key);
    if (!prev || (PRIORITY[e.priority] ?? 0) > (PRIORITY[prev.priority] ?? 0)) map.set(key, e);
  }
  return Array.from(map.values());
}

/** Short text (like the summary) with no offsets: find entity names by matching words. */
export function MatchedText({
  text,
  entities,
  activeId,
  onSelect,
}: {
  text: string;
  entities: EntityInArticle[];
  activeId?: string;
  onSelect: (e: EntityInArticle) => void;
}) {
  const found: { start: number; end: number; entity: EntityInArticle }[] = [];
  for (const entity of uniqueEntities(entities)) {
    const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      found.push({ start: match.index, end: match.index + match[0].length, entity });
    }
  }
  const spans = cleanSpans(found, text.length);
  return <>{renderSegments(segmentRange(text, 0, text.length, spans), activeId, onSelect)}</>;
}
