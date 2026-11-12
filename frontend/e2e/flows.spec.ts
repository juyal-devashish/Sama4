import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// These flows need seeded articles (`make seed`); skip cleanly if the feed is empty.
const ARTICLE = "/?article=89021bed-ec73-4cdc-a2f3-ecb61da7d7f4";

async function axeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
  );
}

test("selecting a highlighted term opens its explanation and stays accessible", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const term = page.locator(".term").first();
  test.skip(
    !(await term.isVisible({ timeout: 8000 }).catch(() => false)),
    "no seeded article with terms",
  );
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
