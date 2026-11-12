import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test("going offline says so, and the feed reloads by itself when back online", async ({
  page,
  context,
}) => {
  await mockApi(page);
  let failFeed = true;
  await page.route("**/api/v1/feed**", (route) =>
    failFeed ? route.abort("internetdisconnected") : route.fallback(),
  );
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/");

  const stories = page.locator('section[aria-label="Stories"]');
  await expect(stories.getByRole("alert")).toContainText("Couldn't load stories", {
    timeout: 15_000,
  });
  await expect(stories.getByText(/backend/)).toHaveCount(0); // no developer advice

  await context.setOffline(true);
  await expect(stories.getByRole("alert")).toContainText("You're offline");

  failFeed = false;
  await context.setOffline(false);
  await expect(stories.locator("li h2").first()).toBeVisible({ timeout: 10_000 });
});
