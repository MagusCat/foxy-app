import asyncio
import threading
from uuid import UUID, uuid4

import httpx
import pytest

from app.feature.documents import extractors
from app.feature.documents.repository import Chunk, ChunkRepository, _vector
from app.feature.documents.service import MAX_CONCURRENT_EXTRACTIONS, DocumentService
from app.platform.errors import StorageError
from app.platform.storage import StorageClient
from tests.conftest import FakeChunkRepository, FakeProvider, FakeStorage


@pytest.fixture
def service(settings):
    def build(blob=b"", found=None):
        storage = FakeStorage(blob)
        provider = FakeProvider()
        repo = FakeChunkRepository(found=found)
        return DocumentService(storage, provider, repo, settings), provider, repo

    return build


@pytest.mark.anyio
async def test_ingest_stores_one_embedding_per_fragment(service):
    text = "\n\n".join(f"Tema {i}. " + "contenido " * 25 for i in range(6))
    svc, provider, repo = service(blob=text.encode())
    attachment = uuid4()

    returned, stored = await svc.ingest("u/u/apuntes.txt", attachment)

    assert returned.startswith("Tema 0.")
    assert stored == len(repo.stored[attachment]) > 1
    assert len(provider.embedded) == stored


@pytest.mark.anyio
async def test_ingest_without_an_id_only_returns_text(service):
    svc, provider, repo = service(blob=b"solo texto")
    text, stored = await svc.ingest("u/u/a.txt", None)
    assert (text, stored) == ("solo texto", 0)
    assert provider.embedded == []
    assert repo.stored == {}


@pytest.mark.anyio
async def test_retrieval_respects_the_character_budget(service, settings):
    attachment = uuid4()
    found = [Chunk(attachment, i, "x" * 100) for i in range(3)]
    svc, _, _ = service(found=found)

    block = await svc.retrieve([attachment], "una pregunta")

    assert block.count("x" * 100) == 1
    assert block.startswith("Material de referencia")


@pytest.mark.anyio
async def test_nothing_to_search_returns_nothing(service):
    svc, provider, _ = service()
    assert await svc.retrieve([], "pregunta") == ""
    assert await svc.retrieve([uuid4()], "   ") == ""
    assert provider.embedded == []


def test_the_vector_literal_is_what_pgvector_expects():
    assert _vector([1, 2.5]) == "[1.0,2.5]"


@pytest.mark.anyio
async def test_the_budget_drops_the_least_relevant_not_the_last_document(service):
    first = UUID("00000000-0000-0000-0000-00000000000a")
    second = UUID("00000000-0000-0000-0000-00000000000b")
    found = [
        Chunk(second, 0, "LO QUE RESPONDE LA PREGUNTA " + "x" * 70),
        Chunk(first, 0, "ruido apenas relacionado " + "y" * 70),
    ]
    svc, _, _ = service(found=found)

    block = await svc.retrieve([first, second], "una pregunta")

    assert "LO QUE RESPONDE LA PREGUNTA" in block, "the most similar fragment was dropped"


@pytest.mark.anyio
async def test_one_oversized_fragment_does_not_hide_the_rest(service):
    attachment = UUID("00000000-0000-0000-0000-00000000000a")
    found = [
        Chunk(attachment, 0, "z" * 200),
        Chunk(attachment, 1, "definición corta y útil"),
    ]
    svc, _, _ = service(found=found)

    block = await svc.retrieve([attachment], "una pregunta")

    assert "definición corta y útil" in block


@pytest.mark.anyio
async def test_the_source_of_each_fragment_is_stored_on_ingest(service):
    svc, _, repo = service(blob=b"contenido de los apuntes")
    attachment = uuid4()

    await svc.ingest("u/u/CalculoI.txt", attachment, "Cálculo I - parcial 2.pdf")

    assert repo.metadata[attachment] == {"file_name": "Cálculo I - parcial 2.pdf"}


@pytest.mark.anyio
async def test_without_a_name_it_falls_back_to_the_path(service):
    svc, _, repo = service(blob=b"contenido")
    attachment = uuid4()

    await svc.ingest("u/u/apuntes.txt", attachment)

    assert repo.metadata[attachment] == {"file_name": "apuntes.txt"}


