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

/**
 * The reader around / and /article/[id]. As a layout it stays mounted when the story
 * changes, so the story list keeps its scroll position. Page 1 of the feed is fetched
 * here so the list is in the server-rendered HTML.
 */
export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  // A slow or failing backend must not block the page; the client fetches instead.
  const initialFeed = await api
    .getFeed({ page: 1, limit: 10 }, { revalidate: FEED_REVALIDATE, timeoutMs: 4000 })
    .catch(() => undefined);

  // No Suspense boundary: the page waits for its data before the first byte, so the
  // story is inline in the HTML and a missing story gets a real 404 status.
  return <Reader initialFeed={initialFeed}>{children}</Reader>;
}
