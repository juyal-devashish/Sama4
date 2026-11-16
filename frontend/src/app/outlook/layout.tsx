import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Outlook",
  path: "/outlook",
  description:
    "AI-generated projections of what might happen next in today's stories. They are estimates, not confirmed events.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
