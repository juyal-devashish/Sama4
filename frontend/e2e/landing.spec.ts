import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
});

test("early access: no claim of a sign-up before there is one", async ({ page, request }) => {
  const html = await (await request.get("/early-access")).text();
  expect(html).not.toContain("You&#x27;re on the list");
  expect(html).not.toContain("You're on the list");
  await page.goto("/early-access");
  await expect(page.locator("#formSuccess")).toBeHidden();
  await expect(page.locator("#formSuccess")).toHaveText("");
});

test("early access: a real heading outline", async ({ page }) => {
  await page.goto("/early-access");
  const headings = await page
    .getByRole("heading")
    .evaluateAll((els) => els.map((e) => `${e.tagName} ${e.textContent?.trim()}`));
  expect(headings.filter((h) => h.startsWith("H1"))).toHaveLength(1);
  // The sample headline in the phone demo is not a heading.
  expect(headings.join("\n")).not.toContain("Fed Holds Rates");
  for (const label of ["How it works", "See it working", "Available now"]) {
    expect(headings, label).toContain(`H2 ${label}`);
  }
  // Every H3 sits under an H2.
  expect(headings.findIndex((h) => h.startsWith("H3"))).toBeGreaterThan(
    headings.findIndex((h) => h.startsWith("H2")),
  );
});

test("early access: one footer, feature icons are drawings, phone chrome is hidden", async ({
  page,
}) => {
  await page.goto("/early-access");
  await expect(page.locator("footer")).toHaveCount(1);
  await expect(page.locator("footer").getByRole("link", { name: "sama4.online" })).toHaveCount(0);
  const icons = page.locator(".value-card-icon, .feature-icon");
  expect(await icons.count()).toBe(10);
  for (const icon of await icons.all()) {
    await expect(icon.locator("svg")).toHaveCount(1);
    await expect(icon).not.toHaveText(/[◉◎◈⊕✓≋⌕☰◇]/);
  }
  await expect(page.locator(".phone-statusbar")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".phone-notch")).toHaveAttribute("aria-hidden", "true");
  // Each feature is described once: "ten outlets" appears a single time.
  expect(await page.getByText(/ten outlets/).count()).toBe(1);
});
