import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

// Audit FB-1: at 21:00 on Saturday in New York it is already Sunday in UTC, where the server
// renders. The date must follow the reader's clock, in the masthead and the Today heading.
test.describe("the date follows the reader", () => {
  test.use({ timezoneId: "America/New_York" });

  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
    await page.clock.setFixedTime(new Date("2026-11-15T02:00:00Z"));
  });

  test("Today says Saturday at 21:00 in New York, in the masthead and the heading", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("header").first()).toContainText("Saturday");
    await expect(page.locator("header").first()).toContainText("November 14, 2026");
    // On a wide window Today opens the first story once the feed loads, which turns this
    // heading from an h1 into an h2: find it by place, not by level.
    await expect(page.locator('section[aria-label="Stories"] header')).toContainText(
      "Saturday, November 14",
    );
    await expect(page.locator("body")).not.toContainText("Sunday");
  });

  test("a story page carries the same date", async ({ page }) => {
    await page.goto(`/article/${ARTICLE_ID}`);
    await expect(page.locator("header").first()).toContainText("Saturday");
    await expect(page.locator("body")).not.toContainText("Sunday");
  });

  for (const route of ["/search", "/about", "/sources"]) {
    test(`${route} shows no date: it means nothing off the reader`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("header").first()).not.toContainText(/Saturday|Sunday/);
      await expect(page.locator("header").first()).not.toContainText("2026");
    });
  }
});

test("every page links to About, Sources, how explanations are made, and Privacy", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/about");
  // A footer inside <main> is not a contentinfo landmark, so find it by element.
  const footer = page.locator("main footer");
  for (const name of ["About", "Sources", "How explanations are made", "Privacy"]) {
    await expect(footer.getByRole("link", { name, exact: true })).toBeVisible();
  }
});
