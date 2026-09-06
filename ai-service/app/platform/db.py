import json

import asyncpg

from app.platform.config import Settings


async def _codecs(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def create_pool(settings: Settings) -> asyncpg.Pool:
    transaction_pooler = ":6543" in settings.database_url
    return await asyncpg.create_pool(
        settings.database_url,
        min_size=settings.db_min_conns,
        max_size=settings.db_max_conns,
        statement_cache_size=0 if transaction_pooler else 100,
        command_timeout=settings.db_command_timeout,
        init=_codecs,
    )
