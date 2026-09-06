from uuid import uuid4

import pytest

from app.feature.materials.service import coerce
from app.platform.errors import MalformedOutput
from tests.conftest import FakeProvider


def test_coerce_accepts_each_type(prompts):
    types = prompts.material_types
    assert coerce(types["summary"], '{"text": "hola"}') == {"text": "hola"}
    assert coerce(types["notes"], '{"text": "apuntes"}')["text"] == "apuntes"
    assert coerce(types["flashcards"], '{"cards": [{"front": "a", "back": "b"}]}')["cards"]
    assert coerce(types["assignment"], '{"tasks": ["a"]}')["tasks"] == ["a"]
    exam = coerce(
        types["exam"], '{"questions": [{"q": "2+2", "options": ["3", "4"], "answer": 1}]}'
    )
    assert exam["questions"][0]["answer"] == 1


def test_coerce_strips_the_code_fence(prompts):
    fenced = '```json\n{"tasks": ["a"]}\n```'
    assert coerce(prompts.material_types["assignment"], fenced) == {"tasks": ["a"]}


@pytest.mark.parametrize("raw", ['{"cards": []}', '{"otra": 1}', "no soy json", "[1, 2]"])
def test_coerce_rejects_what_the_mobile_app_could_not_render(prompts, raw):
    with pytest.raises(MalformedOutput):
        coerce(prompts.material_types["flashcards"], raw)


def test_generate_endpoint_returns_the_content(make_client):
    provider = FakeProvider(answer='{"tasks": ["resolver la guía"]}')
    client, _, _ = make_client(provider=provider)
    with client:
        resp = client.post(
            "/v1/generate", json={"type": "assignment", "prompt": "tarea de álgebra"}
        )
    assert resp.status_code == 200
    assert resp.json() == {"content": {"tasks": ["resolver la guía"]}}


def test_generate_rejects_an_unknown_type(make_client):
    client, _, _ = make_client()
    with client:
        resp = client.post("/v1/generate", json={"type": "podcast", "prompt": "x"})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "unsupported_type"


def test_generate_reports_a_malformed_answer_so_the_backend_retries(make_client):
    client, _, _ = make_client(provider=FakeProvider(answer="lo siento, no puedo"))
    with client:
        resp = client.post("/v1/generate", json={"type": "exam", "prompt": "x"})
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "malformed_output"


def test_a_generation_survives_a_search_failure(make_client):
    from tests.conftest import FakeChunkRepository

    client, _, _ = make_client(
        provider=FakeProvider(answer='{"text": "resumen"}'),
        repo=FakeChunkRepository(fails=RuntimeError("pool agotado")),
    )
    with client:
        resp = client.post(
            "/v1/generate",
            json={
                "type": "summary",
                "prompt": "x",
                "retrieval": {"attachment_ids": [str(uuid4())]},
            },
        )
    assert resp.status_code == 200
