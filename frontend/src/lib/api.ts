import type {
  FeedResponse,
  ArticleDetail,
  ContextResponse,
  ReferenceResponse,
  ExplainRequest,
  ExplainResponse,
  PredictionDetail,
  PredictionSummary,
  PredictionStatus,
  PredictionChatRequest,
  PredictionChatResponse,
  AgentInterviewRequest,
  AgentInterviewResponse,
  TrendingPrediction,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  getFeed(params?: { page?: number; limit?: number; category?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.category && params.category !== "all") {
      searchParams.set("category", params.category);
    }
    const qs = searchParams.toString();
    return fetchAPI<FeedResponse>(`/api/v1/feed${qs ? `?${qs}` : ""}`);
  },

  getArticle(articleId: string) {
    return fetchAPI<ArticleDetail>(`/api/v1/articles/${articleId}`);
  },

  getEntityContext(entityId: string) {
    return fetchAPI<ContextResponse>(`/api/v1/context/${entityId}`);
  },

  getReferencePage(articleId: string) {
    return fetchAPI<ReferenceResponse>(
      `/api/v1/articles/${articleId}/reference`
    );
  },

  explainEntity(request: ExplainRequest) {
    return fetchAPI<ExplainResponse>(`/api/v1/context/explain`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // ============ Predictions (MiroFish) ============

  getArticlePrediction(articleId: string) {
    return fetchAPI<PredictionDetail | null>(
      `/api/v1/predictions/article/${articleId}`
    );
  },

  triggerSimulation(articleId: string, options?: {
    agent_count?: number;
    simulation_rounds?: number;
    prediction_focus?: string;
  }) {
    return fetchAPI<PredictionSummary>(`/api/v1/predictions/simulate`, {
      method: "POST",
      body: JSON.stringify({
        article_id: articleId,
        ...options,
      }),
    });
  },

  getPredictionStatus(predictionId: string) {
    return fetchAPI<PredictionStatus>(
      `/api/v1/predictions/${predictionId}/status`
    );
  },

  chatWithPrediction(request: PredictionChatRequest) {
    return fetchAPI<PredictionChatResponse>(`/api/v1/predictions/chat`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  interviewAgent(request: AgentInterviewRequest) {
    return fetchAPI<AgentInterviewResponse>(`/api/v1/predictions/interview`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  getTrendingPredictions(limit: number = 20) {
    return fetchAPI<TrendingPrediction[]>(
      `/api/v1/predictions/trending?limit=${limit}`
    );
  },

  joinWaitlist(email: string) {
    return fetchAPI<{ status: "joined" | "exists" }>(`/api/v1/waitlist`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
};
