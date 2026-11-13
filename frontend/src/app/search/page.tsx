"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";
import { useFeed } from "@/hooks/useFeed";
import { TOPIC_LABELS, useRecentSearches } from "@/lib/preferences";
import {
  NO_FILTERS,
  applyFilters,
  facet,
  hasFilters,
  matchQuery,
  type DateRange,
  type SearchFilters,
} from "@/lib/search";
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

  const [filters, setFilters] = useState<Omit<SearchFilters, "query">>(NO_FILTERS);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => matchQuery(data?.articles ?? [], q), [data, q]);
  const results = useMemo(() => applyFilters(matches, filters), [matches, filters]);
  const topics = useMemo(() => facet(matches, (a) => a.categories), [matches]);
  const sources = useMemo(() => facet(matches, (a) => [a.source.name]), [matches]);
  const filtered = hasFilters(filters);
  // A new query can drop the chosen source from the matches: fall back to all sources.
  useEffect(() => {
    if (filters.source !== "all" && !sources.some((x) => x.value === filters.source)) {
      setFilters((f) => ({ ...f, source: "all" }));
    }
  }, [sources, filters.source]);
  const setFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

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
                <h2 className="font-editorial text-[14px] font-semibold text-text-secondary">
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
        ) : matches.length === 0 ? (
          <EmptyState icon={SearchIcon} title={`Nothing matches "${query.trim()}"`}>
            Try a shorter word, or the name of a person or place in the story.
          </EmptyState>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3" role="group" aria-label="Filters">
              <FilterSelect
                label="Topic"
                value={filters.topic}
                onChange={(v) => setFilter("topic", v)}
                options={[
                  { value: "all", label: "All topics" },
                  ...topics.map((t) => ({
                    value: t.value,
                    label: `${TOPIC_LABELS[t.value] ?? t.value} (${t.count})`,
                  })),
                ]}
              />
              <FilterSelect
                label="Source"
                value={filters.source}
                onChange={(v) => setFilter("source", v)}
                options={[
                  { value: "all", label: "All sources" },
                  ...sources.map((t) => ({ value: t.value, label: `${t.value} (${t.count})` })),
                ]}
              />
              <FilterSelect
                label="Date"
                value={filters.date}
                onChange={(v) => setFilter("date", v as DateRange)}
                options={[
                  { value: "any", label: "Any time" },
                  { value: "day", label: "Past 24 hours" },
                  { value: "week", label: "Past week" },
                ]}
              />
              {filtered && (
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="h-9 rounded-lg px-2 text-[13px] font-medium text-accent-secondary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
            <p className="mb-2 text-[13px] text-text-tertiary" aria-live="polite">
              {results.length} {results.length === 1 ? "story" : "stories"}
              {filtered && ` of ${matches.length}`} · newest first
            </p>
            {results.length === 0 && (
              <p className="py-6 text-[14px] text-text-secondary">
                None of the {matches.length} matching stories fit these filters.{" "}
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="font-medium text-accent-secondary hover:underline"
                >
                  Clear filters
                </button>
              </p>
            )}
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border bg-surface px-2.5 text-[13.5px] text-foreground focus:border-accent-secondary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
