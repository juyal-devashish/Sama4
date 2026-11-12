"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Check,
  Layers,
  Network,
  Search,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Page } from "@/components/shell/Page";
import { api } from "@/lib/api";
import { cn, entityColor } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

const DEMO_TERMS = {
  fed: {
    label: "Federal Reserve",
    type: "ORG",
    kind: "Organization",
    text: "The central bank of the United States. It sets the interest rate banks charge each other overnight, which ripples out to mortgages, loans and savings.",
  },
  powell: {
    label: "Jerome Powell",
    type: "PERSON",
    kind: "Person",
    text: "Chair of the Federal Reserve since 2018. His press conferences after each rate decision are read closely for hints about what the Fed does next.",
  },
  stagflation: {
    label: "stagflation",
    type: "CONCEPT",
    kind: "Concept",
    text: "Slow economic growth and high inflation at the same time. It is hard to fight because raising rates cools inflation but can slow growth further.",
  },
} as const;

type DemoKey = keyof typeof DEMO_TERMS;

const STEPS = [
  {
    title: "Open any story",
    body: "samā4 gathers the day's news from BBC, NYT, Reuters, Al Jazeera, The Guardian, NPR, AP and more, with duplicate stories folded together.",
  },
  {
    title: "See what it assumes you know",
    body: "Every person, organization, place, event and idea the story takes for granted is highlighted, weighted by how much it matters to the piece.",
  },
  {
    title: "Select a term, keep reading",
    body: "The explanation opens in the margin beside the story. Ask a follow-up if you want more. No new tabs, no copy-pasting into a chatbot.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Sparkles,
    title: "Context in the margin",
    body: "Short, grounded explanations written for this story, not a generic encyclopedia entry.",
  },
  {
    icon: Network,
    title: "Linked entities",
    body: "Names are matched to Wikidata, so the same person or organization connects across every story.",
  },
  {
    icon: Layers,
    title: "One story, many sources",
    body: "Near-duplicate coverage is grouped, so you read the story once and still see who reported it.",
  },
  {
    icon: TrendingUp,
    title: "Outlook",
    body: "Run a simulation of what might happen next, with the stakeholders involved and how much it could matter.",
  },
  {
    icon: Search,
    title: "Search",
    body: "Find stories by what they are about, not just the words in the headline.",
  },
  {
    icon: Bookmark,
    title: "Saved stories",
    body: "Keep stories to come back to. Press S while reading to save one.",
  },
];

const UPDATES = [
  {
    date: "Nov 2026",
    title: "samā4 moves to sama4.online",
    body: "The reader now lives at sama4.online. This page replaces the old landing page and is where we'll post what's new.",
  },
  {
    date: "Nov 2026",
    title: "A new desktop reader",
    body: "Story list, reading pane and context margin side by side, with keyboard shortcuts (J and K to move between stories) and light and dark themes.",
  },
  {
    date: "Coming next",
    title: "Browser extension and voice briefings",
    body: "Context on articles you read anywhere on the web, and spoken briefings of the day's news. Join the waitlist to hear first.",
  },
];

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-secondary">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-[22px] font-semibold tracking-[-0.01em]">{title}</h2>
    </div>
  );
}

function DemoTerm({
  id,
  active,
  onSelect,
  children,
}: {
  id: DemoKey;
  active: boolean;
  onSelect: (id: DemoKey) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="term font-[inherit] text-[inherit]"
      style={{ ["--term-color" as string]: entityColor(DEMO_TERMS[id].type) }}
      aria-pressed={active}
      onClick={() => onSelect(id)}
    >
      {children}
    </button>
  );
}

function Demo() {
  const [selected, setSelected] = useState<DemoKey>("stagflation");
  const term = DEMO_TERMS[selected];

  return (
    <div className="grid overflow-hidden rounded-xl border bg-surface md:grid-cols-[1fr_300px]">
      <article className="p-6">
        <p className="flex gap-3 text-[12.5px]">
          <span className="font-display font-semibold">Reuters</span>
          <span className="text-text-tertiary">Example story</span>
        </p>
        <h3 className="mt-1 font-display text-[18px] font-semibold leading-snug">
          Fed holds rates steady amid renewed stagflation fears
        </h3>
        <p className="mt-3 font-body text-[15px] leading-[1.75] text-text-secondary">
          The{" "}
          <DemoTerm id="fed" active={selected === "fed"} onSelect={setSelected}>
            Federal Reserve
          </DemoTerm>{" "}
          held its benchmark rate unchanged, as Chair{" "}
          <DemoTerm id="powell" active={selected === "powell"} onSelect={setSelected}>
            Jerome Powell
          </DemoTerm>{" "}
          signalled the committee would stay data-dependent amid growing concern about{" "}
          <DemoTerm id="stagflation" active={selected === "stagflation"} onSelect={setSelected}>
            stagflation
          </DemoTerm>
          .
        </p>
        <p className="mt-4 text-[12.5px] text-text-tertiary">Select a highlighted term.</p>
      </article>
      <aside
        className="border-t bg-background-secondary/60 p-6 md:border-l md:border-t-0"
        aria-live="polite"
      >
        <p className="flex items-center gap-2 text-[12px] font-medium text-text-tertiary">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entityColor(term.type) }}
            aria-hidden
          />
          {term.kind}
        </p>
        <h4 className="mt-1 font-display text-[17px] font-semibold capitalize">{term.label}</h4>
        <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{term.text}</p>
      </aside>
    </div>
  );
}

