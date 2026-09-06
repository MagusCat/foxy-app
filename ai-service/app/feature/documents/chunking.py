import re

_PARAGRAPH = re.compile(r"\n\s*\n")
_SENTENCE = re.compile(r"(?<=[.!?…])\s+")
_LEADING_WORD = re.compile(r"^\S*\s+")


def split(text: str, *, size: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []

    chunks: list[str] = []
    current = ""
    for unit in _units(text, size):
        if not current:
            current = unit
        elif len(current) + 2 + len(unit) <= size:
            current = f"{current}\n\n{unit}"
        else:
            chunks.append(current)
            tail = _tail(current, overlap)
            current = f"{tail}\n\n{unit}" if tail else unit
    if current:
        chunks.append(current)
    return chunks


def _units(text: str, size: int) -> list[str]:
    units: list[str] = []
    for paragraph in _PARAGRAPH.split(text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) <= size:
            units.append(paragraph)
            continue
        for sentence in _SENTENCE.split(paragraph):
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) <= size:
                units.append(sentence)
            else:
                units += [sentence[i : i + size] for i in range(0, len(sentence), size)]
    return units


def _tail(chunk: str, overlap: int) -> str:
    if overlap <= 0 or len(chunk) <= overlap:
        return ""
    return _LEADING_WORD.sub("", chunk[-overlap:], count=1).strip()
