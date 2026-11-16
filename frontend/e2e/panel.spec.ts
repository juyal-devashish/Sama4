import { expect, test } from "@playwright/test";
import fixtures from "./fixtures/api.json";
import { ARTICLE_ID, mockApi } from "./mock-api";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
});

test("the follow-up box says where the question goes, and answers explain their labels", async ({
  page,
}) => {
  await page.goto(`/article/${ARTICLE_ID}`);
  await page.locator("p .term").first().click();
  await expect(
    page.getByText("Your question is sent to Samā4 and to Claude, which writes the answer."),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/The small labels after a sentence/)).toHaveCount(0);

  const box = page.getByRole("textbox", { name: /Ask a follow-up question/ });
  await box.fill("What does it make?");
  await box.press("Enter");
  await expect(page.getByRole("link", { name: "Source: Article" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByText(/The small labels after a sentence say where it came from/),
  ).toBeVisible();
});

test("the explanation names the Wikipedia article it was written from", async ({ page }) => {
  // Every fixture explanation gets a titled Wikipedia source.
  await page.route(/\/api\/v1\/context\/[^/?]+(\?|$)/, (route) => {
    const body = JSON.parse(JSON.stringify(Object.values(fixtures.context)[0]));
    body.context.sources = [
      {
        type: "wikipedia",
        title: "Philip Glass",
        url: "https://en.wikipedia.org/wiki/Philip_Glass",
      },
    ];
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  await page.goto(`/article/${ARTICLE_ID}`);
  await page.locator("p .term").first().click();
  await expect(page.getByRole("link", { name: /Wikipedia: Philip Glass/ })).toBeVisible({
    timeout: 10_000,
  });
});
