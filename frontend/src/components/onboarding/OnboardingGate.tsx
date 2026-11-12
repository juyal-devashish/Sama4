"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { GATE_ATTR } from "@/lib/onboarding";
import { useOnboarding, useTopics } from "@/lib/preferences";
import { IntroFlow } from "./IntroFlow";

const SPLASH_MS = 1100;
const SPLASH_MS_REDUCED = 500;
const SPLASH_FADE_MS = 250;

/**
 * Runs the first-visit splash and intro. Whether this visit gets them was decided
 * before first paint (FIRST_VISIT_SCRIPT sets `html.intro`), so the gate reads that
 * class instead of re-deciding after hydration, when stored values can lag a render.
 */
export function OnboardingGate() {
  const [showIntro, setShowIntro] = useState(false);
  const { dispatch } = useOnboarding();
  const [, setTopics] = useTopics();

  useEffect(() => {
    const html = document.documentElement;
    // Tells the pre-paint script's failsafe that the app is running and owns the intro.
    html.setAttribute(GATE_ATTR, "");
    if (!html.classList.contains("intro")) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? SPLASH_MS_REDUCED : SPLASH_MS;
    // The intro mounts under the splash as it fades, so the two crossfade.
    const fade = setTimeout(() => {
      html.classList.add("splash-leaving");
      setShowIntro(true);
    }, hold);
    const done = setTimeout(
      () => html.classList.remove("intro-splash", "splash-leaving"),
      hold + SPLASH_FADE_MS,
    );
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);

  const finish = (topics: string[] | null) => {
    if (topics?.length) setTopics(topics);
    dispatch({ type: "intro-finished" });
    document.documentElement.classList.remove("intro", "intro-splash", "splash-leaving");
    setShowIntro(false);
  };

  return <AnimatePresence>{showIntro && <IntroFlow onFinish={finish} />}</AnimatePresence>;
}
