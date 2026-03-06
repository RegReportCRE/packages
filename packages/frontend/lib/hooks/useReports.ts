"use client";
import { useQuery } from "@tanstack/react-query";
import { api, ReportRecord } from "../api";

export function useReports(issuerAddress: string, limit = 10, offset = 0) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reports", issuerAddress, limit, offset],
    queryFn: () => api.getReports(issuerAddress, limit, offset),
    refetchInterval: 30000,
    enabled: !!issuerAddress,
  });

  return {
    reports: (data?.reports ?? []) as ReportRecord[],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  };
}
