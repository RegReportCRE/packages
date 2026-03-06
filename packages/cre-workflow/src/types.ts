import { z } from "zod";

export interface TriggerPayload {
  issuerAddress: string;
  reportingEpoch: number;
  periodLabel: string;
}

export interface CustodianData {
  aum: number;
  navPerShare: number;
  totalShares: number;
  redemptions: number;
  subscriptions: number;
  custodianName: string;
  attestationDate: string;
  lastUpdated: string;
  unreportedWithdrawals: number;
}

export interface OnchainData {
  totalSupply: string;
  holderCount: number;
  totalTransfers: number;
  yieldDistributed: string;
  lastRedemptionBlock: number;
}

export interface ReconciliationResult {
  discrepancyBps: number;
  onchainSupply: string;
  custodianSupply: number;
  flags: string[];
  clean: boolean;
  timestamp: string;
}

export interface LLMAnalysis {
  anomalyDetected: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  reportXml: string;
  keyFindings: string[];
}

export interface ReportPayload {
  reportId: string;
  issuer: string;
  epoch: number;
  periodLabel: string;
  custodianData: CustodianData;
  onchainData: OnchainData;
  reconciliation: ReconciliationResult;
  llmAnalysis: LLMAnalysis;
  generatedAt: string;
  workflowVersion?: string;
}

export const CustodianDataSchema = z.object({
  aum: z.number().positive(),
  navPerShare: z.number().positive(),
  totalShares: z.number().positive(),
  redemptions: z.number().nonnegative(),
  subscriptions: z.number().nonnegative(),
  custodianName: z.string().min(1),
  attestationDate: z.string().min(1),
  lastUpdated: z.string().min(1),
  unreportedWithdrawals: z.number().nonnegative(),
});

export const LLMAnalysisSchema = z.object({
  anomalyDetected: z.boolean(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  summary: z.string(),
  reportXml: z.string(),
  keyFindings: z.array(z.string()),
});

export const ReportPayloadSchema = z.object({
  reportId: z.string().min(1),
  issuer: z.string().min(1),
  epoch: z.number().int(),
  periodLabel: z.string().min(1),
  custodianData: CustodianDataSchema,
  onchainData: z.object({
    totalSupply: z.string(),
    holderCount: z.number(),
    totalTransfers: z.number(),
    yieldDistributed: z.string(),
    lastRedemptionBlock: z.number(),
  }),
  reconciliation: z.object({
    discrepancyBps: z.number(),
    onchainSupply: z.string(),
    custodianSupply: z.number(),
    flags: z.array(z.string()),
    clean: z.boolean(),
    timestamp: z.string(),
  }),
  llmAnalysis: LLMAnalysisSchema,
  generatedAt: z.string(),
  workflowVersion: z.string().optional(),
});
