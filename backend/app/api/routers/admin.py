"""Admin operations. Every route requires the X-Admin-Secret header (see deps.require_admin)."""

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from app.api.deps import AdminOnly, ContainerDep, DbSession
from app.ingestion import canonicalize as entity_cleanup
from app.ingestion import jobs

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[AdminOnly])


class AdminResponse(BaseModel):
    message: str
    status: str


@router.post("/pipeline/run", response_model=AdminResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline(background_tasks: BackgroundTasks, c: ContainerDep) -> AdminResponse:
    """Run the ingestion pipeline now (in the background)."""
    background_tasks.add_task(jobs.run_ingestion, c)
    return AdminResponse(message="Pipeline started in the background.", status="accepted")


@router.post("/seed", response_model=AdminResponse, status_code=status.HTTP_200_OK)
async def seed_database() -> AdminResponse:
    """Insert sample articles and entities. No-op if articles already exist."""
    from app.seed import seed

    await seed()
    return AdminResponse(message="Seed complete (skipped if data already existed).", status="ok")


@router.post(
    "/summaries/regenerate", response_model=AdminResponse, status_code=status.HTTP_202_ACCEPTED
)
async def regenerate_summaries(background_tasks: BackgroundTasks, c: ContainerDep) -> AdminResponse:
    """Rewrite every summary with the current prompt (run after changing the prompt)."""
    background_tasks.add_task(jobs.regenerate_summaries, c)
    return AdminResponse(
        message="Summary regeneration started in the background.", status="accepted"
    )


class MentionRepairResponse(BaseModel):
    total: int
    aligned: int
    relocated: int
    unlocatable: int
    deleted: int
    dry_run: bool


@router.post("/mentions/repair", response_model=MentionRepairResponse)
async def repair_mentions(
    dry_run: bool = True, delete_unlocatable: bool = False
) -> MentionRepairResponse:
    """Fix stored highlight offsets that don't point at their mention text.

    Dry run by default. Pass dry_run=false to write; add delete_unlocatable=true to
    also remove mentions whose text isn't in the article (irreversible).
    """
    report = await jobs.repair_mention_offsets(
        dry_run=dry_run, delete_unlocatable=delete_unlocatable
    )
    if report is None:
        # Never let a failure look like "nothing to repair".
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Mention repair failed; nothing was changed."
        )
    return MentionRepairResponse(**vars(report))


class EntityCleanupResponse(BaseModel):
    entities: int
    renamed: int
    retyped: int
    merged: int
    mentions_fixed: int
    mentions_dropped: int
    typed_by_claude: bool
    dry_run: bool
    changes: list[str]


@router.post("/entities/canonicalize", response_model=EntityCleanupResponse)
async def canonicalize_entities(
    db: DbSession, c: ContainerDep, dry_run: bool = True, retype: bool = True
) -> EntityCleanupResponse:
    """Merge possessive duplicates ("Jensen Huang's") and fix wrong types ("Nvidia" as a place).

    Dry run by default: the report lists what would change (first 50). Pass dry_run=false
    to write. retype=true asks Claude to type every entity name (one call per 100 names).
    """
    try:
        report = await entity_cleanup.canonicalize_entities(
            db, c.llm, dry_run=dry_run, retype=retype
        )
    except Exception as exc:
        logger.error("Entity cleanup failed", exc_info=True)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Entity cleanup failed; nothing was changed."
        ) from exc
    return EntityCleanupResponse(**vars(report))
