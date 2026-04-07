import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

export function usePipeline() {
  return useQuery({
    queryKey: ["pipeline"],
    queryFn: () => api.get("/api/pipeline").then((r) => r.data),
  });
}

export function useStages() {
  return useQuery({
    queryKey: ["stages"],
    queryFn: () => api.get("/api/pipeline/stages").then((r) => r.data),
    staleTime: Infinity,
  });
}
