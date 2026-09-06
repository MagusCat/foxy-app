from uuid import uuid4

from app.main import create_app
from app.platform.config import Settings
from app.platform.security import SCOPE_CHAT, SCOPE_GENERATE
from tests.conftest import FakeProvider, mint


def test_health_is_always_ok(make_client):
    client, _, _ = make_client()
    with client:
        assert client.get("/health").json() == {"status": "ok"}


def test_ready_reports_the_configured_models(make_client):
    client, _, _ = make_client()
    with client:
        body = client.get("/ready").json()
    assert body["status"] == "ready"
    assert body["embedding_dim"] == 1536
    assert body["provider"] == "openai_compat"
    assert "warning" not in body


def test_ready_warns_when_the_answers_are_canned(make_client):
    client, _, _ = make_client(llm_provider="fake")
    with client:
        body = client.get("/ready").json()
    assert "warning" in body, "a deploy with the test provider must not look healthy"


def test_the_token_is_required_when_it_is_configured(make_client):
    client, _, _ = make_client(
        provider=FakeProvider(answer='{"text": "x"}'), ai_service_token="s3cr3t"
    )
    payload = {"type": "summary", "prompt": "x"}
    with client:
        assert client.post("/v1/generate", json=payload).status_code == 401

        crudo = client.post(
            "/v1/generate", json=payload, headers={"Authorization": "Bearer s3cr3t"}
        )
        assert crudo.status_code == 401

        token = mint("s3cr3t", scope=SCOPE_GENERATE)
        ok = client.post("/v1/generate", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert ok.status_code == 200


def test_a_token_for_one_endpoint_does_not_open_another(make_client):
    client, _, _ = make_client(ai_service_token="s3cr3t")
    chat_token = mint("s3cr3t", scope=SCOPE_CHAT)
    with client:
        resp = client.post(
            "/v1/extract",
            json={"storage_path": "u/u/a.txt", "attachment_id": str(uuid4())},
            headers={"Authorization": f"Bearer {chat_token}"},
        )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_the_request_id_from_the_backend_comes_back(make_client):
    client, _, _ = make_client()
    with client:
        resp = client.get("/health", headers={"X-Request-Id": "abc123"})
    assert resp.headers["x-request-id"] == "abc123"


def test_a_body_over_the_limit_is_rejected(make_client):
    client, _, _ = make_client(max_request_bytes=1024)
    with client:
        resp = client.post(
            "/v1/chat",
            json={"messages": [{"role": "user", "content": "x" * 5000}]},
        )
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "payload_too_large"


def test_an_ordinary_body_is_not_affected(make_client):
    client, _, _ = make_client(max_request_bytes=1024)
    with client:
        resp = client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hola"}]})
    assert resp.status_code == 200


def test_ready_hides_the_configuration_from_a_stranger(make_client):
    client, _, _ = make_client(ai_service_token="s3cr3t")
    with client:
        anonimo = client.get("/ready").json()
        con_token = client.get(
            "/ready",
            headers={"Authorization": f"Bearer {mint('s3cr3t', scope=SCOPE_CHAT)}"},
        ).json()

    assert anonimo["status"] == "ready"
    for filtrado in ("provider", "model", "embedding_model", "embedding_dim"):
        assert filtrado not in anonimo, f"{filtrado} leaks without authentication"
        assert filtrado in con_token


def test_the_fake_provider_warning_is_shown_to_everyone(make_client):
    client, _, _ = make_client(ai_service_token="s3cr3t", llm_provider="fake")
    with client:
        assert "warning" in client.get("/ready").json()


def test_the_browsable_docs_are_off_when_the_token_is_configured(make_client):
    client, _, _ = make_client(ai_service_token="s3cr3t", allow_insecure=False)
    with client:
        for ruta in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(ruta).status_code == 404, ruta


def test_the_docs_are_there_in_development(make_client):
    client, _, _ = make_client(ai_service_token="", allow_insecure=True)
    with client:
        assert client.get("/docs").status_code == 200
        assert client.get("/openapi.json").status_code == 200
        assert client.get("/redoc").status_code == 404


def test_the_spec_is_still_generated_in_process():
    app = create_app(
        Settings(
            _env_file=None,
            supabase_url="https://x.supabase.co",
            supabase_secret_key="k",
            database_url="postgresql://u:p@localhost:5432/postgres",
            llm_provider="fake",
            ai_service_token="s3cr3t",
        )
    )
    assert set(app.openapi()["paths"]) >= {"/v1/chat", "/v1/generate", "/v1/extract"}
