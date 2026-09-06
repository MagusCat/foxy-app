import httpx
import pytest
from openai import APIConnectionError, APIStatusError, BadRequestError
from pydantic import ValidationError

from app.llm.openai_compat import (
    OpenAICompatProvider,
    _cached_tokens,
    _is_transient,
    _usage_fields,
)
from app.platform.config import Settings, _env_problems

REQUIRED = {
    "_env_file": None,
    "supabase_url": "https://example.supabase.co",
    "supabase_secret_key": "k",
    "database_url": "postgresql://user:pass@localhost:5432/postgres",
    "allow_insecure": True,
    "llm_provider": "openai_compat",
    "llm_base_url": "https://api.example.com/v1",
    "llm_model": "test-model",
    "llm_api_key": "k",
    "embedding_model": "test-embed",
}


def build(**overrides) -> Settings:
    return Settings(**{**REQUIRED, **overrides})


def test_fake_needs_no_model_config():
    cfg = Settings(
        _env_file=None,
        supabase_url="https://x.supabase.co",
        supabase_secret_key="k",
        database_url="postgresql://u:p@h:5432/d",
        allow_insecure=True,
        llm_provider="fake",
    )
    assert cfg.llm_provider == "fake"


def test_a_real_provider_requires_a_base_url():
    with pytest.raises(ValueError, match="LLM_BASE_URL"):
        build(llm_base_url="")


def test_a_real_provider_requires_a_model():
    with pytest.raises(ValueError, match="LLM_MODEL"):
        build(llm_model="")


def test_a_real_provider_requires_an_embedding_model():
    with pytest.raises(ValueError, match="EMBEDDING_MODEL"):
        build(embedding_model="")


def test_embeddings_fall_back_to_the_chat_endpoint():
    cfg = build()
    assert cfg.embedding_base_url == cfg.llm_base_url
    assert cfg.embedding_api_key == cfg.llm_api_key


def test_a_real_provider_does_not_need_a_key():
    assert build(llm_api_key="").llm_api_key == ""


def test_without_a_shared_secret_the_service_refuses_to_boot():
    with pytest.raises(ValueError, match="AI_SERVICE_TOKEN"):
        Settings(**{**REQUIRED, "allow_insecure": False})


def test_a_shared_secret_is_enough_without_the_escape_hatch():
    cfg = Settings(**{**REQUIRED, "allow_insecure": False}, ai_service_token="s3cr3t")
    assert cfg.ai_service_token == "s3cr3t"


@pytest.mark.parametrize(
    "field,value",
    [
        ("log_level", "verboso"),
        ("llm_provider", "telepatia"),
        ("db_max_conns", 0),
        ("db_command_timeout", 0),
        ("llm_timeout", -1),
        ("llm_temperature", 3),
        ("embedding_dim", 0),
        ("chunk_size", 0),
        ("retrieval_top_k", 0),
        ("max_pdf_pages", 0),
        ("llm_max_retries", -1),
        ("database_url", "mysql://localhost/foxy"),
        ("supabase_url", "example.supabase.co"),
    ],
)
def test_a_present_but_invalid_value_refuses_to_boot(field, value):
    with pytest.raises(ValueError, match=f"(?i){field}"):
        build(**{field: value})


def test_the_level_is_accepted_however_it_is_written():
    assert build(log_level="INFO").log_level == "info"
    assert build(log_level="warn").log_level == "warn"
    assert build(log_level="warning").log_level == "warning"


def test_a_pool_whose_floor_is_over_its_ceiling_is_rejected():
    with pytest.raises(ValueError, match="DB_MIN_CONNS"):
        build(db_min_conns=9, db_max_conns=5)


def test_every_problem_is_reported_at_once():
    with pytest.raises(ValueError) as caught:
        build(allow_insecure=False, chunk_size=100, chunk_overlap=100)
    reported = str(caught.value)
    for expected in ("AI_SERVICE_TOKEN", "CHUNK_OVERLAP"):
        assert expected in reported, f"{expected} missing from the report:\n{reported}"


def test_the_boot_report_names_the_variables_and_hides_secrets():
    with pytest.raises(ValidationError) as caught:
        build(db_max_conns=0, database_url="mysql://u:h0rrible-p4ss@h/d")
    reported = "\n".join(_env_problems(caught.value))
    assert "DB_MAX_CONNS" in reported
    assert "h0rrible-p4ss" not in reported, "a secret must not end up in the report"


def test_an_empty_required_variable_is_the_same_as_a_missing_one():
    with pytest.raises(ValueError, match="(?i)supabase_secret_key"):
        build(supabase_secret_key="")


def test_the_ingest_insists_more_than_the_chat():
    cfg = build()
    provider = OpenAICompatProvider(cfg)

    assert cfg.embedding_base_url == cfg.llm_base_url
    assert provider._embeddings is not provider._chat
    assert provider._embeddings.max_retries == cfg.embedding_max_retries
    assert provider._chat.max_retries == cfg.llm_max_retries
    assert cfg.embedding_max_retries > cfg.llm_max_retries


def test_one_client_is_enough_when_the_policy_also_matches():
    cfg = build(embedding_max_retries=2, llm_max_retries=2)
    provider = OpenAICompatProvider(cfg)
    assert provider._embeddings is provider._chat


@pytest.mark.parametrize(
    ("status", "transient"),
    [(429, True), (500, True), (503, True), (400, False), (401, False), (404, False)],
)
def test_only_what_can_change_is_marked_transient(status: int, transient: bool):
    response = httpx.Response(status, request=httpx.Request("POST", "https://x"))
    error = APIStatusError("boom", response=response, body=None)
    assert _is_transient(error) is transient


def test_a_network_failure_is_always_worth_retrying():
    assert _is_transient(APIConnectionError(request=httpx.Request("POST", "https://x")))


class _Details:
    def __init__(self, cached_tokens: int):
        self.cached_tokens = cached_tokens


class _Usage:
    def __init__(self, **fields):
        for k, v in fields.items():
            setattr(self, k, v)


def test_the_cache_hit_is_read_wherever_each_provider_puts_it():
    deepseek = _Usage(prompt_tokens=100, prompt_cache_hit_tokens=64)
    openai_like = _Usage(prompt_tokens=100, prompt_tokens_details=_Details(64))

    assert _cached_tokens(deepseek) == 64
    assert _cached_tokens(openai_like) == 64


def test_a_provider_that_reports_nothing_does_not_break_the_log():
    assert _cached_tokens(_Usage(prompt_tokens=10)) is None
    assert _usage_fields(None) == {
        "prompt_tokens": None,
        "completion_tokens": None,
        "total_tokens": None,
        "cached_tokens": None,
    }


@pytest.mark.anyio
async def test_a_provider_that_rejects_stream_options_still_answers(monkeypatch):
    provider = OpenAICompatProvider(build())
    calls: list[bool] = []

    async def create(messages):
        calls.append(provider._send_stream_options)
        if provider._send_stream_options:
            raise BadRequestError(
                "unknown parameter",
                response=httpx.Response(400, request=httpx.Request("POST", "https://x")),
                body=None,
            )
        return "stream"

    monkeypatch.setattr(provider, "_create_stream", create)

    assert await provider._open_stream([]) == "stream"
    assert calls == [True, False]
    assert provider._send_stream_options is False

    assert await provider._open_stream([]) == "stream"
    assert calls == [True, False, False]