@pytest.mark.anyio
async def test_each_fragment_arrives_labelled_with_its_file(service):
    a = UUID("00000000-0000-0000-0000-00000000000a")
    b = UUID("00000000-0000-0000-0000-0000000000b0")
    found = [
        Chunk(a, 0, "la derivada mide el cambio", "Cálculo I.pdf"),
        Chunk(b, 0, "la célula tiene núcleo", "Biología.pdf"),
    ]
    svc, _, _ = service(found=found)

    block = await svc.retrieve([a, b], "una pregunta")

    assert "[Cálculo I.pdf]\nla derivada mide el cambio" in block
    assert "[Biología.pdf]\nla célula tiene núcleo" in block


@pytest.mark.anyio
async def test_a_fragment_with_no_source_is_still_usable(service):
    attachment = UUID("00000000-0000-0000-0000-00000000000a")
    svc, _, _ = service(found=[Chunk(attachment, 0, "texto viejo")])

    block = await svc.retrieve([attachment], "una pregunta")

    assert "texto viejo" in block
    assert "archivo sin nombre" in block


@pytest.mark.anyio
async def test_the_parser_never_runs_on_the_event_loop(service, monkeypatch):
    loop_thread = threading.get_ident()
    seen: list[int] = []

    def spy(blob: bytes, suffix: str, limits) -> str:
        seen.append(threading.get_ident())
        return "texto"

    monkeypatch.setattr(extractors, "extract", spy)
    svc, _, _ = service(blob=b"%PDF-1.7 lo que sea")

    await svc.ingest("u/u/apuntes.pdf", None)

    assert seen and seen[0] != loop_thread


class FakeTransport(httpx.AsyncBaseTransport):
    def __init__(self, body: bytes, declare_length: bool = True):
        self.body = body
        self.declare_length = declare_length

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if self.declare_length:
            return httpx.Response(200, content=self.body)
        return httpx.Response(200, stream=_Chunks(self.body), headers={})


class _Chunks(httpx.AsyncByteStream):
    def __init__(self, body: bytes):
        self.body = body

    async def __aiter__(self):
        for i in range(0, len(self.body), 8192):
            yield self.body[i : i + 8192]


def storage_client(settings, body: bytes, declare_length: bool = True) -> StorageClient:
    http = httpx.AsyncClient(transport=FakeTransport(body, declare_length))
    return StorageClient(http, settings)


@pytest.mark.anyio
@pytest.mark.parametrize("declare_length", [True, False])
async def test_a_download_over_the_cap_is_refused(settings, declare_length: bool):
    cfg = settings.model_copy(update={"max_download_bytes": 1024})
    client = storage_client(cfg, b"x" * 5000, declare_length)

    with pytest.raises(StorageError, match="máximo|supera"):
        await client.download("u/u/grande.pdf")


@pytest.mark.anyio
async def test_a_download_under_the_cap_still_works(settings):
    cfg = settings.model_copy(update={"max_download_bytes": 1024})
    client = storage_client(cfg, b"contenido")
    assert await client.download("u/u/a.txt") == b"contenido"


@pytest.mark.anyio
async def test_the_semaphore_covers_the_download_not_just_the_parse(service, monkeypatch):
    svc, _, _ = service(blob=b"texto")
    dentro: list[int] = []

    original = svc._storage.download

    async def spy(path):
        dentro.append(svc._extraction_slots._value)
        return await original(path)

    monkeypatch.setattr(svc._storage, "download", spy)
    await svc.ingest("u/u/a.txt", None)

    assert dentro == [MAX_CONCURRENT_EXTRACTIONS - 1], "the download was outside the semaphore"


@pytest.mark.anyio
async def test_an_exhausted_pool_fails_instead_of_hanging(settings):
    repo = ChunkRepository(_FullPool(), acquire_timeout=0.05)

    with pytest.raises(TimeoutError):
        await repo.search([uuid4()], [0.0] * 8, 3)


@pytest.mark.anyio
async def test_a_stuck_search_degrades_the_answer_instead_of_breaking_it(settings):
    svc = DocumentService(
        FakeStorage(), FakeProvider(), ChunkRepository(_FullPool(), 0.05), settings
    )
    assert await svc.retrieve([uuid4()], "¿qué es una derivada?") == ""


class _FullPool:
    def acquire(self, *, timeout=None):
        return _NeverReady(timeout)


class _NeverReady:
    def __init__(self, timeout):
        self._timeout = timeout

    async def __aenter__(self):
        await asyncio.sleep(self._timeout)
        raise TimeoutError("pool exhausted")

    async def __aexit__(self, *exc):
        return False
