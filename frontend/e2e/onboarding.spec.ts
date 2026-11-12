import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

const intro = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: /news, understood/i });

test("first visit: splash, try a highlight, pick topics, then the reader; never again", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  // The splash is up from the first frame, and the app is hidden under it.
  await expect(page.locator(".splash")).toBeVisible();
  await expect(page.locator("[data-app-shell]")).toBeHidden();

  await expect(intro(page)).toBeVisible();
  const term = page.getByRole("button", { name: "International Monetary Fund" });
  await term.click();
  await expect(term).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/lends money to countries/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: /what do you want to follow/i })).toBeFocused();
  for (const t of ["General", "Business", "Science", "World"]) {
    await page.getByRole("button", { name: t, exact: true }).click();
  }
  await page.getByRole("button", { name: "Tech", exact: true }).click(); // none left
  await expect(page.getByText("Pick at least one topic.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start reading" })).toBeDisabled();
  await page.getByRole("button", { name: "Tech", exact: true }).click();
  await page.getByRole("button", { name: "Start reading" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("sama4_categories"))).toBe('["tech"]');

  await page.goto("/");
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator(".splash")).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Escape skips the intro and keeps every topic", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(intro(page)).toBeVisible();
  await page.keyboard.press("/"); // the hidden reader's search shortcut must not fire
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  expect(await page.evaluate(() => localStorage.getItem("sama4_categories"))).toBeNull();
});

test("a shared story opens straight away, with no splash or intro", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/?article=${ARTICLE_ID}`);
  await expect(page.locator(".term").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".splash")).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const theme of ["light", "dark"] as const) {
  test(`intro steps are accessible (${theme})`, async ({ page }) => {
    await mockApi(page);
    await page.addInitScript((t) => localStorage.setItem("sama4_theme", JSON.stringify(t)), theme);
    await page.goto("/");
    await expect(intro(page)).toBeVisible();
    await page.waitForTimeout(800); // splash fade and step entrance
    await page.getByRole("button", { name: "International Monetary Fund" }).click();
    await page.waitForTimeout(400);
    const axe = () =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze()
        .then((r) =>
          r.violations.map(
            (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
          ),
        );
    let summary = await axe();
    expect(summary, summary.join("\n")).toEqual([]);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(500);
    summary = await axe();
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
