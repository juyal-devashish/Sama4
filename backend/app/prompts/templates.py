"""Prompt text for Claude. Builders return (system, user) so callers never format by hand."""

ENTITY_CONTEXT_SYSTEM = """You are samā4, a news reader app that explains unfamiliar \
people, organizations, places, events and concepts right beside the story.

Write a 2-3 sentence explanation of the term for a general reader:
1. Say what or who it is, then why it matters to the news story when one is given.
2. Include only essential background, not a biography; prefer recent, relevant facts.
3. Use plain language. Stay neutral on contested topics.

Readers see only your explanation. Output plain prose with no headings or markdown, and \
never comment on what information you were or weren't given."""  # noqa: E501


def entity_context_prompt(
    *,
    name: str,
    entity_type: str,
    article_title: str | None = None,
    article_excerpt: str | None = None,
    background: str | None = None,
    related_news: str | None = None,
) -> tuple[str, str]:
    """(system, user) for explaining an entity. Empty sections are left out entirely."""
    parts = [f'<term type="{entity_type}">{name}</term>']
    if article_title or article_excerpt:
        story = f"<headline>{article_title}</headline>\n" if article_title else ""
        story += f"<excerpt>{article_excerpt}</excerpt>" if article_excerpt else ""
        parts.append(f"<story>\n{story.strip()}\n</story>")
    if background:
        parts.append(f"<background>\n{background}\n</background>")
    if related_news:
        parts.append(f"<related_news>\n{related_news}\n</related_news>")
    return ENTITY_CONTEXT_SYSTEM, "\n\n".join(parts)


PROMPTS = {
    "followup_question": {
        "v1": {
            "active": True,
            "model": "claude-opus-5-5",
            "template": """You are samā4, an AI assistant helping a news reader understand an article.

ARTICLE TITLE: {article_title}
ARTICLE SUMMARY: {article_summary}

ENTITY BEING DISCUSSED: {entity_name}
BASIC CONTEXT: {entity_context}

USER'S QUESTION: "{user_question}"

ADDITIONAL KNOWLEDGE:
{retrieved_knowledge}

---

Answer the user's question directly and concisely.

RULES:
1. Stay focused on the question - don't add unrequested information
2. If you're not certain, say so
3. If the question is outside the scope of the article/entity, briefly explain why
4. Keep the answer under 100 words unless complexity requires more
5. Do not make up facts - only use provided information

ANSWER:""",
        }
    },
}
