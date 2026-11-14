import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types";

export function useReportExplanation(entityId: string) {
  return useMutation({
    mutationFn: (report: ReportRequest) => api.reportExplanation(entityId, report),
  });
}
