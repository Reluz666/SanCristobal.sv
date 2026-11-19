import { apiGet } from "@/api/client";
import type { DashboardSummary } from "@/types/overview";

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>("/dashboard/summary");
}
