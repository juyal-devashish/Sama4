import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
});

for (const [path, title] of [
  ["/about", "About"],
  ["/sources", "Sources"],
  ["/how-explanations-work", "How explanations are made"],
  ["/privacy", "Privacy"],
] as const) {
  test(`${path}: shares as itself and ends the same way as its siblings`, async ({ page }) => {
    await page.goto(path);
    const og = (p: string) => page.locator(`meta[property="${p}"]`).first().getAttribute("content");
    expect(await og("og:title")).toBe(`${title} · Samā4`);
    expect(await og("og:description")).not.toContain("News with context built in");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Back to today's stories" })).toBeVisible();
    // The shared footer comes after it.
    await expect(main.locator("footer").getByRole("link", { name: "Privacy" })).toBeVisible();
  });
}

test("About has a Contact section with a prefilled correction and publisher request", async ({
  page,
}) => {
  await page.goto("/about#contact");
  const section = page.locator("#contact");
  await expect(section.getByRole("heading", { name: "Contact" })).toBeVisible();
  await expect(section.getByRole("link", { name: "Send a correction" })).toHaveAttribute(
    "href",
    /^mailto:.+\?subject=Sam%C4%814%20correction$/,
  );
  await expect(section.getByRole("link", { name: "Make a publisher request" })).toHaveAttribute(
    "href",
    /subject=Sam%C4%814%20publisher%20request$/,
  );
});

test("Privacy says story pictures load from publishers, and dates like the rest of the app", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.getByText(/Story pictures load straight from each publisher/)).toBeVisible();
  await expect(page.getByText(/Last updated November 15, 2026/)).toBeVisible();
});

test("an unknown address offers Today and Search", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "Search stories" })).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: "Back to today's stories" }),
  ).toBeVisible();
});

// Needs the backend's /sources (CI has none: the page then says it couldn't load).
test("Sources links each outlet's site and says what each link is", async ({ page }) => {
  await page.goto("/sources");
  test.skip(
    (await page.getByText("couldn't load right now").count()) > 0,
    "no backend for /sources here",
  );
  const nyt = page.getByRole("heading", { name: /The New York Times/ });
  await expect(nyt.getByRole("link")).toHaveAttribute("href", "https://www.nytimes.com");
  // No link text is a raw feed URL.
  const texts = await page.locator("main ul a").allTextContents();
  expect(texts.filter((t) => /^https?:\/\//.test(t.trim()))).toEqual([]);
  await expect(page.getByRole("link", { name: /RSS feed for Bloomberg, Markets/ })).toBeVisible();
});

test("Search is in the HTML before any script runs", async ({ request }) => {
  const html = await (await request.get("/search")).text();
  expect(html).toContain('role="search"');
  expect(html).toContain('id="q"');
  expect(html).toContain("Find stories by headline");
});
