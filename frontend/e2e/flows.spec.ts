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

test("the explanation panel takes focus, keeps Tab inside it and gives focus back", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const term = page.locator("p .term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.focus();
  await page.keyboard.press("Enter");
  const panel = page.locator("#context-margin");
  await expect(panel).toBeFocused();
  // A live region says when the explanation is ready, for screen-reader users.
  await expect(page.locator("#explanation-status")).toHaveText(/^Explanation of .+ loaded\.$/);

  // Wide windows show the margin beside the story (no trap); drawers must hold focus.
  const isDrawer = await page.evaluate(() => window.matchMedia("(max-width: 1479px)").matches);
  if (isDrawer) {
    const trail: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        const tag = `${el?.tagName}.${el?.getAttribute("aria-label") ?? el?.textContent?.slice(0, 20)}`;
        return el?.closest("#context-margin") ? `in:${tag}` : `OUT:${tag}`;
      });
      trail.push(where);
      expect(where.startsWith("in:"), `Tab #${i + 1} left the panel: ${trail.join(" > ")}`).toBe(
        true,
      );
    }
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Shift+Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest("#context-margin"),
      );
      expect(inside, `Shift+Tab #${i + 1} left the panel`).toBe(true);
    }
  }

  await page.keyboard.press("Escape");
  await expect(term).toBeFocused();
});

test("any selected text can be explained, and honest when nothing is known", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  await expect(page.locator("p .term").first()).toBeVisible({ timeout: 10_000 });

  // Select two plain words from the story body (no highlighted term inside).
  const selectTwoPlainWords = () =>
    page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.querySelector("section[data-explainable]:not(:has(h2#summary-label)) p")!,
        NodeFilter.SHOW_TEXT,
      );
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? "";
        const m = /([A-Za-z]{4,}) ([A-Za-z]{4,})/.exec(text);
        if (m && !(node.parentElement?.closest(".term") ?? false)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const sel = window.getSelection()!;
          sel.removeAllRanges();
          sel.addRange(range);
          return m[0];
        }
      }
      return null;
    });

  const words = await selectTwoPlainWords();
  expect(words).toBeTruthy();
  const explain = page.getByRole("button", { name: /Explain/ });
  await expect(explain).toBeVisible();
  await explain.click();

  const panel = page.locator("#context-margin");
  await expect(panel.getByText("Selected text")).toBeVisible();
  await expect(panel.getByText(`"${words}" is explained here.`)).toBeVisible();
  await expect(panel.getByText(/Written by AI/)).toBeVisible();
  await expect(page.locator("#explanation-status")).toHaveText(/loaded\./);
  await page.keyboard.press("Escape");
  await expect(panel.getByText("Selected text")).toHaveCount(0);
});

test("selected text with no reliable information says so instead of guessing", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/v1/context/selection", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        text: "some words",
        explanation: "",
        reliable: false,
        generated_at: new Date().toISOString(),
        cached: false,
        sources: [],
      }),
    }),
  );
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  await expect(page.locator("p .term").first()).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => {
    const body = document.querySelector("section[data-explainable]:not(:has(h2#summary-label)) p")!;
    const range = document.createRange();
    const node = body.firstChild!;
    range.setStart(node, 0);
    range.setEnd(node, Math.min(12, node.textContent!.length));
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  await page.getByRole("button", { name: /Explain/ }).click();
  await expect(page.locator("#context-margin").getByText(/no reliable information/)).toBeVisible();
});

test("More detail shows a longer explanation only when asked", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const term = page.locator("p .term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.click();
  const panel = page.locator("#context-margin");
  await expect(panel.getByText("The longer explanation starts here.")).toHaveCount(0);

  await panel.getByRole("button", { name: "More detail" }).click();

  await expect(panel.getByText("The longer explanation starts here.")).toBeVisible();
  await expect(panel.getByText("And it continues in a second paragraph.")).toBeVisible();
  await expect(panel.getByText(/written by AI from the same sources/)).toBeVisible();
});

test("an explanation is requested for the story it is opened from", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  const asked: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/v1\/context\/[0-9a-f-]{36}(\?|$)/.test(r.url())) asked.push(r.url());
  });
  await page.goto(ARTICLE);
  const term = page.locator("p .term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.click();
  await expect(page.locator("#explanation-status")).toHaveText(/loaded\./);

  expect(asked.length).toBeGreaterThan(0);
  expect(asked.every((u) => new URL(u).searchParams.get("article_id") === ARTICLE_ID)).toBe(true);
});

