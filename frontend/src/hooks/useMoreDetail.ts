import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/** The longer explanation of a term. Only fetched once `enabled` (the reader asked). */
export function useMoreDetail(entityId: string, articleId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.moreDetail(entityId, articleId),
    queryFn: () => api.getMoreDetail(entityId, articleId),
    enabled: enabled && !!entityId,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
}
