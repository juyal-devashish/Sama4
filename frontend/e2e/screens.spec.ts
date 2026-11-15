import { test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

/**
 * Evidence, not assertions: a screenshot of every route at three widths in both themes,
 * saved to test-results/screens (CI uploads the folder as an artifact). They are what a
 * reviewer opens to judge layout, spacing and contrast, which the DOM checks can't.
 * Runs once, in the desktop project, because it sets its own viewports.
 */
const ROUTES: [name: string, path: string][] = [
  ["today", "/"],
  ["story", `/article/${ARTICLE_ID}`],
  ["search", "/search"],
  ["saved", "/saved"],
  ["outlook", "/outlook"],
  ["settings", "/settings"],
  ["early-access", "/early-access"],
  ["about", "/about"],
  ["sources", "/sources"],
  ["how-explanations-work", "/how-explanations-work"],
  ["privacy", "/privacy"],
  ["not-found", "/no-such-page"],
];
const WIDTHS = [1440, 768, 375] as const;
const THEMES = ["light", "dark"] as const;

test.describe("screenshot matrix", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sets its own viewports");
  });

  for (const [name, path] of ROUTES) {
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        test(`${name} ${width} ${theme}`, async ({ page }) => {
          await mockApi(page);
          await page.addInitScript((t) => {
            try {
              localStorage.setItem("sama4_theme", JSON.stringify(t));
              localStorage.setItem("sama4_onboarded", "true");
            } catch {}
          }, theme);
          await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          // The early-access page fades its hero in.
          if (path === "/early-access") await page.waitForTimeout(4000);
          await page.screenshot({
            path: `test-results/screens/${name}-${width}-${theme}.png`,
            fullPage: false,
          });
        });
      }
    }
  }

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`explanation panel ${width} ${theme}`, async ({ page }) => {
        await mockApi(page);
        await page.addInitScript((t) => {
          try {
            localStorage.setItem("sama4_theme", JSON.stringify(t));
            localStorage.setItem("sama4_onboarded", "true");
          } catch {}
        }, theme);
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.goto(`/article/${ARTICLE_ID}`);
        const term = page.locator("p .term").first();
        await term.waitFor({ timeout: 10_000 });
        await term.click();
        await page.waitForTimeout(1200); // the margin slides in
        await page.screenshot({
          path: `test-results/screens/panel-${width}-${theme}.png`,
        });
      });
    }
  }
});
