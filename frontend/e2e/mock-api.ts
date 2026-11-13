import type { Page, Route } from "@playwright/test";
import fixtures from "./fixtures/api.json";

/** Id of a story in the fixtures that has linked terms. */
export const ARTICLE_ID = Object.keys(fixtures.articles)[0];

const CORS = { "access-control-allow-origin": "*" };

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });
}

/**
 * Serve the API from recorded responses (fixtures/api.json, captured from the seeded
 * backend) so tests are deterministic and run in CI without a backend.
 */
export async function mockApi(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...CORS,
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    }
    if (path === "/feed") {
      const category = url.searchParams.get("category");
      if (!category) return json(route, fixtures.feed);
      // Per-topic feeds: the fixture stories in that topic, then 40 generated ones, so
      // topic switching and "Load more" can be tested against real pagination.
      const pool = [
        ...fixtures.feed.articles.filter((a) => a.categories.includes(category)),
        ...Array.from({ length: 40 }, (_, i) => ({
          ...fixtures.feed.articles[0],
          id: `${category}-${i}`,
          title: `${category} story ${i + 1}`,
          categories: [category],
        })),
      ];
      const page = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const articles = pool.slice((page - 1) * limit, page * limit);
      return json(route, {
        articles,
        pagination: { page, limit, total: pool.length, has_next: page * limit < pool.length },
      });
    }
    if (path === "/context/explain") {
      const { article_id, question } = route.request().postDataJSON() as {
        article_id: string;
        question: string;
      };
      const article = (fixtures.articles as Record<string, { source: { url: string } }>)[
        article_id
      ];
      return json(route, {
        entity: null,
        explanation: `You asked: ${question}. The story covers it [article]. Background agrees [Wikipedia].`,
        sources: [
          { type: "article", title: "The article", url: article?.source.url },
          { type: "wikipedia", title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Example" },
        ],
        confidence: 0.85,
      });
    }
    if (path === "/predictions/trending") return json(route, fixtures.trending);
    if (path.startsWith("/predictions/article/")) return json(route, null);

    let m = path.match(/^\/articles\/([^/]+)\/reference$/);
    if (m) {
      const body = (fixtures.references as Record<string, unknown>)[m[1]];
      return body ? json(route, body) : json(route, { detail: "Not found" }, 404);
    }
    m = path.match(/^\/articles\/([^/]+)$/);
    if (m) {
      const body = (fixtures.articles as Record<string, unknown>)[m[1]];
      return body ? json(route, body) : json(route, { detail: "Not found" }, 404);
    }
    m = path.match(/^\/context\/([^/]+)$/);
    if (m) {
      const body = (fixtures.context as Record<string, unknown>)[m[1]];
      return body ? json(route, body) : json(route, { detail: "Not found" }, 404);
    }
    return json(route, { detail: `unmocked: ${path}` }, 404);
  });
}
