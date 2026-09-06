import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

request_id: ContextVar[str] = ContextVar("request_id", default="")
user_id: ContextVar[str] = ContextVar("user_id", default="")

_STD = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "taskName",
}


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if rid := request_id.get():
            payload["request_id"] = rid
        if uid := user_id.get():
            payload["user_id"] = uid
        for key, value in record.__dict__.items():
            if key not in _STD:
                payload[key] = value
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
