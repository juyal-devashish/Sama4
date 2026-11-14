"""Score the context feature against the labelled eval set and log the result.

    poetry run python -m evals.run_context_eval [--api URL] [--judge] [--label v1.2]

Two scores per run:
- **linker**: does the term's linked Wikipedia page match the gold referent? No model needed.
- **explanation** (with --judge): Claude reads the passage, the gold referent and the
  explanation the API serves, and says whether the explanation is about the right thing
  and consistent with the passage. Needs ANTHROPIC_API_KEY.

Explanations come from GET /context/{entity_id}, i.e. exactly what readers see. An
entity with no cached explanation is generated on that request, so a first run against
production costs up to one low-effort Claude call per item.

Each run appends one line to evals/results/history.jsonl (git sha, date, scores), so
accuracy can be compared release to release. Scoring is pure and tested.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote

import httpx

from evals.build_context_eval import DEFAULT_API

HERE = Path(__file__).parent
EVAL_SET = HERE / "context_eval.jsonl"
HISTORY = HERE / "results" / "history.jsonl"

JUDGE_SYSTEM = """You grade explanations in a news reader. Given a news passage, the \
term highlighted in it, what the term actually refers to there, and the explanation the \
app showed, answer with one JSON object and nothing else:
{"right_referent": true|false, "consistent": true|false, "reason": "<12 words max>"}
right_referent: the explanation is about the referent given (not a namesake, a surname, \
or a generic sense). consistent: nothing in it contradicts the passage or is plainly false."""

JUDGE_PROMPT = """<passage>{excerpt}</passage>
<term>{term}</term>
<referent>{referent}</referent>
<explanation>{explanation}</explanation>"""


def page_title(url: str) -> str:
    """ "https://en.wikipedia.org/wiki/caf%C3%A9#x" -> "Café" (MediaWiki's normal form)."""
    t = unquote(url.split("/wiki/")[-1].split("#")[0]).replace("_", " ").strip()
    return t[:1].upper() + t[1:]


def same_page(a: str | None, b: str | None, redirects: dict[str, str] | None = None) -> bool:
    """Wikipedia URLs naming the same article, following `redirects` (title -> target)."""
    if not a or not b:
        return False
    redirects = redirects or {}
    ta, tb = page_title(a), page_title(b)
    return redirects.get(ta, ta) == redirects.get(tb, tb)


def linker_score(
    items: Iterable[dict],
    current: dict[str, str | None] | None = None,
    redirects: dict[str, str] | None = None,
) -> dict:
    """Share of gold-labelled items whose linked page is the gold page.

    `current` maps item id -> the link the API serves now; without it, the link recorded
    when the set was built is used. Items whose gold referent has no Wikipedia page count
    as correct only when nothing is linked (linking a wrong page is the failure this
    catches).
    """
    total = correct = 0
    for item in items:
        gold = item.get("gold") or {}
        if gold.get("labelled_by") is None:
            continue
        total += 1
        expected = gold.get("wikipedia_url")
        linked = item.get("linked_wikipedia_url")
        if current is not None and item.get("id") in current:
            linked = current[item["id"]]
        if (expected is None and linked is None) or same_page(expected, linked, redirects):
            correct += 1
    return {
        "n": total,
        "correct": correct,
        "accuracy": round(correct / total, 4) if total else None,
    }


def parse_verdict(text: str) -> dict | None:
    """The judge's JSON object, tolerating prose or code fences around it."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        verdict = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    if not isinstance(verdict.get("right_referent"), bool):
        return None
    verdict.setdefault("consistent", False)
    return verdict


def explanation_score(verdicts: list[dict | None]) -> dict:
    judged = [v for v in verdicts if v is not None]
    ok = sum(1 for v in judged if v["right_referent"] and v["consistent"])
    return {
        "n": len(judged),
        "unjudged": len(verdicts) - len(judged),
        "correct": ok,
        "accuracy": round(ok / len(judged), 4) if judged else None,
    }


AMBIGUOUS_TAGS = {"single_word", "linked_to_several_pages"}


def split_by_tag(items: list[dict]) -> dict[str, list[dict]]:
    """All items; ambiguous names (item 43's disambiguation cases); the rest; and terms
    that shouldn't be highlighted at all (fragments, generic words)."""

    def ambiguous(i: dict) -> bool:
        return bool(AMBIGUOUS_TAGS & set(i.get("tags", [])))

    return {
        "all": items,
        "ambiguous": [i for i in items if ambiguous(i)],
        "plain": [i for i in items if not ambiguous(i)],
        "not_a_useful_term": [i for i in items if "not_a_useful_term" in i.get("tags", [])],
    }


def git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


async def fetch_current_links(api: str, items: list[dict]) -> dict[str, str | None]:
    """Item id -> the Wikipedia link the API serves for that term now (matched by entity
    id, else by name, since clean-ups can merge entities)."""
    gate = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "sama4-evals"}) as http:

        async def one(article_id: str) -> tuple[str, list[dict]]:
            async with gate:
                r = await http.get(f"{api}/articles/{article_id}/reference")
            return article_id, (r.json()["entities"] if r.status_code == 200 else [])

        refs = dict(await asyncio.gather(*(one(a) for a in {i["article_id"] for i in items})))
    links: dict[str, str | None] = {}
    for item in items:
        entities = refs.get(item["article_id"], [])
        match = next((e for e in entities if e["id"] == item["entity_id"]), None) or next(
            (e for e in entities if e["name"].lower() == item["term"].lower()), None
        )
        links[item["id"]] = match.get("wikipedia_url") if match else None
    return links


