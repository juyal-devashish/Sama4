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
      <div className="splash-mark flex flex-col items-center">
        <Logo className="mb-5 h-16" />
        <span className="font-editorial text-[64px] font-bold leading-none tracking-[-0.045em]">
          Samā4
        </span>
        <span className="rule-thick mt-4 w-[240px]" />
      </div>
      <p className="splash-tagline label-ui text-text-secondary">News, understood.</p>
    </div>
  );
}
