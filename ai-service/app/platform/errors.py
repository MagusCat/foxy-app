from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status = 500
    code = "internal_error"

    def __init__(self, message: str, *, cause: Exception | None = None):
        super().__init__(message)
        self.message = message
        self.cause = cause


class ProviderError(AppError):
    status = 502
    code = "provider_error"

    def __init__(self, message: str, *, cause: Exception | None = None, transient: bool = False):
        super().__init__(message, cause=cause)
        self.transient = transient


class StorageError(AppError):
    status = 502
    code = "storage_error"


class UnsupportedType(AppError):
    status = 400
    code = "unsupported_type"


class MalformedOutput(AppError):
    status = 502
    code = "malformed_output"


class Unauthorized(AppError):
    status = 401
    code = "unauthorized"


class PayloadTooLarge(AppError):
    status = 413
    code = "payload_too_large"


def envelope(exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle(_: Request, exc: AppError) -> JSONResponse:
        return envelope(exc)
