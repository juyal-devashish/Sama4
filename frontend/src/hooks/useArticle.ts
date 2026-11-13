import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ArticleDetail } from "@/types";

/** `initial` is the story as fetched by the server component, so it's in the HTML. */
export function useArticle(articleId: string, initial?: ArticleDetail) {
  return useQuery({
    queryKey: queryKeys.article(articleId),
    queryFn: () => api.getArticle(articleId),
    enabled: !!articleId,
    initialData: initial,
  });
}
