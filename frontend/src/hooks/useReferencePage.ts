import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useReferencePage(articleId: string) {
  return useQuery({
    queryKey: queryKeys.reference(articleId),
    queryFn: () => api.getReferencePage(articleId),
    enabled: !!articleId,
  });
}
