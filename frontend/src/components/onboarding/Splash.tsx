import { Logo } from "@/components/ui/logo";

/**
 * First-visit splash. Always in the server HTML but hidden by CSS; the pre-paint
 * script (FIRST_VISIT_SCRIPT in lib/onboarding.ts) reveals it with `html.intro-splash`,
 * so it is on screen from the first frame. OnboardingGate fades it out.
 */
export function Splash() {
  return (
    <div
      className="splash fixed inset-0 z-[60] flex-col items-center justify-center gap-4 bg-background px-4"
      aria-hidden="true"
    >
      <div className="splash-mark flex items-center gap-3">
        <Logo className="h-14" />
        <span className="font-display text-[34px] font-bold tracking-[-0.02em]">samā4</span>
      </div>
      <p className="splash-tagline text-[15px] text-text-secondary">News, understood.</p>
    </div>
  );
}
