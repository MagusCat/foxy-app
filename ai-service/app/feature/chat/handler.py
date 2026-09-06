from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.feature.chat.schemas import ChatRequest
from app.feature.chat.service import ChatService
from app.platform import sse

router = APIRouter(tags=["chat"])


def service(request: Request) -> ChatService:
    return request.app.state.services.chat


@router.post("/chat")
async def chat(
    req: ChatRequest, svc: Annotated[ChatService, Depends(service)]
) -> StreamingResponse:
    tokens = svc.stream(req)
    first = await anext(tokens, None)
    return StreamingResponse(sse.encode(_chain(first, tokens)), media_type="text/event-stream")


async def _chain(first: str | None, rest: AsyncIterator[str]) -> AsyncIterator[str]:
    if first is not None:
        yield first
    async for token in rest:
        yield token
