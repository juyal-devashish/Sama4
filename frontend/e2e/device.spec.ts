import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
});

const saveOne = async (page: import("@playwright/test").Page) => {
  await page.goto(`/article/${ARTICLE_ID}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
};

test("an empty Saved page says where things are kept and links to Today", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByText(/saved on this device only/i)).toBeVisible();
  await expect(page.getByText(/press S/i)).toHaveCount(0); // shortcuts were removed
  await expect(page.getByRole("link", { name: "Go to today's stories" })).toBeVisible();
});

test("saved stories can be exported, and imported into a clean browser", async ({
  page,
  browser,
}) => {
  await saveOne(page);
  await page.goto("/saved");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^sama4-saved-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();

  // A fresh context stands in for another browser.
  const other = await browser.newContext();
  const page2 = await other.newPage();
  await mockApi(page2);
  await page2.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page2.goto("/saved");
  await expect(page2.getByText("Nothing saved yet")).toBeVisible();
  await page2.locator('input[type="file"]').setInputFiles(path);
  await expect(page2.getByText(/Added 1 story \(1 saved now\)/)).toBeVisible();
  await expect(page2.locator("main li h2")).toHaveCount(1);

  // Importing the same file again adds nothing.
  await page2.locator('input[type="file"]').setInputFiles(path);
  await expect(page2.getByText(/Nothing new/)).toBeVisible();
  await other.close();
});

test("a file that isn't a saved-stories file is refused and changes nothing", async ({ page }) => {
  await page.goto("/saved");
  await page.locator('input[type="file"]').setInputFiles({
    name: "x.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(page.getByText(/isn't a Samā4 saved-stories file/)).toBeVisible();
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});

test("Settings clears what Samā4 keeps on this device, after a confirmation", async ({ page }) => {
  await saveOne(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Clear data on this device" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/saved");
  await expect(page.locator("main li h2")).toHaveCount(1); // cancelled: still there

  await page.goto("/settings");
  await page.getByRole("button", { name: "Clear data on this device" }).click();
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await expect(page.getByText(/Cleared\. Saved stories/)).toBeVisible();
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sama4_"))),
  ).toEqual([]);
  await page.goto("/saved");
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});
