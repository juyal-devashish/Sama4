"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowUpRight, Loader2, Send, X } from "lucide-react";
import { useEntityContext } from "@/hooks/useEntityContext";
import { useExplain } from "@/hooks/useExplain";
import { usePrediction } from "@/hooks/usePrediction";
import { EntityBadge } from "@/components/ui/entity-badge";
import { Tip } from "@/components/onboarding/Tip";
import type { SelectedTerm } from "@/components/reader/ArticleText";
import { uniqueEntities } from "@/lib/highlight";
import { ENTITY_LABELS, ENTITY_TYPES, entityColor, entityKind } from "@/lib/utils";
import type { ArticleDetail, ExplainResponse } from "@/types";
import { splitCitations, type CitationTag } from "@/lib/citations";

interface Props {
  term: SelectedTerm;
  articleId: string;
  onSelectTerm: (t: SelectedTerm) => void;
  onOpenArticle: (id: string) => void;
  onClose: () => void;
  /** First-run tip about follow-up questions; set while it should show. */
  followUpTip?: FollowUpTip;
}

/** Explanation of one term, shown in the margin beside the story. */
export interface FollowUpTip {
  /** They asked a question, or saw the tip and moved on. */
  onDone: () => void;
  onDismiss: () => void;
}

export function ContextPanel({
  term,
  articleId,
  onSelectTerm,
  onOpenArticle,
  onClose,
  followUpTip,
}: Props) {
  const { data, isLoading, isError, refetch } = useEntityContext(term.id);
  const { data: prediction } = usePrediction(articleId);
  const color = entityColor(term.type);

  return (
    <div className="flex h-full flex-col">
      <div className="h-[3px] flex-shrink-0" style={{ backgroundColor: color }} aria-hidden />
      <div className="flex items-center justify-between px-6 pb-1 pt-5">
        <EntityBadge type={term.type} />
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="-mr-2 flex h-8 w-8 items-center justify-center text-text-tertiary transition-colors hover:text-foreground"
        >
          <X size={16} />
          <span className="sr-only">Close explanation</span>
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-6">
        <h2 className="headline mt-1 text-[30px]">{data?.entity.name ?? term.name}</h2>

        {isLoading ? (
          <div
            className="mt-5 space-y-2.5"
            role="status"
            aria-busy="true"
            aria-label="Loading explanation"
          >
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-3/5" />
          </div>
        ) : isError || !data ? (
          <div className="mt-5 text-[15px] leading-relaxed text-text-secondary">
            <p>The explanation didn&apos;t load. The server may be busy generating it.</p>
            <button type="button" onClick={() => refetch()} className="btn-outline mt-3">
              Try again
            </button>
          </div>
        ) : (
          <>
            {data.context.text.trim() ? (
              <>
                <p className="mt-4 text-[16.5px] leading-[1.6] text-foreground">
                  {data.context.text}
                </p>
                <p className="mt-2 font-ui text-[11.5px] text-text-tertiary">
                  Written by Samā4&apos;s AI from Wikipedia and this story.
                </p>
              </>
            ) : (
              <div className="mt-4 text-[15px] leading-relaxed text-text-secondary">
                <p>
                  Samā4 couldn&apos;t write an explanation for this term right now.
                  {data.entity.wikipedia_url
                    ? " Wikipedia has background on it below."
                    : " You can still ask a question about it below."}
                </p>
                <button type="button" onClick={() => refetch()} className="btn-outline mt-3">
                  Try again
                </button>
              </div>
            )}

            {data.entity.wikipedia_url && (
              <a
                href={data.entity.wikipedia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="label-ui link-ui mt-4 inline-flex items-center gap-1 font-bold text-accent-secondary"
              >
                Read more on Wikipedia
                <ArrowUpRight size={12} aria-hidden />
              </a>
            )}

            {data.related_entities.length > 0 && (
              <section className="mt-8">
                <h3 className="section-label">Connected to</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.related_entities.slice(0, 8).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelectTerm({ id: r.id, name: r.name, type: r.type })}
                      className="inline-flex h-7 items-center gap-1.5 border border-border px-2.5 font-editorial text-[13.5px] text-foreground transition-colors hover:border-foreground"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: entityColor(r.type) }}
                        aria-hidden
                      />
                      {r.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data.related_articles.filter((a) => a.id !== articleId).length > 0 && (
              <section className="mt-8">
                <h3 className="section-label">Also in the news</h3>
                <ol className="divide-y divide-divider">
                  {data.related_articles
                    .filter((a) => a.id !== articleId)
                    .slice(0, 4)
                    .map((a, i) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => onOpenArticle(a.id)}
                          className="flex w-full gap-3 py-3 text-left"
                        >
                          <span className="kicker pt-[3px] tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-editorial text-[15.5px] leading-[1.25] text-foreground hover:underline hover:decoration-1 hover:underline-offset-4">
                            {a.title}
                          </span>
                        </button>
                      </li>
                    ))}
                </ol>
              </section>
            )}

            {prediction?.status === "completed" && prediction.prediction_summary && (
              <section className="mt-8">
                <h3 className="section-label">Where this story may go</h3>
                <p className="mt-3 line-clamp-4 text-[15px] italic leading-[1.5] text-foreground">
                  {prediction.prediction_summary}
                </p>
                <a
                  href="#outlook"
                  className="label-ui link-ui mt-2 inline-block font-bold text-accent-secondary"
                >
                  See the full outlook
                </a>
              </section>
            )}
          </>
        )}
      </div>

      <FollowUp
        key={term.id}
        term={term}
        articleId={articleId}
        disabled={isLoading}
        tip={followUpTip}
      />
    </div>
  );
}

