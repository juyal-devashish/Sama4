import re
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    environment: str = "development"  # "production" on Railway
    log_level: str = "INFO"
    backend_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]
    # Regex for extra allowed origins, e.g. every Vercel URL of the frontend project
    # (production aliases, git-branch and preview deployments). None = list only.
    cors_origin_regex: str | None = None
    # Run the nightly ingestion job in-process. Tests and one-off scripts set False.
    scheduler_enabled: bool = True
    # When the daily ingestion runs (local time in ingestion_timezone).
    ingestion_hour: int = 3
    ingestion_minute: int = 0
    ingestion_timezone: str = "America/New_York"
    # Most articles one ingestion run processes, spread across sources. 0 = no cap.
    ingestion_max_articles: int = 10

    # Database
    database_url: str = "postgresql+asyncpg://sama4:sama4_dev@localhost:5432/sama4"
    # Set automatically when sslmode=require is in DATABASE_URL;
    # override with DATABASE_SSL=true/false

    database_ssl: bool = False

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        """Rewrite plain postgres(ql):// URLs to use asyncpg driver.
        Also strips sslmode — asyncpg rejects it; SSL is handled via connect_args instead.
        """
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Strip sslmode query param — asyncpg doesn't accept it
        v = re.sub(r"[?&]sslmode=[^&]*", "", v).rstrip("?&")
        return v

    @model_validator(mode="after")
    def auto_set_ssl(self) -> "Settings":
        """Enable SSL automatically if the original DATABASE_URL contained sslmode=require."""
        import os

        raw = os.environ.get("DATABASE_URL", "")
        if not self.database_ssl and "sslmode=require" in raw:
            self.database_ssl = True
        return self

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Pinecone (vector store + hosted embeddings via Pinecone Inference)
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1"  # serverless region for auto-created index
    # New name: the old OpenAI-era index was 1536-d and is incompatible
    pinecone_index: str = "sama4-articles-v2"
    pinecone_embed_model: str = "llama-text-embed-v2"
    pinecone_embed_dim: int = 1024

    # Claude (Anthropic)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    # Default effort for short, high-volume calls (summaries, entity context, NER)
    anthropic_effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"

    # Admin (X-Admin-Secret header). The default is rejected when environment=production.
    admin_secret: str = "change-me-in-production"

    # MiroFish prediction engine (separate service; off unless you run one)
    mirofish_url: str = "http://localhost:5001"
    mirofish_enabled: bool = False
    mirofish_default_agents: int = 500
    mirofish_default_rounds: int = 30
    mirofish_simulation_timeout: int = 600  # 10 minutes max wait
    mirofish_auto_simulate: bool = False  # auto-simulate high-impact articles
    mirofish_impact_threshold: int = 5  # min entity count to auto-simulate
    prediction_cache_ttl: int = 43200  # 12 hours
    # A running prediction whose row hasn't changed for this long is treated as dead
    # (its background task died with a deploy or crash) and marked failed.
    prediction_stale_minutes: int = 60

    # Sentry
    sentry_dsn: str = ""

    # Cache TTLs (seconds)
    entity_context_ttl: int = 86400  # 24 hours

    model_config = {"env_file": ("../.env", ".env"), "env_file_encoding": "utf-8"}


settings = Settings()
