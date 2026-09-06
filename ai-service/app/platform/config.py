from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Positive = Annotated[int, Field(gt=0)]
PositiveSeconds = Annotated[float, Field(gt=0)]
Retries = Annotated[int, Field(ge=0)]
Required = Annotated[str, Field(min_length=1)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    log_level: Literal["debug", "info", "warn", "warning", "error", "critical"] = "info"

    ai_service_token: str = ""
    allow_insecure: bool = False

    prompts_file: str = ""

    llm_provider: Literal["fake", "openai_compat"]
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    llm_temperature: Annotated[float, Field(ge=0, le=2)] = 0.4
    llm_timeout: PositiveSeconds = 90.0
    llm_max_retries: Retries = 2

    embedding_base_url: str = ""
    embedding_api_key: str = ""
    embedding_model: str = ""
    embedding_dim: Positive = 1536
    embedding_batch: Positive = 96
    embedding_max_retries: Retries = 5

    supabase_url: Required
    supabase_secret_key: Required
    storage_bucket: str = "attachments"

    database_url: Required
    db_min_conns: Positive = 1
    db_max_conns: Positive = 5
    db_command_timeout: PositiveSeconds = 30.0
    db_acquire_timeout: PositiveSeconds = 10.0

    max_download_bytes: Positive = 30 * 1024 * 1024
    max_decompressed_bytes: Positive = 100 * 1024 * 1024
    max_pdf_pages: Positive = 500
    max_request_bytes: Positive = 2 * 1024 * 1024

    chunk_size: Positive = 1200
    chunk_overlap: Annotated[int, Field(ge=0)] = 150
    retrieval_top_k: Positive = 8
    retrieval_char_budget: Positive = 8000
    extract_max_chars: Positive = 100_000

    @field_validator("log_level", "llm_provider", mode="before")
    @classmethod
    def _normalize(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _defaults(self) -> "Settings":
        self.supabase_url = self.supabase_url.rstrip("/")
        problems: list[str] = []

        if not self.database_url.startswith(("postgresql://", "postgres://")):
            problems.append("DATABASE_URL invalid")
        if not self.supabase_url.startswith(("https://", "http://")):
            problems.append("SUPABASE_URL invalid")
        if not self.ai_service_token and not self.allow_insecure:
            problems.append("AI_SERVICE_TOKEN required")

        if self.llm_provider != "fake":
            if not self.llm_base_url:
                problems.append("LLM_BASE_URL required")
            if not self.llm_model:
                problems.append("LLM_MODEL required")
            self.embedding_base_url = self.embedding_base_url or self.llm_base_url
            self.embedding_api_key = self.embedding_api_key or self.llm_api_key
            if not self.embedding_model:
                problems.append("EMBEDDING_MODEL required")

        if self.chunk_overlap >= self.chunk_size:
            problems.append("CHUNK_OVERLAP invalid")
        if self.db_min_conns > self.db_max_conns:
            problems.append("DB_MIN_CONNS invalid")
        if self.max_download_bytes > self.max_decompressed_bytes:
            problems.append("MAX_DOWNLOAD_BYTES invalid")

        if problems:
            raise ValueError("\n".join(problems))
        return self


def _env_problems(exc: ValidationError) -> list[str]:
    problems: list[str] = []
    for err in exc.errors():
        if not err["loc"]:
            problems += str(err.get("ctx", {}).get("error", err["msg"])).split("\n")
        elif err["type"] in ("missing", "string_too_short"):
            problems.append(f"{str(err['loc'][0]).upper()} required")
        else:
            problems.append(f"{str(err['loc'][0]).upper()} invalid")
    return problems


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        raise ValueError(
            "invalid configuration:\n  - " + "\n  - ".join(_env_problems(exc))
        ) from None
