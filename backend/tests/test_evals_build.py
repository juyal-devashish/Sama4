"""The eval-set builder's sampling logic (the network fetch isn't tested)."""

from evals.build_context_eval import ambiguity_tags, candidates, excerpt_around, sample


def _story(article_id: str, terms: list[tuple[str, str]]) -> dict:
    content = " ".join(t for t, _ in terms) + " did things."
    entities, refs, pos = [], [], 0
    for i, (term, etype) in enumerate(terms):
        eid = f"{article_id}-e{i}"
        entities.append(
            {"id": eid, "text": term, "type": etype, "start": pos, "end": pos + len(term)}
        )
        refs.append({"id": eid, "name": term, "wikipedia_url": f"https://w/{term}", "context": "c"})
        pos += len(term) + 1
    return {
        "article": {"id": article_id, "title": "T", "content": content, "entities": entities},
        "reference_entities": refs,
    }


def test_ambiguity_tags():
    assert ambiguity_tags("Cunningham", {"https://w/a"}) == ["single_word"]
    assert ambiguity_tags("Cade Cunningham", {"https://w/a", "https://w/b"}) == [
        "linked_to_several_pages"
    ]
    assert ambiguity_tags("Cade Cunningham", set()) == []


def test_excerpt_snaps_to_words():
    text = "alpha beta gamma delta epsilon"
    # The window cuts "beta" and "delta" mid-word, so both partial words are dropped.
    assert excerpt_around(text, 11, 16, radius=4) == "…gamma…"
    assert excerpt_around(text, 11, 16, radius=7) == "…beta gamma delta…"


def test_candidates_skip_stale_offsets():
    story = _story("a1", [("Ada Lovelace", "PERSON")])
    story["article"]["entities"][0]["start"] += 1  # offsets no longer match the text
    assert candidates([story]) == []


def test_sample_caps_per_story_dedupes_terms_and_balances_types():
    stories = [
        _story(f"a{i}", [(f"Person {i}", "PERSON"), (f"Org {i}", "ORG"), (f"Place {i}", "GPE")])
        for i in range(10)
    ]
    stories.append(_story("dup", [("Person 1", "PERSON")]))

    items = sample(candidates(stories), size=12)

    assert len(items) == 12
    assert len({i.term.lower() for i in items}) == 12
    per_story: dict[str, int] = {}
    for i in items:
        per_story[i.article_id] = per_story.get(i.article_id, 0) + 1
    assert max(per_story.values()) <= 2
    kinds = {i.entity_type for i in items}
    assert kinds == {"PERSON", "ORG", "GPE"}