type Turn = { q: string; a?: string; sources?: ExplainResponse["sources"]; failed?: boolean };

const TAG_LABEL: Record<CitationTag, string> = {
  article: "Article",
  explanation: "Explanation",
  Wikipedia: "Wikipedia",
  outlook: "Outlook",
};

/** A follow-up answer with its [source] tags shown as small labels (linked where possible). */
function CitedAnswer({ text, sources = [] }: { text: string; sources?: Turn["sources"] }) {
  const href = (tag: CitationTag) =>
    tag === "outlook"
      ? "#outlook"
      : sources.find((s) => s.type.toLowerCase() === tag.toLowerCase())?.url;
  return (
    <p className="mt-1 text-[15px] leading-[1.55] text-foreground">
      {splitCitations(text).map((part, i) => {
        if ("text" in part) return <span key={i}>{part.text}</span>;
        const label = TAG_LABEL[part.tag];
        const url = href(part.tag);
        const cls =
          "ml-1 inline-flex h-[16px] items-center border border-border px-1 align-[2px] font-ui text-[9px] uppercase tracking-label text-accent-secondary";
        return url ? (
          <a
            key={i}
            href={url}
            {...(url.startsWith("#") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className={`${cls} hover:border-foreground`}
            aria-label={`Source: ${label}`}
          >
            {label}
          </a>
        ) : (
          <span key={i} className={cls} aria-label={`Source: ${label}`}>
            {label}
          </span>
        );
      })}
    </p>
  );
}

function FollowUp({
  term,
  articleId,
  disabled,
  tip,
}: {
  term: SelectedTerm;
  articleId: string;
  disabled: boolean;
  tip?: FollowUpTip;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const explain = useExplain();

  // Once the tip has been on screen for a moment, moving on (closing the panel or
  // picking another term) counts as having seen it. The delay keeps React's dev-mode
  // double mount, or a panel closed straight away, from using it up.
  const tipRef = useRef(tip);
  tipRef.current = tip;
  const showing = !!tip;
  useEffect(() => {
    if (!showing) return;
    const shownAt = Date.now();
    return () => {
      if (Date.now() - shownAt > 1500) tipRef.current?.onDone();
    };
  }, [showing]);

  const ask = async () => {
    const q = question.trim();
    if (!q || explain.isPending) return;
    tip?.onDone();
    setQuestion("");
    setTurns((t) => [...t, { q }]);
    try {
      const res = await explain.mutateAsync({
        entity_id: term.id,
        article_id: articleId,
        question: q,
      });
      setTurns((t) =>
        t.map((x, i) =>
          i === t.length - 1 ? { ...x, a: res.explanation, sources: res.sources } : x,
        ),
      );
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, failed: true } : x)));
    }
  };

  return (
    <div className="relative flex-shrink-0 border-t-2 border-foreground bg-background-secondary/60">
      <AnimatePresence>
        {tip && turns.length === 0 && (
          <Tip
            arrow="bottom"
            escape={false}
            onDismiss={tip.onDismiss}
            className="absolute bottom-full left-4 right-4 z-10 mb-3 max-w-none"
          >
            Ask a follow-up about {term.name}. Answers cite where they come from.
          </Tip>
        )}
      </AnimatePresence>
      {turns.length > 0 && (
        <div
          aria-live="polite"
          className="scroll-thin max-h-[40vh] space-y-4 overflow-y-auto px-6 pt-4"
        >
          {turns.map((t, i) => (
            <div key={i}>
              <p className="font-editorial text-[15px] font-bold leading-snug">{t.q}</p>
              {t.a ? (
                <CitedAnswer text={t.a} sources={t.sources} />
              ) : t.failed ? (
                <p className="mt-1 font-ui text-[12.5px] text-error">
                  No answer came back. Ask again in a moment.
                </p>
              ) : (
                <p className="label-ui mt-1.5 inline-flex items-center gap-2 text-text-tertiary">
                  <Loader2 size={13} className="animate-spin" /> Writing an answer
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <label htmlFor="followup" className="sr-only">
          Ask a follow-up question about {term.name}
        </label>
        <input
          id="followup"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={disabled}
          placeholder={`Ask about ${term.name}`}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 border border-border bg-background px-3 font-editorial text-[15px] text-foreground outline-none placeholder:italic placeholder:text-text-tertiary focus:border-foreground"
        />
        <button
          type="submit"
          disabled={!question.trim() || explain.isPending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-foreground text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          <Send size={15} />
          <span className="sr-only">Ask</span>
        </button>
      </form>
    </div>
  );
}

/** Margin content when no term is selected: every term in the story, grouped by type. */
export function KeyTerms({
  article,
  onSelect,
  onClose,
}: {
  article: ArticleDetail;
  onSelect: (t: SelectedTerm) => void;
  /** Set when shown as a drawer (narrow screens), which needs its own close button. */
  onClose?: () => void;
}) {
  const unique = uniqueEntities(article.entities);
  const groups = ENTITY_TYPES.map((type) => ({
    type,
    items: unique.filter((e) => entityKind(e.type) === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 py-6">
      <div className="section-label flex items-center justify-between">
        <h2 className="font-ui font-bold">In this story</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="-mr-2 flex h-8 w-8 items-center justify-center text-text-tertiary transition-colors hover:text-foreground"
          >
            <X size={16} />
            <span className="sr-only">Close the list of terms</span>
          </button>
        )}
      </div>
      <p className="mt-2 font-ui text-[12px] leading-relaxed text-text-tertiary">
        Select any highlighted term, or one below, to see who or what it is.
      </p>
      {groups.length === 0 ? (
        <p className="mt-6 text-[15px] text-text-secondary">
          No terms were picked out for this story.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((g) => (
            <section key={g.type}>
              <h3 className="label-ui flex items-center gap-2 font-bold text-text-secondary">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: entityColor(g.type) }}
                  aria-hidden
                />
                {ENTITY_LABELS[g.type].many}
              </h3>
              <ul className="mt-1.5 divide-y divide-divider">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelect({ id: e.id, name: e.text, type: e.type })}
                      className="block w-full py-2 text-left font-editorial text-[15.5px] leading-snug text-foreground hover:underline hover:decoration-1 hover:underline-offset-4"
                    >
                      {e.text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
