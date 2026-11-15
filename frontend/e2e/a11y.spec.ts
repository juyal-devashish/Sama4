import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

const routes = [
  "/",
  "/search",
  "/saved",
  "/outlook",
  "/early-access",
  "/settings",
  "/privacy",
  "/about",
  "/sources",
];
const themes = ["light", "dark"] as const;

for (const route of routes) {
  for (const theme of themes) {
    test(`axe: ${route} (${theme})`, async ({ page }) => {
      await mockApi(page);
      await page.addInitScript((t) => {
        try {
          localStorage.setItem("sama4_theme", JSON.stringify(t));
          localStorage.setItem("sama4_onboarded", "true");
        } catch {}
      }, theme);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      // The early-access page fades its hero and phone mock in; axe samples
      // mid-fade colours unless we let the animations finish first.
      if (route === "/early-access") await page.waitForTimeout(4000);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
      );
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }
}

// The first-run intro has its own checks in onboarding.spec.ts.

test("loading skeletons are accessible (feed request held open)", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.route("**/api/v1/feed**", () => {
    /* never fulfil: keep the skeleton on screen */
  });
  await page.goto("/");
  await expect(page.getByLabel("Loading stories")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
});

test.describe("exactly one h1 per page", () => {
  const pages = [...routes, `/article/${ARTICLE_ID}`];
  for (const route of pages) {
    test(route.startsWith("/article") ? "an open story" : route, async ({ page }) => {
      await mockApi(page);
      await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    });
  }
});

test("the first Tab stop skips the navigation and lands in the content", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/saved");
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
});

// The open explanation panel in the dark theme (the flows spec scans it in light), at both
// project widths: 1440 shows the margin beside the story, 375 a drawer.
test("axe: the open explanation panel (dark)", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem("sama4_theme", JSON.stringify("dark"));
    localStorage.setItem("sama4_onboarded", "true");
  });
  await page.goto(`/article/${ARTICLE_ID}`);
  const term = page.locator("p .term").first();
  await term.waitFor({ timeout: 10_000 });
  await term.click();
  await page.waitForTimeout(1200); // the margin slides in
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
});
