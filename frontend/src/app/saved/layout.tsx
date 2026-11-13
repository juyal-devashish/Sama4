import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved stories",
  alternates: { canonical: "/saved" },
  description: "Stories you saved to read later on Samā4. They stay in this browser.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
