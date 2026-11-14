# Context-feature evals

Measures whether Samā4 explains the right thing: a highlighted term in a story should be
linked to, and explained as, what it means *in that story* (Cade Cunningham the Pistons
guard, not the surname Cunningham).

Not part of the app or of `make check`'s network-free tests (only the pure scoring and
sampling functions are tested, in `tests/test_evals_*.py`).

## The set: `context_eval.jsonl`

200 term + story pairs sampled from production stories on 2026-11-13 by
`build_context_eval.py`: at most 2 terms per story, no term twice, 40 of each type
(person, organization, location, event, concept), and 60 deliberately ambiguous names
(bare single words, or names linked to different pages in different stories).

Each line holds the term, its type, the story passage around it, what the linker chose
(`linked_wikipedia_url`, `stored_context`), `tags`, and `gold`:

| field | meaning |
|---|---|
| `wikipedia_url` | the English Wikipedia article for what the term means here; `null` if none |
| `referent` | a short name for it, e.g. "Colette Kress, Nvidia CFO" |
| `linker_correct` | whether the linker's page was that article at build time |
| `confidence` | the labeller's confidence: high / medium / low |
| `labelled_by` | `claude-first-pass` for now |
| `human_verified` | flip to `true` as a person checks each label |
| `entity_type` (optional) | the correct type, when the app's `entity_type` is wrong |
| `term` (optional) | the correct span, when the app highlighted too much or too little |
| `exclude` (optional) | `true` drops the item from scoring (e.g. a mention from paywall boilerplate) |

The item's own `term` and `entity_type` record what the app produced, so a correction
goes in `gold` and the app's mistake stays measurable.

**The first-pass labels were written by Claude** from the passage, and every gold URL was
checked to exist on Wikipedia (redirects resolved to canonical titles). They need a human
spot-check, starting with the 68 medium- and low-confidence items. Items tagged
`not_a_useful_term` (31) are fragments or generic words the app shouldn't highlight;
their gold is `null`.

Rebuild a fresh set (it samples whatever is live): `poetry run python -m evals.build_context_eval`.
Don't overwrite the labelled file unless you mean to re-label.

## Scoring: `run_context_eval.py`

```
poetry run python -m evals.run_context_eval --label v1.3            # linker only
ANTHROPIC_API_KEY=... poetry run python -m evals.run_context_eval --judge --label v1.3
```

Or `make eval-context` from the repo root. Each run appends to `results/history.jsonl`.

- **linker**: the link the API serves *now* for each term vs the gold article (Wikipedia
  redirects followed). A term with no gold article scores only if nothing is linked.
- **explanation** (`--judge`): the explanation the API serves, graded by Claude for being
  about the gold referent and consistent with the passage. A term with no cached
  explanation is generated on request, so a first judged run costs up to 200 low-effort
  Claude calls in production.

Scores are split into `all`, `ambiguous`, `plain` and `not_a_useful_term`.

Baseline (2026-11-13, linker only): 58.5% overall, 45% on ambiguous names, 64% on the rest.
