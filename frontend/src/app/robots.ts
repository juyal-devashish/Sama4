import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Crawl everything public; /saved and /settings only hold per-browser data. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/saved", "/settings"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
