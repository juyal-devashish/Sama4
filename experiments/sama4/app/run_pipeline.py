"""Manually run the ingestion pipeline (for testing/dev)."""

import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


async def main() -> None:
    from app.database import IS_SQLITE, create_tables

    if IS_SQLITE:
        await create_tables()

    from app.ingestion.pipeline import IngestionPipeline

    pipeline = IngestionPipeline()
    count = await pipeline.run()
    print(f"\nDone. Processed {count} new articles.")


if __name__ == "__main__":
    asyncio.run(main())
