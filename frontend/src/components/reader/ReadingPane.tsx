"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Check,
  Library,
  Link2,
  ListTree,
} from "lucide-react";
import { useArticle } from "@/hooks/useArticle";
import { useOnboarding, useSavedStories, TOPIC_LABELS } from "@/lib/preferences";
import { eligibleHint } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { PublishedTime } from "@/components/ui/published-time";
import { ErrorState } from "@/components/ui/states";
import { StoryImage } from "@/components/ui/story-image";
import { ContextPanel, KeyTerms } from "@/components/context/ContextPanel";
import { OutlookSection } from "@/components/outlook/OutlookSection";
import { TermHint } from "@/components/onboarding/TermHint";
import { useDesktop, useIntroShowing } from "@/components/onboarding/useHintContext";
import { uniqueEntities } from "@/lib/highlight";
import { ArticleBody, MatchedText, type SelectedTerm } from "./ArticleText";
import type { ArticleDetail } from "@/types";
import { storyPath } from "@/lib/routes";

interface Props {
  articleId: string;
  /** The story as fetched on the server. */
  initialArticle?: ArticleDetail;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}

export function ReadingPane({ articleId, initialArticle, onBack, onOpenArticle }: Props) {
  const { data: article, isLoading, isError, refetch } = useArticle(articleId, initialArticle);
  const [term, setTerm] = useState<SelectedTerm | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  // Below the wide breakpoint the margin is a drawer: it opens for a selected term, or
  // on the term list itself (the toolbar's Terms button), so the list stays reachable.
  const [listOpen, setListOpen] = useState(false);
  const drawerOpen = !!term || listOpen;

  // First-run hints: at most one at a time (rules in lib/onboarding.ts).
  const { state: onboarding, dispatch } = useOnboarding();
  const introShowing = useIntroShowing();
  const desktop = useDesktop();
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScroller = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setScrollEl(el);
  }, []);
  // A dismissed tip stays hidden for the rest of this story, even if it has chances left.
  const [tipDismissedFor, setTipDismissedFor] = useState<string | null>(null);
  const hint = eligibleHint(onboarding, {
    articleWithTerms: !!article && uniqueEntities(article.entities).length > 0,
    contextPanelOpen: !!term,
    desktop,
    introShowing,
  });

  useEffect(() => {
    if (article) dispatch({ type: "story-opened", id: article.id });
  }, [article, dispatch]);

  // Selecting any term means they've found highlights; that tip is done for good.
  useEffect(() => {
    if (term) dispatch({ type: "hint-done", hint: "select-term" });
  }, [term, dispatch]);
  const closeDrawer = () => {
    setTerm(null);
    setListOpen(false);
  };

  // New story: clear the margin and go back to the top.
  useEffect(() => {
    setTerm(null);
    setListOpen(false);
    setProgress(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [articleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (term) setTerm(null);
      else if (listOpen) setListOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [term, listOpen]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
  };

  return (
    <div className="flex min-w-0 flex-1">
      <div
        ref={setScroller}
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
          <Story
            article={article}
            term={term}
            onSelectTerm={setTerm}
            onBack={onBack}
            scrolled={progress > 0}
            listOpen={listOpen}
            onOpenTerms={() => setListOpen(true)}
          />
        )}
        {article && hint === "select-term" && tipDismissedFor !== article.id && (
          <TermHint
            key={article.id}
            container={scrollEl}
            storyKey={article.id}
            onDismiss={() => {
              setTipDismissedFor(article.id);
              dispatch({ type: "hint-dismissed", hint: "select-term" });
            }}
          />
        )}
      </div>

      {/* Context margin. Inline column on wide windows; a drawer over the story otherwise. */}
      {article && (
        <>
          <AnimatePresence>
            {drawerOpen && (
              <motion.button
                key="scrim"
                type="button"
                aria-label="Close explanation"
                className="fixed inset-0 z-30 bg-[var(--scrim)] wide:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeDrawer}
              />
            )}
          </AnimatePresence>
          <aside
            id="context-margin"
            aria-label={term ? `About ${term.name}` : "Terms in this story"}
            className={cn(
              "z-40 w-[380px] flex-shrink-0 border-l bg-background",
              "fixed inset-y-0 right-0 shadow-[var(--shadow-panel)] transition-transform duration-200 ease-out",
              "wide:static wide:translate-x-0 wide:shadow-none",
              drawerOpen ? "translate-x-0" : "invisible translate-x-full wide:visible",
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
                    followUpTip={
                      hint === "ask-follow-up"
                        ? {
                            onDone: () => dispatch({ type: "hint-done", hint: "ask-follow-up" }),
                            onDismiss: () =>
                              dispatch({ type: "hint-dismissed", hint: "ask-follow-up" }),
                          }
                        : undefined
                    }
                  />
                ) : (
                  <KeyTerms
                    article={article}
                    onSelect={setTerm}
                    onClose={listOpen ? () => setListOpen(false) : undefined}
                  />
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
  scrolled,
  listOpen,
  onOpenTerms,
}: {
  article: ArticleDetail;
  term: SelectedTerm | null;
  onSelectTerm: (t: SelectedTerm) => void;
  onBack: () => void;
  /** Once the story scrolls, the bar gets its rule and repeats the source name. */
  scrolled: boolean;
  listOpen: boolean;
  /** Narrow screens: open the margin drawer on the list of terms in this story. */
  onOpenTerms: () => void;
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
      await navigator.clipboard.writeText(`${window.location.origin}${storyPath(article.id)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing to do */
    }
  };

  const select = (e: { id: string; text: string; type: string }) =>
    onSelectTerm({ id: e.id, name: e.text, type: e.type });

  return (
    <>
      <div
        className={cn(
          "sticky top-[2px] z-10 flex h-12 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur transition-colors sm:px-6",
          scrolled ? "border-border" : "border-transparent",
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className="label-ui -ml-2 flex h-9 items-center gap-1.5 px-2 text-text-secondary hover:text-foreground lg:hidden"
        >
          <ArrowLeft size={14} /> Stories
        </button>
        <span
          aria-hidden={!scrolled}
          className={cn(
            "label-ui truncate font-bold transition-opacity duration-200",
            scrolled ? "opacity-100" : "opacity-0",
          )}
        >
          {article.source.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {termCount > 0 && (
            <button
              type="button"
              onClick={onOpenTerms}
              aria-expanded={listOpen}
              aria-controls="context-margin"
              aria-label="Terms in this story"
              className="label-ui flex h-9 items-center gap-1.5 px-2.5 text-text-secondary transition-colors hover:text-foreground wide:hidden"
            >
              <ListTree size={14} aria-hidden />
              <span className="hidden sm:inline">Terms</span>
            </button>
          )}
          <Link
            href={`/article/${article.id}/reference`}
            aria-label="References"
            className="label-ui flex h-9 items-center gap-1.5 px-2.5 text-text-secondary transition-colors hover:text-foreground"
          >
            <Library size={14} /> <span className="hidden sm:inline">References</span>
          </Link>
          <button
            type="button"
            onClick={copyLink}
            aria-label={copied ? "Link copied" : "Copy link"}
            className="label-ui flex h-9 items-center gap-1.5 px-2.5 text-text-secondary transition-colors hover:text-foreground"
          >
            {copied ? <Check size={14} className="text-success" /> : <Link2 size={14} />}
            <span className="hidden sm:inline">{copied ? "Link copied" : "Copy link"}</span>
          </button>
          <button
            type="button"
            onClick={save}
            aria-pressed={saved}
            aria-label={saved ? "Saved" : "Save"}
            title={saved ? "Remove from saved (S)" : "Save for later (S)"}
            className={cn(
              "label-ui flex h-9 items-center gap-1.5 px-2.5 transition-colors",
              saved ? "font-bold text-foreground" : "text-text-secondary hover:text-foreground",
            )}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[760px] px-6 pb-28 pt-10 sm:px-10 xl:px-14">
        {article.categories.length > 0 && (
          <p className="kicker mb-4">
            {article.categories.map((c) => TOPIC_LABELS[c] ?? c).join(" & ")}
          </p>
        )}
        <h1 className="headline text-[36px] leading-[1] sm:text-[44px] xl:text-[52px] xl:leading-[0.96]">
          {article.title}
        </h1>
        <p className="label-ui mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-text-secondary">
          <span className="font-bold text-foreground">{article.source.name}</span>
          {article.published_at && (
            <>
              <span aria-hidden>·</span>
              <PublishedTime at={article.published_at} />
            </>
          )}
          {article.reading_time_minutes ? (
            <>
              <span aria-hidden>·</span>
              <span>{article.reading_time_minutes} min read</span>
            </>
          ) : null}
          {termCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{termCount} terms explained</span>
            </>
          )}
        </p>
        {article.source.url && (
          <a
            href={article.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ink mt-5 px-4 py-2.5 text-[11px]"
          >
            Read the original at {article.source.name}
            <ArrowUpRight size={13} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}

        <StoryImage
          src={article.image_url}
          source={article.source.name}
          className="mt-8 aspect-[16/9] w-full text-[64px]"
        />

        {article.summary && (
          <section
            aria-labelledby="summary-label"
            aria-describedby="summary-note"
            className="mt-10 border-y border-border py-6"
          >
            <h2 id="summary-label" className="section-label">
              In brief
            </h2>
            <p
              id="summary-note"
              className="mt-1 font-ui text-[11.5px] leading-snug text-text-tertiary"
            >
              AI summary written by Samā4 from the article. Check the original for detail.
            </p>
            <p className="mt-3 text-[17px] leading-[1.6] text-foreground">
              <MatchedText
                text={article.summary}
                entities={article.entities}
                activeId={term?.id}
                onSelect={select}
              />
            </p>
          </section>
        )}

        <section
          aria-labelledby="body-label"
          aria-describedby="body-note"
          className="mt-10 text-[19px] leading-[1.7] text-foreground"
        >
          <h2 id="body-label" className="section-label">
            From {article.source.name}
          </h2>
          <p
            id="body-note"
            className="mb-5 mt-1 font-ui text-[11.5px] leading-snug text-text-tertiary"
          >
            As published by {article.source.name}. Samā4 adds the highlights.
          </p>
          {article.content ? (
            <ArticleBody
              content={article.content}
              entities={article.entities}
              activeId={term?.id}
              onSelect={select}
              dropCap
            />
          ) : (
            <p className="text-[16px] text-text-secondary">
              Only the brief is available for this story.
            </p>
          )}
          {article.source.url && (
            <a
              href={article.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ink mt-6 px-4 py-2.5 text-[11px]"
            >
              Continue reading at {article.source.name}
              <ArrowUpRight size={13} aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </section>

        <div className="mt-16">
          <OutlookSection
            articleId={article.id}
            articleTitle={article.title}
            basis={{
              publisher: article.source.name,
              words: article.content ? article.content.trim().split(/\s+/).length : 0,
              summaryOnly: !article.content,
            }}
          />
        </div>
      </article>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div
      className="mx-auto max-w-[760px] px-10 pt-24"
      role="status"
      aria-busy="true"
      aria-label="Loading story"
    >
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-8 w-full" />
      <div className="skeleton mt-2 h-8 w-3/4" />
      <div className="skeleton mt-5 h-3 w-64" />
      <div className="skeleton mt-8 aspect-[16/9] w-full" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${92 - (i % 3) * 9}%` }} />
        ))}
      </div>
    </div>
  );
}
