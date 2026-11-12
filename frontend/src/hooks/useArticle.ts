import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useArticle(articleId: string) {
  return useQuery({
    queryKey: queryKeys.article(articleId),
    queryFn: () => api.getArticle(articleId),
    enabled: !!articleId,
  });
}
