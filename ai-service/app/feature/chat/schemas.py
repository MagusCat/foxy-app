from pydantic import BaseModel, Field

from app.schemas import ChatContext, Message, Retrieval


class ChatRequest(BaseModel):
    context: ChatContext = Field(default_factory=ChatContext)
    messages: list[Message]
    retrieval: Retrieval = Field(default_factory=Retrieval)
