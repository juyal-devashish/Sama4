import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Search",
  path: "/search",
  description: "Search Samā4's stories by headline, summary, source or a name in the story.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
