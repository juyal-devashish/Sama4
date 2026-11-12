import { expect, test, type Page } from "@playwright/test";
import fixtures from "./fixtures/api.json";
import { mockApi } from "./mock-api";

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "list and pane swap on small screens");

const titles = (page: Page) => page.locator('section[aria-label="Stories"] li h2');
const inTopic = (topic: string) => {
  const real = new Set(
    fixtures.feed.articles.filter((a) => a.categories.includes(topic)).map((a) => a.title),
  );
  return (title: string) => real.has(title) || title.startsWith(`${topic} story`);
};

async function expectOnlyTopic(page: Page, topic: string, count: number) {
  await expect(titles(page)).toHaveCount(count, { timeout: 10_000 });
  const all = await titles(page).allTextContents();
  expect(
    all.filter((t) => !inTopic(topic)(t)),
    `stories outside ${topic}`,
  ).toEqual([]);
  // The open story belongs to this topic (no unrelated article left open).
  const open = new URL(page.url()).searchParams.get("article");
  const openCard = page.locator(`section[aria-label="Stories"] [aria-current="true"] h2`);
  if (open) expect(inTopic(topic)((await openCard.textContent()) ?? "")).toBe(true);
}

const pool = (topic: string) =>
  fixtures.feed.articles.filter((a) => a.categories.includes(topic)).length + 40;

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
});

test("topic, chips, feed and open story stay in sync across Load more, switching and back", async ({
  page,
}) => {
  await page.goto("/?topic=science");
  await expectOnlyTopic(page, "science", 25);
  await page.getByRole("button", { name: "Load more stories" }).click();
  await expectOnlyTopic(page, "science", pool("science"));

  // Science keeps the page it loaded with "Load more"; World only ever loads one page.
  const expected = (topic: string) => (topic === "science" ? pool("science") : 25);
  for (const topic of ["world", "science", "world"]) {
    const label = topic[0].toUpperCase() + topic.slice(1);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`topic=${topic}`));
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectOnlyTopic(page, topic, expected(topic));
  }

  await page.goBack();
  await expect(page).toHaveURL(/topic=science/);
  await expect(page.getByRole("button", { name: "Science", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectOnlyTopic(page, "science", pool("science"));
});

test("a link to a hidden topic still shows it selected; an unknown topic shows All", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("sama4_categories", JSON.stringify(["tech"])),
  );
  await page.goto("/?topic=world");
  await expect(page.getByRole("button", { name: "World", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectOnlyTopic(page, "world", 25);

  await page.goto("/?topic=nonsense");
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