test("the logo is a small WebP and loads in both themes", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  const sizes: Record<string, number> = {};
  page.on("response", (r) => {
    if (/logo-owl.*\.(png|webp)$/.test(r.url()))
      sizes[r.url()] = Number(r.headers()["content-length"] ?? 0);
  });
  await page.goto("/saved");
  await page.waitForLoadState("networkidle");

  const logos = page.locator("img[src^='/logo-owl']");
  expect(await logos.count()).toBeGreaterThan(0);
  for (const src of await logos.evaluateAll((els) => els.map((e) => e.getAttribute("src")))) {
    expect(src).toMatch(/\.webp$/);
  }
  const visible = page.locator("img[src='/logo-owl.webp']:visible").first();
  expect(await visible.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  for (const bytes of Object.values(sizes)) expect(bytes).toBeLessThan(15_000);
});

const sseEvent = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Answer the explanation stream for any term with `text`, built from that term's fixture. */
async function streamExplanations(
  page: import("@playwright/test").Page,
  text: string,
  respond: "stream" | "not-found" | "not-a-stream" = "stream",
) {
  await page.route(/\/api\/v1\/context\/[0-9a-f-]{36}\/stream/, (route) => {
    const cors = { "access-control-allow-origin": "*" };
    if (respond === "not-found") return route.fulfill({ status: 404, headers: cors, body: "" });
    if (respond === "not-a-stream")
      return route.fulfill({ status: 200, headers: cors, contentType: "text/html", body: "<p>" });
    const id = new URL(route.request().url()).pathname.split("/")[4];
    const full = (fixtures.context as Record<string, { context: { text: string } }>)[id];
    const done = { ...full, context: { ...full.context, text, cached: false } };
    const words = text.split(" ");
    return route.fulfill({
      status: 200,
      headers: { ...cors, "cache-control": "no-cache" },
      contentType: "text/event-stream",
      body:
        words
          .map((w, i) => sseEvent("delta", { text: w + (i < words.length - 1 ? " " : "") }))
          .join("") + sseEvent("done", done),
    });
  });
}

test("an explanation streams in and the finished text replaces it", async ({ page }) => {
  await mockApi(page);
  await streamExplanations(page, "Streamed explanation text for this term.");
  let plainGets = 0;
  page.on("request", (r) => {
    if (/\/api\/v1\/context\/[0-9a-f-]{36}(\?|$)/.test(r.url())) plainGets++;
  });
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  const term = page.locator("p .term").first();
  await expect(term).toBeVisible({ timeout: 10_000 });
  await term.click();

  await expect(
    page.locator("#context-margin").getByText("Streamed explanation text for this term."),
  ).toBeVisible();
  await expect(page.locator("#explanation-status")).toHaveText(/loaded\./);
  expect(plainGets).toBe(0); // the stream was enough
});

for (const respond of ["not-found", "not-a-stream"] as const) {
  test(`if the stream is unavailable (${respond}) the plain request still explains the term`, async ({
    page,
  }) => {
    await mockApi(page);
    await streamExplanations(page, "never shown", respond);
    await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
    await page.goto(ARTICLE);
    const term = page.locator("p .term").first();
    await expect(term).toBeVisible({ timeout: 10_000 });
    await term.click();

    await expect(page.locator("#explanation-status")).toHaveText(/loaded\./);
    await expect(page.locator("#context-margin").getByText("never shown")).toHaveCount(0);
    await expect(page.locator("#context-margin").getByText("Try again")).toHaveCount(0);
  });
}

