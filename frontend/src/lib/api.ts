/**
 * Typed client for the Samā4 backend. All network calls go through here.
 * Request/response types live in src/types/index.ts and mirror backend/app/schemas/.
 */
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
  WaitlistResponse,
} from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Thrown for any non-2xx response. `status` is the HTTP status (0 = network failure). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** Build "/api/v1/..." with query params; undefined/empty values are dropped. */
export function apiPath(
  path: string,
  params?: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const query = qs.toString();
  return `/api/v1${path}${query ? `?${query}` : ""}`;
}

/**
 * Options for calls made from server components. `revalidate` caches the response
 * in Next's data cache for that many seconds; `timeoutMs` aborts a slow backend so
 * server rendering never hangs on it (the client then fetches as usual).
 */
export interface ServerFetchOptions {
  revalidate?: number;
  timeoutMs?: number;
}

async function fetchAPI<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown } & ServerFetchOptions,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.timeoutMs ? AbortSignal.timeout(init.timeoutMs) : undefined,
      ...(init?.revalidate !== undefined ? { next: { revalidate: init.revalidate } } : {}),
    });
  } catch (err) {
    throw new ApiError(0, path, `Network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new ApiError(res.status, path, `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getFeed(
    params?: { page?: number; limit?: number; category?: string },
    server?: ServerFetchOptions,
  ) {
    const category = params?.category === "all" ? undefined : params?.category;
    return fetchAPI<FeedResponse>(
      apiPath("/feed", { page: params?.page, limit: params?.limit, category }),
      server,
    );
  },

  getArticle(articleId: string, server?: ServerFetchOptions) {
    return fetchAPI<ArticleDetail>(apiPath(`/articles/${articleId}`), server);
  },

  getReferencePage(articleId: string) {
    return fetchAPI<ReferenceResponse>(apiPath(`/articles/${articleId}/reference`));
  },

  getEntityContext(entityId: string) {
    return fetchAPI<ContextResponse>(apiPath(`/context/${entityId}`));
  },

  explainEntity(request: ExplainRequest) {
    return fetchAPI<ExplainResponse>(apiPath("/context/explain"), {
      method: "POST",
      body: request,
    });
  },

  // ---- Predictions (MiroFish; backend falls back to Claude when MiroFish is off) ----

  getArticlePrediction(articleId: string) {
    return fetchAPI<PredictionDetail | null>(apiPath(`/predictions/article/${articleId}`));
  },

  triggerSimulation(
    articleId: string,
    options?: { agent_count?: number; simulation_rounds?: number; prediction_focus?: string },
  ) {
    return fetchAPI<PredictionSummary>(apiPath("/predictions/simulate"), {
      method: "POST",
      body: { article_id: articleId, ...options },
    });
  },

  cancelPrediction(predictionId: string) {
    return fetchAPI<PredictionStatus>(apiPath(`/predictions/${predictionId}/cancel`), {
      method: "POST",
    });
  },

  getPredictionStatus(predictionId: string) {
    return fetchAPI<PredictionStatus>(apiPath(`/predictions/${predictionId}/status`));
  },

  chatWithPrediction(request: PredictionChatRequest) {
    return fetchAPI<PredictionChatResponse>(apiPath("/predictions/chat"), {
      method: "POST",
      body: request,
    });
  },

  interviewAgent(request: AgentInterviewRequest) {
    return fetchAPI<AgentInterviewResponse>(apiPath("/predictions/interview"), {
      method: "POST",
      body: request,
    });
  },

  getTrendingPredictions(limit = 20) {
    return fetchAPI<TrendingPrediction[]>(apiPath("/predictions/trending", { limit }));
  },

  // ---- Waitlist (early-access page) ----

  joinWaitlist(email: string) {
    return fetchAPI<WaitlistResponse>(apiPath("/waitlist"), { method: "POST", body: { email } });
  },
};
