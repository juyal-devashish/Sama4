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
  entityContext: (entityId: string, articleId?: string) =>
    ["context", entityId, articleId] as const,
  selection: (articleId: string, text: string) => ["selection", articleId, text] as const,
  /** Key for the explanation text that has streamed in so far (see lib/streamStore.ts). */
  contextPartial: (entityId: string, articleId?: string) =>
    ["context-partial", entityId, articleId].join("|"),
  moreDetail: (entityId: string, articleId?: string) =>
    ["more-detail", entityId, articleId] as const,
  prediction: (articleId: string) => ["prediction", articleId] as const,
  predictionStatus: (predictionId: string) => ["prediction-status", predictionId] as const,
  trendingPredictions: (limit: number) => ["trending-predictions", limit] as const,
};
