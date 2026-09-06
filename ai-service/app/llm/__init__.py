from app.llm.base import LLMProvider
from app.llm.fake import FakeProvider
from app.llm.openai_compat import OpenAICompatProvider
from app.platform.config import Settings

__all__ = ["LLMProvider", "get_provider"]


def get_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "fake":
        return FakeProvider(settings)
    return OpenAICompatProvider(settings)
