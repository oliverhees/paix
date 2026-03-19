"""PAIONE API Configuration — loaded from environment variables."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from .env file or environment variables."""

    # ─── App ───
    app_name: str = "PAIONE API"
    app_version: str = "0.1.0"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=True, alias="DEBUG")

    # ─── Database ───
    database_url: str = Field(
        default="postgresql+asyncpg://paione:paione@localhost:5432/paione",
        alias="DATABASE_URL",
    )

    # ─── Redis ───
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # ─── Celery ───
    celery_broker_url: str = Field(
        default="redis://localhost:6379/1", alias="CELERY_BROKER_URL"
    )
    celery_result_backend: str = Field(
        default="redis://localhost:6379/2", alias="CELERY_RESULT_BACKEND"
    )

    # ─── FalkorDB / Graphiti ───
    falkordb_host: str = Field(default="localhost", alias="FALKORDB_HOST")
    falkordb_port: int = Field(default=6379, alias="FALKORDB_PORT")
    graphiti_url: str = Field(default="http://localhost:8001", alias="GRAPHITI_URL")

    # ─── Auth ───
    jwt_secret: str = Field(default="change-me-in-production", alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # ─── External APIs ───
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    google_ai_api_key: str = Field(default="", alias="GOOGLE_AI_API_KEY")
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", alias="GOOGLE_CLIENT_SECRET")
    telegram_bot_token: str = Field(default="", alias="TELEGRAM_BOT_TOKEN")

    # ─── Internal ───
    internal_api_key: str = Field(default="", alias="INTERNAL_API_KEY")

    # ─── Web Push (VAPID) ───
    vapid_public_key: str = Field(default="", alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field(default="", alias="VAPID_PRIVATE_KEY")
    vapid_claims_email: str = Field(default="oliver@hrcodelabs.de", alias="VAPID_CLAIMS_EMAIL")

    # ─── Object Storage (S3-compatible / Hetzner) ───
    s3_endpoint_url: str = Field(default="", alias="S3_ENDPOINT_URL")
    s3_access_key: str = Field(default="", alias="S3_ACCESS_KEY")
    s3_secret_key: str = Field(default="", alias="S3_SECRET_KEY")
    s3_bucket_name: str = Field(default="paione-files", alias="S3_BUCKET_NAME")
    s3_region: str = Field(default="fsn1", alias="S3_REGION")

    # ─── Docker Sandbox ───
    docker_sandbox_enabled: bool = False
    docker_sandbox_image: str = "paione-sandbox:latest"
    docker_sandbox_timeout: int = 30
    docker_sandbox_memory: str = "256m"
    docker_sandbox_cpus: str = "0.5"

    # ─── CORS ───
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:80",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
