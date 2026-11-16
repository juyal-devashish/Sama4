import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/** The explanation of text a reader selected in a story. */
export function useSelectionExplanation(articleId: string, text: string) {
  return useQuery({
    queryKey: queryKeys.selection(articleId, text),
    queryFn: () => api.explainSelection({ article_id: articleId, text }),
    enabled: !!articleId && !!text,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false, // a refusal (text not in the story, rate limit) won't change on retry
  });
}
