import httpx

from app.platform.config import Settings
from app.platform.errors import StorageError


class StorageClient:
    def __init__(self, http: httpx.AsyncClient, settings: Settings):
        self._http = http
        self._base = f"{settings.supabase_url}/storage/v1/object/{settings.storage_bucket}"
        self._key = settings.supabase_secret_key
        self._max_bytes = settings.max_download_bytes

    async def download(self, storage_path: str) -> bytes:
        url = f"{self._base}/{storage_path.lstrip('/')}"
        headers = {"Authorization": f"Bearer {self._key}", "apikey": self._key}
        try:
            async with self._http.stream("GET", url, headers=headers) as resp:
                if resp.status_code != 200:
                    raise StorageError(f"storage respondió {resp.status_code} para {storage_path}")
                self._check_declared_size(resp, storage_path)
                return await self._read_capped(resp, storage_path)
        except httpx.HTTPError as e:
            raise StorageError(f"no se pudo descargar {storage_path}", cause=e) from e

    def _check_declared_size(self, resp: httpx.Response, storage_path: str) -> None:
        declared = resp.headers.get("content-length")
        if declared and int(declared) > self._max_bytes:
            raise StorageError(
                f"{storage_path} ocupa {int(declared) // 1024 // 1024} MB, por encima "
                f"del máximo de {self._max_bytes // 1024 // 1024} MB"
            )

    async def _read_capped(self, resp: httpx.Response, storage_path: str) -> bytes:
        chunks: list[bytes] = []
        total = 0
        async for chunk in resp.aiter_bytes():
            total += len(chunk)
            if total > self._max_bytes:
                raise StorageError(
                    f"{storage_path} supera el máximo de {self._max_bytes // 1024 // 1024} MB"
                )
            chunks.append(chunk)
        return b"".join(chunks)
