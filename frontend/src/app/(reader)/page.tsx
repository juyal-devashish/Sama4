import type { Metadata } from "next";
import { NoStorySelected } from "@/components/reader/Reader";

// ?topic= and other query variants are the same page.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Today: the story list (from the layout) with no story open yet. */
export default function TodayPage() {
  return <NoStorySelected />;
}
