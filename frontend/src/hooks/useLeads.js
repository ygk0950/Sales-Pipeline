import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

export function useLeads(params = {}) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: () => api.get("/api/leads", { params }).then((r) => r.data),
  });
}

export function useLead(id) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.get(`/api/leads/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage_id }) =>
      api.patch(`/api/leads/${id}/stage`, { stage_id }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
