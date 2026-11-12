import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function usePrediction(articleId: string) {
  return useQuery({
    queryKey: queryKeys.prediction(articleId),
    queryFn: () => api.getArticlePrediction(articleId),
    enabled: !!articleId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePredictionStatus(predictionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.predictionStatus(predictionId),
    queryFn: () => api.getPredictionStatus(predictionId),
    enabled: enabled && !!predictionId,
    refetchInterval: (query) => {
      // Stop on a terminal status, and on an error (e.g. 404): keep polling only a live run.
      if (query.state.status === "error") return false;
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000; // poll every 3s while running
    },
  });
}

export function useTriggerSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      articleId,
      options,
    }: {
      articleId: string;
      options?: { agent_count?: number; simulation_rounds?: number; prediction_focus?: string };
    }) => api.triggerSimulation(articleId, options),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prediction(variables.articleId) });
    },
  });
}

export function useCancelPrediction(articleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (predictionId: string) => api.cancelPrediction(predictionId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.prediction(articleId) }),
  });
}

export function usePredictionChat() {
  return useMutation({
    mutationFn: (request: {
      prediction_id: string;
      message: string;
      history: { role: string; content: string }[];
    }) => api.chatWithPrediction(request),
  });
}

export function useAgentInterview() {
  return useMutation({
    mutationFn: (request: {
      prediction_id: string;
      agent_perspective_id: string;
      question: string;
    }) => api.interviewAgent(request),
  });
}

export function useTrendingPredictions(limit: number = 20) {
  return useQuery({
    queryKey: queryKeys.trendingPredictions(limit),
    queryFn: () => api.getTrendingPredictions(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
