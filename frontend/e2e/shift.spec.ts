import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

// Layout shift budget (audit: "load and shift not measured"). 0.1 is Google's "good" line.
const BUDGET = 0.1;

for (const [name, path] of [
  ["Today", "/"],
  ["a story", `/article/${ARTICLE_ID}`],
] as const) {
  test(`${name} stays under the layout-shift budget`, async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => {
      localStorage.setItem("sama4_onboarded", "true");
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, `cumulative layout shift ${cls.toFixed(3)}`).toBeLessThan(BUDGET);
  });
}
