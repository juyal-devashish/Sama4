"""Admin operations. Every route requires the X-Admin-Secret header (see deps.require_admin)."""

from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel

from app.api.deps import AdminOnly, ContainerDep
from app.ingestion import jobs

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
    return MentionRepairResponse(**vars(report))
