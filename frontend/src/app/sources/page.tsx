import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/shell/Page";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Sources",
  alternates: { canonical: "/sources" },
  description: "Every news outlet and RSS feed Samā4 reads each night to build its daily edition.",
};

/** The feed list changes only with a deploy; an hour of caching is plenty. */
export const revalidate = 3600;

const REGION: Record<string, string> = {
  us: "United States",
  india: "India",
  world: "World",
  tech: "Technology",
};

export default async function SourcesPage() {
  const data = await api.getSources({ revalidate, timeoutMs: 4000 }).catch(() => null);

  return (
    <Page
      title="Sources"
      description="Every outlet and feed Samā4 reads each night. Every story links to its original article."
    >
      {!data ? (
        <p className="text-[17px] text-text-secondary" role="status">
          The list of sources couldn&apos;t load right now. Please try again later.
        </p>
      ) : (
        <div className="max-w-[72ch]">
          <p className="label-ui text-text-tertiary">
            {data.outlets.length} outlets · {data.feed_count} RSS feeds
          </p>
          <ul className="mt-4 divide-y divide-divider border-y border-border">
            {data.outlets.map((outlet) => (
              <li key={outlet.name} className="py-5">
                <h2 className="font-editorial text-[22px] leading-tight tracking-[-0.01em]">
                  {outlet.name}
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {outlet.feeds.map((feed) => (
                    <li key={feed.url} className="text-[15px] text-text-secondary">
                      <span className="label-ui mr-2 text-text-tertiary">
                        {REGION[feed.region] ?? feed.region}
                      </span>
                      <a
                        href={feed.url}
                        className="break-all text-accent-secondary underline underline-offset-2"
                        rel="noopener noreferrer"
                      >
                        {feed.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-9">
        <Link href="/about" className="label-ui link-ui font-bold text-accent-secondary">
          About Samā4
        </Link>
      </p>
    </Page>
  );
}
