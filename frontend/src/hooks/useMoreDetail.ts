import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/** The longer explanation of a term. Only fetched once `enabled` (the reader asked). */
export function useMoreDetail(entityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.moreDetail(entityId),
    queryFn: () => api.getMoreDetail(entityId),
    enabled: enabled && !!entityId,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
}
