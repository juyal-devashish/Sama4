import type { Metadata } from "next";
import { getStory } from "@/lib/story";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const article = await getStory(params.id);
  return { title: article ? `References: ${article.title}` : "References" };
}

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
