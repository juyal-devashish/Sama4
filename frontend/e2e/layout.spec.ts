import { expect, test } from "@playwright/test";

test("settings theme switch fits its container at every width", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/settings");
  const group = page.getByRole("radiogroup", { name: "Theme" });
  await expect(group).toBeVisible();
  const g = (await group.boundingBox())!;
  expect(g.x + g.width, "group stays inside the viewport").toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  for (const radio of await page.getByRole("radio").all()) {
    const b = (await radio.boundingBox())!;
    expect(b.x + b.width, "option stays inside the group").toBeLessThanOrEqual(g.x + g.width);
    expect(b.height, "label does not wrap").toBeLessThanOrEqual(32);
  }
});
