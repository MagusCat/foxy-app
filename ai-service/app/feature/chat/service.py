import logging
from collections.abc import AsyncIterator

from app.feature.chat.schemas import ChatRequest
from app.llm import LLMProvider
from app.prompts import Prompts
from app.schemas import Message, RetrieveFn

log = logging.getLogger(__name__)

RETRIEVAL_QUERY_TURNS = 3

RETRIEVAL_QUERY_MAX_CHARS = 600


class ChatService:
    def __init__(self, provider: LLMProvider, retrieve: RetrieveFn, prompts: Prompts):
        self._provider = provider
        self._retrieve = retrieve
        self._prompts = prompts

    async def stream(self, req: ChatRequest) -> AsyncIterator[str]:
        block = await self._retrieve(req.retrieval.attachment_ids, _retrieval_query(req.messages))

        messages: list[dict] = [
            {"role": "system", "content": self._prompts.system_for(req.context)}
        ]
        messages += [m.model_dump() for m in req.messages]
        if block:
            _append_context(messages, f"{self._prompts.cite}\n\n{block}")

        async for token in self._provider.stream(messages):
            yield token


def _append_context(messages: list[dict], context: str) -> None:
    for i in reversed(range(len(messages))):
        if messages[i]["role"] == "user":
            messages[i] = {"role": "user", "content": f"{messages[i]['content']}\n\n{context}"}
            return


def _retrieval_query(
    messages: list[Message],
    turns: int = RETRIEVAL_QUERY_TURNS,
    max_chars: int = RETRIEVAL_QUERY_MAX_CHARS,
) -> str:
    recent = [m.content.strip() for m in messages if m.role == "user" and m.content.strip()]
    if not recent:
        return ""

    kept: list[str] = []
    used = 0
    for content in reversed(recent[-turns:]):
        if kept and used + len(content) > max_chars:
            break
        kept.append(content[:max_chars])
        used += len(kept[-1])
    kept.reverse()
    return "\n".join(kept)
