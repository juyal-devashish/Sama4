import { describe, expect, it } from "vitest";
import { DEFAULT_SHARE_IMAGE, jsonLd, storyMetadata, storyStructuredData } from "./seo";
import type { ArticleDetail } from "@/types";

const story: ArticleDetail = {
  id: "abc",
  title: "A headline",
  summary: "A short summary.",
  image_url: "https://example.com/a.jpg",
  source: { name: "Example News", url: "https://example.com/story" },
  published_at: "2026-11-13T08:00:00Z",
  categories: ["world"],
  entities: [],
};

describe("storyMetadata", () => {
  it("describes the story as an article with its image", () => {
    const m = storyMetadata(story);
    expect(m.title).toBe("A headline");
    expect(m.description).toBe("A short summary.");
    expect(m.alternates).toEqual({ canonical: "/article/abc" });
    expect(m.openGraph).toMatchObject({
      type: "article",
      url: "/article/abc",
      images: ["https://example.com/a.jpg"],
      publishedTime: "2026-11-13T08:00:00Z",
      authors: ["Example News"],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("falls back to the logo and a small card without an image or summary", () => {
    const m = storyMetadata({ ...story, image_url: undefined, summary: undefined });
    expect(m.description).toBe("A headline, from Example News, explained on Samā4.");
    expect(m.openGraph).toMatchObject({ images: [DEFAULT_SHARE_IMAGE] });
    expect(m.twitter).toMatchObject({ card: "summary" });
  });
});

describe("storyStructuredData", () => {
  it("is a NewsArticle crediting the original publisher", () => {
    const ld = storyStructuredData(story);
    expect(ld).toMatchObject({
      "@type": "NewsArticle",
      headline: "A headline",
      url: "https://www.sama4.online/article/abc",
      datePublished: "2026-11-13T08:00:00Z",
      publisher: { name: "Samā4" },
      isBasedOn: {
        url: "https://example.com/story",
        publisher: { "@type": "Organization", name: "Example News" },
      },
    });
  });
});

describe("jsonLd", () => {
  it("escapes < so text can't end the script tag", () => {
    const out = jsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ headline: "</script><script>alert(1)</script>" });
  });
});
