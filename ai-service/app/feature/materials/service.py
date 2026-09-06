import json
import logging
import re

from app.feature.materials.schemas import GenerateRequest
from app.llm import LLMProvider
from app.platform.errors import MalformedOutput, UnsupportedType
from app.prompts import MaterialSpec, Prompts
from app.schemas import RetrieveFn

log = logging.getLogger(__name__)

_FENCE = re.compile(r"^```[a-z]*\n?|\n?```$")


class MaterialService:
    def __init__(self, provider: LLMProvider, retrieve: RetrieveFn, prompts: Prompts):
        self._provider = provider
        self._retrieve = retrieve
        self._prompts = prompts

    async def generate(self, req: GenerateRequest) -> dict:
        types = self._prompts.material_types
        spec = types.get(req.type)
        if spec is None:
            known = ", ".join(sorted(types))
            raise UnsupportedType(f"tipo de material no soportado: {req.type} (hay: {known})")

        block = await self._retrieve(req.retrieval.attachment_ids, req.prompt)
        user = f"{block}\n\nPetición:\n{req.prompt}" if block else req.prompt

        raw = await self._provider.complete(
            [
                {
                    "role": "system",
                    "content": self._prompts.material_system.format(shape=spec.shape),
                },
                {"role": "user", "content": user},
            ],
            json_mode=True,
        )
        return coerce(spec, raw)


def coerce(spec: MaterialSpec, raw: str) -> dict:
    try:
        data = json.loads(_FENCE.sub("", raw.strip()))
    except json.JSONDecodeError as e:
        raise MalformedOutput(f"la respuesta no es JSON: {e}", cause=e) from e
    if not isinstance(data, dict) or not data.get(spec.key):
        raise MalformedOutput(f"la respuesta no trae la clave '{spec.key}'")
    return data
