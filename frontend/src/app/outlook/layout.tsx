import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outlook",
  alternates: { canonical: "/outlook" },
  description:
    "AI-generated projections of what might happen next in today's stories. They are estimates, not confirmed events.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
