import type { Metadata } from "next";
import { storyPath } from "./routes";
import { SITE_NAME, SITE_URL } from "./site";
import { metaDescription } from "./utils";
import type { ArticleDetail } from "@/types";

/** Share image for pages without one of their own (relative to metadataBase). */
export const DEFAULT_SHARE_IMAGE = "/logo-owl.png";

/**
 * Title, description, Open Graph and Twitter card for a story page. Next replaces a
 * parent's openGraph/twitter objects rather than merging them, so every field is set.
 */
export function storyMetadata(article: ArticleDetail): Metadata {
  const description = metaDescription(
    article.summary || `${article.title}, from ${article.source.name}, explained on ${SITE_NAME}.`,
  );
  const images = [article.image_url || DEFAULT_SHARE_IMAGE];
  return {
    title: article.title,
    description,
    alternates: { canonical: storyPath(article.id) },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      url: storyPath(article.id),
      title: article.title,
      description,
      images,
      publishedTime: article.published_at,
      section: article.categories[0],
      authors: [article.source.name],
    },
    twitter: {
      card: article.image_url ? "summary_large_image" : "summary",
      title: article.title,
      description,
      images,
    },
  };
}

/**
 * schema.org NewsArticle for a story page. The page is Samā4's summary, so Samā4 is
 * its publisher; the original story and its outlet are credited via `isBasedOn`.
 */
export function storyStructuredData(article: ArticleDetail): Record<string, unknown> {
  const url = `${SITE_URL}${storyPath(article.id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary ? metaDescription(article.summary) : undefined,
    image: article.image_url ? [article.image_url] : undefined,
    datePublished: article.published_at,
    url,
    mainEntityOfPage: url,
    articleSection: article.categories[0],
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}${DEFAULT_SHARE_IMAGE}` },
    },
    isBasedOn: {
      "@type": "NewsArticle",
      headline: article.title,
      url: article.source.url,
      datePublished: article.published_at,
      publisher: { "@type": "Organization", name: article.source.name },
    },
  };
}

/** JSON for an inline <script>: `<` is escaped so story text can't close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
