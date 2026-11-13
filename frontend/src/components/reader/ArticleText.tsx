"use client";

import { Fragment } from "react";
import {
  bodySpans,
  findMentions,
  paragraphRanges,
  segmentRange,
  type Segment,
} from "@/lib/highlight";
import { entityColor } from "@/lib/utils";
import type { EntityInArticle } from "@/types";

export interface SelectedTerm {
  id: string;
  name: string;
  type: string;
}

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
  onSelect: (e: EntityInArticle) => void,
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
    ),
  );
}

/** Article text. Entities carry character offsets into `content`. */
export function ArticleBody({
  content,
  entities,
  activeId,
  onSelect,
  dropCap = false,
}: {
  content: string;
  entities: EntityInArticle[];
  activeId?: string;
  onSelect: (e: EntityInArticle) => void;
  /** Open the first paragraph with a drop cap, like the start of a printed story. */
  dropCap?: boolean;
}) {
  const spans = bodySpans(content, entities);

  const paragraphs = paragraphRanges(content);

  return (
    <div className="space-y-6">
      {paragraphs.map(([from, to], i) => (
        <p key={from} className={dropCap && i === 0 ? "drop-cap" : undefined}>
          {renderSegments(segmentRange(content, from, to, spans), activeId, onSelect)}
        </p>
      ))}
    </div>
  );
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
  const spans = findMentions(text, entities);
  return <>{renderSegments(segmentRange(text, 0, text.length, spans), activeId, onSelect)}</>;
}
