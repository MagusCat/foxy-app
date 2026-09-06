import base64
import hashlib
import hmac
import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import Request

from app.platform import logging as applog
from app.platform.errors import Unauthorized

ISSUER = "foxy-backend"
AUDIENCE = "foxy-ai-service"
ALGORITHM = "HS256"

LEEWAY_SECONDS = 60

SCOPE_CHAT = "chat"
SCOPE_GENERATE = "generate"
SCOPE_EXTRACT = "extract"


@dataclass(frozen=True)
class Caller:
    user_id: str
    request_id: str


def _b64url(segment: str) -> bytes:
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


def decode(token: str, key: str, *, scope: str, now: float | None = None) -> Caller:
    now = time.time() if now is None else now
    parts = token.split(".")
    if len(parts) != 3:
        raise Unauthorized("token mal formado")
    header_b64, payload_b64, signature_b64 = parts

    try:
        header = json.loads(_b64url(header_b64))
        claims = json.loads(_b64url(payload_b64))
        signature = _b64url(signature_b64)
    except (ValueError, json.JSONDecodeError) as e:
        raise Unauthorized("token ilegible") from e
    if not isinstance(claims, dict):
        raise Unauthorized("token ilegible")

    if header.get("alg") != ALGORITHM:
        raise Unauthorized("algoritmo no aceptado")

    expected = hmac.new(
        key.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(expected, signature):
        raise Unauthorized("firma inválida")

    if claims.get("iss") != ISSUER:
        raise Unauthorized("emisor inesperado")
    if claims.get("aud") != AUDIENCE:
        raise Unauthorized("token emitido para otro destinatario")
    exp = claims.get("exp")
    if not isinstance(exp, int | float):
        raise Unauthorized("token sin caducidad")
    if now > exp + LEEWAY_SECONDS:
        raise Unauthorized("token caducado")
    if claims.get("scope") != scope:
        raise Unauthorized(f"el token no autoriza {scope}")

    return Caller(
        user_id=str(claims.get("sub") or ""),
        request_id=str(claims.get("jti") or ""),
    )


def require_scope(scope: str) -> Callable[[Request], Awaitable[None]]:
    async def dependency(request: Request) -> None:
        key: str = request.app.state.settings.ai_service_token
        if not key:
            return
        header = request.headers.get("authorization", "")
        raw = header[7:].strip() if header[:7].lower() == "bearer " else ""
        if not raw:
            raise Unauthorized("falta el token")
        caller = decode(raw, key, scope=scope)
        applog.user_id.set(caller.user_id)

    dependency.required_scope = scope  # type: ignore[attr-defined]
    return dependency
