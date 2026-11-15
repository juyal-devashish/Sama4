"use client";

import { Masthead } from "./Masthead";
import { Sidebar } from "./Sidebar";
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-foreground focus:px-4 focus:py-2.5 focus:font-ui focus:text-[14px] focus:font-bold focus:text-background"
      >
        Skip to content
      </a>
      <div data-app-shell className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Masthead />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-0 min-w-0 flex-1 overflow-hidden focus:outline-none"
          >
            {children}
          </main>
        </div>
      </div>
      <Splash />
      <OnboardingGate />
    </>
  );
}
