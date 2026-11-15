import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

// Audit FB-1: at 21:00 on Saturday in New York it is already Sunday in UTC, where the server
// renders. The date must follow the reader's clock and be the same on every route.
test.describe("the date follows the reader", () => {
  test.use({ timezoneId: "America/New_York" });

  for (const route of ["/", "/search", "/about"]) {
    // Fixed until the shell batch makes the masthead and Today heading client-rendered.
    test.fixme(`${route} says Saturday at 21:00 in New York`, async ({ page }) => {
      await mockApi(page);
      await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
      await page.clock.setFixedTime(new Date("2026-11-15T02:00:00Z"));
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("header").first()).toContainText("Saturday");
      await expect(page.locator("body")).not.toContainText("Sunday");
    });
  }
});
