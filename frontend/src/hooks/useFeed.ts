import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useFeed(params?: { page?: number; limit?: number; category?: string }) {
  return useQuery({
    queryKey: queryKeys.feed(params),
    queryFn: () => api.getFeed(params),
  });
}

/** Paginated feed for the story list ("Load more"). */
export function useFeedPages(category: string, limit = 25) {
  return useInfiniteQuery({
    queryKey: queryKeys.feedPages(category, limit),
    queryFn: ({ pageParam }) => api.getFeed({ page: pageParam, limit, category }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
}
