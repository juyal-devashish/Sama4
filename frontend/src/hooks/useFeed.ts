import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FeedResponse } from "@/types";
import { queryKeys } from "@/lib/queryKeys";

export function useFeed(params?: { page?: number; limit?: number; category?: string }) {
  return useQuery({
    queryKey: queryKeys.feed(params),
    queryFn: () => api.getFeed(params),
  });
}

/**
 * Paginated feed for the story list ("Load more"). `firstPage` is page 1 as fetched
 * by the server component, so the list is in the server-rendered HTML.
 */
export function useFeedPages(category: string, limit = 10, firstPage?: FeedResponse) {
  return useInfiniteQuery({
    queryKey: queryKeys.feedPages(category, limit),
    queryFn: ({ pageParam }) => api.getFeed({ page: pageParam, limit, category }),
    initialPageParam: 1,
    initialData: firstPage ? { pages: [firstPage], pageParams: [1] } : undefined,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
}
