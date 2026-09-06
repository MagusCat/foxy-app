import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from app.platform import logging as applog
from app.platform.config import Settings, get_settings
from app.platform.errors import PayloadTooLarge, envelope, install_handlers
from app.router import Services, build, mount, shutdown


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    cfg = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = resolved = cfg
        applog.configure(resolved.log_level)
        owned = services is None
        app.state.services = services or await build(resolved)
        try:
            yield
        finally:
            if owned:
                await shutdown(app.state.services)

    app = FastAPI(
        title="foxy-ai-service",
        version="0.1.0",
        summary="Chat, generación de material y contexto documental para Foxy",
        lifespan=lifespan,
        docs_url="/docs" if cfg.allow_insecure else None,
        openapi_url="/openapi.json" if cfg.allow_insecure else None,
        redoc_url=None,
    )

    @app.middleware("http")
    async def limit_body(request: Request, call_next):
        declared = request.headers.get("content-length")
        max_bytes = request.app.state.settings.max_request_bytes
        if declared and int(declared) > max_bytes:
            return envelope(
                PayloadTooLarge(f"el cuerpo supera el máximo de {max_bytes // 1024} KB")
            )
        return await call_next(request)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        token = applog.request_id.set(rid)
        try:
            response = await call_next(request)
        finally:
            applog.request_id.reset(token)
        response.headers["x-request-id"] = rid
        return response

    install_handlers(app)
    mount(app)
    return app
