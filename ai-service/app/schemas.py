from collections.abc import Awaitable, Callable
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatContext(BaseModel):
    user_kind: str = ""
    academic_level: str | None = None
    main_goal: str | None = None
    custom_instructions: str | None = None
    mode: Literal["respuesta", "pasos", "quiz"] | None = None
    objectives: list[str] = Field(default_factory=list)


class Retrieval(BaseModel):
    attachment_ids: list[UUID] = Field(default_factory=list)


RetrieveFn = Callable[[list[UUID], str], Awaitable[str]]
