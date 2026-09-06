import os
import uuid

import pytest

from app.feature.documents.repository import ChunkRepository
from app.platform.config import Settings
from app.platform.db import create_pool

DIM = 1536

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"), reason="no DATABASE_URL: integration test skipped"
)


def onehot(index: int, weight: float = 1.0) -> list[float]:
    vector = [0.0] * DIM
    vector[index] = weight
    return vector


def mix(pairs: list[tuple[int, float]]) -> list[float]:
    vector = [0.0] * DIM
    for index, weight in pairs:
        vector[index] = weight
    return vector


@pytest.fixture
async def db():
    cfg = Settings(
        _env_file=None,
        supabase_url="https://example.supabase.co",
        supabase_secret_key="k",
        database_url=os.environ["DATABASE_URL"],
        llm_provider="fake",
    )
    pool = await create_pool(cfg)
    user, attachment = uuid.uuid4(), uuid.uuid4()
    async with pool.acquire() as conn:
        await conn.execute(
            "insert into auth.users (id, email) values ($1, $2)", user, f"{user}@test.local"
        )
        await conn.execute(
            """insert into attachments (id, user_id, storage_path, file_name, processing_status)
               values ($1, $2, $3, $4, 'ready')""",
            attachment,
            user,
            f"{user}/x/apuntes.txt",
            "apuntes.txt",
        )
    try:
        yield pool, ChunkRepository(pool), attachment
    finally:
        async with pool.acquire() as conn:
            await conn.execute("delete from auth.users where id = $1", user)
        await pool.close()


@pytest.mark.anyio
async def test_fragments_come_back_ordered_by_similarity(db):
    _, repo, attachment = db
    await repo.replace(attachment, ["uno", "dos", "tres"], [onehot(0), onehot(1), onehot(2)])

    found = await repo.search([attachment], mix([(2, 0.9), (1, 0.4)]), 2)

    assert [c.content for c in found] == ["tres", "dos"]
    assert [c.chunk_index for c in found] == [2, 1]


@pytest.mark.anyio
async def test_reingesting_neither_duplicates_nor_leaves_a_tail(db):
    pool, repo, attachment = db
    await repo.replace(attachment, ["uno", "dos", "tres"], [onehot(0), onehot(1), onehot(2)])

    assert await repo.replace(attachment, ["uno corregido"], [onehot(0)]) == 1

    rows = await pool.fetch(
        "select chunk_index, content from document_chunks where attachment_id = $1 order by 1",
        attachment,
    )
    assert [(r["chunk_index"], r["content"]) for r in rows] == [(0, "uno corregido")]


@pytest.mark.anyio
async def test_the_search_never_leaves_the_ids_it_was_given(db):
    _, repo, attachment = db
    await repo.replace(attachment, ["material ajeno"], [onehot(0)])

    assert await repo.search([uuid.uuid4()], onehot(0), 5) == []


@pytest.mark.anyio
async def test_the_source_survives_the_round_trip_to_jsonb(db):
    _, repo, attachment = db
    await repo.replace(
        attachment, ["la derivada"], [onehot(0)], {"file_name": "Cálculo I - parcial 2.pdf"}
    )

    (found,) = await repo.search([attachment], onehot(0), 1)

    assert found.file_name == "Cálculo I - parcial 2.pdf"


@pytest.mark.anyio
async def test_a_chunk_without_metadata_reads_back_empty(db):
    _, repo, attachment = db
    await repo.replace(attachment, ["texto"], [onehot(0)])

    (found,) = await repo.search([attachment], onehot(0), 1)

    assert found.file_name == ""
