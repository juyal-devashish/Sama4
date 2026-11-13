import type { Metadata } from "next";
import { storyPath } from "./routes";
import { SITE_NAME } from "./site";
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