function Waitlist() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await api.joinWaitlist(email);
      setState("done");
      setMessage(
        res.status === "exists"
          ? "You're already on the list. We'll be in touch."
          : "You're on the list. We'll be in touch."
      );
    } catch {
      setState("error");
      setMessage("That didn't go through. Check the address and try again.");
    }
  }

  return (
    <section
      id="waitlist"
      className="rounded-xl border bg-surface p-8"
      aria-labelledby="waitlist-title"
    >
      <h2 id="waitlist-title" className="font-display text-[22px] font-semibold tracking-[-0.01em]">
        Get early access to what&apos;s next
      </h2>
      <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-text-secondary">
        Be first to try the browser extension and voice briefings. One email when they&apos;re
        ready, nothing else.
      </p>
      {state === "done" ? (
        <p className="mt-5 flex items-center gap-2 text-[14px] font-medium text-success">
          <Check size={16} aria-hidden /> {message}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 flex max-w-[480px] flex-col gap-2 sm:flex-row">
          <label htmlFor="waitlist-email" className="sr-only">
            Email address
          </label>
          <input
            id="waitlist-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3.5 font-body text-[14px] outline-none placeholder:text-text-tertiary focus:border-accent-secondary"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="h-10 rounded-lg bg-accent-primary px-4 font-display text-[13px] font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
          >
            {state === "sending" ? "Joining…" : "Join the waitlist"}
          </button>
        </form>
      )}
      {state === "error" && <p className="mt-2 text-[13px] text-error">{message}</p>}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AnnouncementsPage() {
  return (
    <Page
      width="max-w-[960px]"
      title="Announcements"
      description="What samā4 is, what's new, and what's coming next."
    >
      <div className="space-y-16">
        <section aria-labelledby="intro-title">
          <h2
            id="intro-title"
            className="max-w-[24ch] font-display text-[34px] font-bold leading-[1.15] tracking-[-0.02em]"
          >
            News that explains what it assumes you know.
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-text-secondary">
            samā4 spots the people, places, events and ideas a story takes for granted and explains
            them right beside the text, so you go from confused to informed without leaving the
            page.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-primary px-4 font-display text-[13px] font-semibold text-on-accent hover:opacity-90"
            >
              Read today&apos;s stories <ArrowRight size={15} aria-hidden />
            </Link>
            <a
              href="#waitlist"
              className="inline-flex h-10 items-center rounded-lg border bg-surface px-4 font-display text-[13px] font-medium hover:bg-background-secondary"
            >
              Join the waitlist
            </a>
          </div>
          <div className="mt-8">
            <Demo />
          </div>
        </section>

        <section aria-label="What's new">
          <SectionHeading eyebrow="Updates" title="What's new" />
          <ol className="divide-y border-y">
            {UPDATES.map((u) => (
              <li key={u.title} className="grid gap-1 py-5 sm:grid-cols-[140px_1fr] sm:gap-6">
                <p className="pt-0.5 font-display text-[13px] font-medium text-text-tertiary">
                  {u.date}
                </p>
                <div>
                  <h3 className="font-display text-[16px] font-semibold">{u.title}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-text-secondary">{u.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="How it works">
          <SectionHeading eyebrow="How it works" title="From headline to understanding" />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border bg-surface p-5">
                <span className="font-display text-[22px] font-semibold tabular-nums text-text-tertiary">
                  {i + 1}
                </span>
                <h3 className="mt-2 font-display text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Features">
          <SectionHeading eyebrow="Features" title="What you get" />
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg bg-background-secondary text-accent-secondary"
                  )}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden />
                </span>
                <h3 className="mt-3 font-display text-[15px] font-semibold">{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <Waitlist />
      </div>
    </Page>
  );
}
