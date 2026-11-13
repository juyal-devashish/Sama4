"use client";

import { forwardRef } from "react";
import { Newspaper } from "lucide-react";
import type { ArticleCard } from "@/types";
import { StoryImage } from "@/components/ui/story-image";
import { cn, formatLongDate } from "@/lib/utils";
import { PublishedTime } from "@/components/ui/published-time";
import { TOPIC_LABELS } from "@/lib/preferences";
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
  HTMLButtonElement,
  { story: ArticleCard; selected?: boolean; onClick: () => void; dense?: boolean }
>(function StoryRow({ story, selected, onClick, dense }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full gap-4 px-4 text-left transition-colors",
        dense ? "py-3.5" : "py-5",
        selected ? "bg-background-secondary/70" : "hover:bg-background-secondary/40",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-foreground" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="kicker truncate">{story.source.name}</span>
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
        {!dense && story.summary && (
          <p className="mt-2 line-clamp-2 font-editorial text-[14px] leading-[1.4] text-text-secondary">
            {story.summary}
          </p>
        )}
      </div>
      <StoryImage
        src={story.image_url}
        source={story.source.name}
        loading="lazy"
        className={dense ? "h-14 w-14 text-[10px]" : "h-[72px] w-[72px] text-[12px]"}
      />
    </button>
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

interface StoryListProps {
  stories: ArticleCard[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId?: string;
  onSelect: (id: string) => void;
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
  topics,
  topic,
  onTopicChange,
  hasMore,
  loadingMore,
  onLoadMore,
  className,
}: StoryListProps) {
  return (
    <section
      aria-label="Stories"
      className={cn(
        "flex w-full flex-shrink-0 flex-col border-r border-border bg-background lg:w-[360px]",
        className,
      )}
    >
      <header className="mx-4 border-b border-border pb-4 pt-5">
        <p className="kicker">The daily edition</p>
        <h1
          className="mt-1 font-editorial text-[20px] leading-tight tracking-[-0.01em]"
          suppressHydrationWarning
        >
          {formatLongDate()}
        </h1>
        {topics.length > 0 && (
          <div className="mt-4">
            <TopicChips topics={topics} active={topic} onChange={onTopicChange} />
          </div>
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
            <ul className="divide-y divide-divider">
              {stories.map((s) => (
                <li key={s.id}>
                  <StoryRow
                    story={s}
                    selected={s.id === selectedId}
                    onClick={() => onSelect(s.id)}
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
