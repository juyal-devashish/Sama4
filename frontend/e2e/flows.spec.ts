import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fixtures from "./fixtures/api.json";
import { ARTICLE_ID, mockApi } from "./mock-api";

// The API is served from recorded fixtures (see mock-api.ts), so these run anywhere.
const ARTICLE = `/?article=${ARTICLE_ID}`;

async function axeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
  );
}

test("selecting a highlighted term opens its explanation and stays accessible", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const term = page.locator(".term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.click();
  await expect(term).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1200); // context margin slide-in
  const summary = await axeViolations(page);
  expect(summary, summary.join("\n")).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(term).toHaveAttribute("aria-pressed", "false");
});

test("reference page is accessible", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(`/article/${ARTICLE_ID}/reference`);
  await page.waitForLoadState("networkidle");
  const summary = await axeViolations(page);
  expect(summary, summary.join("\n")).toEqual([]);
});

test("reader toolbar controls stay inside the viewport", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const save = page.getByRole("button", { name: /^save/i });
  await expect(save).toBeVisible({ timeout: 10_000 });
  const width = page.viewportSize()!.width;
  for (const control of [
    page.getByRole("link", { name: "References" }),
    page.getByRole("button", { name: /link copied|copy link/i }),
    save,
  ]) {
    const box = await control.boundingBox();
    expect(box, "control is rendered").not.toBeNull();
    expect(box!.x + box!.width, "control fits horizontally").toBeLessThanOrEqual(width);
  }
});

test.describe("keyboard shortcuts", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "list and pane swap on small screens");

  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
    await page.goto(ARTICLE);
    await expect(page.getByRole("button", { name: /^save/i })).toBeVisible({ timeout: 10_000 });
  });

  test("J and K move between stories", async ({ page }) => {
    const first = new URL(page.url()).searchParams.get("article");
    await page.keyboard.press("j");
    await expect.poll(() => new URL(page.url()).searchParams.get("article")).not.toBe(first);
    await page.keyboard.press("k");
    await expect.poll(() => new URL(page.url()).searchParams.get("article")).toBe(first);
  });

  test("S toggles save and the story shows up in Saved", async ({ page }) => {
    const save = page.getByRole("button", { name: /^save/i });
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("s");
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await page.goto("/saved");
    await expect(page.getByText(fixtures.feed.articles[0].title).first()).toBeVisible();
  });

  test("/ opens search", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(page).toHaveURL(/\/search/);
  });
});

test("every story links to its original article in a new tab", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const source = (fixtures.articles as Record<string, { source: { name: string; url: string } }>)[
    ARTICLE_ID
  ].source;
  const link = page.getByRole("link", {
    name: `Read the original at ${source.name} (opens in a new tab)`,
  });
  await expect(link).toBeVisible({ timeout: 10_000 });
  await expect(link).toHaveAttribute("href", source.url);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await link.focus();
  await expect(link).toBeFocused();
});
