"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { INTRO_STEPS, nextIntroStep, type IntroStep } from "@/lib/onboarding";
import { ALL_TOPICS, TOPIC_LABELS, useTopics } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { TermDemo } from "./TermDemo";
import { Logo } from "@/components/ui/logo";

const ghost =
  "h-10 rounded-lg px-4 text-[14px] font-medium text-text-secondary transition-colors hover:bg-background-secondary hover:text-foreground";
const primary =
  "h-10 rounded-lg bg-accent-primary px-5 text-[14px] font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The two-step intro: what samā4 does (with a try-it highlight), then topics.
 * `onFinish(topics)` gets the picked topics, or null when the reader skipped.
 */
export function IntroFlow({ onFinish }: { onFinish: (topics: string[] | null) => void }) {
  const [step, setStep] = useState<IntroStep>("welcome");
  const [current] = useTopics();
  const [picked, setPicked] = useState<string[]>(current);
  const index = INTRO_STEPS.indexOf(step);

  // Focus each step's heading as it mounts (after the old step has animated out),
  // so screen readers announce the new step.
  const focusOnMount = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);

  // The reader is hidden underneath; keep its shortcuts (/, J, K) from acting on it.
  // Buttons still work: their activation is the key's default action, not a listener.
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finishRef.current(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const toggle = (t: string) =>
    setPicked((prev) => (prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]));

  const next = () => {
    const n = nextIntroStep(step);
    if (n) setStep(n);
    else onFinish(picked);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-8 pt-10 sm:px-6 sm:pt-[12vh]">
        <div className="mb-8">
          <Logo className="h-11" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {step === "welcome" ? (
              <>
                <h1
                  id="intro-title"
                  ref={focusOnMount}
                  tabIndex={-1}
                  className="font-display text-[30px] font-bold leading-[1.15] tracking-[-0.02em] focus-visible:outline-none"
                >
                  News, understood.
                </h1>
                <p className="mt-3 max-w-[44ch] text-[16px] leading-relaxed text-text-secondary">
                  Stories assume you already know the people, places and ideas in them. samā4
                  explains them as you read.
                </p>
                <div className="mt-8">
                  <TermDemo />
                </div>
              </>
            ) : (
              <>
                <h1
                  id="intro-title"
                  ref={focusOnMount}
                  tabIndex={-1}
                  className="font-display text-[30px] font-bold leading-[1.15] tracking-[-0.02em] focus-visible:outline-none"
                >
                  What do you want to follow?
                </h1>
                <p className="mt-3 max-w-[44ch] text-[16px] leading-relaxed text-text-secondary">
                  Pick a few, or keep them all. You can change this any time in Settings.
                </p>
                <div role="group" aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
                  {ALL_TOPICS.map((t) => {
                    const on = picked.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(t)}
                        className={cn(
                          "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium transition-colors",
                          on
                            ? "border-accent-primary bg-accent-primary text-on-accent"
                            : "text-text-secondary hover:border-accent-secondary hover:text-foreground",
                        )}
                      >
                        {on && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
                        {TOPIC_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
                <p aria-live="polite" className="mt-3 min-h-[20px] text-[13px] text-text-tertiary">
                  {picked.length === 0 ? "Pick at least one topic." : ""}
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5" aria-hidden="true">
              {INTRO_STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-5 bg-accent-primary" : "w-1.5 bg-border",
                  )}
                />
              ))}
            </span>
            <span className="text-[13px] text-text-tertiary">
              Step {index + 1} of {INTRO_STEPS.length}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {step === "welcome" ? (
              <button type="button" className={ghost} onClick={() => onFinish(null)}>
                Skip intro
              </button>
            ) : (
              <button type="button" className={ghost} onClick={() => setStep("welcome")}>
                Back
              </button>
            )}
            <button
              type="button"
              className={primary}
              onClick={next}
              disabled={step === "topics" && picked.length === 0}
            >
              {step === "welcome" ? "Continue" : "Start reading"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
