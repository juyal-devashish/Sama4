import { notFound } from "next/navigation";
import { ReaderStory } from "@/components/reader/Reader";
import { ApiError, api } from "@/lib/api";

/** How long the server keeps a story before asking the backend again (seconds). */
const ARTICLE_REVALIDATE = 300;

/**
 * A story's stable, shareable URL: the reader with this story open. The story is
 * fetched on the server so its headline, summary and source are in the HTML.
 */
export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await api
    .getArticle(params.id, { revalidate: ARTICLE_REVALIDATE, timeoutMs: 4000 })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.isNotFound) notFound();
      // Slow or failing backend: render anyway and let the client fetch.
      return undefined;
    });

  return <ReaderStory articleId={params.id} initialArticle={article} />;
}
