/**
 * Every React Query cache key in the app. Use these instead of inline arrays so
 * invalidation (`queryClient.invalidateQueries({ queryKey: queryKeys.x(...) })`)
 * always matches what the hooks cache.
 */
export const queryKeys = {
  feed: (params?: { page?: number; limit?: number; category?: string }) =>
    ["feed", params] as const,
  feedPages: (category: string, limit: number) => ["feed-pages", category, limit] as const,
  article: (articleId: string) => ["article", articleId] as const,
  reference: (articleId: string) => ["reference", articleId] as const,
  entityContext: (entityId: string) => ["context", entityId] as const,
  prediction: (articleId: string) => ["prediction", articleId] as const,
  predictionStatus: (predictionId: string) => ["prediction-status", predictionId] as const,
  trendingPredictions: (limit: number) => ["trending-predictions", limit] as const,
};