async def resolve_redirects(urls: Iterable[str | None]) -> dict[str, str]:
    """Title -> canonical title for every URL that is a Wikipedia redirect."""
    titles = sorted({page_title(u) for u in urls if u})
    out: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "sama4-evals"}) as http:
        for k in range(0, len(titles), 50):
            r = await http.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "titles": "|".join(titles[k : k + 50]),
                    "redirects": 1,
                    "format": "json",
                },
            )
            q = r.json().get("query", {})
            norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
            red = {d["from"]: d["to"] for d in q.get("redirects", [])}
            for t in titles[k : k + 50]:
                t2 = norm.get(t, t)
                if red.get(t2, t2) != t:
                    out[t] = red.get(t2, t2)
    return out


async def fetch_explanations(api: str, items: list[dict]) -> dict[str, str]:
    gate = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "sama4-evals"}) as http:

        async def one(entity_id: str) -> tuple[str, str]:
            async with gate:
                r = await http.get(f"{api}/context/{entity_id}")
            text = r.json()["context"]["text"] if r.status_code == 200 else ""
            return entity_id, text

        pairs = await asyncio.gather(*(one(i["entity_id"]) for i in items))
    return dict(pairs)


async def judge(items: list[dict], explanations: dict[str, str]) -> list[dict | None]:
    from app.clients.llm import LLMClient

    llm = LLMClient(
        os.environ["ANTHROPIC_API_KEY"], os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
    )
    gate = asyncio.Semaphore(4)

    async def one(item: dict) -> dict | None:
        gold = item["gold"]
        referent = gold.get("referent") or gold.get("wikipedia_url") or item["term"]
        prompt = JUDGE_PROMPT.format(
            excerpt=item["excerpt"],
            term=item["term"],
            referent=referent,
            explanation=explanations.get(item["entity_id"]) or "(no explanation shown)",
        )
        async with gate:
            reply = await llm.generate(prompt, effort="low", system=JUDGE_SYSTEM)
        return parse_verdict(reply)

    return await asyncio.gather(*(one(i) for i in items))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--judge", action="store_true", help="score explanations with Claude")
    parser.add_argument("--label", default="", help="release name to store with the result")
    parser.add_argument("--no-log", action="store_true", help="don't append to history")
    args = parser.parse_args()

    items = [json.loads(line) for line in EVAL_SET.read_text().splitlines() if line.strip()]
    groups = split_by_tag(items)
    current = asyncio.run(fetch_current_links(args.api, items))
    redirects = asyncio.run(
        resolve_redirects([*current.values(), *(i["gold"].get("wikipedia_url") for i in items)])
    )
    result: dict = {
        "date": datetime.now(UTC).isoformat(timespec="seconds"),
        "git_sha": git_sha(),
        "label": args.label,
        "api": args.api,
        "linker": {name: linker_score(group, current, redirects) for name, group in groups.items()},
    }
    if args.judge:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit("--judge needs ANTHROPIC_API_KEY")
        labelled = [i for i in items if (i.get("gold") or {}).get("labelled_by")]
        explanations = asyncio.run(fetch_explanations(args.api, labelled))
        verdicts = dict(
            zip(
                (i["id"] for i in labelled), asyncio.run(judge(labelled, explanations)), strict=True
            )
        )
        result["explanation"] = {
            name: explanation_score([verdicts[i["id"]] for i in group if i["id"] in verdicts])
            for name, group in split_by_tag(labelled).items()
        }

    print(json.dumps(result, indent=2))
    if not args.no_log:
        HISTORY.parent.mkdir(exist_ok=True)
        with HISTORY.open("a") as f:
            f.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    main()
