import { useQuery } from "@tanstack/react-query";

import { apiRequestWithMeta } from "@/api/client";
import { healthSchema } from "@/lib/schemas";
import type { HealthPayload } from "@/types/api";

export interface HealthResult extends HealthPayload {
  latencyMs: number;
  traceId: string;
}

async function fetchHealth(): Promise<HealthResult> {
  const startedAt = performance.now();
  const { data, meta } = await apiRequestWithMeta({ url: "/health", method: "GET" }, healthSchema);
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));

  return { ...data, latencyMs, traceId: meta.trace_id };
}

export function useHealth() {
  return useQuery<HealthResult>({
    queryKey: ["system", "health"],
    queryFn: fetchHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
