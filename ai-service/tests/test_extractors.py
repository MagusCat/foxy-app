import io
import zipfile

import pytest

from app.feature.documents import extractors
from app.platform.errors import UnsupportedType

LIMITS = extractors.Limits(
    max_decompressed_bytes=1 * 1024 * 1024, max_chars=100_000, max_pdf_pages=500
)


def extract(blob: bytes, suffix: str, limits: extractors.Limits = LIMITS) -> str:
    return extractors.extract(blob, suffix, limits)


def test_suffix_and_image_detection():
    assert extractors.suffix_of("uid/uid/apuntes.PDF") == ".pdf"
    assert extractors.suffix_of("uid/uid/sin-extension") == ""
    assert extractors.is_image(".png")
    assert not extractors.is_image(".pdf")


def test_plain_text_formats():
    assert extract(b"  hola  ", ".txt") == "hola"
    assert extract(b"# titulo", ".md") == "# titulo"


def test_broken_encoding_does_not_break_the_ingest():
    assert extract(b"caf\xe9", ".txt")


def test_unknown_format_is_reported():
    with pytest.raises(UnsupportedType):
        extract(b"...", ".exe")


def zip_with(payload: bytes, name: str = "word/document.xml") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr(name, payload)
    return buf.getvalue()


@pytest.mark.parametrize("suffix", [".docx", ".pptx"])
def test_a_zip_bomb_is_rejected_before_being_opened(suffix: str):
    bomb = zip_with(b"A" * (50 * 1024 * 1024))
    assert len(bomb) < 200 * 1024, "the bomb must be small, otherwise it proves nothing"

    with pytest.raises(UnsupportedType, match="se expande"):
        extract(bomb, suffix)


def test_something_that_is_not_a_zip_is_a_clean_rejection():
    with pytest.raises(UnsupportedType):
        extract(b"esto no es un zip", ".docx")


def test_the_guard_does_not_reject_an_ordinary_file():
    small = zip_with(b"<xml>contenido normal</xml>")
    with pytest.raises(Exception) as exc:
        extract(small, ".docx")
    assert "se expande" not in str(exc.value)


def test_plain_text_is_capped_too():
    assert extract(b"x" * 5000, ".txt", extractors.Limits(1024, 100, 10)) == "x" * 100


def test_the_pdf_stops_reading_once_the_budget_is_full(monkeypatch):
    visitadas = []

    class Page:
        def __init__(self, n: int):
            self.n = n

        def extract_text(self) -> str:
            visitadas.append(self.n)
            return "x" * 100

    class Reader:
        def __init__(self, _stream):
            self.pages = [Page(i) for i in range(1000)]

    monkeypatch.setattr("pypdf.PdfReader", Reader)

    texto = extract(b"%PDF-1.7", ".pdf", extractors.Limits(1024, 250, 500))

    assert len(visitadas) == 3, f"read {len(visitadas)} pages for a 250-char cap"
    assert len(texto) >= 250


def test_the_page_cap_bounds_a_pdf_with_no_text(monkeypatch):
    visitadas = []

    class Page:
        def extract_text(self) -> str:
            visitadas.append(1)
            return ""

    class Reader:
        def __init__(self, _stream):
            self.pages = [Page() for _ in range(1000)]

    monkeypatch.setattr("pypdf.PdfReader", Reader)

    extract(b"%PDF-1.7", ".pdf", extractors.Limits(1024, 100_000, max_pdf_pages=10))
    assert len(visitadas) == 10
