import re

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    backend_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]

    # Database
    database_url: str = "postgresql+asyncpg://sama4:sama4_dev@localhost:5432/sama4"
    # Set automatically when sslmode=require is in DATABASE_URL; override with DATABASE_SSL=true/false
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

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1"
    pinecone_index: str = "sama4-articles"

    # OpenAI
    openai_api_key: str = ""

    # Admin
    admin_secret: str = "change-me-in-production"

    # MiroFish
    mirofish_url: str = "http://localhost:5001"
    mirofish_enabled: bool = True
    mirofish_default_agents: int = 500
    mirofish_default_rounds: int = 30
    mirofish_simulation_timeout: int = 600  # 10 minutes max wait
    mirofish_auto_simulate: bool = True  # auto-simulate high-impact articles
    mirofish_impact_threshold: int = 5  # min entity count to auto-simulate
    prediction_cache_ttl: int = 43200  # 12 hours

    # Sentry
    sentry_dsn: str = ""

    # Cache TTLs (seconds)
    entity_context_ttl: int = 86400  # 24 hours
    llm_response_ttl: int = 21600  # 6 hours

    # Rate limits
    context_rate_limit: int = 50
    followup_rate_limit: int = 20
    rate_limit_window: int = 3600  # 1 hour

    model_config = {"env_file": ("../.env", ".env"), "env_file_encoding": "utf-8"}


settings = Settings()
