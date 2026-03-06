import {
  cre,
  consensusIdenticalAggregation,
  type Runtime
} from "@chainlink/cre-sdk";
import {
  CustodianData,
  OnchainData,
  ReconciliationResult,
  LLMAnalysis,
  LLMAnalysisSchema,
} from "../types.js";
import { LLMGenerationError } from "../errors.js";
import { type Config } from "../Main.js";

const { HTTPClient } = cre.capabilities;

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function buildReportId(issuer: string, epoch: number): string {
  return `${issuer.toLowerCase()}-${epoch}-${Date.now()}`;
}

const SYSTEM_PROMPT = `You are a regulatory compliance officer. Output ONLY valid JSON matching the schema below. Flag anomalies conservatively — HIGH/CRITICAL only if discrepancy >100bps or flags non-empty.

Schema:
{
  "anomalyDetected": boolean,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "2-3 sentence plain English summary",
  "reportXml": "full ISO 20022-style XML report body string",
  "keyFindings": ["finding1", "finding2", ...]
}`;

function buildUserPrompt(
  issuer: string,
  periodLabel: string,
  custodian: CustodianData,
  onchain: OnchainData,
  reconciliation: ReconciliationResult
): string {
  return `Generate a regulatory compliance report for:
${JSON.stringify(
    {
      issuer,
      periodLabel,
      custodianData: custodian,
      onchainData: onchain,
      reconciliation,
    },
    null,
    2
  )}`;
}

export async function generateReport(
  runtime: Runtime<Config>,
  config: Config,
  issuer: string,
  periodLabel: string,
  custodian: CustodianData,
  onchain: OnchainData,
  reconciliation: ReconciliationResult
): Promise<LLMAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    runtime.log("OPENROUTER_API_KEY not set. Using fallback report generation.");
    const riskLevel =
      reconciliation.discrepancyBps > 100 || reconciliation.flags.length > 0
        ? "HIGH"
        : reconciliation.discrepancyBps > 50
          ? "MEDIUM"
          : "LOW";

    return {
      anomalyDetected: reconciliation.flags.length > 0,
      riskLevel: riskLevel as LLMAnalysis["riskLevel"],
      summary: `[FALLBACK] Regulatory report for ${issuer} for period ${periodLabel}. Discrepancy: ${reconciliation.discrepancyBps}bps.`,
      reportXml: "<xml>Fallback Report</xml>",
      keyFindings: reconciliation.flags.length > 0 ? reconciliation.flags : ["No significant anomalies detected"],
    };
  }

  const httpClient = new HTTPClient();
  const userPrompt = buildUserPrompt(issuer, periodLabel, custodian, onchain, reconciliation);

  try {
    const response = await runtime.runInNodeMode(async (nodeRuntime) => {
      const res = httpClient.sendRequest(nodeRuntime, {
        url: "https://openrouter.ai/api/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://regreportcre.io",
          "X-Title": "RegReportCRE",
        },
        body: bytesToBase64(new TextEncoder().encode(JSON.stringify({
          model: "google/gemini-2.5-flash-lite-preview:free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })))
      });
      return res.result();
    }, consensusIdenticalAggregation<any>() as any)().result();

    if (response.statusCode !== 200) {
      const errorText = new TextDecoder().decode(response.body);
      throw new LLMGenerationError(`OpenRouter API error: ${response.statusCode} - ${errorText}`);
    }

    const bodyStr = new TextDecoder().decode(response.body);
    const result = JSON.parse(bodyStr);
    const content = result.choices[0].message.content;

    // Some models might still return markdown blocks even with json_object
    const cleaned = content.replace(/```(?:json)?\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    const parsed: unknown = JSON.parse(cleaned);

    return LLMAnalysisSchema.parse(parsed);

  } catch (err: unknown) {
    runtime.log(`LLM generation via OpenRouter failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
