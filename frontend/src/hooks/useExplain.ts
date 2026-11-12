import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ExplainRequest } from "@/types";

export function useExplain() {
  return useMutation({
    mutationFn: (request: ExplainRequest) => api.explainEntity(request),
  });
}
