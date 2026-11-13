import { ReaderStory } from "@/components/reader/Reader";

/** A story's stable, shareable URL: the reader with this story open. */
export default function ArticlePage({ params }: { params: { id: string } }) {
  return <ReaderStory articleId={params.id} />;
}
