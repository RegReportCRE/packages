const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error || "API error",
      response.status,
      (data as { code?: string }).code
    );
  }
  return data;
}

export interface ReportRecord {
  reportId: string;
  issuer: string;
  epoch: number;
  reportHash: string;
  attestationHash: string;
  ipfsCid: string;
  discrepancyBps: number;
  anomalyFlagged: boolean;
  timestamp: number;
  submitter: string;
}

export interface ReportPayload {
  reportId: string;
  issuer: string;
  epoch: number;
  periodLabel: string;
  custodianData: Record<string, unknown>;
  onchainData: Record<string, unknown>;
  reconciliation: Record<string, unknown>;
  llmAnalysis: Record<string, unknown>;
  generatedAt: string;
  workflowVersion: string;
}

export interface SimulateResult {
  reportId: string;
  cid: string;
  reportHash: string;
  attestationHash: string;
  txHash: string;
  blockNumber: number;
  anomalyDetected: boolean;
  riskLevel: string;
}

export const api = {
  getReports: (issuerAddress: string, limit = 10, offset = 0) =>
    fetchJSON<{ reports: ReportRecord[]; total: number }>(
      `${BASE_URL}/reports/${issuerAddress}?limit=${limit}&offset=${offset}`
    ),

  getLatestReport: (issuerAddress: string) =>
    fetchJSON<ReportRecord>(`${BASE_URL}/reports/${issuerAddress}/latest`).catch(() => null),

  getReportDetail: (reportId: string) =>
    fetchJSON<ReportRecord>(`${BASE_URL}/reports/detail/${encodeURIComponent(reportId)}`),

  decryptReport: (reportId: string, key: string) =>
    fetchJSON<ReportPayload>(
      `${BASE_URL}/reports/detail/${encodeURIComponent(reportId)}/decrypt?key=${key}`
    ),

  simulateReport: (issuerAddress: string, periodLabel: string, forceAnomaly = false) =>
    fetchJSON<SimulateResult>(`${BASE_URL}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuerAddress, periodLabel, forceAnomaly }),
    }),
};
