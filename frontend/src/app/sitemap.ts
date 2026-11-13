import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { storyPath } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";
import type { ArticleCard } from "@/types";

/** Rebuilt at most hourly; the feed changes once a night. */
export const revalidate = 3600;

const PAGE_SIZE = 100; // the feed API's maximum
const MAX_PAGES = 50; // 5,000 stories, well under the 50,000-URL sitemap limit

/** Public pages. /saved and /settings are per-browser, so they're left out. */
const STATIC_PATHS = ["/", "/early-access", "/outlook", "/search", "/about", "/privacy"];

async function allStories(): Promise<ArticleCard[]> {
  const stories: ArticleCard[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await api.getFeed({ page, limit: PAGE_SIZE }, { revalidate, timeoutMs: 10_000 });
    stories.push(...res.articles);
    if (!res.pagination.has_next) break;
  }
  return stories;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If the backend is down, still list the static pages.
  const stories = await allStories().catch(() => []);
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...stories.map((s) => ({
      url: `${SITE_URL}${storyPath(s.id)}`,
      lastModified: s.published_at,
    })),
  ];
}
