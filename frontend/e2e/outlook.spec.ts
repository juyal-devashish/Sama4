import { expect, test } from "@playwright/test";
import { ARTICLE_ID, mockApi } from "./mock-api";

const PREDICTION = {
  id: "11111111-1111-1111-1111-111111111111",
  article_id: ARTICLE_ID,
  status: "completed",
  method: "language_model",
  agent_count: 500, // the configured default; nothing was actually simulated
  simulation_rounds: 30,
  platforms: ["twitter", "reddit"],
  prediction_summary: "Other artists may follow.",
  key_findings: ["Funding cuts are contested."],
  sentiment_distribution: JSON.stringify({ positive: 58, neutral: 30, negative: 12 }),
  predicted_outcomes: ["More withdrawals", "A compromise", "No change"],
  confidence_score: 0.6,
  impact_score: 38,
  agent_perspectives: Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    agent_name: `Dr. Persona ${i}`,
    agent_role: "Arts policy analyst",
    stance: "neutral",
    perspective_text: "I think this matters.",
    influence_score: 50,
  })),
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
};

test("a finished outlook is labelled as an AI projection and explains its figures", async ({
  page,
}) => {
  await mockApi(page);
  await page.route("**/api/v1/predictions/article/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(PREDICTION),
    }),
  );
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(`/?article=${ARTICLE_ID}`);
  const outlook = page.locator("#outlook");
  await expect(outlook.getByText("Other artists may follow.")).toBeVisible({ timeout: 10_000 });

  await expect(outlook.getByText(/AI-generated projection by samā4/)).toBeVisible();
  await expect(outlook.getByText(/Based only on the \d+-word text samā4 has from/)).toBeVisible();
  await expect(outlook.getByText(/not a measured probability/)).toBeVisible();
  await expect(outlook.getByText(/it does not say how important or true/)).toBeVisible();
  // The fallback simulated nothing: never show "500 simulated".
  await expect(outlook.getByText("Viewpoints written")).toBeVisible();
  await expect(outlook.getByText("500")).toHaveCount(0);
  await expect(outlook.getByText(/No crowd simulation ran/)).toBeVisible();
  await expect(outlook.getByText(/Not a poll, survey/)).toBeVisible();
  await expect(outlook.getByText("AI persona")).toHaveCount(5);
  await expect(outlook.getByText(/They are not real people/)).toBeVisible();
});
