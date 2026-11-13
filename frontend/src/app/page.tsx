import { Suspense } from "react";
import { Reader } from "@/components/reader/Reader";
import { api } from "@/lib/api";

/**
 * Render per request so the Reader's useSearchParams runs on the server instead of
 * bailing out to client rendering, which left the story list out of the HTML.
 * The backend call is still cached (FEED_REVALIDATE); force-dynamic doesn't override
 * a fetch's explicit revalidate.
 */
export const dynamic = "force-dynamic";

/** How long the server keeps the feed before asking the backend again (seconds). */
const FEED_REVALIDATE = 300;

/** The Today feed, rendered on the server so the story list is in the HTML. */
export default async function TodayPage() {
  // A slow or failing backend must not block the page; the client fetches instead.
  const initialFeed = await api
    .getFeed({ page: 1, limit: 10 }, { revalidate: FEED_REVALIDATE, timeoutMs: 4000 })
    .catch(() => undefined);

  return (
    <Suspense>
      <Reader initialFeed={initialFeed} />
    </Suspense>
  );
}
