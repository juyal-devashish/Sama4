"""MiroFish HTTP client — communicates with the MiroFish backend API."""

import logging
from pathlib import Path
from tempfile import NamedTemporaryFile

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class MirofishClient:
    """Async HTTP client for MiroFish simulation engine."""

    def __init__(self) -> None:
        self.base_url = settings.mirofish_url.rstrip("/")
        self.timeout = httpx.Timeout(
            connect=10.0,
            read=float(settings.mirofish_simulation_timeout),
            write=30.0,
            pool=10.0,
        )

    async def health_check(self) -> bool:
        """Check if MiroFish backend is reachable."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                resp = await client.get(f"{self.base_url}/api/health")
                return resp.status_code == 200
        except Exception:
            logger.warning("MiroFish is not reachable at %s", self.base_url)
            return False

    async def upload_seed_material(
        self, title: str, content: str, metadata: dict | None = None
    ) -> dict:
        """Upload article text as seed material for simulation.

        Creates a temporary markdown file and uploads it to MiroFish.
        Returns project/document reference.
        """
        # MiroFish accepts file uploads — create a temp markdown file
        md_content = f"# {title}\n\n{content}"
        if metadata:
            md_content = (
                f"---\n"
                + "\n".join(f"{k}: {v}" for k, v in metadata.items())
                + f"\n---\n\n{md_content}"
            )

        with NamedTemporaryFile(suffix=".md", delete=False, mode="w") as f:
            f.write(md_content)
            temp_path = Path(f.name)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                with open(temp_path, "rb") as f:
                    resp = await client.post(
                        f"{self.base_url}/api/graph/upload",
                        files={"file": (f"{title[:50]}.md", f, "text/markdown")},
                    )
                    resp.raise_for_status()
                    return resp.json()
        finally:
            temp_path.unlink(missing_ok=True)

    async def build_knowledge_graph(self, project_id: str) -> dict:
        """Trigger GraphRAG knowledge graph construction."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/graph/build",
                json={"project_id": project_id},
            )
            resp.raise_for_status()
            return resp.json()

    async def setup_simulation(
        self,
        project_id: str,
        agent_count: int = 500,
        rounds: int = 30,
        platforms: list[str] | None = None,
        prediction_focus: str | None = None,
    ) -> dict:
        """Configure simulation environment — generate agent personas."""
        payload = {
            "project_id": project_id,
            "agent_count": agent_count,
            "rounds": rounds,
            "platforms": platforms or ["twitter", "reddit"],
        }
        if prediction_focus:
            payload["prediction_requirement"] = prediction_focus

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/simulation/setup",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def run_simulation(self, project_id: str, config_id: str | None = None) -> dict:
        """Start the multi-agent simulation. Returns simulation_id for tracking."""
        payload = {"project_id": project_id}
        if config_id:
            payload["config_id"] = config_id

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/simulation/run",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_simulation_status(self, simulation_id: str) -> dict:
        """Poll simulation progress."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(
                f"{self.base_url}/api/simulation/{simulation_id}/status",
            )
            resp.raise_for_status()
            return resp.json()

    async def get_report(self, simulation_id: str) -> dict:
        """Retrieve the generated prediction report."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(
                f"{self.base_url}/api/report/{simulation_id}",
            )
            resp.raise_for_status()
            return resp.json()

    async def chat_with_report(
        self, simulation_id: str, message: str, history: list[dict] | None = None
    ) -> dict:
        """Interact with the prediction report conversationally."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/report/chat",
                json={
                    "report_id": simulation_id,
                    "message": message,
                    "history": history or [],
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def interview_agent(
        self, simulation_id: str, agent_id: str, question: str
    ) -> dict:
        """Interview a specific simulated agent."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/report/interview",
                json={
                    "report_id": simulation_id,
                    "agent_ids": [agent_id],
                    "question": question,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def query_graph(self, project_id: str, query: str) -> dict:
        """Query the MiroFish knowledge graph for entity context enrichment."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(
                f"{self.base_url}/api/graph/query",
                json={"project_id": project_id, "query": query},
            )
            resp.raise_for_status()
            return resp.json()
