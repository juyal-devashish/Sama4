# samā4 vs Particle News — Where the Technical Requirements Diverge

*Prepared 2026-11-11. Particle details come from its App Store / Play Store listings, particle.news, and press coverage (The Verge, Nov 2024; TechCrunch, May 2025). Particle's internals are not public, so anything about its backend is **inferred from product behavior** and marked (inferred).*

---

## 1. The one-line difference

| | **Particle** | **samā4** |
|---|---|---|
| Core question it answers | "What happened, according to everyone?" | "What does *this* word in *this* article mean?" |
| Unit of content | **Story** — a cluster of 10–100+ articles, posts, quotes, podcast clips | **Article × Entity** — one article, with tappable spans inside it |
| AI does | Multi-document *compression* (many sources → one summary) | Single-document *expansion* (one span → just-in-time background) |
| Hot path | Precomputed at story-update time, read is cheap | Interactive, on tap, latency-bound (<300 ms p50 target) |

Almost every requirement below falls out of that inversion: Particle aggregates *across* documents, samā4 drills *into* one.

---

## 2. Requirements that are fundamentally different

### R1. Content model: event clustering vs. span-level entity extraction

**Particle needs**
- **Online event clustering**: assign every incoming article/post to an existing Story or open a new one, continuously. Needs story identity that survives over days (merge two clusters, split one that drifted, retire stale ones). (inferred)
- **Story versioning**: summary, quotes, and spectrum chart get regenerated as new coverage joins; old versions need invalidation.
- Cross-source **quote extraction and attribution** ("salient quotes" section).

**samā4 needs**
- **Span-accurate NER** with character offsets, entity type, and priority per article (`ArticleEntity`), using `en_core_web_trf`.
- **Entity linking** to a canonical KB (Wikidata/Wikipedia) so "Powell", "Jerome Powell", and "the Fed chair" resolve to one `Entity`.
- **Offset re-mapping onto LLM output.** Entities are highlighted on the *generated summary* in `FullPageCard`, not just the source text, so offsets have to be recomputed against text the LLM wrote. Right now that's frontend text-matching. Particle has no equivalent problem.

samā4's MinHash dedup (`ingestion/dedup.py`) **drops** near-duplicates. Particle's clustering **keeps** them and groups them. Those are opposite goals. Same-event coverage is noise to samā4 and the product itself to Particle.

### R2. Where the LLM sits and what it's graded on

| | Particle | samā4 |
|---|---|---|
| Task | Multi-doc summarization with citations, bias-balanced framing | Entity explanation grounded in article context + KB |
| Input size | Large (dozens of articles per story) | Small (entity + surrounding paragraph + Wikipedia + top-k Pinecone chunks) |
| Output variants | Per-story × per-style matrix: bullets, ELI5, 5Ws, translation, custom (Particle+) | Per-entity short context, plus per-question follow-ups |
| Failure that matters | Misattribution, false consensus across outlets | Wrong disambiguation (wrong "Jordan"), context that ignores *this* article |
| When it runs | Write path (story update) | Read path (user tap), with pre-generation as an optimization |

**Implication for samā4:** `config.py` sets `anthropic_model = "claude-opus-5-5"` for everything. That conflicts with the CLAUDE.md targets (p50 < 300 ms, < $0.002 per context). samā4 needs a **tiered model policy**: pre-generate `Entity.short_context` offline (where a big model is fine), serve the tap from cache or a small, fast model, and keep the large model for `/context/explain` follow-ups only. Particle can afford big models everywhere because generation happens off the read path.

### R3. Latency and caching shape

- **Particle**: write-heavy and batch-friendly. Cost scales with *stories × styles × languages*. The read path is a CDN/DB fetch. (inferred)
- **samā4**: read-path inference. Cost scales with *distinct (entity, article-context) pairs tapped*. Requirements:
  - Two-level cache: global entity context (24h TTL) + article-scoped context keyed by `(entity_id, article_id)`.
  - **Prefetch on card view**: when a `FullPageCard` renders, warm contexts for its top-priority entities before any tap (`usePrefetch.ts` exists, so extend it to context).
  - Popularity-driven pre-generation using `Entity.popularity_score`.
  - Hard timeout + graceful fallback (Wikipedia extract) if the LLM misses the budget.

### R4. Ingestion breadth, modality, and freshness

| | Particle | samā4 today |
|---|---|---|
| Sources | Hundreds+ of publishers, X posts, **165k+ podcasts** (Radar) | ~10 RSS feeds (`sources.py`) |
| Modalities | Text + social posts + **audio** | Text only |
| Freshness | Near-real-time (breaking alerts on followed entities) | Hourly APScheduler batch |

Particle's podcast feature alone implies an audio pipeline samā4 doesn't need: feed crawling at scale, ASR, speaker diarization, transcript-to-story topical alignment, **segment boundary detection** (the "relevant 45 seconds"), clip hosting, and transcript-synced playback.

samā4 only needs breadth when it changes *context quality*. More publishers don't make an entity explanation better; a better KB and better retrieval do. So samā4's freshness requirement is about **entity context staleness** ("who is the current PM?"), not article velocity. It needs:
- Entity context invalidation when new articles shift an entity's state (e.g., `short_context` re-generated when an entity appears in N new articles within T hours).
- A "fact-as-of" timestamp on every context response.

