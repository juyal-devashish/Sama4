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

test("with nothing saved, the app is light even when the OS is dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: /light/i })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(
    false,
  );
});

test('"Match system" still follows a dark OS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("sama4_theme", '"system"'));
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
});
