import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { partialStore, usePartialText } from "@/lib/streamStore";

/**
 * The explanation of a term, written for the story it was opened from.
 *
 * It streams: `partialText` fills in as Claude writes, and `data` arrives when it is done.
 * If the server can't stream (an older backend, a network that buffers or drops it) the
 * plain request is used instead, so an explanation never depends on streaming working.
 */
export function useEntityContext(entityId: string, articleId?: string) {
  const partialKey = queryKeys.contextPartial(entityId, articleId);
  const query = useQuery({
    queryKey: queryKeys.entityContext(entityId, articleId),
    queryFn: async ({ signal }) => {
      partialStore.clear(partialKey); // nothing left over from an earlier, abandoned attempt
      try {
        return await api.streamEntityContext(entityId, articleId, {
          signal,
          onDelta: (text) => partialStore.append(partialKey, text),
        });
      } catch (err) {
        if (signal.aborted) throw err; // the reader moved on: don't start another request
        partialStore.clear(partialKey);
        return await api.getEntityContext(entityId, articleId);
      }
    },
    enabled: !!entityId,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
  // The finished explanation replaces the partial text; drop it once that has happened.
  const partial = usePartialText(partialKey);
  useEffect(() => {
    if (query.data) partialStore.clear(partialKey);
  }, [query.data, partialKey]);
  return { ...query, partialText: query.data ? "" : partial };
}