### R5. Source metadata: political spectrum vs. credibility

- **Particle** needs a **publisher bias taxonomy** (left↔right ratings per outlet), plus per-story distribution charts and "Opposite Sides" stance grouping. That means a maintained ratings dataset plus stance/framing classification per article. (inferred)
- **samā4** only needs `Source.credibility` to weight retrieval and to cite where context came from. It does not need stance classification. **Neutrality of the explanation** is a prompt and eval requirement, not a data-model one.

### R6. Personalization model

| | Particle | samā4 |
|---|---|---|
| Personalizes | **What you see** (feed selection) | **How deep the explanation goes** (adaptive depth) |
| Signals | Follow graph: topics, people, places, journalists, publishers; location for local news | Per-user entity familiarity: what they've tapped, dismissed, already learned |
| Data structures | Follows table, fan-out on story update, per-user feed ranking | User × Entity knowledge state; reading-level preference |
| Output | Feed ordering + push triggers | Which spans get highlighted, and how much context is shown |

samā4-specific requirements:
- **Highlight suppression**: stop highlighting entities the user has demonstrably learned, so highlights don't get noisy over time.
- **Depth tiers** in the context prompt (novice / familiar / expert), driven by user state rather than a manual style picker. Particle exposes styles as a manual menu (ELI5, 5Ws). samā4's thesis is that it should be automatic.
- This needs real user identity. `models/user.py` exists but there's no auth flow yet. Particle needs auth for follows and notifications; samā4 needs it for knowledge state.

### R7. Q&A scope and visibility

- **Particle**: questions are **story-scoped** and **public by default**. Users browse what others asked, and "Private Questions" is a paid feature. That requires question canonicalization/dedup, moderation, ranking, and privacy entitlements. (inferred)
- **samā4**: follow-ups are **entity-scoped within an article** (`POST /context/explain`) and private. Requirements are conversation memory per (user, entity, article), grounding citations, and refusal to speculate beyond sources. No moderation pipeline needed unless questions become shared.

### R8. Delivery surface and notifications

- **Particle**: native iOS + Android + web; push for daily digests and follow-triggered breaking alerts; TTS "play my feed" with voice choice; email newsletter; entitlement system for Particle+.
- **samā4**: mobile-first Next.js web app (393px). Required:
  - Bottom-sheet context in under one frame of perceived delay. That's a UX constraint Particle doesn't share, because it never interrupts reading.
  - No push/TTS dependency for the core value. If notifications are added later, Web Push + a service worker is the path, not native.

### R9. Forward-looking analysis (samā4-only)

samā4 has `Prediction` / `AgentPerspective` models backed by **MiroFish** multi-agent simulation (500 agents × 30 rounds by default). Particle has nothing comparable. It summarizes coverage that already exists. This brings requirements Particle doesn't have:
- Long-running async jobs (minutes) with queueing, status polling, timeouts, and retries. Today this is an HTTP client to an external service with a long read timeout.
- Cost controls and impact gating (`impact_score`) so simulations only run on stories that warrant them.
- Clear UI labeling that output is **simulated opinion, not reporting**, which is a trust requirement.

---

## 3. Data model contrast

```
PARTICLE (inferred)                          SAMĀ4 (actual)
─────────────────────                        ─────────────────────
Story ──< StoryArticle >── Article           Article ──< ArticleEntity >── Entity
Story ──< StoryVersion (summary × style)       (start, end, type, priority)    (wikidata_id, short_context,
Story ──< Quote (speaker, source)                                               popularity_score)
Story ──< PodcastClip >── Episode ── Show    Article ──< Prediction ──< AgentPerspective
Publisher (bias_rating, region)              Source (feed_url, credibility)
User ──< Follow (entity|journalist|pub)      User ──< EntityKnowledge   ← to build
User ──< Question ──< Answer (public/priv)   User ──< FollowupThread    ← to build
Subscription / Entitlement
```

---

## 4. Shared requirements (not differentiators)

Both need these, and none of them set samā4 apart: RSS/web ingestion, HTML cleaning, an embeddings + vector index for search, LLM summarization of articles, source attribution with outbound links, and publisher-copyright hygiene (summaries, not reproduction).

---

## 5. What this means for samā4's roadmap

1. **Don't build story clustering to match Particle.** It's their moat, and it's a different product. If multi-source context is ever needed, use it as *retrieval input* for entity explanations, not as the reading unit.
2. **Move Opus 5.5 off the tap path** (R2/R3). This is the most immediate conflict between the current config and the stated performance targets.
3. **Make offsets on generated summaries a backend responsibility** (R1). Return entity spans computed against the summary text from the API instead of frontend text-matching.
4. **Build user knowledge state before a follow graph** (R6). Adaptive depth and highlight suppression are samā4's differentiation; feed personalization is table stakes Particle already does well.
5. **Add entity-context staleness handling** (R4): as-of timestamps and invalidation on new coverage.
6. **Treat MiroFish predictions as a separate async subsystem** (R9) with its own queue and cost gate, so it can't degrade the core read path.
