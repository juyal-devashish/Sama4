import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

const routes = [
  "/",
  "/search",
  "/saved",
  "/outlook",
  "/early-access",
  "/settings",
  "/privacy",
  "/about",
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
