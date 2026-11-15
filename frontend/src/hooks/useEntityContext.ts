import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/** The explanation of a term, written for the story it was opened from. */
export function useEntityContext(entityId: string, articleId?: string) {
  return useQuery({
    queryKey: queryKeys.entityContext(entityId, articleId),
    queryFn: () => api.getEntityContext(entityId, articleId),
    enabled: !!entityId,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
