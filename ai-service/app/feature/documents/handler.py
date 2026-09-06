from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.feature.documents.schemas import ExtractRequest, ExtractResponse
from app.feature.documents.service import DocumentService

router = APIRouter(tags=["documents"])


def service(request: Request) -> DocumentService:
    return request.app.state.services.documents


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    req: ExtractRequest, svc: Annotated[DocumentService, Depends(service)]
) -> ExtractResponse:
    text, chunks = await svc.ingest(req.storage_path, req.attachment_id, req.file_name)
    return ExtractResponse(text=text, chunks=chunks)
