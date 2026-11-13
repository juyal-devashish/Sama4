/**
 * Reader URLs. A story's stable, shareable address is /article/{id}; the bare feed
 * is /. Other query params (such as `topic`) are carried over.
 */

export function storyPath(articleId: string): string {
  return `/article/${encodeURIComponent(articleId)}`;
}

/** The reader showing `articleId` (or no story when it's null), keeping `query`. */
export function readerHref(
  articleId: string | null | undefined,
  query?: URLSearchParams | string,
): string {
  const q = new URLSearchParams(query);
  q.delete("article"); // the old ?article= form; the id now lives in the path
  const path = articleId ? storyPath(articleId) : "/";
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}
