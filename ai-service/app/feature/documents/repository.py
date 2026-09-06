from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import UUID

import asyncpg


@dataclass(frozen=True)
class Chunk:
    attachment_id: UUID
    chunk_index: int
    content: str
    file_name: str = ""


def _vector(values: list[float]) -> str:
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


class ChunkRepository:
    def __init__(self, pool: asyncpg.Pool, acquire_timeout: float = 10.0):
        self._pool = pool
        self._acquire_timeout = acquire_timeout

    @asynccontextmanager
    async def _conn(self) -> AsyncIterator[asyncpg.Connection]:
        async with self._pool.acquire(timeout=self._acquire_timeout) as conn:
            yield conn

    async def replace(
        self,
        attachment_id: UUID,
        contents: list[str],
        embeddings: list[list[float]],
        metadata: dict | None = None,
    ) -> int:
        meta = metadata or {}
        rows = [
            (attachment_id, content, _vector(embedding), index, meta)
            for index, (content, embedding) in enumerate(zip(contents, embeddings, strict=True))
        ]
        async with self._conn() as conn, conn.transaction():
            await conn.executemany(
                """insert into document_chunks
                       (attachment_id, content, embedding, chunk_index, metadata)
                   values ($1, $2, $3::vector, $4, $5)
                   on conflict (attachment_id, chunk_index)
                   do update set content = excluded.content,
                                 embedding = excluded.embedding,
                                 metadata = excluded.metadata""",
                rows,
            )
            await conn.execute(
                "delete from document_chunks where attachment_id = $1 and chunk_index >= $2",
                attachment_id,
                len(rows),
            )
        return len(rows)

    async def search(
        self, attachment_ids: list[UUID], embedding: list[float], limit: int
    ) -> list[Chunk]:
        async with self._conn() as conn:
            rows = await conn.fetch(
                """select attachment_id, chunk_index, content, metadata
                   from document_chunks
                   where attachment_id = any($1::uuid[])
                   order by embedding <=> $2::vector
                   limit $3""",
                attachment_ids,
                _vector(embedding),
                limit,
            )
        return [
            Chunk(
                r["attachment_id"],
                r["chunk_index"],
                r["content"],
                (r["metadata"] or {}).get("file_name", ""),
            )
            for r in rows
        ]
