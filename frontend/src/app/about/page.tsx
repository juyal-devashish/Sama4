import type { Metadata } from "next";
import Link from "next/link";
import { BackToStories } from "@/components/shell/BackToStories";
import { Page } from "@/components/shell/Page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  path: "/about",
  description:
    "What Samā4 is, who makes it and how it's built: the news pipeline, entity linking and Claude.",
});

const LINK = "text-accent-secondary underline underline-offset-2";
const CONTACT_EMAIL = "djuyal23@gmail.com";

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

const SECTIONS: { id?: string; title: string; body: React.ReactNode }[] = [
  {
    title: "What Samā4 is",
    body: (
      <p>
        A news reader that explains the people, places, organizations and ideas a story takes for
        granted, right beside the text. Each night it picks the day&apos;s most consequential
        stories from ten outlets and highlights what a reader might not know.
      </p>
    ),
  },
  {
    title: "Who makes it",
    body: (
      <p>
        Samā4 is made by Devashish Juyal and Shreyas Methi. See{" "}
        <a href="#contact" className={LINK}>
          how to reach us
        </a>{" "}
        for corrections and publisher requests.
      </p>
    ),
  },
  {
    title: "How it's built",
    body: (
      <>
        <p>
          Stories come from publishers&apos; public RSS feeds (see{" "}
          <Link href="/sources" className={LINK}>
            every source
          </Link>
          ). Near-duplicate stories are merged with MinHash. Names, places and ideas are found with
          spaCy and linked to Wikidata and Wikipedia. Pinecone and Redis handle retrieval and
          caching, and Anthropic&apos;s Claude writes the summaries and explanations (
          <Link href="/how-explanations-work" className={LINK}>
            how explanations are made
          </Link>
          ).
        </p>
        <p>
          The web app is Next.js; the API and the nightly pipeline are Python (FastAPI). How your
          data is handled is on the{" "}
          <Link href="/privacy" className={LINK}>
            privacy page
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>
          Found a mistake in a summary or an explanation? Use <em>Report an error</em> under the
          explanation, or write to us.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a href={mail("Samā4 correction")} className={LINK}>
              Send a correction
            </a>
          </li>
          <li>
            <a href={mail("Samā4 publisher request")} className={LINK}>
              Make a publisher request
            </a>{" "}
            (to remove a feed or story)
          </li>
        </ul>
        <p>
          Both go to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <Page title="About" description="What Samā4 is, who makes it and how it's built.">
      <div className="max-w-[62ch] space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.title} id={s.id} className="scroll-mt-6">
            <h2 className="font-editorial text-[24px] leading-tight tracking-[-0.02em]">
              {s.title}
            </h2>
            <div className="mt-2 space-y-3 text-[17px] leading-[1.65] text-text-secondary">
              {s.body}
            </div>
          </section>
        ))}
        <BackToStories />
      </div>
    </Page>
  );
}
