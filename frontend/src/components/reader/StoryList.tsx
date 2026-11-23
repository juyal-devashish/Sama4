"use client";

import { forwardRef, useEffect, useRef } from "react";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import type { ArticleCard } from "@/types";
import { StoryImage } from "@/components/ui/story-image";
import { cn, displaySummary } from "@/lib/utils";
import { ClientDate } from "@/components/ui/client-date";
import { PublishedTime } from "@/components/ui/published-time";
import { TOPIC_LABELS } from "@/lib/preferences";
import { useNewSince } from "@/hooks/useNewSince";
import { firstEarlierIndex, newestEditionAt } from "@/lib/edition";
import { isNewSince } from "@/lib/lastVisit";
import { EmptyState, ErrorState } from "@/components/ui/states";

export function TopicChips({
  topics,
  active,
  onChange,
}: {
  topics: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  // A link can open a topic the reader has hidden in Settings: still show it, selected.
  const shown = [
    "all",
    ...topics,
    ...(active !== "all" && !topics.includes(active) ? [active] : []),
  ];
  return (
    // Toggle buttons, not tabs: tabs promise arrow-key navigation and a tab panel.
    <div role="group" aria-label="Topics" className="flex flex-wrap gap-1.5">
      {shown.map((t) => {
        const on = active === t;
        return (
          <button
            key={t}
            aria-pressed={on}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "label-ui h-7 border px-2.5 transition-colors",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-transparent text-text-secondary hover:border-foreground hover:text-foreground",
            )}
          >
            {t === "all" ? "All" : (TOPIC_LABELS[t] ?? t)}
          </button>
        );
      })}
    </div>
  );
}

export const StoryRow = forwardRef<
  HTMLAnchorElement,
  {
    story: ArticleCard;
    /** The story's own address: opens in a new tab, copies, and works without script. */
    href: string;
    selected?: boolean;
    onClick: () => void;
    dense?: boolean;
    /** Stored since the reader's last visit: shows a "New" marker. */
    isNew?: boolean;
    /** The first card on screen: its image loads at once instead of lazily. */
    priority?: boolean;
  }
>(function StoryRow({ story, href, selected, onClick, dense, isNew, priority }, ref) {
  // The brief, or else the publisher's own description (stories with short feed text have no brief).
  const summary = displaySummary(story.summary) ?? (story.feed_text?.trim() || null);
  return (
    <a
      ref={ref}
      href={href}
      onClick={(e) => {
        // Plain clicks select the story in place; modified ones (new tab, window) are the browser's.
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onClick();
      }}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full gap-4 px-4 text-left no-underline transition-colors",
        dense ? "py-3.5" : "py-5",
        selected ? "bg-background-secondary/70" : "hover:bg-background-secondary/40",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-foreground" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="kicker truncate">{story.source.name}</span>
          {isNew && (
            <span className="label-ui flex-shrink-0 font-bold text-accent-secondary">
              New<span className="sr-only"> since your last visit</span>
            </span>
          )}
          <PublishedTime
            at={story.published_at}
            className="label-ui flex-shrink-0 text-text-tertiary"
          />
        </div>
        <h2
          className={cn(
            "font-editorial leading-[1.12] tracking-[-0.02em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4",
            dense ? "line-clamp-2 text-[17px]" : "line-clamp-3 text-[20px]",
          )}
        >
          {story.title}
        </h2>
        {!dense && summary && (
          <p className="mt-2 line-clamp-2 font-editorial text-[14px] leading-[1.4] text-text-secondary">
            {summary}
          </p>
        )}
      </div>
      <StoryImage
        src={story.image_url}
        source={story.source.name}
        loading={priority ? "eager" : "lazy"}
        priority={priority}
        className={dense ? "h-14 w-14 text-[10px]" : "h-[72px] w-[72px] text-[12px]"}
      />
    </a>
  );
});

export function StoryListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-3" role="status" aria-busy="true" aria-label="Loading stories">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
          <div className="skeleton h-[72px] w-[72px]" />
        </div>
      ))}
    </div>
  );
}

