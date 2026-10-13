import logging
from dataclasses import dataclass

from app.ingestion.ner import ExtractedEntity
from app.services.entity_service import EntityService

logger = logging.getLogger(__name__)


@dataclass
class LinkedEntity:
    """An entity linked to Wikidata and Wikipedia."""

    text: str
    type: str
    start: int
    end: int
    in_title: bool
    priority: str
    wikidata_id: str | None
    wikipedia_url: str | None
    description: str | None


class EntityLinker:
    """Links extracted entities to Wikidata and Wikipedia."""

    def __init__(self) -> None:
        self.service = EntityService()

    async def link_entity(self, entity: ExtractedEntity) -> LinkedEntity:
        """Link an extracted entity to external knowledge bases.

        Args:
            entity: The extracted entity to link.

        Returns:
            LinkedEntity with external IDs and descriptions.
        """
        wikidata_id = await self.service.search_wikidata(entity.text)

        wikipedia_url = None
        description = None

        if wikidata_id:
            wikipedia_url = await self.service.get_wikipedia_url(wikidata_id)
            description = await self.service.get_wikipedia_extract(wikipedia_url or "")

        return LinkedEntity(
            text=entity.text,
            type=entity.type,
            start=entity.start,
            end=entity.end,
            in_title=entity.in_title,
            priority=entity.priority,
            wikidata_id=wikidata_id,
            wikipedia_url=wikipedia_url,
            description=description,
        )

    async def link_entities(self, entities: list[ExtractedEntity]) -> list[LinkedEntity]:
        """Link a batch of entities.

        Args:
            entities: List of extracted entities.

        Returns:
            List of linked entities.
        """
        linked = []
        for entity in entities:
            try:
                result = await self.link_entity(entity)
                linked.append(result)
            except Exception:
                logger.error(f"Failed to link entity: {entity.text}", exc_info=True)
        return linked
