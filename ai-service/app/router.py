import logging
from dataclasses import dataclass

import asyncpg
import httpx
from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.feature.chat.handler import router as chat_router
from app.feature.chat.service import ChatService
from app.feature.documents.handler import router as documents_router
from app.feature.documents.repository import ChunkRepository
from app.feature.documents.service import DocumentService
from app.feature.materials.handler import router as materials_router
from app.feature.materials.service import MaterialService
from app.llm import LLMProvider, get_provider
from app.platform.config import Settings
from app.platform.db import create_pool
from app.platform.errors import Unauthorized
from app.platform.security import (
    SCOPE_CHAT,
    SCOPE_EXTRACT,
    SCOPE_GENERATE,
    decode,
    require_scope,
)
from app.platform.storage import StorageClient
from app.prompts import Prompts

log = logging.getLogger(__name__)


@dataclass
class Services:
    chat: ChatService
    materials: MaterialService
    documents: DocumentService
    provider: LLMProvider
    pool: asyncpg.Pool | None = None
    http: httpx.AsyncClient | None = None


async def build(settings: Settings) -> Services:
    http = httpx.AsyncClient(timeout=30)
    pool = await create_pool(settings)
    provider = get_provider(settings)
    prompts = Prompts.load(settings.prompts_file)

    documents = DocumentService(
        StorageClient(http, settings),
        provider,
        ChunkRepository(pool, settings.db_acquire_timeout),
        settings,
    )
    return Services(
        chat=ChatService(provider, documents.retrieve, prompts),
        materials=MaterialService(provider, documents.retrieve, prompts),
        documents=documents,
        provider=provider,
        pool=pool,
        http=http,
    )


async def shutdown(services: Services) -> None:
    await services.provider.aclose()
    if services.pool is not None:
        await services.pool.close()
    if services.http is not None:
        await services.http.aclose()


ops = APIRouter(tags=["ops"])


@ops.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@ops.get("/ready")
async def ready(request: Request) -> JSONResponse:
    services: Services = request.app.state.services
    settings: Settings = request.app.state.settings
    try:
        if services.pool is not None:
            await services.pool.fetchval("select 1")
    except Exception as e:  # noqa: BLE001 - any failure here means not ready
        log.error("readiness check failed", exc_info=e)
        detail = {"reason": str(e)} if _is_trusted(request) else {}
        return JSONResponse(status_code=503, content={"status": "not-ready", **detail})

    body: dict = {"status": "ready"}
    if settings.llm_provider == "fake":
        body["warning"] = "proveedor de prueba: las respuestas no vienen de un modelo real"
    if _is_trusted(request):
        body |= {
            "provider": settings.llm_provider,
            "model": settings.llm_model,
            "embedding_model": settings.embedding_model,
            "embedding_dim": settings.embedding_dim,
        }
    return JSONResponse(body)


def _is_trusted(request: Request) -> bool:
    key: str = request.app.state.settings.ai_service_token
    if not key:
        return True
    header = request.headers.get("authorization", "")
    raw = header[7:].strip() if header[:7].lower() == "bearer " else ""
    if not raw:
        return False
    for scope in (SCOPE_CHAT, SCOPE_GENERATE, SCOPE_EXTRACT):
        try:
            decode(raw, key, scope=scope)
        except Unauthorized:
            continue
        return True
    return False


def mount(app: FastAPI) -> None:
    app.include_router(ops)
    v1 = APIRouter(prefix="/v1")
    v1.include_router(chat_router, dependencies=[Depends(require_scope(SCOPE_CHAT))])
    v1.include_router(materials_router, dependencies=[Depends(require_scope(SCOPE_GENERATE))])
    v1.include_router(documents_router, dependencies=[Depends(require_scope(SCOPE_EXTRACT))])
    app.include_router(v1)
