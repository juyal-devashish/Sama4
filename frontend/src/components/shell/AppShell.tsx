"use client";

import { Masthead } from "./Masthead";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { Splash } from "@/components/onboarding/Splash";
import { useTheme } from "@/lib/preferences";

export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useTheme(); // keeps the html.dark class in sync with the stored choice

  return (
    <>
      <div data-app-shell className="flex h-screen flex-col overflow-hidden bg-background">
        <Masthead />
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <Splash />
      <OnboardingGate />
    </>
  );
}
