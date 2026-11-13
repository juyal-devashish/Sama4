import Link from "next/link";
import { Page } from "@/components/shell/Page";

export const metadata = {
  title: "Privacy",
  alternates: { canonical: "/privacy" },
  description:
    "How Samā4 handles your data, in plain terms: the waitlist, what stays on your device, error reports, and no tracking.",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The early-access waitlist",
    body: (
      <>
        <p>
          If you join the{" "}
          <Link
            href="/early-access#waitlist"
            className="text-accent-secondary underline underline-offset-2"
          >
            early-access waitlist
          </Link>{" "}
          we store your email address, when you signed up and which page you used. We use it only to
          tell you when early access opens. We never sell it or share it for marketing.
        </p>
        <p>
          To stop abuse of the form, your IP address is used as a sign-up counter for up to an hour
          and then discarded.
        </p>
      </>
    ),
  },
  {
    title: "What stays on your device",
    body: (
      <p>
        <Link href="/saved" className="text-accent-secondary underline underline-offset-2">
          Saved stories
        </Link>
        , your theme, your topics and whether you&apos;ve seen the welcome screen are kept in your
        browser&apos;s local storage. They aren&apos;t sent to Samā4. Clearing this site&apos;s data
        in your browser removes them.
      </p>
    ),
  },
  {
    title: "Explanations, questions and outlooks",
    body: (
      <p>
        When you open an explanation, ask a follow-up question or run an outlook, the term, your
        question and the story text are sent to Samā4&apos;s server and to Anthropic&apos;s Claude,
        which writes the answer. Samā4 doesn&apos;t save your questions to its database. Outlooks
        are saved and shown to other readers, but they contain no information about you.
      </p>
    ),
  },
  {
    title: "No tracking",
    body: (
      <p>
        Samā4 has no analytics or advertising scripts and sets no tracking cookies. We don&apos;t
        build a profile of what you read.
      </p>
    ),
  },
  {
    title: "Error reports and hosting",
    body: (
      <>
        <p>
          If something breaks, an error report may be sent to our error-tracking provider (Sentry).
          It can include technical details of the request, such as your IP address.
        </p>
        <p>
          The app is hosted on Vercel and its server and database on Railway. Like any website,
          these providers keep standard request logs.
        </p>
      </>
    ),
  },
  {
    title: "The stories",
    body: (
      <p>
        Stories come from publishers&apos; public news feeds. Every story links to the original
        article; summaries, explanations and outlooks are written by Samā4&apos;s AI and labelled as
        such.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <Page
      title="Privacy"
      description="How Samā4 handles your data, in plain terms. This describes what the app does today. Last updated 12 November 2026."
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
