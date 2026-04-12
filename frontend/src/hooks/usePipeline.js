import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

export function usePipeline() {
  return useQuery({
    queryKey: ["pipeline"],
    queryFn: () => api.get("/api/pipeline").then((r) => r.data),
  });
}

export function useFlushStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageId) =>
      api.post(`/api/leads/flush-stage?stage_id=${stageId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["field-values"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useResetAllLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/api/leads/all").then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["field-values"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useStages() {
  return useQuery({
    queryKey: ["stages"],
    queryFn: () => api.get("/api/pipeline/stages").then((r) => r.data),
    staleTime: Infinity,
  });
}
