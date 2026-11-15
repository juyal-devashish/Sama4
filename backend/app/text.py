"""Plain-text helpers shared by ingestion and services. No I/O, no settings."""

import re

# A full stop, ! or ?, optionally followed by a closing quote or bracket, then space or end.
_SENTENCE_END = re.compile(r"[.!?][\"'”’)]?(?=\s|$)")

# Words whose full stop is part of the word, not the end of a sentence: titles before names
# ("Gov. Jeff Landry"), and short forms that are usually followed by more of the sentence.
_ABBREVIATIONS = frozenset(
    """
    mr mrs ms dr prof sr jr st mt ft gov sen rep pres gen lt col maj capt sgt cmdr adm
    supt insp det rev hon
    jan feb mar apr jun jul aug sep sept oct nov dec
    vs inc corp co ltd bros dept univ approx est fig
    """.split()
)

# Initials and initialisms: "U.S.", "U.K.", "J."
_INITIALISM = re.compile(r"^(?:[A-Za-z]\.)+[A-Za-z]?\.?$")


def _is_abbreviation(text: str, dot: int) -> bool:
    """True when the full stop at `dot` belongs to an abbreviation, not a sentence end."""
    if text[dot] != ".":
        return False
    start = dot
    while start > 0 and not text[start - 1].isspace() and text[start - 1] not in "\"'“‘(":
        start -= 1
    word = text[start : dot + 1]
    if _INITIALISM.match(word):
        return True
    return word[:-1].lower() in _ABBREVIATIONS


def sentence_ends(text: str) -> list[int]:
    """Indexes just past each sentence end in `text`, skipping abbreviations."""
    return [m.end() for m in _SENTENCE_END.finditer(text) if not _is_abbreviation(text, m.start())]


def cap_words(text: str, limit: int, min_ratio: float = 0.0) -> str:
    """Trim `text` to at most `limit` words, ending on a whole sentence when one fits.

    A sentence end is used only if it keeps at least `min_ratio` of the cut text;
    otherwise the cut ends with "…". Text within the limit is returned unchanged.
    """
    words = text.split()
    if len(words) <= limit:
        return text.strip()
    cut = " ".join(words[:limit])
    ends = [e for e in sentence_ends(cut) if e >= len(cut) * min_ratio]
    if ends:
        return cut[: ends[-1]]
    return cut.rstrip(",;:—–- ") + "…"
