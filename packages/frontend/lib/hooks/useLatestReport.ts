"use client";
import { useQuery } from "@tanstack/react-query";
import { api, ReportRecord } from "../api";

export function useLatestReport(issuerAddress: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["latestReport", issuerAddress],
    queryFn: () => api.getLatestReport(issuerAddress),
    refetchInterval: 60000,
    enabled: !!issuerAddress,
  });

  return {
    report: data as ReportRecord | null | undefined,
    isLoading,
    error,
  };
}
