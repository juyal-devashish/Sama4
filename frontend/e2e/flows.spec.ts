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

test.describe("saving", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "list and pane swap on small screens");

  test("Save toggles and the story shows up in Saved", async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
    await page.goto(ARTICLE);
    const save = page.getByRole("button", { name: /^save/i });
    await expect(save).toBeVisible({ timeout: 10_000 });
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await page.goto("/saved");
    await expect(page.getByText(fixtures.feed.articles[0].title).first()).toBeVisible();
  });

  test("letter keys no longer act as shortcuts", async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
    await page.goto(ARTICLE);
    await expect(page.getByRole("button", { name: /^save/i })).toBeVisible({ timeout: 10_000 });
    const url = page.url();
    for (const key of ["j", "k", "s", "/"]) await page.keyboard.press(key);
    await expect(page.getByRole("button", { name: /^save/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(page.url()).toBe(url);
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

test("follow-up answers show the sources they used", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  await page.locator(".term").first().click();
  const box = page.getByRole("textbox", { name: /Ask a follow-up question/ });
  await box.fill("What does it make?");
  await box.press("Enter");
  const source = page.getByRole("link", { name: "Source: Article" });
  await expect(source).toBeVisible({ timeout: 10_000 });
  const article = (fixtures.articles as Record<string, { source: { url: string } }>)[ARTICLE_ID];
  await expect(source).toHaveAttribute("href", article.source.url);
  await expect(page.getByRole("link", { name: "Source: Wikipedia" })).toBeVisible();
  await expect(page.getByText("[article]")).toHaveCount(0); // raw tags never shown
});

test("publisher text and samā4-generated text are labelled", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  // Each section is headed, and described by a note saying who wrote the text.
  await expect(page.getByRole("region", { name: "In brief" })).toHaveAccessibleDescription(
    /^AI summary written by samā4/,
    { timeout: 10_000 },
  );
  await expect(page.getByRole("region", { name: /^From / })).toHaveAccessibleDescription(
    /^The publisher's text/,
  );
  await page.locator(".term").first().click();
  await expect(
    page.getByText("Written by samā4's AI from Wikipedia and this story."),
  ).toBeVisible();
});

test("the old Announcements link lands on Early access, with a way back to reading", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/announcements");
  await expect(page).toHaveURL(/\/early-access$/);
  await expect(page.getByRole("link", { name: "Early access", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Back to today's stories" })).toBeVisible();
  // One navigation: the page's own top nav is hidden inside the app.
  await expect(page.locator(".s4-landing > nav")).toBeHidden();
  await expect(page.getByText(/Samā4/)).toHaveCount(0);
});

test("a term with no explanation says so and offers a next step", async ({ page }) => {
  await mockApi(page);
  const ref = JSON.parse(
    JSON.stringify((fixtures.references as Record<string, unknown>)[ARTICLE_ID]),
  ) as { entities: { name: string; context?: string | null }[] };
  ref.entities[0].context = null;
  await page.route(`**/api/v1/articles/${ARTICLE_ID}/reference`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(ref),
    }),
  );
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(`/article/${ARTICLE_ID}/reference`);

  const row = page.getByRole("button", {
    name: new RegExp(`${ref.entities[0].name}.*Not explained yet`),
  });
  await row.click();
  await expect(page.getByText(/hasn't written an explanation for/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the story" })).toHaveAttribute(
    "href",
    `/?article=${ARTICLE_ID}`,
  );
});

test("an empty explanation in the margin offers a retry instead of a blank", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/v1/context/*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    const body = (fixtures.context as Record<string, { context: object }>)[id];
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ ...body, context: { ...body.context, text: "" } }),
    });
  });
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  await page.locator(".term").first().click();
  await expect(page.getByText(/couldn't write an explanation for this term/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("waitlist email has a real label and accessible inline errors", async ({ page }) => {
  let posted = 0;
  await mockApi(page);
  await page.route("**/api/v1/waitlist", (route) => {
    posted++;
    return route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" } });
  });
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/early-access");
  const email = page.getByRole("textbox", { name: "Your email address" });
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("autocomplete", "email");
  const submit = page.getByRole("button", { name: "Get early access" });

  await submit.click();
  await expect(page.locator("#formError[role=alert]")).toHaveText("Enter your email address.");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toBeFocused();

  await email.fill("not-an-email");
  await expect(email).not.toHaveAttribute("aria-invalid", "true"); // cleared while typing
  await email.press("Enter");
  await expect(page.locator("#formError[role=alert]")).toHaveText(
    /doesn't look like an email address/,
  );
  expect(posted).toBe(0); // invalid input never reaches the server

  await email.fill("reader@example.com");
  await email.press("Enter");
  await expect(page.locator("#formError[role=alert]")).toHaveText(/not on the list yet/);
  expect(posted).toBe(1);

  await expect(page.getByRole("link", { name: "How samā4 handles your data" })).toHaveAttribute(
    "href",
    "/privacy",
  );
});

test("privacy page explains how data is handled", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The early-access waitlist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No tracking" })).toBeVisible();
});

test("search results can be narrowed by topic, source and date", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/search");
  await page.getByRole("searchbox").or(page.getByLabel("Search stories")).first().fill("e");
  const count = page.getByText(/\d+ stor(y|ies)( of \d+)? · newest first/);
  await expect(count).toBeVisible({ timeout: 10_000 });
  const total = Number((await count.textContent())!.match(/^(\d+)/)![1]);
  expect(total).toBeGreaterThan(1);

  const source = page.getByLabel("Source");
  const firstSource = (await source.locator("option").nth(1).textContent())!;
  await source.selectOption({ index: 1 });
  const expected = Number(firstSource.match(/\((\d+)\)/)![1]);
  await expect(count).toHaveText(new RegExp(`^${expected} stor(y|ies) of ${total} · newest first`));

  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(count).toHaveText(new RegExp(`^${total} stor`));
  await expect(page.getByLabel("Topic")).toHaveValue("all");
  await expect(page.getByLabel("Date")).toHaveValue("any");
});

test("removing a saved story can be undone, back in its place", async ({ page }) => {
  const saved = [
    { id: "a", title: "Newer story", source: "BBC", saved_at: "2026-11-12T10:00:00Z" },
    { id: "b", title: "Older story", source: "NPR", saved_at: "2026-11-11T10:00:00Z" },
  ];
  await page.addInitScript((s) => {
    localStorage.setItem("sama4_onboarded", "true");
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("sama4_saved", JSON.stringify(s));
      sessionStorage.setItem("seeded", "1");
    }
  }, saved);
  await page.goto("/saved");
  const titles = page.locator("main li h2");
  await expect(titles).toHaveText(["Newer story", "Older story"]);

  await page.getByRole("button", { name: "Remove Newer story from saved" }).click();
  await expect(titles).toHaveText(["Older story"]);
  await expect(page.getByRole("status").getByText(/Removed .Newer story./)).toBeVisible();
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();

  await undo.click();
  await expect(titles).toHaveText(["Newer story", "Older story"]);
  await expect(undo).toHaveCount(0);
});

test("early-access page: sample demo labelled, stats never show zero, one CTA wording", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/early-access");
  await expect(page.getByText("Demo with a sample story, not today’s news.")).toBeVisible();
  const stats = page.locator(".stat-number");
  await expect(stats).toHaveCount(4);
  for (const text of await stats.allTextContents()) expect(text).not.toMatch(/^0/);
  await expect(page.getByText(/Join Waitlist|Get Early Access/)).toHaveCount(0);
  await expect(page.getByText(/Mistral/)).toHaveCount(0);
});