test("a term longer than the line wraps inside its box instead of overflowing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(`/article/${ARTICLE_ID}`);
  await expect(page.locator("p .term").first()).toBeVisible({ timeout: 10_000 });

  const fit = await page.evaluate(() => {
    const term = document.querySelector<HTMLElement>("p .term")!;
    term.textContent = "The United States Department of Health and Human Services Administration";
    const line = term.closest("p")!.getBoundingClientRect();
    return {
      overflowsLine: term.getBoundingClientRect().right > line.right + 0.5,
      pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(fit).toEqual({ overflowsLine: false, pageScrollsSideways: false });
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

test("publisher text and Samā4-generated text are labelled", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto(ARTICLE);
  // Each section is headed, and described by a note saying who wrote the text.
  await expect(page.getByRole("region", { name: "In brief" })).toHaveAccessibleDescription(
    /^AI summary written by Samā4/,
    { timeout: 10_000 },
  );
  await expect(page.getByRole("region", { name: /’s description$/ })).toHaveAccessibleDescription(
    /^.+’s own description of this story, unaltered\. Samā4 adds the highlights\.$/,
  );
  await page.locator(".term").first().click();
  // Names its sources (none in these fixtures) and the date it was written.
  await expect(page.getByText(/^Written by Samā4's AI.*, as of /)).toBeVisible();
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
  // One on-page navigation, the in-app bar; the page's old nav and mobile menu are gone.
  await expect(page.locator(".s4-landing nav, .s4-landing .mobile-menu")).toHaveCount(0);
  // Narrow screens hide the bar's links with display:none, so assistive tech skips them too.
  const wide = (page.viewportSize()?.width ?? 0) >= 640;
  await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(wide ? 1 : 0);
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
    `/article/${ARTICLE_ID}`,
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
  const submit = page.getByRole("button", { name: "Join the waitlist" });

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

  await expect(page.getByRole("link", { name: "How Samā4 handles your data" })).toHaveAttribute(
    "href",
    "/privacy",
  );
});

test("privacy page explains how data is handled", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The waitlist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No tracking" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Limits on heavy use" })).toBeVisible();
  await expect(page.getByText(/daily totals of how the app is used/)).toBeVisible();
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

test("the search query lives in the address and a shared link reopens it", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/search");
  const box = page.getByLabel("Search stories");
  await box.fill("art");
  await expect(page).toHaveURL(/\/search\?q=art$/);

  await box.fill("");
  await expect(page).toHaveURL(/\/search$/);

  await page.goto("/search?q=art");
  await expect(box).toHaveValue("art");
  await expect(page.getByText(/\d+ stor(y|ies)( of \d+)? · newest first/)).toBeVisible({
    timeout: 10_000,
  });
});

test("Share hands the story's own address to the system share sheet", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem("sama4_onboarded", "true");
    (window as unknown as { shared: unknown[] }).shared = [];
    navigator.share = async (data) => {
      (window as unknown as { shared: unknown[] }).shared.push(data);
    };
  });
  await page.goto(`/article/${ARTICLE_ID}`);
  await page.getByRole("button", { name: "Share" }).click();
  const shared = (await page.evaluate(
    () => (window as unknown as { shared: unknown[] }).shared,
  )) as {
    title: string;
    url: string;
  }[];
  expect(shared).toHaveLength(1);
  expect(shared[0].url).toBe(new URL(`/article/${ARTICLE_ID}`, page.url()).href);
  expect(shared[0].title.length).toBeGreaterThan(0);
});

test("stories stored since the reader's last visit are marked New, and only then", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  // First ever visit: nothing is marked.
  await page.goto("/");
  await expect(page.locator("section[aria-label=Stories] li").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("since your last visit")).toHaveCount(0);

  // Returning after a long time (an earlier visit is on record): everything newer is marked.
  const returning = await page.context().newPage();
  await mockApi(returning);
  await returning.addInitScript(() => {
    localStorage.setItem("sama4_onboarded", "true");
    if (!sessionStorage.getItem("sama4_visit_baseline"))
      localStorage.setItem("sama4_last_visit", "1");
  });
  await returning.goto("/");
  await expect(returning.getByText("since your last visit").first()).toBeAttached({
    timeout: 10_000,
  });
  // A reload in the same session keeps the markers.
  await returning.reload();
  await expect(returning.getByText("since your last visit").first()).toBeAttached({
    timeout: 10_000,
  });
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

test("early-access page: sample demo labelled, no unsourced stats, one CTA wording", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sama4_onboarded", "true"));
  await page.goto("/early-access");
  await expect(page.getByText("Demo with a sample story, not today’s news.")).toBeVisible();
  await expect(page.getByText(/Uptime|Articles Processed|Latency/i)).toHaveCount(0);
  await expect(page.getByText(/Join Waitlist|Get Early Access/)).toHaveCount(0);
  await expect(page.getByText(/Mistral/)).toHaveCount(0);
  // Only what's built is offered; the waitlist is for sign-in and personalization.
  await expect(page.getByText(/Browser extension|Voice briefings/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /tailored to you/ })).toBeVisible();
});
