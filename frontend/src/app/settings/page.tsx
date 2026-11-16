"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  ALL_TOPICS,
  SECTIONS_ENABLED,
  TOPIC_LABELS,
  useTheme,
  useTopics,
  type ThemeChoice,
} from "@/lib/preferences";
import { Page } from "@/components/shell/Page";
import { clearDeviceData } from "@/lib/storage";
import { cn } from "@/lib/utils";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match system", icon: Monitor },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-b border-divider pb-8 pt-2 first:pt-0 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="section-label inline-block">{title}</h2>
        {description && (
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

/** Two steps, so one slip can't wipe saved stories. */
function ClearDeviceData() {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  return (
    <>
      <p className="max-w-[56ch] text-[16px] leading-relaxed text-text-secondary">
        Your saved stories, theme, topics, recent searches, and whether you have seen the welcome
        screen are kept in this browser, not on Samā4&apos;s servers. Clear them to start fresh.
      </p>
      {step === "confirm" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-[15px] text-foreground">
            Delete everything Samā4 keeps on this device? This can&apos;t be undone.
          </p>
          <button
            type="button"
            className="btn-ink"
            onClick={() => {
              clearDeviceData();
              setStep("done");
            }}
          >
            Yes, clear it
          </button>
          <button type="button" className="btn-outline" onClick={() => setStep("idle")}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn-outline mt-4" onClick={() => setStep("confirm")}>
          Clear data on this device
        </button>
      )}
      <p role="status" className="mt-3 text-[15px] text-text-secondary empty:hidden">
        {step === "done" ? "Cleared. Saved stories and your settings are back to the start." : ""}
      </p>
    </>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [topics, setTopics] = useTopics();

  const toggleTopic = (t: string) => {
    const next = topics.includes(t as (typeof ALL_TOPICS)[number])
      ? topics.filter((x) => x !== t)
      : [...topics, t];
    setTopics(next.length ? next : [...ALL_TOPICS]);
  };

  return (
    <Page title="Settings">
      <Section title="Appearance">
        <div
          role="radiogroup"
          aria-label="Theme"
          className="inline-flex max-w-full border border-border"
        >
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "label-ui flex h-8 items-center gap-2 whitespace-nowrap px-3 transition-colors sm:px-3.5",
                theme === value
                  ? "bg-foreground text-background"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              <Icon size={13} className="hidden sm:block" aria-hidden />
              {value === "system" ? (
                <>
                  <span className="sm:hidden">System</span>
                  <span className="hidden sm:inline">{label}</span>
                </>
              ) : (
                label
              )}
            </button>
          ))}
        </div>
      </Section>

      {SECTIONS_ENABLED && (
        <Section title="Topics" description="Shown as filters above Today's stories.">
          <div className="flex flex-wrap gap-2">
            {ALL_TOPICS.map((t) => {
              const on = topics.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTopic(t)}
                  className={cn(
                    "label-ui h-9 border px-3.5 transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-text-secondary hover:border-foreground hover:text-foreground",
                  )}
                >
                  {TOPIC_LABELS[t]}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Data on this device">
        <ClearDeviceData />
      </Section>

      <Section title="About">
        <p className="max-w-[56ch] text-[16px] leading-relaxed text-text-secondary">
          Samā4 explains the people, places and ideas in the news as you read. Explanations are
          generated by AI from Wikipedia and recent reporting, so check anything important against
          the source.
        </p>
        <p className="label-ui mt-4 text-text-tertiary">
          Version 2.0 ·{" "}
          <Link href="/privacy" className="link-ui font-bold text-accent-secondary">
            How Samā4 handles your data
          </Link>
        </p>
      </Section>
    </Page>
  );
}
