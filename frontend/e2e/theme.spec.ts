import { expect, test } from "@playwright/test";

// The inline script in app/layout.tsx must apply the saved theme before React hydrates,
// or dark-mode readers see a light flash on every load. Block the JS bundles so only
// that script can set the class.
for (const [saved, dark] of [
  ['"dark"', true],
  ['"light"', false],
  ["dark", true], // a plain string from before values were JSON-encoded
] as const) {
  test(`pre-paint theme applies saved ${saved}`, async ({ page }) => {
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.addInitScript((v) => localStorage.setItem("sama4_theme", v), saved);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(isDark).toBe(dark);
  });
}
