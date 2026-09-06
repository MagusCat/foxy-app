import json

import pytest

from app.llm import get_provider
from app.llm.fake import FakeProvider
from app.platform.errors import MalformedOutput


@pytest.fixture
def provider(settings) -> FakeProvider:
    return FakeProvider(settings)


def test_the_selector_knows_it(settings):
    provider = get_provider(settings.model_copy(update={"llm_provider": "fake"}))
    assert isinstance(provider, FakeProvider)


@pytest.mark.anyio
async def test_json_mode_answers_the_shape_the_prompt_asked_for(provider):
    shape = '{"cards": [{"front": "p", "back": "r"}]}'
    system = f"Devuelves JSON.\n\nEstructura exacta:\n{shape}\n\nFin."
    raw = await provider.complete(
        [{"role": "system", "content": system}, {"role": "user", "content": "algo"}],
        json_mode=True,
    )
    assert json.loads(raw)["cards"][0]["front"] == "p"


@pytest.mark.anyio
async def test_json_mode_without_a_shape_is_reported(provider):
    with pytest.raises(MalformedOutput):
        await provider.complete([{"role": "user", "content": "algo"}], json_mode=True)


@pytest.mark.anyio
async def test_the_stream_echoes_the_question(provider):
    question = {"role": "user", "content": "¿qué es una derivada?"}
    tokens = [t async for t in provider.stream([question])]
    assert "".join(tokens).endswith("¿qué es una derivada? ")
    assert len(tokens) > 5, "it must arrive chunked, not all at once"


@pytest.mark.anyio
async def test_embeddings_are_stable_and_have_the_column_dimension(provider, settings):
    a, b = await provider.embed(["cálculo diferencial", "cálculo diferencial"])
    assert len(a) == settings.embedding_dim
    assert a == b, "the same text must give the same vector"


@pytest.mark.anyio
async def test_sharing_words_shortens_the_distance(provider):
    query, near, far = await provider.embed(
        ["la derivada mide el cambio", "la derivada mide el cambio instantáneo", "receta de sopa"]
    )
    assert _cosine(query, near) > _cosine(query, far)


@pytest.mark.anyio
async def test_an_empty_text_is_not_the_zero_vector(provider):
    # pgvector cannot order by cosine distance against an all-zero vector.
    (vector,) = await provider.embed(["   "])
    assert any(vector)


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


@pytest.mark.anyio
async def test_it_reports_the_sources_it_was_given(provider):
    system = "Material de referencia.\n\n[apuntes.pdf]\nun dato\n\n---\n\n[apuntes.pdf]\notro dato"
    tokens = [
        t
        async for t in provider.stream(
            [{"role": "system", "content": system}, {"role": "user", "content": "¿y?"}]
        )
    ]
    answer = "".join(tokens)
    assert "Fuentes recibidas: apuntes.pdf." in answer, (
        "with no real key, this is how the citation shows"
    )
