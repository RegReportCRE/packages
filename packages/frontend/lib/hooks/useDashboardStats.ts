"use client";
import { useQuery } from "@tanstack/react-query";
import { api, ReportRecord } from "../api";

interface DashboardStats {
  totalReports: number;
  reportsThisMonth: number;
  anomaliesDetected: number;
  avgDiscrepancyBps: number;
}

export function useDashboardStats(issuerAddresses: string[]) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboardStats", issuerAddresses],
    queryFn: async () => {
      const results = await Promise.allSettled(
        issuerAddresses.map((addr) => api.getReports(addr, 100))
      );

      const allReports: ReportRecord[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allReports.push(...result.value.reports);
        }
      }

      const now = Date.now() / 1000;
      const monthAgo = now - 30 * 24 * 3600;

      const stats: DashboardStats = {
        totalReports: allReports.length,
        reportsThisMonth: allReports.filter((r) => Number(r.epoch) >= monthAgo).length,
        anomaliesDetected: allReports.filter((r) => r.anomalyFlagged).length,
        avgDiscrepancyBps:
          allReports.length > 0
            ? allReports.reduce((sum, r) => sum + Number(r.discrepancyBps), 0) / allReports.length
            : 0,
      };

      return stats;
    },
    refetchInterval: 60000,
  });

  return {
    stats: data ?? { totalReports: 0, reportsThisMonth: 0, anomaliesDetected: 0, avgDiscrepancyBps: 0 },
    isLoading,
  };
}
