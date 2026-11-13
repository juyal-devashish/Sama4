"use client";

import { useCallback, useEffect, useMemo, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Newspaper } from "lucide-react";
import { useFeedPages } from "@/hooks/useFeed";
import { ALL_TOPICS, SECTIONS_ENABLED, useTopics } from "@/lib/preferences";
import { readerHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";
import type { ArticleDetail, FeedResponse } from "@/types";
import { StoryList } from "./StoryList";
import { ReadingPane } from "./ReadingPane";

const FEED_LIMIT = 10;

/**
 * Reader state from the URL: the open story is /article/{id}, the topic is ?topic=.
 * `go` navigates, keeping the other query params; `pending` is true until the next
 * story (fetched on the server) has rendered.
 */
function useReaderNav() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const params = useSearchParams();
  const articleId = useParams<{ id?: string }>()?.id;
  // Unknown topics (a stale or mistyped link) fall back to all stories.
  // With sections off, every story is in one feed, newest first.
  const rawTopic = SECTIONS_ENABLED ? (params.get("topic") ?? "all") : "all";
  const topic = (ALL_TOPICS as readonly string[]).includes(rawTopic) ? rawTopic : "all";

  const go = useCallback(
    (next: { article?: string | null; topic?: string }, replace = false) => {
      const q = new URLSearchParams(params.toString());
      if (next.topic !== undefined) {
        if (next.topic === "all") q.delete("topic");
        else q.set("topic", next.topic);
      }
      const url = readerHref(next.article === undefined ? articleId : next.article, q);
      startTransition(() => {
        if (replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      });
    },
    [params, router, articleId],
  );

  return { articleId, topic, go, pending };
}

/**
 * Today: story list on the left, the selected story (`children`, from the route) on
 * the right. `initialFeed` is page 1 of the unfiltered feed, fetched on the server.
 */
export function Reader({
  initialFeed,
  children,
}: {
  initialFeed?: FeedResponse;
  children: React.ReactNode;
}) {
  const { articleId, topic, go, pending } = useReaderNav();
  const [topics] = useTopics();

  const feed = useFeedPages(topic, FEED_LIMIT, topic === "all" ? initialFeed : undefined);
  const stories = useMemo(() => feed.data?.pages.flatMap((p) => p.articles) ?? [], [feed.data]);

  return (
    <div className="flex min-w-0 flex-1">
      <StoryList
        className={cn(articleId ? "hidden lg:flex" : "flex")}
        stories={stories}
        isLoading={feed.isLoading}
        isError={feed.isError}
        onRetry={() => feed.refetch()}
        selectedId={articleId}
        onSelect={(id) => go({ article: id })}
        topics={SECTIONS_ENABLED ? topics : []}
        topic={topic}
        onTopicChange={(t) => go({ topic: t, article: null })}
        hasMore={!!feed.hasNextPage}
        loadingMore={feed.isFetchingNextPage}
        onLoadMore={() => feed.fetchNextPage()}
      />
      {/* Dimmed while the next story loads, so a click gets feedback at once. */}
      <div
        aria-busy={pending || undefined}
        className={cn("flex min-w-0 flex-1 transition-opacity", pending && "opacity-60")}
      >
        {children}
      </div>
    </div>
  );
}

/** The reading pane for /article/[id]. `initialArticle` is the server's copy. */
export function ReaderStory({
  articleId,
  initialArticle,
}: {
  articleId: string;
  initialArticle?: ArticleDetail;
}) {
  const { go } = useReaderNav();
  return (
    <ReadingPane
      articleId={articleId}
      initialArticle={initialArticle}
      onBack={() => go({ article: null })}
      onOpenArticle={(id) => go({ article: id })}
    />
  );
}

/** The right-hand pane on / before a story is chosen. */
export function NoStorySelected() {
  const { topic, go } = useReaderNav();
  const feed = useFeedPages(topic, FEED_LIMIT);
  const first = feed.data?.pages[0]?.articles[0]?.id;

  // On a desktop-width window, open the first story so the reading pane is never blank.
  useEffect(() => {
    if (first && window.matchMedia("(min-width: 1024px)").matches) go({ article: first }, true);
  }, [first, go]);

  return (
    <div className="hidden flex-1 bg-surface lg:flex">
      {!feed.isLoading && (
        <EmptyState icon={Newspaper} title="Pick a story to start reading" className="m-auto">
          Highlighted names, places and ideas can be selected for a quick explanation.
        </EmptyState>
      )}
    </div>
  );
}
