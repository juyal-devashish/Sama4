import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/shell/Page";

export const metadata: Metadata = { title: "Page not found" };

/** Unknown URLs and stories that no longer exist. */
export default function NotFound() {
  return (
    <Page
      title="Page not found"
      description="This page or story doesn't exist. Stories can be removed when they leave the feed."
    >
      <Link href="/" className="btn-outline inline-flex">
        Back to today&apos;s stories
      </Link>
    </Page>
  );
}
