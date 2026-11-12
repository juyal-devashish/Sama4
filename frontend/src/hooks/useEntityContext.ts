import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useEntityContext(entityId: string) {
  return useQuery({
    queryKey: queryKeys.entityContext(entityId),
    queryFn: () => api.getEntityContext(entityId),
    enabled: !!entityId,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
