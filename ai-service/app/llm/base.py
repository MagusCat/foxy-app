from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable

ProviderMessage = dict[str, Any]


@runtime_checkable
class LLMProvider(Protocol):
    def stream(self, messages: list[ProviderMessage]) -> AsyncIterator[str]: ...

    async def complete(
        self, messages: list[ProviderMessage], *, json_mode: bool = False
    ) -> str: ...

    async def embed(self, texts: list[str]) -> list[list[float]]: ...

    async def aclose(self) -> None: ...
