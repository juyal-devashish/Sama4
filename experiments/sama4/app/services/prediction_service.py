"""PredictionService — orchestrates MiroFish simulations for articles."""

import json
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.article import Article
from app.models.prediction import AgentPerspective, Prediction
from app.models.source import Source
from app.services.cache_service import CacheService
from app.services.llm_service import LLMService
from app.services.mirofish_service import MirofishClient

logger = logging.getLogger(__name__)


class PredictionService:
    """Orchestrates the full MiroFish prediction pipeline for articles."""

    def __init__(self) -> None:
        self.mirofish = MirofishClient()
        self.cache = CacheService()
        self.llm = LLMService()

    async def trigger_simulation(
        self,
        article: Article,
        db: AsyncSession,
        agent_count: int | None = None,
        simulation_rounds: int | None = None,
        platforms: list[str] | None = None,
        prediction_focus: str | None = None,
    ) -> Prediction:
        """Trigger a MiroFish simulation for an article.

        Creates the Prediction record and kicks off the async pipeline.
        """
        # Check if prediction already exists for this article
        existing = await db.execute(
            select(Prediction).where(
                Prediction.article_id == article.id,
                Prediction.status.in_(["queued", "building_graph", "simulating", "generating_report", "completed"]),
            )
        )
        if pred := existing.scalar_one_or_none():
            return pred

        prediction = Prediction(
            article_id=article.id,
            agent_count=agent_count or settings.mirofish_default_agents,
            simulation_rounds=simulation_rounds or settings.mirofish_default_rounds,
            platforms=platforms or ["twitter", "reddit"],
            status="queued",
        )
        db.add(prediction)
        await db.flush()

        return prediction

    async def run_simulation_pipeline(self, prediction_id: str, db: AsyncSession) -> None:
        """Execute the full MiroFish simulation pipeline.

        Steps: upload seed → build graph → setup env → run simulation → extract report.
        Called as a background task.
        """
        prediction = await db.get(Prediction, prediction_id)
        if not prediction:
            logger.error("Prediction %s not found", prediction_id)
            return

        article = await db.get(Article, prediction.article_id)
        if not article:
            prediction.status = "failed"
            prediction.error_message = "Article not found"
            await db.commit()
            return

        # Check MiroFish availability
        is_healthy = await self.mirofish.health_check()

        if is_healthy:
            await self._run_with_mirofish(prediction, article, db)
        else:
            # Fallback: use LLM to generate synthetic prediction
            logger.warning("MiroFish unavailable — using LLM fallback for prediction %s", prediction_id)
            await self._run_llm_fallback(prediction, article, db)

    async def _run_with_mirofish(
        self, prediction: Prediction, article: Article, db: AsyncSession
    ) -> None:
        """Run prediction through the real MiroFish engine."""
        try:
            # Step 1: Upload seed material
            prediction.status = "building_graph"
            await db.commit()

            content = article.cleaned_content or article.raw_content or article.summary or ""
            metadata = {
                "source": "samā4 news platform",
                "published_at": str(article.published_at) if article.published_at else "",
                "categories": ", ".join(article.categories) if article.categories else "",
            }
            upload_result = await self.mirofish.upload_seed_material(
                title=article.title, content=content, metadata=metadata
            )
            project_id = upload_result.get("project_id", upload_result.get("id", ""))
            prediction.mirofish_project_id = project_id

            # Step 2: Build knowledge graph
            await self.mirofish.build_knowledge_graph(project_id)

            # Step 3: Setup simulation
            prediction.status = "simulating"
            await db.commit()

            setup_result = await self.mirofish.setup_simulation(
                project_id=project_id,
                agent_count=prediction.agent_count,
                rounds=prediction.simulation_rounds,
                platforms=prediction.platforms,
                prediction_focus=f"Predict public reaction and future developments regarding: {article.title}",
            )
            config_id = setup_result.get("config_id", setup_result.get("id"))

            # Step 4: Run simulation
            sim_result = await self.mirofish.run_simulation(project_id, config_id)
            simulation_id = sim_result.get("simulation_id", sim_result.get("id", ""))
            prediction.mirofish_simulation_id = simulation_id

            # Step 5: Get report
            prediction.status = "generating_report"
            await db.commit()

            report = await self.mirofish.get_report(simulation_id)
            await self._process_mirofish_report(prediction, report, db)

        except Exception as e:
            logger.error("MiroFish simulation failed for prediction %s: %s", prediction.id, e, exc_info=True)
            # Fall back to LLM
            logger.info("Falling back to LLM prediction for %s", prediction.id)
            await self._run_llm_fallback(prediction, article, db)

    async def _run_llm_fallback(
        self, prediction: Prediction, article: Article, db: AsyncSession
    ) -> None:
        """Generate a synthetic prediction using LLM when MiroFish is unavailable."""
        try:
            prediction.status = "generating_report"
            await db.commit()

            content = article.cleaned_content or article.summary or article.title
            # Truncate to fit token limits
            content = content[:4000]

            prompt = f"""You are a multi-perspective news analyst simulating how different stakeholders would react to a news story. Analyze this article and predict future developments.

ARTICLE TITLE: {article.title}

ARTICLE CONTENT:
{content}

---

Provide your analysis in the following JSON format:
{{
  "prediction_summary": "A 2-3 sentence summary of what is likely to happen next",
  "key_findings": ["finding 1", "finding 2", "finding 3", "finding 4", "finding 5"],
  "predicted_outcomes": ["outcome 1 (most likely)", "outcome 2 (possible)", "outcome 3 (less likely)"],
  "sentiment_distribution": {{"positive": 35, "negative": 40, "neutral": 25}},
  "confidence_score": 0.72,
  "impact_score": 75,
  "agent_perspectives": [
    {{
      "agent_name": "Name",
      "agent_role": "Role (e.g. economist, policy analyst, tech industry insider, affected citizen)",
      "agent_persona": "Brief 1-sentence persona description",
      "stance": "positive/negative/neutral/mixed",
      "perspective_text": "2-3 sentences from this agent's viewpoint",
      "key_argument": "Their main argument in one sentence",
      "influence_score": 75,
      "sentiment_score": 0.3
    }}
  ]
}}

Generate exactly 5 diverse agent perspectives covering different stakeholder viewpoints.
Return ONLY valid JSON, no markdown code blocks."""

            raw_response = await self.llm.generate(
                prompt, model="gpt-4o-mini", max_tokens=2000, temperature=0.7
            )

            # Parse the JSON response
            # Strip markdown code blocks if present
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)

            prediction.prediction_summary = data.get("prediction_summary", "")
            prediction.key_findings = data.get("key_findings", [])
            prediction.predicted_outcomes = data.get("predicted_outcomes", [])
            prediction.sentiment_distribution = json.dumps(data.get("sentiment_distribution", {}))
            prediction.confidence_score = data.get("confidence_score", 0.7)
            prediction.impact_score = data.get("impact_score", 50)

            # Create agent perspectives
            for ap_data in data.get("agent_perspectives", []):
                perspective = AgentPerspective(
                    prediction_id=prediction.id,
                    agent_name=ap_data.get("agent_name", "Analyst"),
                    agent_role=ap_data.get("agent_role", "general analyst"),
                    agent_persona=ap_data.get("agent_persona"),
                    stance=ap_data.get("stance", "neutral"),
                    perspective_text=ap_data.get("perspective_text", ""),
                    key_argument=ap_data.get("key_argument"),
                    influence_score=ap_data.get("influence_score", 50),
                    sentiment_score=ap_data.get("sentiment_score"),
                )
                db.add(perspective)

            prediction.status = "completed"
            prediction.completed_at = datetime.now(UTC)
            await db.commit()

            # Cache the result
            await self.cache.set(
                f"prediction:article:{prediction.article_id}",
                {"prediction_id": str(prediction.id), "status": "completed"},
                ttl=settings.prediction_cache_ttl,
            )

        except Exception as e:
            logger.error("LLM fallback failed for prediction %s: %s", prediction.id, e, exc_info=True)
            prediction.status = "failed"
            prediction.error_message = str(e)
            await db.commit()

    async def _process_mirofish_report(
        self, prediction: Prediction, report: dict, db: AsyncSession
    ) -> None:
        """Extract structured data from a MiroFish report and store it."""
        # Use LLM to structure the raw report into our schema
        report_text = json.dumps(report) if isinstance(report, dict) else str(report)
        report_text = report_text[:6000]  # truncate for token limits

        prompt = f"""Extract structured prediction data from this MiroFish simulation report.

REPORT:
{report_text}

Return JSON with:
{{
  "prediction_summary": "2-3 sentence summary of the key prediction",
  "key_findings": ["finding 1", "finding 2", ...],
  "predicted_outcomes": ["most likely outcome", "possible outcome", ...],
  "sentiment_distribution": {{"positive": %, "negative": %, "neutral": %}},
  "confidence_score": 0.0-1.0,
  "impact_score": 0-100,
  "agent_perspectives": [
    {{
      "agent_name": "Name",
      "agent_role": "Role",
      "stance": "positive/negative/neutral/mixed",
      "perspective_text": "Their view",
      "key_argument": "Main point",
      "influence_score": 0-100,
      "sentiment_score": -1.0 to 1.0
    }}
  ]
}}

Return ONLY valid JSON."""

        raw = await self.llm.generate(prompt, model="gpt-4o-mini", max_tokens=2000, temperature=0.3)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]

        data = json.loads(cleaned.strip())

        prediction.prediction_summary = data.get("prediction_summary", "")
        prediction.key_findings = data.get("key_findings", [])
        prediction.predicted_outcomes = data.get("predicted_outcomes", [])
        prediction.sentiment_distribution = json.dumps(data.get("sentiment_distribution", {}))
        prediction.confidence_score = data.get("confidence_score", 0.7)
        prediction.impact_score = data.get("impact_score", 50)

        for ap_data in data.get("agent_perspectives", []):
            db.add(AgentPerspective(
                prediction_id=prediction.id,
                agent_name=ap_data.get("agent_name", "Agent"),
                agent_role=ap_data.get("agent_role", "analyst"),
                stance=ap_data.get("stance", "neutral"),
                perspective_text=ap_data.get("perspective_text", ""),
                key_argument=ap_data.get("key_argument"),
                influence_score=ap_data.get("influence_score", 50),
                sentiment_score=ap_data.get("sentiment_score"),
            ))

        prediction.status = "completed"
        prediction.completed_at = datetime.now(UTC)
        await db.commit()

        await self.cache.set(
            f"prediction:article:{prediction.article_id}",
            {"prediction_id": str(prediction.id), "status": "completed"},
            ttl=settings.prediction_cache_ttl,
        )

    async def get_prediction_for_article(
        self, article_id: str, db: AsyncSession
    ) -> Prediction | None:
        """Get the latest prediction for an article."""
        result = await db.execute(
            select(Prediction)
            .where(Prediction.article_id == article_id)
            .options(selectinload(Prediction.agent_perspectives))
            .order_by(Prediction.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_trending_predictions(
        self, db: AsyncSession, limit: int = 20
    ) -> list[dict]:
        """Get top predictions by impact score for the trending tab."""
        result = await db.execute(
            select(Prediction, Article, Source)
            .join(Article, Prediction.article_id == Article.id)
            .outerjoin(Source, Article.source_id == Source.id)
            .where(Prediction.status == "completed")
            .order_by(Prediction.impact_score.desc(), Prediction.completed_at.desc())
            .limit(limit)
        )

        trending = []
        for pred, article, source in result.all():
            trending.append({
                "id": pred.id,
                "article_id": article.id,
                "article_title": article.title,
                "article_image_url": article.image_url,
                "article_source": source.name if source else "Unknown",
                "prediction_summary": pred.prediction_summary,
                "key_findings": pred.key_findings or [],
                "impact_score": pred.impact_score,
                "confidence_score": pred.confidence_score,
                "agent_count": pred.agent_count,
                "completed_at": pred.completed_at,
            })
        return trending

    async def chat_with_prediction(
        self, prediction: Prediction, message: str, history: list[dict]
    ) -> str:
        """Chat with a prediction report — uses MiroFish if available, else LLM."""
        # Try MiroFish first
        if prediction.mirofish_simulation_id:
            try:
                is_healthy = await self.mirofish.health_check()
                if is_healthy:
                    result = await self.mirofish.chat_with_report(
                        prediction.mirofish_simulation_id, message, history
                    )
                    return result.get("response", result.get("message", str(result)))
            except Exception:
                logger.warning("MiroFish chat failed, using LLM fallback")

        # LLM fallback: use prediction data as context
        context = f"""PREDICTION REPORT:
Summary: {prediction.prediction_summary}
Key Findings: {', '.join(prediction.key_findings or [])}
Predicted Outcomes: {', '.join(prediction.predicted_outcomes or [])}
Sentiment: {prediction.sentiment_distribution}
Confidence: {prediction.confidence_score}"""

        history_text = "\n".join(
            f"{msg['role'].upper()}: {msg['content']}" for msg in history[-6:]
        )

        prompt = f"""You are an AI analyst discussing a news prediction report. Use the report data to answer questions.

{context}

CONVERSATION HISTORY:
{history_text}

USER QUESTION: {message}

Answer concisely based on the prediction data. If speculating beyond the data, say so."""

        return await self.llm.generate(prompt, model="gpt-4o-mini", max_tokens=500, temperature=0.5)

    async def interview_agent(
        self, prediction: Prediction, perspective: AgentPerspective, question: str
    ) -> str:
        """Interview a specific agent perspective — uses MiroFish if available, else LLM."""
        if prediction.mirofish_simulation_id:
            try:
                is_healthy = await self.mirofish.health_check()
                if is_healthy:
                    result = await self.mirofish.interview_agent(
                        prediction.mirofish_simulation_id,
                        perspective.agent_name,
                        question,
                    )
                    responses = result.get("responses", [result])
                    if responses:
                        return responses[0].get("response", str(responses[0]))
            except Exception:
                logger.warning("MiroFish interview failed, using LLM fallback")

        # LLM fallback
        prompt = f"""You are role-playing as {perspective.agent_name}, a {perspective.agent_role}.

YOUR PERSONA: {perspective.agent_persona or f'A {perspective.agent_role} with a {perspective.stance} stance on this topic.'}

YOUR ESTABLISHED VIEWPOINT:
{perspective.perspective_text}

YOUR KEY ARGUMENT: {perspective.key_argument or 'N/A'}

---

A journalist asks you: "{question}"

Respond in character, staying true to your established viewpoint and role. Keep your response under 150 words."""

        return await self.llm.generate(prompt, model="gpt-4o-mini", max_tokens=300, temperature=0.6)
