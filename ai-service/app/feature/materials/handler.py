from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.feature.materials.schemas import GenerateRequest, GenerateResponse
from app.feature.materials.service import MaterialService

router = APIRouter(tags=["materials"])


def service(request: Request) -> MaterialService:
    return request.app.state.services.materials


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    req: GenerateRequest, svc: Annotated[MaterialService, Depends(service)]
) -> GenerateResponse:
    return GenerateResponse(content=await svc.generate(req))
