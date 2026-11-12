"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_TOPICS, TOPIC_LABELS, useOnboarded, useTopics } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** First-run welcome: what samā4 does, and which topics to show. */
export function WelcomeDialog() {
  const [onboarded, setOnboarded] = useOnboarded();
  const [, setTopics] = useTopics();
  const [mounted, setMounted] = useState(false);
  const [picked, setPicked] = useState<string[]>([...ALL_TOPICS]);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  const open = mounted && !onboarded;

  useEffect(() => {
    if (open) startRef.current?.focus();
  }, [open]);

  const finish = () => {
    setTopics(picked.length ? picked : [...ALL_TOPICS]);
    setOnboarded(true);
  };

  const toggle = (t: string) =>
    setPicked((prev) => (prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="w-full max-w-[560px] overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-panel)]"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="px-10 pb-8 pt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sama4-logo.jpg" alt="" className="mb-6 h-12 w-12 rounded-xl" />
              <h1
                id="welcome-title"
                className="font-display text-[30px] font-bold leading-[1.15] tracking-[-0.02em]"
              >
                News, understood.
              </h1>
              <p className="mt-3 max-w-[44ch] text-[16px] leading-relaxed text-text-secondary">
                Stories assume you already know the people, places and ideas in them. samā4
                doesn&apos;t. Anything{" "}
                <span
                  className="term"
                  style={{ ["--term-color" as string]: "var(--entity-person)" }}
                >
                  highlighted
                </span>{" "}
                can be selected to see what it is, right beside the story.
              </p>

              <fieldset className="mt-8">
                <legend className="font-display text-[14px] font-semibold">
                  Which topics do you want in your feed?
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_TOPICS.map((t) => {
                    const on = picked.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(t)}
                        className={cn(
                          "h-9 rounded-full border px-4 text-[14px] font-medium transition-colors",
                          on
                            ? "border-accent-primary bg-accent-primary text-on-accent"
                            : "text-text-secondary hover:border-accent-secondary hover:text-foreground",
                        )}
                      >
                        {TOPIC_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[13px] text-text-tertiary">
                  You can change these any time in Settings.
                </p>
              </fieldset>
            </div>
            <div className="flex items-center justify-end border-t bg-background-secondary/50 px-10 py-4">
              <button
                ref={startRef}
                type="button"
                onClick={finish}
                className="h-10 rounded-lg bg-accent-primary px-5 text-[14px] font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                Start reading
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
