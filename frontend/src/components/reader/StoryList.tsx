"use client";

import { forwardRef } from "react";
import { Newspaper } from "lucide-react";
import type { ArticleCard } from "@/types";
import { cn, formatLongDate, formatTimeAgo } from "@/lib/utils";
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
  return (
    <div role="tablist" aria-label="Topics" className="flex flex-wrap gap-1.5">
      {["all", ...topics].map((t) => {
        const on = active === t;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              on
                ? "border-accent-primary bg-accent-primary text-on-accent"
                : "bg-transparent text-text-secondary hover:border-accent-secondary hover:text-foreground",
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
        "group relative flex w-full gap-4 rounded-xl px-4 text-left transition-colors",
        dense ? "py-3" : "py-4",
        selected ? "bg-surface" : "hover:bg-surface/70",
      )}
    >
      {selected && (
        <span
          className="absolute inset-y-4 left-0 w-[3px] rounded-full bg-accent-primary"
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2 text-[12px]">
          <span className="truncate font-display font-semibold text-foreground">
            {story.source.name}
          </span>
          <span className="flex-shrink-0 text-text-tertiary">
            {formatTimeAgo(story.published_at)}
          </span>
        </div>
        <h2
          className={cn(
            "font-display text-[15px] font-semibold leading-snug tracking-[-0.005em]",
            dense ? "line-clamp-2" : "line-clamp-3",
          )}
        >
          {story.title}
        </h2>
        {!dense && story.summary && (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.5] text-text-secondary">
            {story.summary}
          </p>
        )}
      </div>
      {story.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.image_url}
          onError={(e) => (e.currentTarget.style.display = "none")}
          alt=""
          loading="lazy"
          className={cn(
            "flex-shrink-0 rounded-lg bg-background-secondary object-cover",
            dense ? "h-14 w-14" : "h-[72px] w-[72px]",
          )}
        />
      )}
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
          <div className="skeleton h-[72px] w-[72px] rounded-lg" />
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
  rowRef: (id: string, el: HTMLButtonElement | null) => void;
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
  rowRef,
  className,
}: StoryListProps) {
  return (
    <section
      aria-label="Stories"
      className={cn(
        "flex w-full flex-shrink-0 flex-col border-r bg-background-secondary/40 lg:w-[340px]",
        className,
      )}
    >
      <header className="px-6 pb-4 pt-6">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.02em]">Today</h1>
        <p className="mt-0.5 text-[13px] text-text-tertiary" suppressHydrationWarning>
          {formatLongDate()}
        </p>
        <div className="mt-4">
          <TopicChips topics={topics} active={topic} onChange={onTopicChange} />
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-6">
        {isLoading ? (
          <StoryListSkeleton />
        ) : isError ? (
          <ErrorState what="stories" onRetry={onRetry} />
        ) : stories.length === 0 ? (
          <EmptyState icon={Newspaper} title="No stories here yet">
            New stories are fetched every hour. Try another topic, or check back soon.
          </EmptyState>
        ) : (
          <>
            <ul className="space-y-1">
              {stories.map((s) => (
                <li key={s.id}>
                  <StoryRow
                    ref={(el) => rowRef(s.id, el)}
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
                  className="h-9 w-full rounded-lg border text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface hover:text-foreground disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load more stories"}
                </button>
              </div>
            )}
            <p className="px-6 pt-5 text-[12px] leading-relaxed text-text-tertiary">
              Press <kbd className="rounded border px-1 font-body">J</kbd> and{" "}
              <kbd className="rounded border px-1 font-body">K</kbd> to move between stories.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
