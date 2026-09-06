import logging
from collections.abc import AsyncIterator

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    BadRequestError,
    OpenAIError,
)

from app.llm.base import ProviderMessage
from app.platform.config import Settings
from app.platform.errors import ProviderError

log = logging.getLogger(__name__)

_SERVER_ERROR = 500
_TOO_MANY_REQUESTS = 429


def _is_transient(e: OpenAIError) -> bool:
    if isinstance(e, APIConnectionError | APITimeoutError):
        return True
    if isinstance(e, APIStatusError):
        return e.status_code == _TOO_MANY_REQUESTS or e.status_code >= _SERVER_ERROR
    return False


class OpenAICompatProvider:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._chat = AsyncOpenAI(
            base_url=settings.llm_base_url or None,
            api_key=settings.llm_api_key or "not-needed",
            timeout=settings.llm_timeout,
            max_retries=settings.llm_max_retries,
        )
        same_endpoint = (
            settings.embedding_base_url == settings.llm_base_url
            and settings.embedding_api_key == settings.llm_api_key
            and settings.embedding_max_retries == settings.llm_max_retries
        )
        self._embeddings = (
            self._chat
            if same_endpoint
            else AsyncOpenAI(
                base_url=settings.embedding_base_url or None,
                api_key=settings.embedding_api_key or "not-needed",
                timeout=settings.llm_timeout,
                max_retries=settings.embedding_max_retries,
            )
        )
        self._send_dimensions = True
        self._send_stream_options = True

    async def stream(self, messages: list[ProviderMessage]) -> AsyncIterator[str]:
        deltas, chars = 0, 0
        usage = None
        try:
            chunks = await self._open_stream(messages)
            async for chunk in chunks:
                if getattr(chunk, "usage", None):
                    usage = chunk.usage
                if not chunk.choices:
                    continue
                if delta := chunk.choices[0].delta.content:
                    deltas, chars = deltas + 1, chars + len(delta)
                    yield delta
        except OpenAIError as e:
            raise ProviderError(
                f"fallo del proveedor: {e}", cause=e, transient=_is_transient(e)
            ) from e
        finally:
            log.info(
                "chat streamed",
                extra={
                    "provider": self._settings.llm_provider,
                    "model": self._settings.llm_model,
                    "deltas": deltas,
                    "chars": chars,
                    **_usage_fields(usage),
                },
            )

    async def _open_stream(self, messages: list[ProviderMessage]):
        try:
            return await self._create_stream(messages)
        except BadRequestError:
            if not self._send_stream_options:
                raise
            log.warning("provider rejected stream_options, continuing without token usage")
            self._send_stream_options = False
            return await self._create_stream(messages)

    async def _create_stream(self, messages: list[ProviderMessage]):
        extra = {"stream_options": {"include_usage": True}} if self._send_stream_options else {}
        return await self._chat.chat.completions.create(
            model=self._settings.llm_model,
            messages=messages,
            temperature=self._settings.llm_temperature,
            stream=True,
            **extra,
        )

    async def complete(self, messages: list[ProviderMessage], *, json_mode: bool = False) -> str:
        extra = {"response_format": {"type": "json_object"}} if json_mode else {}
        try:
            resp = await self._chat.chat.completions.create(
                model=self._settings.llm_model,
                messages=messages,
                temperature=self._settings.llm_temperature,
                **extra,
            )
        except OpenAIError as e:
            raise ProviderError(
                f"fallo del proveedor: {e}", cause=e, transient=_is_transient(e)
            ) from e
        _log_usage("completion", self._settings.llm_provider, self._settings.llm_model, resp)
        return resp.choices[0].message.content or ""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        try:
            for start in range(0, len(texts), self._settings.embedding_batch):
                batch = texts[start : start + self._settings.embedding_batch]
                vectors.extend(await self._embed_batch(batch))
        except OpenAIError as e:
            transient = _is_transient(e)
            log.error(
                "embedding failed after the retries",
                extra={
                    "model": self._settings.embedding_model,
                    "retries": self._settings.embedding_max_retries,
                    "transient": transient,
                    "texts": len(texts),
                },
            )
            raise ProviderError(f"fallo al vectorizar: {e}", cause=e, transient=transient) from e
        return vectors

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        try:
            resp = await self._create_embeddings(batch)
        except BadRequestError:
            if not self._send_dimensions:
                raise
            log.warning("provider rejected the dimensions parameter, retrying without it")
            self._send_dimensions = False
            resp = await self._create_embeddings(batch)

        vectors = [item.embedding for item in resp.data]
        want, got = self._settings.embedding_dim, len(vectors[0]) if vectors else 0
        if vectors and got != want:
            raise ProviderError(
                f"el modelo {self._settings.embedding_model} devuelve dimensión {got} "
                f"y la tabla document_chunks espera {want}"
            )
        _log_usage("embeddings", self._settings.llm_provider, self._settings.embedding_model, resp)
        return vectors

    async def _create_embeddings(self, batch: list[str]):
        extra = {"dimensions": self._settings.embedding_dim} if self._send_dimensions else {}
        return await self._embeddings.embeddings.create(
            model=self._settings.embedding_model, input=batch, **extra
        )

    async def aclose(self) -> None:
        await self._chat.close()
        if self._embeddings is not self._chat:
            await self._embeddings.close()


def _log_usage(kind: str, provider: str, model: str, resp) -> None:
    log.info(
        kind,
        extra={"provider": provider, "model": model, **_usage_fields(getattr(resp, "usage", None))},
    )


def _cached_tokens(usage) -> int | None:
    if (flat := getattr(usage, "prompt_cache_hit_tokens", None)) is not None:
        return flat
    return getattr(getattr(usage, "prompt_tokens_details", None), "cached_tokens", None)


def _usage_fields(usage) -> dict:
    return {
        "prompt_tokens": getattr(usage, "prompt_tokens", None),
        "completion_tokens": getattr(usage, "completion_tokens", None),
        "total_tokens": getattr(usage, "total_tokens", None),
        "cached_tokens": _cached_tokens(usage),
    }
