from app.feature.documents import chunking

SIZE = 200
OVERLAP = 40


def split(text):
    return chunking.split(text, size=SIZE, overlap=OVERLAP)


def test_empty_text_has_no_fragments():
    assert split("") == []
    assert split("   \n\n  ") == []


def test_short_text_is_one_fragment():
    assert split("Una definición corta.") == ["Una definición corta."]


def test_every_fragment_fits_the_budget():
    text = "\n\n".join(f"Párrafo {i}. " + "palabra " * 30 for i in range(12))
    fragments = split(text)
    assert len(fragments) > 1
    assert all(len(f) <= SIZE + OVERLAP for f in fragments)


def test_consecutive_fragments_share_context():
    text = "\n\n".join(f"Concepto número {i} explicado. " + "detalle " * 20 for i in range(6))
    fragments = split(text)
    tail = fragments[0][-OVERLAP:].split(maxsplit=1)[-1]
    assert tail in fragments[1], "the next fragment must carry the end of the previous one"


def test_a_paragraph_longer_than_the_budget_is_cut_by_sentences():
    long_paragraph = " ".join(f"Oración número {i} del texto." for i in range(40))
    fragments = split(long_paragraph)
    assert len(fragments) > 1
    assert all(len(f) <= SIZE + OVERLAP for f in fragments)


def test_text_without_any_boundary_still_gets_cut():
    fragments = split("x" * (SIZE * 3))
    assert len(fragments) >= 3
    assert "".join(f for f in fragments).count("x") >= SIZE * 3


def test_nothing_is_lost_from_a_normal_document():
    text = "\n\n".join(f"Tema {i}: contenido del tema." for i in range(10))
    joined = " ".join(split(text))
    for i in range(10):
        assert f"Tema {i}" in joined
