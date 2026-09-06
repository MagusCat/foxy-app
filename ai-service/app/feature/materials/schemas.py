from typing import Any

from pydantic import BaseModel, Field

from app.schemas import Retrieval


class GenerateRequest(BaseModel):
    type: str
    prompt: str
    retrieval: Retrieval = Field(default_factory=Retrieval)


class GenerateResponse(BaseModel):
    content: dict[str, Any]
