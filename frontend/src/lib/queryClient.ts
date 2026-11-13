import { QueryClient } from "@tanstack/react-query";

/**
 * A fresh client per browser session or server request. A module-level client would
 * be shared by every request the server renders, leaking one visitor's cache to the next.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
