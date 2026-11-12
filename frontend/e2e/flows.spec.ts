import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The term flow needs seeded articles (`make seed`); it is skipped in CI, which has no backend.
const ARTICLE = "/?article=89021bed-ec73-4cdc-a2f3-ecb61da7d7f4";

async function axeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
  );
}

test("selecting a highlighted term opens its explanation and stays accessible", async ({
  page,
}) => {
  test.skip(!!process.env.CI, "needs a seeded backend (run `make seed` locally)");
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const term = page.locator(".term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.click();
  await expect(term).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1200); // context margin slide-in
  const summary = await axeViolations(page);
  expect(summary, summary.join("\n")).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(term).toHaveAttribute("aria-pressed", "false");
});

test("reference page is accessible", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/article/89021bed-ec73-4cdc-a2f3-ecb61da7d7f4/reference");
  await page.waitForLoadState("networkidle");
  const summary = await axeViolations(page);
  expect(summary, summary.join("\n")).toEqual([]);
});
