"""Seed the database with sample data for local development."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from app.database import IS_SQLITE, async_session, create_tables
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.models.source import Source

SOURCES = [
    {
        "name": "The New York Times",
        "feed_url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "categories": ["general", "world"],
        "credibility_score": 0.92,
    },
    {
        "name": "TechCrunch",
        "feed_url": "https://techcrunch.com/feed/",
        "categories": ["tech"],
        "credibility_score": 0.85,
    },
    {
        "name": "Reuters",
        "feed_url": "https://feeds.reuters.com/reuters/topNews",
        "categories": ["general", "world", "business"],
        "credibility_score": 0.95,
    },
]

now = datetime.now(UTC)

ARTICLES = [
    {
        "title": "Philip Glass Withdraws From Kennedy Center Performance Amid Controversy",
        "url": "https://example.com/articles/philip-glass-kennedy-center",
        "raw_content": (
            "Philip Glass, the acclaimed minimalist composer, has announced his withdrawal "
            "from an upcoming performance at the Kennedy Center. The decision comes amid growing "
            "controversy over federal arts funding cuts proposed by the current administration.\n\n"
            "Glass, 89, whose works include 'Einstein on the Beach' and the film scores for "
            "'The Hours' and 'Koyaanisqatsi', released a statement saying he could not in good "
            "conscience perform at a venue receiving federal funding while artists across the "
            "country face unprecedented budget reductions.\n\n"
            "The Kennedy Center, located in Washington D.C., is one of the nation's premier "
            "performing arts venues. The National Symphony Orchestra, which was set to accompany "
            "Glass, expressed disappointment but respect for his decision.\n\n"
            "Several other prominent artists, including Yo-Yo Ma and Renee Fleming, have voiced "
            "support for Glass's position, though they have not announced similar withdrawals."
        ),
        "cleaned_content": (
            "Philip Glass, the acclaimed minimalist composer, has announced his withdrawal "
            "from an upcoming performance at the Kennedy Center. The decision comes amid growing "
            "controversy over federal arts funding cuts proposed by the current administration.\n\n"
            "Glass, 89, whose works include 'Einstein on the Beach' and the film scores for "
            "'The Hours' and 'Koyaanisqatsi', released a statement saying he could not in good "
            "conscience perform at a venue receiving federal funding while artists across the "
            "country face unprecedented budget reductions.\n\n"
            "The Kennedy Center, located in Washington D.C., is one of the nation's premier "
            "performing arts venues. The National Symphony Orchestra, which was set to accompany "
            "Glass, expressed disappointment but respect for his decision.\n\n"
            "Several other prominent artists, including Yo-Yo Ma and Renee Fleming, have voiced "
            "support for Glass's position, though they have not announced similar withdrawals."
        ),
        "summary": (
            "Composer Philip Glass pulls out of a Kennedy Center performance to protest "
            "federal arts funding cuts, drawing support from fellow artists."
        ),
        "categories": ["general", "world"],
        "reading_time_minutes": 3,
        "published_at": now - timedelta(hours=2),
        "source_index": 0,
    },
    {
        "title": "OpenAI Announces GPT-5 With Breakthrough Reasoning Capabilities",
        "url": "https://example.com/articles/openai-gpt5-announcement",
        "raw_content": (
            "OpenAI has officially unveiled GPT-5, its most advanced large language model to date, "
            "claiming significant breakthroughs in multi-step reasoning and factual accuracy. CEO "
            "Sam Altman presented the model at a press event in San Francisco.\n\n"
            "The new model reportedly scores 92% on graduate-level science benchmarks, "
            "up from GPT-4's 78%. Altman described it as 'the first model that can genuinely "
            "reason through complex problems rather than pattern-matching.'\n\n"
            "Competitors including Google DeepMind and Anthropic have been racing to develop "
            "similar capabilities. Google's Gemini Ultra 2 and Anthropic's Claude have both shown "
            "improvements in reasoning, but OpenAI claims GPT-5 sets a new bar.\n\n"
            "The model will be available to ChatGPT Plus subscribers starting next month, with "
            "API access following shortly after. Pricing has not yet been announced."
        ),
        "cleaned_content": (
            "OpenAI has officially unveiled GPT-5, its most advanced large language model to date, "
            "claiming significant breakthroughs in multi-step reasoning and factual accuracy. CEO "
            "Sam Altman presented the model at a press event in San Francisco.\n\n"
            "The new model reportedly scores 92% on graduate-level science benchmarks, "
            "up from GPT-4's 78%. Altman described it as 'the first model that can genuinely "
            "reason through complex problems rather than pattern-matching.'\n\n"
            "Competitors including Google DeepMind and Anthropic have been racing to develop "
            "similar capabilities. Google's Gemini Ultra 2 and Anthropic's Claude have both shown "
            "improvements in reasoning, but OpenAI claims GPT-5 sets a new bar.\n\n"
            "The model will be available to ChatGPT Plus subscribers starting next month, with "
            "API access following shortly after. Pricing has not yet been announced."
        ),
        "summary": (
            "OpenAI launches GPT-5 with major reasoning improvements, outscoring GPT-4 on "
            "science benchmarks. Available to subscribers next month."
        ),
        "categories": ["tech"],
        "reading_time_minutes": 4,
        "published_at": now - timedelta(hours=5),
        "source_index": 1,
    },
    {
        "title": "Federal Reserve Holds Interest Rates Steady, Signals Cuts Later This Year",
        "url": "https://example.com/articles/fed-interest-rates-hold",
        "raw_content": (
            "The Federal Reserve voted unanimously to hold its benchmark interest rate steady "
            "at 4.25-4.50%, in line with market expectations. Fed Chair Jerome Powell indicated "
            "that rate cuts remain on the table for later in 2026.\n\n"
            "In his press conference, Powell cited ongoing inflation concerns but acknowledged "
            "that the labor market has shown signs of cooling. The unemployment rate ticked up "
            "to 4.1% last month.\n\n"
            "Wall Street reacted positively to the announcement, with the S&P 500 rising 1.2% "
            "and the Nasdaq gaining 1.5%. Treasury yields fell slightly on expectations of "
            "future rate cuts.\n\n"
            "The European Central Bank faces a similar decision next week, with economists "
            "split on whether ECB President Christine Lagarde will signal a more dovish stance."
        ),
        "cleaned_content": (
            "The Federal Reserve voted unanimously to hold its benchmark interest rate steady "
            "at 4.25-4.50%, in line with market expectations. Fed Chair Jerome Powell indicated "
            "that rate cuts remain on the table for later in 2026.\n\n"
            "In his press conference, Powell cited ongoing inflation concerns but acknowledged "
            "that the labor market has shown signs of cooling. The unemployment rate ticked up "
            "to 4.1% last month.\n\n"
            "Wall Street reacted positively to the announcement, with the S&P 500 rising 1.2% "
            "and the Nasdaq gaining 1.5%. Treasury yields fell slightly on expectations of "
            "future rate cuts.\n\n"
            "The European Central Bank faces a similar decision next week, with economists "
            "split on whether ECB President Christine Lagarde will signal a more dovish stance."
        ),
        "summary": (
            "The Fed keeps rates at 4.25-4.50% as expected. Chair Powell hints at possible "
            "cuts later in 2026, boosting stocks."
        ),
        "categories": ["business"],
        "reading_time_minutes": 3,
        "published_at": now - timedelta(hours=8),
        "source_index": 2,
    },
    {
        "title": "NASA's Artemis III Moon Landing Pushed to Late 2027",
        "url": "https://example.com/articles/nasa-artemis-iii-delay",
        "raw_content": (
            "NASA has delayed the Artemis III crewed Moon landing mission to no earlier than "
            "late 2027, citing ongoing development challenges with SpaceX's Starship lunar "
            "lander. Administrator Bill Nelson emphasized that safety remains the top priority.\n\n"
            "The mission, which aims to land the first woman and first person of color on the "
            "Moon, has faced multiple delays since its original 2025 target. The Starship "
            "Human Landing System requires several more uncrewed test flights before NASA will "
            "certify it for astronauts.\n\n"
            "SpaceX CEO Elon Musk expressed confidence that Starship would be ready, pointing "
            "to recent successful orbital test flights. However, the vehicle's in-space "
            "refueling system remains unproven.\n\n"
            "China's competing lunar program continues to advance, with CNSA targeting a "
            "crewed landing by 2030. The growing space race has added political pressure to "
            "NASA's timeline."
        ),
        "cleaned_content": (
            "NASA has delayed the Artemis III crewed Moon landing mission to no earlier than "
            "late 2027, citing ongoing development challenges with SpaceX's Starship lunar "
            "lander. Administrator Bill Nelson emphasized that safety remains the top priority.\n\n"
            "The mission, which aims to land the first woman and first person of color on the "
            "Moon, has faced multiple delays since its original 2025 target. The Starship "
            "Human Landing System requires several more uncrewed test flights before NASA will "
            "certify it for astronauts.\n\n"
            "SpaceX CEO Elon Musk expressed confidence that Starship would be ready, pointing "
            "to recent successful orbital test flights. However, the vehicle's in-space "
            "refueling system remains unproven.\n\n"
            "China's competing lunar program continues to advance, with CNSA targeting a "
            "crewed landing by 2030. The growing space race has added political pressure to "
            "NASA's timeline."
        ),
        "summary": (
            "NASA pushes the Artemis III Moon landing to late 2027 due to SpaceX Starship "
            "development delays. China's lunar program adds competitive pressure."
        ),
        "categories": ["science", "tech"],
        "reading_time_minutes": 4,
        "published_at": now - timedelta(hours=12),
        "source_index": 2,
    },
]

# Entities with positions referencing cleaned_content of each article
ENTITIES_BY_ARTICLE = [
    # Article 0: Philip Glass
    [
        {
            "canonical_name": "Philip Glass",
            "entity_type": "PERSON",
            "wikidata_id": "Q189729",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Philip_Glass",
            "short_context": (
                "American composer known for minimalist music,"
                " including operas, symphonies, and film scores."
            ),
            "popularity_score": 85,
            "mention_text": "Philip Glass",
            "start_position": 0,
            "end_position": 12,
            "priority": "high",
        },
        {
            "canonical_name": "Kennedy Center",
            "entity_type": "ORG",
            "wikidata_id": "Q631289",
            "wikipedia_url": "https://en.wikipedia.org/wiki/John_F._Kennedy_Center_for_the_Performing_Arts",
            "short_context": (
                "The nation's premier performing arts center in"
                " Washington D.C., named after President John F. Kennedy."
            ),
            "popularity_score": 75,
            "mention_text": "Kennedy Center",
            "start_position": 92,
            "end_position": 106,
            "priority": "high",
        },
        {
            "canonical_name": "National Symphony Orchestra",
            "entity_type": "ORG",
            "wikidata_id": "Q1967952",
            "wikipedia_url": "https://en.wikipedia.org/wiki/National_Symphony_Orchestra_(United_States)",
            "short_context": (
                "Major American orchestra based at the Kennedy Center in Washington D.C."
            ),
            "popularity_score": 50,
            "mention_text": "National Symphony Orchestra",
            "start_position": 597,
            "end_position": 624,
            "priority": "medium",
        },
        {
            "canonical_name": "Yo-Yo Ma",
            "entity_type": "PERSON",
            "wikidata_id": "Q180278",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Yo-Yo_Ma",
            "short_context": (
                "French-born American cellist, considered one of the greatest cellists of all time."
            ),
            "popularity_score": 80,
            "mention_text": "Yo-Yo Ma",
            "start_position": 730,
            "end_position": 738,
            "priority": "medium",
        },
    ],
    # Article 1: OpenAI GPT-5
    [
        {
            "canonical_name": "OpenAI",
            "entity_type": "ORG",
            "wikidata_id": "Q21708200",
            "wikipedia_url": "https://en.wikipedia.org/wiki/OpenAI",
            "short_context": (
                "AI research company that created ChatGPT and the GPT series of language models."
            ),
            "popularity_score": 95,
            "mention_text": "OpenAI",
            "start_position": 0,
            "end_position": 6,
            "priority": "high",
        },
        {
            "canonical_name": "Sam Altman",
            "entity_type": "PERSON",
            "wikidata_id": "Q16030873",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Sam_Altman",
            "short_context": "CEO of OpenAI, former president of Y Combinator.",
            "popularity_score": 90,
            "mention_text": "Sam Altman",
            "start_position": 152,
            "end_position": 162,
            "priority": "high",
        },
        {
            "canonical_name": "Google DeepMind",
            "entity_type": "ORG",
            "wikidata_id": "Q15056543",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Google_DeepMind",
            "short_context": "Google's AI research lab, known for AlphaGo and Gemini.",
            "popularity_score": 85,
            "mention_text": "Google DeepMind",
            "start_position": 419,
            "end_position": 434,
            "priority": "medium",
        },
        {
            "canonical_name": "Anthropic",
            "entity_type": "ORG",
            "wikidata_id": "Q107096030",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Anthropic",
            "short_context": (
                "AI safety company founded by former OpenAI"
                " members, creator of the Claude AI assistant."
            ),
            "popularity_score": 80,
            "mention_text": "Anthropic",
            "start_position": 439,
            "end_position": 448,
            "priority": "medium",
        },
    ],
    # Article 2: Fed Interest Rates
    [
        {
            "canonical_name": "Federal Reserve",
            "entity_type": "ORG",
            "wikidata_id": "Q53536",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Federal_Reserve",
            "short_context": (
                "The central bank of the United States,"
                " responsible for monetary policy and interest rates."
            ),
            "popularity_score": 90,
            "mention_text": "Federal Reserve",
            "start_position": 4,
            "end_position": 19,
            "priority": "high",
        },
        {
            "canonical_name": "Jerome Powell",
            "entity_type": "PERSON",
            "wikidata_id": "Q6178961",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Jerome_Powell",
            "short_context": (
                "Chair of the Federal Reserve since 2018, overseeing U.S. monetary policy."
            ),
            "popularity_score": 85,
            "mention_text": "Jerome Powell",
            "start_position": 133,
            "end_position": 146,
            "priority": "high",
        },
        {
            "canonical_name": "S&P 500",
            "entity_type": "MISC",
            "wikidata_id": "Q199316",
            "wikipedia_url": "https://en.wikipedia.org/wiki/S%26P_500",
            "short_context": (
                "A stock market index tracking 500 of the largest"
                " U.S. public companies, widely used as a market benchmark."
            ),
            "popularity_score": 70,
            "mention_text": "S&P 500",
            "start_position": 440,
            "end_position": 447,
            "priority": "medium",
        },
        {
            "canonical_name": "Christine Lagarde",
            "entity_type": "PERSON",
            "wikidata_id": "Q182692",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Christine_Lagarde",
            "short_context": (
                "President of the European Central Bank since 2019, former head of the IMF."
            ),
            "popularity_score": 75,
            "mention_text": "Christine Lagarde",
            "start_position": 617,
            "end_position": 634,
            "priority": "medium",
        },
    ],
    # Article 3: NASA Artemis III
    [
        {
            "canonical_name": "NASA",
            "entity_type": "ORG",
            "wikidata_id": "Q23548",
            "wikipedia_url": "https://en.wikipedia.org/wiki/NASA",
            "short_context": (
                "The U.S. federal agency responsible for"
                " space exploration and aeronautics research."
            ),
            "popularity_score": 95,
            "mention_text": "NASA",
            "start_position": 0,
            "end_position": 4,
            "priority": "high",
        },
        {
            "canonical_name": "SpaceX",
            "entity_type": "ORG",
            "wikidata_id": "Q193701",
            "wikipedia_url": "https://en.wikipedia.org/wiki/SpaceX",
            "short_context": (
                "Private aerospace company founded by Elon Musk,"
                " developing rockets and the Starship vehicle."
            ),
            "popularity_score": 90,
            "mention_text": "SpaceX",
            "start_position": 123,
            "end_position": 129,
            "priority": "high",
        },
        {
            "canonical_name": "Bill Nelson",
            "entity_type": "PERSON",
            "wikidata_id": "Q357719",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Bill_Nelson",
            "short_context": "Administrator of NASA since 2021, former U.S. Senator from Florida.",
            "popularity_score": 60,
            "mention_text": "Bill Nelson",
            "start_position": 170,
            "end_position": 181,
            "priority": "medium",
        },
        {
            "canonical_name": "Elon Musk",
            "entity_type": "PERSON",
            "wikidata_id": "Q317521",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Elon_Musk",
            "short_context": "CEO of SpaceX and Tesla, one of the world's wealthiest people.",
            "popularity_score": 95,
            "mention_text": "Elon Musk",
            "start_position": 477,
            "end_position": 486,
            "priority": "high",
        },
    ],
]


async def seed() -> None:
    """Seed the database with sample data."""
    if IS_SQLITE:
        await create_tables()

    async with async_session() as session:
        # Check if already seeded
        from sqlalchemy import func, select

        count = (await session.execute(select(func.count()).select_from(Article))).scalar_one()
        if count > 0:
            print(f"Database already has {count} articles, skipping seed.")
            return

        # Create sources
        source_objs = []
        for s in SOURCES:
            source = Source(
                id=uuid.uuid4(),
                name=s["name"],
                feed_url=s["feed_url"],
                categories=s["categories"],
                credibility_score=s["credibility_score"],
            )
            session.add(source)
            source_objs.append(source)

        await session.flush()

        # Create articles and entities
        for i, article_data in enumerate(ARTICLES):
            article = Article(
                id=uuid.uuid4(),
                source_id=source_objs[article_data["source_index"]].id,
                url=article_data["url"],
                title=article_data["title"],
                raw_content=article_data["raw_content"],
                cleaned_content=article_data["cleaned_content"],
                summary=article_data["summary"],
                categories=article_data["categories"],
                reading_time_minutes=article_data["reading_time_minutes"],
                published_at=article_data["published_at"],
                processing_status="completed",
            )
            session.add(article)
            await session.flush()

            # Create entities for this article
            for entity_data in ENTITIES_BY_ARTICLE[i]:
                # Check if entity already exists (shared across articles)
                existing = (
                    await session.execute(
                        select(Entity).where(
                            Entity.canonical_name == entity_data["canonical_name"],
                            Entity.entity_type == entity_data["entity_type"],
                        )
                    )
                ).scalar_one_or_none()

                if existing:
                    entity = existing
                else:
                    entity = Entity(
                        id=uuid.uuid4(),
                        canonical_name=entity_data["canonical_name"],
                        entity_type=entity_data["entity_type"],
                        wikidata_id=entity_data["wikidata_id"],
                        wikipedia_url=entity_data["wikipedia_url"],
                        short_context=entity_data["short_context"],
                        popularity_score=entity_data["popularity_score"],
                    )
                    session.add(entity)
                    await session.flush()

                # Create article-entity link
                ae = ArticleEntity(
                    id=uuid.uuid4(),
                    article_id=article.id,
                    entity_id=entity.id,
                    mention_text=entity_data["mention_text"],
                    start_position=entity_data["start_position"],
                    end_position=entity_data["end_position"],
                    priority=entity_data["priority"],
                )
                session.add(ae)

        await session.commit()
        entity_count = sum(len(e) for e in ENTITIES_BY_ARTICLE)
        print(f"Seeded {len(ARTICLES)} articles, {entity_count} entity mentions.")


if __name__ == "__main__":
    asyncio.run(seed())
