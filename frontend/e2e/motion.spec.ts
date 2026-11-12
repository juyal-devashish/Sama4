import { expect, test } from "@playwright/test";

test("early-access page settles immediately under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/early-access");
  await page.waitForLoadState("networkidle");
  // No animation should still be running shortly after load.
  await page.waitForTimeout(300);
  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity)
        .length,
  );
  expect(running).toBe(0);
});
