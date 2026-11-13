import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  alternates: { canonical: "/search" },
  description: "Search Samā4's stories by headline, summary or source.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
