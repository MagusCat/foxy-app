from uuid import UUID

from pydantic import BaseModel


class ExtractRequest(BaseModel):
    storage_path: str
    attachment_id: UUID | None = None
    file_name: str = ""


class ExtractResponse(BaseModel):
    text: str
    chunks: int
