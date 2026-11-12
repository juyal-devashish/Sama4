import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

for (const width of [375, 768, 1100]) {
  test(`terms list is reachable on narrow screens (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
    await page.goto(`/?article=${ARTICLE_ID}`);

    const open = page.getByRole("button", { name: "Terms in this story" });
    await expect(open).toBeVisible({ timeout: 10_000 });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    const box = (await open.boundingBox())!;
    expect(box.height, "touch target").toBeGreaterThanOrEqual(24);
    await open.click();

    const drawer = page.locator("#context-margin");
    await expect(drawer.getByRole("heading", { name: "In this story" })).toBeVisible();
    await page.waitForTimeout(300); // slide-in
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    // Pick a term from the list, then Esc goes back to the list, then close.
    await drawer.getByRole("button").filter({ hasNotText: /Close/ }).first().click();
    await expect(drawer.getByRole("button", { name: "Close explanation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer.getByRole("heading", { name: "In this story" })).toBeVisible();
    await drawer.getByRole("button", { name: "Close the list of terms" }).click();
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toBeHidden();
  });
}

test("follow-up answers are announced politely", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(`/?article=${ARTICLE_ID}`);
  await page.locator(".term").first().click();
  const box = page.getByRole("textbox", { name: /Ask a follow-up question/ });
  await box.fill("Why?");
  await box.press("Enter");
  const live = page.locator('[aria-live="polite"]').filter({ hasText: "Why?" });
  await expect(live).toBeVisible();
  await expect(live).toContainText("The story covers it");
});
