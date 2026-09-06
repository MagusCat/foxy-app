import base64
import hashlib
import hmac
import json
import time
from collections.abc import AsyncIterator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.feature.chat.service import ChatService
from app.feature.documents.repository import Chunk
from app.feature.documents.service import DocumentService
from app.feature.materials.service import MaterialService
from app.main import create_app
from app.platform.config import Settings
from app.prompts import Prompts
from app.router import Services


class FakeProvider:
    def __init__(self, tokens: list[str] | None = None, answer: str = "{}", dim: int = 1536):
        self.tokens = tokens or ["Hola", " mundo"]
        self.answer = answer
        self.dim = dim
        self.seen_messages: list[dict] = []
        self.embedded: list[str] = []

    async def stream(self, messages: list[dict]) -> AsyncIterator[str]:
        self.seen_messages = messages
        for token in self.tokens:
            yield token

    async def complete(self, messages: list[dict], *, json_mode: bool = False) -> str:
        self.seen_messages = messages
        return self.answer

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.embedded += texts
        return [[float(len(t) % 7)] * self.dim for t in texts]

    async def aclose(self) -> None:
        return None


class FakeStorage:
    def __init__(self, blob: bytes = b""):
        self.blob = blob
        self.asked: list[str] = []

    async def download(self, storage_path: str) -> bytes:
        self.asked.append(storage_path)
        return self.blob


class FakeChunkRepository:
    def __init__(self, found: list[Chunk] | None = None, fails: Exception | None = None):
        self.stored: dict[UUID, list[str]] = {}
        self.metadata: dict[UUID, dict] = {}
        self.found = found or []
        self.fails = fails

    async def replace(self, attachment_id, contents, embeddings, metadata=None) -> int:
        assert len(contents) == len(embeddings)
        self.stored[attachment_id] = contents
        self.metadata[attachment_id] = metadata or {}
        return len(contents)

    async def search(self, attachment_ids, embedding, limit) -> list[Chunk]:
        if self.fails is not None:
            raise self.fails
        return [c for c in self.found if c.attachment_id in attachment_ids][:limit]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        supabase_url="https://example.supabase.co",
        supabase_secret_key="test-key",
        database_url="postgresql://user:pass@localhost:5432/postgres",
        llm_provider="openai_compat",
        llm_base_url="https://api.example.com/v1",
        llm_model="test-model",
        llm_api_key="test-key",
        embedding_model="test-embed",
        ai_service_token="",
        allow_insecure=True,
        chunk_size=200,
        chunk_overlap=40,
        retrieval_top_k=3,
        retrieval_char_budget=120,
    )


@pytest.fixture
def prompts() -> Prompts:
    return Prompts.load()


@pytest.fixture
def make_client(settings, prompts):
    def build(
        provider: FakeProvider | None = None,
        storage: FakeStorage | None = None,
        repo: FakeChunkRepository | None = None,
        **overrides,
    ) -> tuple[TestClient, FakeProvider, FakeChunkRepository]:
        cfg = settings.model_copy(update=overrides) if overrides else settings
        provider = provider or FakeProvider()
        repo = repo or FakeChunkRepository()
        documents = DocumentService(storage or FakeStorage(), provider, repo, cfg)
        services = Services(
            chat=ChatService(provider, documents.retrieve, prompts),
            materials=MaterialService(provider, documents.retrieve, prompts),
            documents=documents,
            provider=provider,
        )
        return TestClient(create_app(cfg, services)), provider, repo

    return build


def mint(
    key: str,
    *,
    scope: str = "generate",
    issuer: str = "foxy-backend",
    audience: str = "foxy-ai-service",
    alg: str = "HS256",
    expires_in: float = 300,
    now: float | None = None,
    sign_with: str | None = None,
    omit: tuple[str, ...] = (),
    payload_override: object | None = None,
    **claims,
) -> str:
    now = time.time() if now is None else now
    payload: object = {
        "iss": issuer,
        "aud": audience,
        "scope": scope,
        "iat": int(now),
        "exp": int(now + expires_in),
        **claims,
    }
    for claim in omit:
        del payload[claim]  # type: ignore[union-attr]
    if payload_override is not None:
        payload = payload_override

    def seg(data: object) -> str:
        raw = json.dumps(data, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    signing_input = f"{seg({'alg': alg, 'typ': 'JWT'})}.{seg(payload)}"
    signature = hmac.new(
        (sign_with if sign_with is not None else key).encode(),
        signing_input.encode(),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"
