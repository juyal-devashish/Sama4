import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/shell/Page";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page or story doesn't exist on Samā4.",
};

/** Unknown URLs and stories that no longer exist. */
export default function NotFound() {
  return (
    <Page
      title="Page not found"
      description="This page or story doesn't exist. Stories can be removed when they leave the feed."
    >
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn-outline inline-flex">
          Back to today&apos;s stories
        </Link>
        <Link href="/search" className="btn-outline inline-flex">
          Search stories
        </Link>
      </div>
    </Page>
  );
}
