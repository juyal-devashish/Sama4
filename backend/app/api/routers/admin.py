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
