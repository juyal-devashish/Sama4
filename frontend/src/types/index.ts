// ============ Feed ============

export interface ArticleCardSource {
  name: string;
  logo_url?: string;
}

export interface ArticleCard {
  id: string;
  title: string;
  summary?: string;
  image_url?: string;
  source: ArticleCardSource;
  published_at?: string;
  reading_time_minutes?: number;
  categories: string[];
  entity_count: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

export interface FeedResponse {
  articles: ArticleCard[];
  pagination: PaginationMeta;
}

// ============ Article ============

export interface SourceInfo {
  name: string;
  url?: string;
  credibility_score?: number;
}

export interface EntityInArticle {
  id: string;
  text: string;
  type: string;
  start: number;
  end: number;
  priority: string;
}

export interface ArticleDetail {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  image_url?: string;
  source: SourceInfo;
  published_at?: string;
  reading_time_minutes?: number;
  categories: string[];
  entities: EntityInArticle[];
}

// ============ Reference ============

export interface ReferenceEntityContext {
  id: string;
  name: string;
  type: string;
  context?: string;
  wikipedia_url?: string;
  image_url?: string;
}

export interface RelatedArticle {
  id: string;
  title: string;
  source: string;
  published_at?: string;
}

export interface ReferenceResponse {
  article: ArticleDetail;
  entities: ReferenceEntityContext[];
  related_articles: RelatedArticle[];
}

// ============ Context ============

export interface EntityInfo {
  id: string;
  name: string;
  type: string;
  wikidata_id?: string;
  wikipedia_url?: string;
}

/** Where an explanation or answer came from. type: article | wikipedia | graph | explanation | outlook */
export interface ContextSource {
  type: string;
  title?: string;
  url?: string;
  /** Wikipedia only: permalink to the exact revision the explanation used. */
  revision_url?: string;
}

export interface ContextData {
  text: string;
  generated_at: string;
  source: string;
  cached: boolean;
  /** What the explanation was written from. */
  sources: ContextSource[];
}

export interface ContextResponse {
  entity: EntityInfo;
  context: ContextData;
  related_entities: { id: string; name: string; type: string }[];
  related_articles: { id: string; title: string }[];
}

export type ReportReason = "wrong_thing" | "wrong_fact" | "outdated" | "other";

export interface ReportRequest {
  reason: ReportReason;
  article_id?: string;
  /** The explanation exactly as the reader saw it. */
  explanation_text?: string;
  note?: string;
}

export interface ReportResponse {
  status: "received";
}

export interface ExplainRequest {
  entity_id: string;
  article_id: string;
  question: string;
}

export interface ExplainResponse {
  entity: EntityInfo;
  explanation: string;
  sources: ContextSource[];
  confidence: number;
}

// ============ Predictions (MiroFish) ============

export interface AgentPerspective {
  id: string;
  agent_name: string;
  agent_role: string;
  agent_persona?: string;
  stance: "positive" | "negative" | "neutral" | "mixed";
  perspective_text: string;
  key_argument?: string;
  influence_score: number;
  sentiment_score?: number;
}

export interface PredictionSummary {
  id: string;
  status: string;
  prediction_summary?: string;
  confidence_score?: number;
  impact_score: number;
  agent_count: number;
  completed_at?: string;
}

/** "simulation": MiroFish simulated agent_count agents. "language_model": nothing was
 *  simulated; Samā4's AI wrote the outlook and its viewpoints directly. */
export type PredictionMethod = "simulation" | "language_model";

export interface PredictionDetail {
  id: string;
  article_id: string;
  status: string;
  method?: PredictionMethod;
  agent_count: number;
  simulation_rounds: number;
  platforms: string[];
  prediction_summary?: string;
  key_findings: string[];
  sentiment_distribution?: string;
  predicted_outcomes: string[];
  confidence_score?: number;
  impact_score: number;
  agent_perspectives: AgentPerspective[];
  created_at: string;
  completed_at?: string;
}

export interface PredictionStatus {
  id: string;
  status: string;
  progress_message: string;
}

export interface PredictionChatRequest {
  prediction_id: string;
  message: string;
  history: { role: string; content: string }[];
}

export interface PredictionChatResponse {
  prediction_id: string;
  response: string;
  sources: string[];
}

export interface AgentInterviewRequest {
  prediction_id: string;
  agent_perspective_id: string;
  question: string;
}

export interface AgentInterviewResponse {
  agent_name: string;
  agent_role: string;
  response: string;
  stance: string;
}

export interface TrendingPrediction {
  id: string;
  article_id: string;
  article_title: string;
  article_image_url?: string;
  article_source: string;
  prediction_summary?: string;
  key_findings: string[];
  impact_score: number;
  confidence_score?: number;
  method?: PredictionMethod;
  agent_count: number;
  completed_at?: string;
}

// ---- Waitlist (backend/app/api/routers/waitlist.py) ----

export interface WaitlistResponse {
  status: "joined" | "exists";
}

// ============ Sources (mirrors backend/app/schemas/source.py) ============

export interface SourceFeed {
  url: string;
  category: string;
  region: string;
}

export interface SourceOutlet {
  name: string;
  feeds: SourceFeed[];
}

export interface SourcesResponse {
  outlets: SourceOutlet[];
  feed_count: number;
}
