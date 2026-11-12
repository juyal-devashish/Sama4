"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";
import { useFeed } from "@/hooks/useFeed";
import { useRecentSearches } from "@/lib/preferences";
import { Page } from "@/components/shell/Page";
import { StoryRow } from "@/components/reader/StoryList";
import { EmptyState, ErrorState } from "@/components/ui/states";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { recent, add, clear } = useRecentSearches();
  // Search runs over the latest stories until semantic search ships on the server.
  const { data, isLoading, isError, refetch } = useFeed({ limit: 100 });

  useEffect(() => inputRef.current?.focus(), []);

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? (data?.articles ?? []).filter(
            (a) =>
              a.title.toLowerCase().includes(q) ||
              (a.summary ?? "").toLowerCase().includes(q) ||
              a.source.name.toLowerCase().includes(q),
          )
        : [],
    [data, q],
  );

  const open = (id: string) => {
    add(query);
    router.push(`/?article=${id}`);
  };

  return (
    <Page title="Search" description="Find stories by headline, summary or source.">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          add(query);
        }}
        className="flex h-12 items-center gap-3 rounded-xl border bg-background px-4 focus-within:border-accent-secondary"
      >
        <SearchIcon size={18} className="text-text-tertiary" aria-hidden />
        <label htmlFor="q" className="sr-only">
          Search stories
        </label>
        <input
          id="q"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Try a name, a place or a topic"
          autoComplete="off"
          className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-tertiary"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-text-tertiary hover:text-foreground"
          >
            <X size={18} />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </form>

      <div className="mt-8">
        {!q ? (
          recent.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[14px] font-semibold text-text-secondary">
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={clear}
                  className="text-[13px] text-text-tertiary hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="h-8 rounded-full border px-3.5 text-[13px] font-medium text-text-secondary hover:border-accent-secondary hover:text-foreground"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          )
        ) : isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState what="stories" onRetry={() => refetch()} />
        ) : results.length === 0 ? (
          <EmptyState icon={SearchIcon} title={`Nothing matches "${query.trim()}"`}>
            Try a shorter word, or the name of a person or place in the story.
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-[13px] text-text-tertiary">
              {results.length} {results.length === 1 ? "story" : "stories"}
            </p>
            <ul className="-mx-4 space-y-1">
              {results.map((s) => (
                <li key={s.id}>
                  <StoryRow story={s} onClick={() => open(s.id)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Page>
  );
}
