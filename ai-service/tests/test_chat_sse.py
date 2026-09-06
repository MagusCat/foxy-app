import json
from uuid import uuid4

from app.feature.documents.repository import Chunk
from tests.conftest import FakeChunkRepository, FakeProvider


def data_lines(body: str) -> list[dict]:
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


def test_stream_sends_one_event_per_token_and_closes_with_done(make_client):
    client, _, _ = make_client(provider=FakeProvider(tokens=["Hola", " mundo"]))
    with client:
        resp = client.post(
            "/v1/chat",
            json={"messages": [{"role": "user", "content": "hola"}]},
        )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    events = data_lines(resp.text)
    assert [e.get("content") for e in events[:-1]] == ["Hola", " mundo"]
    assert events[-1] == {"done": True}


def test_accents_travel_as_utf8_not_as_escapes(make_client):
    client, _, _ = make_client(provider=FakeProvider(tokens=["¿qué tal?"]))
    with client:
        resp = client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hola"}]})
    assert "¿qué tal?" in resp.text


def test_the_context_from_go_becomes_the_system_prompt(make_client, prompts):
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider)
    with client:
        client.post(
            "/v1/chat",
            json={
                "context": {
                    "user_kind": "teacher",
                    "main_goal": "preparar un examen",
                    "objectives": ["Derivadas"],
                },
                "messages": [{"role": "user", "content": "hola"}],
            },
        )
    system = provider.seen_messages[0]["content"]
    assert prompts.persona_kind["teacher"] in system
    assert "preparar un examen" in system
    assert "Derivadas" in system


def test_without_context_the_base_persona_still_travels(make_client, prompts):
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider)
    with client:
        client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hola"}]})
    assert provider.seen_messages[0] == {"role": "system", "content": prompts.persona_base}


def test_the_retrieved_fragments_reach_the_last_user_turn(make_client, prompts):
    attachment = uuid4()
    repo = FakeChunkRepository(
        found=[
            Chunk(attachment, 1, "La derivada mide el cambio instantáneo."),
            Chunk(attachment, 0, "Cálculo diferencial, capítulo uno."),
        ]
    )
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider, repo=repo)
    with client:
        client.post(
            "/v1/chat",
            json={
                "messages": [{"role": "user", "content": "¿qué es una derivada?"}],
                "retrieval": {"attachment_ids": [str(attachment)]},
            },
        )
    assert provider.seen_messages[0] == {"role": "system", "content": prompts.persona_base}

    last = provider.seen_messages[-1]
    assert last["role"] == "user"
    assert "¿qué es una derivada?" in last["content"]
    assert "La derivada mide" in last["content"]
    assert last["content"].index("capítulo uno") < last["content"].index("cambio instantáneo")
    assert provider.embedded == ["¿qué es una derivada?"]


def test_without_attachments_there_is_no_search(make_client):
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider)
    with client:
        client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hola"}]})
    assert provider.embedded == []


def test_a_search_failure_does_not_take_the_answer_down(make_client, prompts):
    repo = FakeChunkRepository(fails=RuntimeError("connection refused"))
    provider = FakeProvider(tokens=["sigo", " aquí"])
    client, _, _ = make_client(provider=provider, repo=repo)
    with client:
        resp = client.post(
            "/v1/chat",
            json={
                "messages": [{"role": "user", "content": "hola"}],
                "retrieval": {"attachment_ids": [str(uuid4())]},
            },
        )
    assert resp.status_code == 200
    assert [e.get("content") for e in data_lines(resp.text)[:-1]] == ["sigo", " aquí"]
    assert provider.seen_messages[0]["content"] == prompts.persona_base


def test_the_model_is_told_to_cite_only_when_there_is_material(make_client, prompts):
    attachment = uuid4()
    repo = FakeChunkRepository(found=[Chunk(attachment, 0, "dato del PDF", "apuntes.pdf")])
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider, repo=repo)
    with client:
        client.post(
            "/v1/chat",
            json={
                "messages": [{"role": "user", "content": "¿qué dice el pdf?"}],
                "retrieval": {"attachment_ids": [str(attachment)]},
            },
        )
    last = provider.seen_messages[-1]["content"]
    assert prompts.cite in last
    assert "[apuntes.pdf]" in last


def test_without_material_there_is_nothing_to_cite(make_client, prompts):
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider)
    with client:
        client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hola"}]})
    assert all(prompts.cite not in m["content"] for m in provider.seen_messages)


def test_a_follow_up_question_still_carries_its_subject(make_client):
    provider = FakeProvider(tokens=["ok"])
    client, _, _ = make_client(provider=provider, repo=FakeChunkRepository(found=[]))
    with client:
        client.post(
            "/v1/chat",
            json={
                "messages": [
                    {"role": "user", "content": "¿qué es una derivada?"},
                    {"role": "assistant", "content": "La tasa de cambio instantánea."},
                    {"role": "user", "content": "¿y para qué sirve?"},
                ],
                "retrieval": {"attachment_ids": [str(uuid4())]},
            },
        )
    assert len(provider.embedded) == 1
    query = provider.embedded[0]
    assert "derivada" in query
    assert "¿y para qué sirve?" in query


def test_only_the_last_turn_changes_when_the_retrieved_material_changes(make_client):
    attachment = uuid4()
    history = [
        {"role": "user", "content": "¿qué es una derivada?"},
        {"role": "assistant", "content": "La tasa de cambio instantánea."},
        {"role": "user", "content": "¿y una integral?"},
    ]

    def ask(chunk_text: str) -> list[dict]:
        provider = FakeProvider(tokens=["ok"])
        repo = FakeChunkRepository(found=[Chunk(attachment, 0, chunk_text, "apuntes.pdf")])
        client, _, _ = make_client(provider=provider, repo=repo)
        with client:
            client.post(
                "/v1/chat",
                json={
                    "context": {"user_kind": "student"},
                    "messages": history,
                    "retrieval": {"attachment_ids": [str(attachment)]},
                },
            )
        return provider.seen_messages

    primero = ask("el material que se recuperó esta vez")
    segundo = ask("un material completamente distinto")

    assert primero[:-1] == segundo[:-1], "the cacheable prefix changed"
    assert primero[-1] != segundo[-1], "the material should be in the last turn"
