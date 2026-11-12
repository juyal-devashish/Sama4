"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Newspaper } from "lucide-react";
import { useFeedPages } from "@/hooks/useFeed";
import { ALL_TOPICS, useTopics } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/states";
import { StoryList } from "./StoryList";
import { ReadingPane } from "./ReadingPane";

/** Today: story list on the left, the selected story on the right. State lives in the URL. */
export function Reader() {
  const router = useRouter();
  const params = useSearchParams();
  const articleId = params.get("article") ?? undefined;
  // Unknown topics (a stale or mistyped link) fall back to all stories.
  const rawTopic = params.get("topic") ?? "all";
  const topic = (ALL_TOPICS as readonly string[]).includes(rawTopic) ? rawTopic : "all";
  const [topics] = useTopics();

  const feed = useFeedPages(topic);
  const stories = useMemo(() => feed.data?.pages.flatMap((p) => p.articles) ?? [], [feed.data]);

  const rows = useRef(new Map<string, HTMLButtonElement>());
  const rowRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  }, []);

  const go = useCallback(
    (next: { article?: string | null; topic?: string }, replace = false) => {
      const q = new URLSearchParams(params.toString());
      if (next.topic !== undefined) {
        if (next.topic === "all") q.delete("topic");
        else q.set("topic", next.topic);
      }
      if (next.article !== undefined) {
        if (next.article) q.set("article", next.article);
        else q.delete("article");
      }
      const url = q.toString() ? `/?${q}` : "/";
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, router],
  );

  // On a desktop-width window, open the first story so the reading pane is never blank.
  useEffect(() => {
    if (articleId || stories.length === 0) return;
    if (window.matchMedia("(min-width: 1024px)").matches) go({ article: stories[0].id }, true);
  }, [articleId, stories, go]);

  // J / K move through the list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key !== "j" && e.key !== "k") return;
      if (stories.length === 0) return;
      const i = stories.findIndex((s) => s.id === articleId);
      const next = e.key === "j" ? Math.min(stories.length - 1, i + 1) : Math.max(0, i - 1);
      const id = stories[next]?.id;
      if (id && id !== articleId) {
        go({ article: id });
        rows.current.get(id)?.scrollIntoView({ block: "nearest" });
        if (
          e.key === "j" &&
          next >= stories.length - 3 &&
          feed.hasNextPage &&
          !feed.isFetchingNextPage
        ) {
          feed.fetchNextPage();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories, articleId, go, feed]);

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
        topics={topics}
        topic={topic}
        onTopicChange={(t) => go({ topic: t, article: null })}
        hasMore={!!feed.hasNextPage}
        loadingMore={feed.isFetchingNextPage}
        onLoadMore={() => feed.fetchNextPage()}
        rowRef={rowRef}
      />
      {articleId ? (
        <ReadingPane
          articleId={articleId}
          onBack={() => go({ article: null })}
          onOpenArticle={(id) => go({ article: id })}
        />
      ) : (
        <div className="hidden flex-1 bg-surface lg:flex">
          {!feed.isLoading && (
            <EmptyState icon={Newspaper} title="Pick a story to start reading" className="m-auto">
              Highlighted names, places and ideas can be selected for a quick explanation.
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
