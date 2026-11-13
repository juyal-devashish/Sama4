import type { Metadata } from "next";
import { storyPath } from "@/lib/routes";
import { getStory } from "@/lib/story";
import { metaDescription } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const article = await getStory(params.id);
  if (!article) return { title: "References" };
  return {
    title: `References: ${article.title}`,
    alternates: { canonical: `${storyPath(article.id)}/reference` },
    description: metaDescription(
      `Who and what is named in "${article.title}" (${article.source.name}), with a short sourced explanation of each.`,
    ),
  };
}

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
