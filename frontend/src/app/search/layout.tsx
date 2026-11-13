import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Samā4's stories by headline, summary or source.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
