import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  alternates: { canonical: "/search" },
  description: "Search Samā4's stories by headline, summary, source or a name in the story.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
