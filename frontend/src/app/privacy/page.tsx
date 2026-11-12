import Link from "next/link";
import { Page } from "@/components/shell/Page";

export const metadata = { title: "Privacy · samā4" };

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The early-access waitlist",
    body: (
      <>
        <p>
          If you join the{" "}
          <Link href="/early-access#waitlist" className="text-accent-secondary underline underline-offset-2">
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
        browser&apos;s local storage. They aren&apos;t sent to samā4. Clearing this site&apos;s data
        in your browser removes them.
      </p>
    ),
  },
  {
    title: "Explanations, questions and outlooks",
    body: (
      <p>
        When you open an explanation, ask a follow-up question or run an outlook, the term, your
        question and the story text are sent to samā4&apos;s server and to Anthropic&apos;s Claude,
        which writes the answer. samā4 doesn&apos;t save your questions to its database. Outlooks
        are saved and shown to other readers, but they contain no information about you.
      </p>
    ),
  },
  {
    title: "No tracking",
    body: (
      <p>
        samā4 has no analytics or advertising scripts and sets no tracking cookies. We don&apos;t
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
        article; summaries, explanations and outlooks are written by samā4&apos;s AI and labelled as
        such.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <Page
      title="Privacy"
      description="How samā4 handles your data, in plain terms. This describes what the app does today. Last updated 12 November 2026."
    >
      <div className="max-w-[62ch] space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-[17px] font-semibold">{s.title}</h2>
            <div className="mt-2 space-y-3 text-[15.5px] leading-[1.7] text-text-secondary">
              {s.body}
            </div>
          </section>
        ))}
        <p>
          <Link href="/" className="text-[14px] font-medium text-accent-secondary hover:underline">
            Back to today&apos;s stories
          </Link>
        </p>
      </div>
    </Page>
  );
}