function DateHeading({
  as: Tag,
  className,
  children,
}: {
  as: "h1" | "h2";
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={className} suppressHydrationWarning>
      {children}
    </Tag>
  );
}

interface StoryListProps {
  stories: ArticleCard[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Address of a story in the current topic, for each card's link. */
  hrefFor: (id: string) => string;
  /** How many stories the feed holds in all, for "Showing 10 of 42". */
  total?: number;
  topics: string[];
  topic: string;
  onTopicChange: (t: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  className?: string;
}

export function StoryList({
  stories,
  isLoading,
  isError,
  onRetry,
  selectedId,
  onSelect,
  hrefFor,
  total,
  topics,
  topic,
  onTopicChange,
  hasMore,
  loadingMore,
  onLoadMore,
  className,
}: StoryListProps) {
  const since = useNewSince();
  const listRef = useRef<HTMLUListElement>(null);
  const earlierAt = firstEarlierIndex(stories);
  const edition = newestEditionAt(stories);

  // After "Load more", move focus to the first new story so keyboard and screen-reader
  // readers continue where the new stories start instead of at the top.
  const shown = useRef(0);
  const loadedMore = useRef(false);
  useEffect(() => {
    if (loadingMore) loadedMore.current = true;
  }, [loadingMore]);
  useEffect(() => {
    if (loadedMore.current && !loadingMore && stories.length > shown.current && shown.current > 0) {
      listRef.current?.querySelectorAll<HTMLAnchorElement>("a")[shown.current]?.focus();
      loadedMore.current = false;
    }
    shown.current = stories.length;
  }, [stories.length, loadingMore]);
  return (
    <section
      aria-label="Stories"
      className={cn(
        "flex w-full flex-shrink-0 flex-col border-r border-border bg-background lg:w-[360px]",
        className,
      )}
    >
      <header className="mx-4 border-b border-border pb-4 pt-5">
        {/* The date is the page's heading until a story opens; then the story's title is. */}
        <DateHeading
          as={selectedId ? "h2" : "h1"}
          className="font-editorial text-[20px] leading-tight tracking-[-0.01em]"
        >
          <ClientDate format="long" />
        </DateHeading>
        {topics.length > 0 && (
          <div className="mt-4">
            <TopicChips topics={topics} active={topic} onChange={onTopicChange} />
          </div>
        )}
        <p className="mt-3 font-ui text-[11.5px] leading-snug text-text-tertiary">
          Summaries are written by Samā4&rsquo;s AI from each outlet&rsquo;s own text.{" "}
          <Link href="/how-explanations-work" className="underline underline-offset-2">
            How it works
          </Link>
        </p>
        {stories.length > 0 && (
          <p
            role="status"
            className="label-ui mt-2 flex flex-wrap gap-x-2 text-text-tertiary"
            suppressHydrationWarning
          >
            <span>
              {total && total > stories.length
                ? `Showing ${stories.length} of ${total} stories`
                : `${stories.length} ${stories.length === 1 ? "story" : "stories"}`}
            </span>
            {edition !== null && (
              <span>
                · Updated <PublishedTime at={new Date(edition).toISOString()} />
              </span>
            )}
          </p>
        )}
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto pb-6">
        {isLoading ? (
          <StoryListSkeleton />
        ) : isError ? (
          <ErrorState what="stories" onRetry={onRetry} />
        ) : stories.length === 0 ? (
          <EmptyState icon={Newspaper} title="No stories here yet">
            New stories arrive through the day. Check back soon.
          </EmptyState>
        ) : (
          <>
            <ul ref={listRef} className="divide-y divide-divider">
              {stories.map((s, i) => (
                <li key={s.id}>
                  {i === earlierAt && (
                    <p className="kicker border-t border-border px-4 pb-1 pt-4">Earlier editions</p>
                  )}
                  <StoryRow
                    story={s}
                    href={hrefFor(s.id)}
                    selected={s.id === selectedId}
                    onClick={() => onSelect(s.id)}
                    isNew={isNewSince(s, since)}
                    priority={i === 0}
                  />
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="px-4 pt-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="btn-outline w-full"
                >
                  {loadingMore ? "Loading…" : "Load more stories"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
