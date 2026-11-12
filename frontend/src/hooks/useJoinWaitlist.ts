import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useJoinWaitlist() {
  return useMutation({ mutationFn: (email: string) => api.joinWaitlist(email) });
}
