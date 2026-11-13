import { cache } from "react";
import { ApiError, api } from "./api";
import type { ArticleDetail } from "@/types";

/** How long the server keeps a story before asking the backend again (seconds). */
const STORY_REVALIDATE = 300;

/**
 * A story for server components (page, metadata, layouts), fetched once per request.
 * Returns null when the story doesn't exist, undefined when the backend is slow or
 * down (render anyway; the client fetches).
 */
export const getStory = cache(async (id: string): Promise<ArticleDetail | null | undefined> => {
  try {
    return await api.getArticle(id, { revalidate: STORY_REVALIDATE, timeoutMs: 4000 });
  } catch (err) {
    return err instanceof ApiError && err.isNotFound ? null : undefined;
  }
});
