import hashlib
import logging
import math
import re
from collections.abc import AsyncIterator

from app.llm.base import ProviderMessage
from app.platform.config import Settings
from app.platform.errors import MalformedOutput

log = logging.getLogger(__name__)

_WORD = re.compile(r"\w+", re.UNICODE)
_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)

CANNED = (
    "Respuesta del proveedor de prueba: no hay modelo real conectado, así que este "
    "texto es fijo. Sirve para verificar el streaming, el contexto y la persistencia "
    "de extremo a extremo."
)


class FakeProvider:
    def __init__(self, settings: Settings):
        self._dim = settings.embedding_dim

    async def stream(self, messages: list[ProviderMessage]) -> AsyncIterator[str]:
        for word in self._answer(messages).split():
            yield word + " "

    async def complete(self, messages: list[ProviderMessage], *, json_mode: bool = False) -> str:
        if not json_mode:
            return self._answer(messages)
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        found = _JSON_OBJECT.search(system if isinstance(system, str) else "")
        if not found:
            raise MalformedOutput("el proveedor de prueba no encontró la forma pedida")
        return found.group(0)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._hash_vector(t) for t in texts]

    async def aclose(self) -> None:
        return None

    def _answer(self, messages: list[ProviderMessage]) -> str:
        question = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        if not isinstance(question, str):
            return "Transcripción de prueba: el proveedor real no está conectado."
        answer = f"{CANNED} Pregunta recibida: {question}"
        if sources := _sources(messages):
            answer += " Fuentes recibidas: " + ", ".join(sources) + "."
        return answer

    def _hash_vector(self, text: str) -> list[float]:
        vector = [0.0] * self._dim
        for word in _WORD.findall(text.lower()):
            digest = hashlib.blake2b(word.encode(), digest_size=8).digest()
            bucket = int.from_bytes(digest[:4], "big") % self._dim
            sign = 1.0 if digest[4] % 2 else -1.0
            vector[bucket] += sign
        norm = math.sqrt(sum(v * v for v in vector))
        if norm == 0:
            vector[0] = 1.0  # pgvector rejects comparing an all-zero vector
            return vector
        return [v / norm for v in vector]


_SOURCE_LABEL = re.compile(r"^\[(.+?)\]$", re.MULTILINE)


def _sources(messages: list[ProviderMessage]) -> list[str]:
    system = next((m["content"] for m in messages if m["role"] == "system"), "")
    if not isinstance(system, str):
        return []
    return list(dict.fromkeys(_SOURCE_LABEL.findall(system)))
