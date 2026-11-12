import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fixtures from "./fixtures/api.json";
import { ARTICLE_ID, mockApi } from "./mock-api";

const ARTICLE = `/?article=${ARTICLE_ID}`;
const OTHER_ID = Object.keys(fixtures.articles).find((id) => id !== ARTICLE_ID);

/** A reader who has finished the intro but hasn't seen any in-app tips yet. */
async function freshReader(page: Page) {
  await mockApi(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return; // keep progress across reloads
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "sama4_onboarding",
      JSON.stringify({
        version: 1,
        introDone: true,
        hintsSeen: [],
        dismissals: {},
        storiesOpened: [],
      }),
    );
  });
}

const termTip = (page: Page) =>
  page.getByRole("status").filter({ hasText: /select any highlight/i });
const followTip = (page: Page) => page.getByRole("status").filter({ hasText: /ask a follow-up/i });

async function axe(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return r.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
  );
}

test("tips teach selecting a term, then follow-ups, one at a time, once", async ({ page }) => {
  await freshReader(page);
  await page.goto(ARTICLE);
  await expect(termTip(page)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".hint-ring")).toHaveCount(1);
  await expect(followTip(page)).toHaveCount(0);
  // Non-modal: focus stays where it was.
  await expect(page.getByRole("button", { name: "Dismiss tip" })).not.toBeFocused();
  let summary = await axe(page);
  expect(summary, summary.join("\n")).toEqual([]);

  await page.locator("article .term").first().click();
  await expect(termTip(page)).toHaveCount(0);
  await expect(followTip(page)).toBeVisible();
  await page.waitForTimeout(400);
  summary = await axe(page);
  expect(summary, summary.join("\n")).toEqual([]);

  await page.getByRole("button", { name: "Dismiss tip" }).click();
  await expect(followTip(page)).toHaveCount(0);

  await page.reload();
  await expect(page.locator("article .term").first()).toBeVisible({ timeout: 10_000 });
  await page.locator("article .term").first().click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("status").filter({ hasText: /highlight|follow-up/i })).toHaveCount(0);
});

test("dismissing the term tip hides it for this story; three dismissals retire it", async ({
  page,
}) => {
  test.skip(!OTHER_ID, "needs two stories in the fixtures");
  await freshReader(page);
  await page.goto(ARTICLE);
  await expect(termTip(page)).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(termTip(page)).toHaveCount(0);

  await page.goto(`/?article=${OTHER_ID}`);
  await expect(termTip(page)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Dismiss tip" }).click();

  await page.goto(ARTICLE);
  await expect(termTip(page)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Dismiss tip" }).click();

  await page.goto(`/?article=${OTHER_ID}`);
  await expect(page.locator("article .term").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await expect(termTip(page)).toHaveCount(0);
});

test("readers from before the tips never see them", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  await expect(page.locator("article .term").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await expect(page.getByRole("status").filter({ hasText: /highlight/i })).toHaveCount(0);
});

test("no tips over the intro; the first one waits until it ends", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: /news, understood/i })).toBeVisible();
  await expect(termTip(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  // On a desktop-width window the first story opens by itself, and the tip follows.
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(termTip(page)).toBeVisible({ timeout: 10_000 });
  }
});
