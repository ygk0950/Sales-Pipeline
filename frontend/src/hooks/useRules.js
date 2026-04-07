import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

export function useRules() {
  return useQuery({
    queryKey: ["rules"],
    queryFn: () => api.get("/api/rules").then((r) => r.data),
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/api/rules", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) =>
      api.put(`/api/rules/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/rules/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useEvaluateRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/rules/evaluate").then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function usePreviewRule() {
  return useMutation({
    mutationFn: (id) =>
      api.post(`/api/rules/${id}/preview`).then((r) => r.data),
  });
}
