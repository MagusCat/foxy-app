import json
from collections.abc import AsyncIterator

DONE = 'data: {"done": true}\n\n'


def token(text: str) -> str:
    return "data: " + json.dumps({"content": text}, ensure_ascii=False) + "\n\n"


async def encode(tokens: AsyncIterator[str]) -> AsyncIterator[str]:
    async for text in tokens:
        if text:
            yield token(text)
    yield DONE
