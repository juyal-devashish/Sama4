"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bookmark, BookmarkCheck, Check, Library, Link2 } from "lucide-react";
import { useArticle } from "@/hooks/useArticle";
import { useSavedStories, TOPIC_LABELS } from "@/lib/preferences";
import { cn, formatTimeAgo } from "@/lib/utils";
import { isTypingTarget } from "@/components/shell/AppShell";
import { ErrorState } from "@/components/ui/states";
import { ContextPanel, KeyTerms } from "@/components/context/ContextPanel";
import { OutlookSection } from "@/components/outlook/OutlookSection";
import { uniqueEntities } from "@/lib/highlight";
import { ArticleBody, MatchedText, type SelectedTerm } from "./ArticleText";
import type { ArticleDetail } from "@/types";

interface Props {
  articleId: string;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}

export function ReadingPane({ articleId, onBack, onOpenArticle }: Props) {
  const { data: article, isLoading, isError, refetch } = useArticle(articleId);
  const [term, setTerm] = useState<SelectedTerm | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  // New story: clear the margin and go back to the top.
  useEffect(() => {
    setTerm(null);
    setProgress(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [articleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && term) setTerm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [term]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
  };

  return (
    <div className="flex min-w-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-thin relative min-w-0 flex-1 overflow-y-auto bg-surface"
      >
        <div className="sticky top-0 z-20">
          <div
            className="h-[2px] bg-accent-primary transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        {isLoading ? (
          <ArticleSkeleton />
        ) : isError || !article ? (
          <ErrorState what="this story" onRetry={() => refetch()} />
        ) : (
          <Story article={article} term={term} onSelectTerm={setTerm} onBack={onBack} />
        )}
      </div>

      {/* Context margin. Inline column on wide windows; a drawer over the story otherwise. */}
      {article && (
        <>
          <AnimatePresence>
            {term && (
              <motion.button
                key="scrim"
                type="button"
                aria-label="Close explanation"
                className="fixed inset-0 z-30 bg-[var(--scrim)] wide:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTerm(null)}
              />
            )}
          </AnimatePresence>
          <aside
            aria-label={term ? `About ${term.name}` : "Terms in this story"}
            className={cn(
              "z-40 w-[380px] flex-shrink-0 border-l bg-background",
              "fixed inset-y-0 right-0 shadow-[var(--shadow-panel)] transition-transform duration-200 ease-out",
              "wide:static wide:translate-x-0 wide:shadow-none",
              term ? "translate-x-0" : "invisible translate-x-full wide:visible",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={term?.id ?? "terms"}
                className="h-full"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {term ? (
                  <ContextPanel
                    term={term}
                    articleId={article.id}
                    onSelectTerm={setTerm}
                    onOpenArticle={onOpenArticle}
                    onClose={() => setTerm(null)}
                  />
                ) : (
                  <KeyTerms article={article} onSelect={setTerm} />
                )}
              </motion.div>
            </AnimatePresence>
          </aside>
        </>
      )}
    </div>
  );
}

function Story({
  article,
  term,
  onSelectTerm,
  onBack,
}: {
  article: ArticleDetail;
  term: SelectedTerm | null;
  onSelectTerm: (t: SelectedTerm) => void;
  onBack: () => void;
}) {
  const { isSaved, toggle } = useSavedStories();
  const saved = isSaved(article.id);
  const [copied, setCopied] = useState(false);
  const termCount = uniqueEntities(article.entities).length;

  const save = () =>
    toggle({
      id: article.id,
      title: article.title,
      summary: article.summary,
      image_url: article.image_url,
      published_at: article.published_at,
      reading_time_minutes: article.reading_time_minutes,
      source: article.source.name,
    });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/article/${article.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing to do */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "s") save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const select = (e: { id: string; text: string; type: string }) =>
    onSelectTerm({ id: e.id, name: e.text, type: e.type });

  return (
    <>
      <div className="sticky top-[2px] z-10 flex h-14 items-center gap-2 border-b bg-surface/90 px-6 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-text-secondary hover:bg-background-secondary lg:hidden"
        >
          <ArrowLeft size={16} /> Stories
        </button>
        <span className="truncate font-display text-[13px] font-semibold">
          {article.source.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`/article/${article.id}/reference`}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <Library size={16} /> References
          </Link>
          <button
            type="button"
            onClick={copyLink}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            {copied ? <Check size={16} className="text-success" /> : <Link2 size={16} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={save}
            aria-pressed={saved}
            title={saved ? "Remove from saved (S)" : "Save for later (S)"}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors hover:bg-background-secondary",
              saved ? "text-accent-primary" : "text-text-secondary hover:text-foreground",
            )}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[760px] px-10 pb-28 pt-10 xl:px-14">
        {article.categories.length > 0 && (
          <p className="mb-3 font-display text-[13px] font-medium text-accent-secondary">
            {article.categories.map((c) => TOPIC_LABELS[c] ?? c).join(", ")}
          </p>
        )}
        <h1 className="font-display text-[32px] font-bold leading-[1.18] tracking-[-0.02em] xl:text-[38px]">
          {article.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-text-secondary">
          <span className="font-medium text-foreground">{article.source.name}</span>
          {article.published_at && (
            <time dateTime={article.published_at} suppressHydrationWarning>
              {formatTimeAgo(article.published_at)}
            </time>
          )}
          {article.reading_time_minutes ? (
            <span>{article.reading_time_minutes} min read</span>
          ) : null}
          {termCount > 0 && <span>{termCount} terms explained</span>}
        </div>

        {article.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image_url}
            onError={(e) => (e.currentTarget.style.display = "none")}
            alt=""
            className="mt-8 aspect-[16/9] w-full rounded-xl bg-background-secondary object-cover"
          />
        )}

        {article.summary && (
          <section aria-label="Summary" className="mt-9 border-l-[3px] border-accent-primary pl-5">
            <h2 className="font-display text-[13px] font-semibold text-accent-primary">In brief</h2>
            <p className="mt-1.5 text-[17px] leading-[1.65] text-foreground">
              <MatchedText
                text={article.summary}
                entities={article.entities}
                activeId={term?.id}
                onSelect={select}
              />
            </p>
          </section>
        )}

        <div className="mt-9 max-w-measure text-[18px] leading-[1.75] text-foreground">
          {article.content ? (
            <ArticleBody
              content={article.content}
              entities={article.entities}
              activeId={term?.id}
              onSelect={select}
            />
          ) : (
            <p className="text-[15px] text-text-secondary">
              Only the summary is available for this story.
              {article.source.url && (
                <>
                  {" "}
                  <a
                    href={article.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-secondary hover:underline"
                  >
                    Visit {article.source.name}
                  </a>{" "}
                  for the full text.
                </>
              )}
            </p>
          )}
        </div>

        <div className="mt-16">
          <OutlookSection articleId={article.id} articleTitle={article.title} />
        </div>
      </article>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-[760px] px-10 pt-24" aria-busy="true" aria-label="Loading story">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-8 w-full" />
      <div className="skeleton mt-2 h-8 w-3/4" />
      <div className="skeleton mt-5 h-3 w-64" />
      <div className="skeleton mt-8 aspect-[16/9] w-full rounded-xl" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${92 - (i % 3) * 9}%` }} />
        ))}
      </div>
    </div>
  );
}
