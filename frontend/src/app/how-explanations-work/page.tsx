import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/shell/Page";

export const metadata: Metadata = {
  title: "How explanations are made",
  alternates: { canonical: "/how-explanations-work" },
  description:
    "How Samā4 picks the terms it highlights, what Claude is given to explain them, how sources and dates are shown, and how to report a mistake.",
};

const LINK = "text-accent-secondary underline underline-offset-2";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Which terms get highlighted",
    body: (
      <p>
        When a story comes in, spaCy, a language-processing library, finds the names of people,
        organizations and places in it. Claude then reads the story, gives each name its type and
        adds the ideas and events a general reader probably wouldn&apos;t know. Very familiar names
        are left out. Each term is linked to its Wikidata entry and Wikipedia article where one
        exists.
      </p>
    ),
  },
  {
    title: "What Claude is given",
    body: (
      <>
        <p>
          The first time anyone opens a term, Samā4 asks Anthropic&apos;s Claude for a two or three
          sentence explanation. Claude gets the term, the opening of its Wikipedia article, and the
          passage of the most recent story that mentions it, about 300 characters on each side.
          It&apos;s asked to say what or who the term is and why it matters to that story, in plain,
          neutral language.
        </p>
        <p>
          The explanation is kept for 24 hours and then written again, so it can pick up a newer
          story. If Claude isn&apos;t available, you see the opening of the Wikipedia article
          instead, labelled as coming from Wikipedia.
        </p>
      </>
    ),
  },
  {
    title: "Sources and dates",
    body: (
      <p>
        Under every explanation, Samā4 lists what it was written from, with links: the story and the
        Wikipedia article. A source is listed only if its text was actually given to Claude. The
        date shows when the explanation was written, and &ldquo;version used&rdquo; opens the exact
        revision of the Wikipedia article, since Wikipedia changes. Samā4 keeps a permanent record
        of the story and Wikipedia revision behind every explanation it writes.
      </p>
    ),
  },
  {
    title: "Follow-up questions",
    body: (
      <p>
        When you ask about a term, Claude gets the story you&apos;re reading, the explanation you
        saw, the Wikipedia text and, if there is one, the story&apos;s AI outlook. It&apos;s asked
        to answer only from those and to tag each fact with where it came from, which shows as a
        small label after the sentence.
      </p>
    ),
  },
  {
    title: "When it gets things wrong",
    body: (
      <p>
        Explanations are written by AI and can be wrong. The most common mistake is mixing up two
        people or places with the same name. Check the linked sources for anything that matters, and
        use <span className="text-foreground">Report an error</span> under an explanation to tell
        us. Reports go to the people who make Samā4 (see{" "}
        <Link href="/about" className={LINK}>
          About
        </Link>
        ), and what a report stores is on the{" "}
        <Link href="/privacy" className={LINK}>
          privacy page
        </Link>
        .
      </p>
    ),
  },
];

export default function HowExplanationsWorkPage() {
  return (
    <Page
      title="How explanations are made"
      description="What Samā4 highlights, what the AI is given, and how to check it."
    >
      <div className="max-w-[62ch] space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-editorial text-[24px] leading-tight tracking-[-0.02em]">
              {s.title}
            </h2>
            <div className="mt-2 space-y-3 text-[17px] leading-[1.65] text-text-secondary">
              {s.body}
            </div>
          </section>
        ))}
        <p>
          <Link href="/" className="label-ui link-ui font-bold text-accent-secondary">
            Back to today&apos;s stories
          </Link>
        </p>
      </div>
    </Page>
  );
}
