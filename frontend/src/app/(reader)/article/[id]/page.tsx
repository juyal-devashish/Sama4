import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderStory } from "@/components/reader/Reader";
import { getStory } from "@/lib/story";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getStory(params.id);
  return { title: article?.title ?? "Story" };
}

/**
 * A story's stable, shareable URL: the reader with this story open. The story is
 * fetched on the server so its headline, summary and source are in the HTML.
 */
export default async function ArticlePage({ params }: Props) {
  const article = await getStory(params.id);
  if (article === null) notFound();
  return <ReaderStory articleId={params.id} initialArticle={article} />;
}
