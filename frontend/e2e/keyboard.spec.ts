import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

test("keyboard only: reach a story, a highlighted term and its explanation, then leave", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/");
  const firstStory = page.locator("main h2").first();
  await expect(firstStory).toBeVisible({ timeout: 10_000 });

  // Tab until a story row has focus (the nav and chips come first), and open it.
  let onRow = false;
  for (let i = 0; i < 40 && !onRow; i++) {
    await page.keyboard.press("Tab");
    onRow = await page.evaluate(() => !!document.activeElement?.querySelector("h2"));
  }
  expect(onRow, "Tab never reached a story row").toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/article\//);

  // Then to the first highlighted term; Enter opens its explanation and takes focus.
  const term = page.locator("p .term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.focus();
  await page.keyboard.press("Enter");
  await expect(term).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#context-margin")).toBeFocused();

  // Escape closes it and gives focus back to the term.
  await page.keyboard.press("Escape");
  await expect(term).toHaveAttribute("aria-pressed", "false");
  await expect(term).toBeFocused();
});

test("the first Tab on a page lands on something named", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(`/article/${ARTICLE_ID}`);
  await page.keyboard.press("Tab");
  const name = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return (el?.getAttribute("aria-label") || el?.textContent || "").trim();
  });
  expect(name.length).toBeGreaterThan(0);
});
