import { expect, test } from "@playwright/test";
import fixtures from "./fixtures/api.json";
import { ARTICLE_ID, mockApi } from "./mock-api";

const HOUR = 3_600_000;

test("every story card is a real link to the story", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/");
  const cards = page.locator('section[aria-label="Stories"] li a');
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h).toMatch(/^\/article\/.+/);

  // A plain click still opens it in place; the list stays mounted.
  await cards.nth(1).click();
  await expect(page).toHaveURL(hrefs[1]!);
  await expect(page.locator('section[aria-label="Stories"]')).toBeVisible();
});

test("the feed says it is AI-written, how many stories, and when it was updated", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/");
  const stories = page.locator('section[aria-label="Stories"]');
  await expect(stories.getByText(/written by Samā4.s AI/)).toBeVisible({ timeout: 10_000 });
  await expect(stories.getByRole("link", { name: "How it works" })).toHaveAttribute(
    "href",
    "/how-explanations-work",
  );
  await expect(stories.getByRole("status")).toContainText(/4 stories/);
});

test("stories from an earlier night sit under an Earlier editions divider", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  const now = Date.now();
  const articles = fixtures.feed.articles.map((a, i) => ({
    ...a,
    added_at: new Date(now - (i < 2 ? i * 0.1 * HOUR : 24 * HOUR + i * 0.1 * HOUR)).toISOString(),
  }));
  await page.route("**/api/v1/feed?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ ...fixtures.feed, articles }),
    }),
  );
  await page.goto("/");
  const stories = page.locator('section[aria-label="Stories"]');
  await expect(stories.getByText("Earlier editions")).toBeVisible({ timeout: 10_000 });
  await expect(stories.getByRole("status")).toContainText(/Updated/);
  // Exactly the third story starts the earlier edition.
  const third = stories.locator("li").nth(2);
  await expect(third).toContainText("Earlier editions");
  await expect(stories.locator("li").nth(1)).not.toContainText("Earlier editions");
});

test("Copy link shows the link when the clipboard is blocked", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem("sama4_onboarded", "true");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("blocked")) },
    });
  });
  let shown = "";
  page.on("dialog", async (d) => {
    shown = d.defaultValue();
    await d.dismiss();
  });
  await page.goto(`/article/${ARTICLE_ID}`);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect.poll(() => shown).toContain(`/article/${ARTICLE_ID}`);
});
