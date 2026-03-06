import {
    cre,
    handler,
    Runner,
    type Runtime
} from "@chainlink/cre-sdk";
import { z } from "zod";
import { fetchCustodianData } from "./fetchers/custodian";
import { fetchOnchainData, getBlockAtTimestamp } from "./fetchers/onchain";
import { reconcile } from "./reconciler";
import { generateReport, buildReportId } from "./llm/report-generator";
import { publishToIPFS } from "./publishers/ipfs";
import { publishToChain } from "./publishers/chain";

const { CronCapability } = cre.capabilities;

// 1. Define Config Schema for type safety and runtime validation
export const ConfigSchema = z.object({
    issuerAddress: z.string().startsWith("0x"),
    reportingEpoch: z.number().int().positive(),
    periodLabel: z.string(),
    reportRegistryAddress: z.string().startsWith("0x"),
    custodianApiUrl: z.string().url(),
    rpcUrlSepolia: z.string().url(),
    gasLimit: z.number().default(500000),
});

export type Config = z.infer<typeof ConfigSchema>;

// 2. Define the main workflow handler logic
export const onCronHandler = async (runtime: Runtime<Config>, config: Config) => {
    const { issuerAddress, reportingEpoch, periodLabel } = config;

    runtime.log(`Starting RegReport workflow for issuer: ${issuerAddress} [${periodLabel}]`);

    // Step 1: Resolve block range
    const epochStart = await getBlockAtTimestamp(runtime, config, reportingEpoch);
    const epochEnd = await getBlockAtTimestamp(runtime, config, reportingEpoch + 30 * 24 * 3600);

    // Step 2: Fetch data in parallel
    runtime.log("Fetching custodian and onchain data...");
    const [custodianData, onchainData] = await Promise.all([
        fetchCustodianData(runtime, config),
        fetchOnchainData(runtime, config, issuerAddress, epochStart, epochEnd),
    ]);

    // Step 3: Business Logic - Reconcile
    runtime.log("Reconciling data...");
    const reconciliation = reconcile(custodianData, onchainData);

    // Step 4: AI Analysis
    runtime.log("Generating LLM report...");
    const llmAnalysis = await generateReport(
        runtime,
        config,
        issuerAddress,
        periodLabel,
        custodianData,
        onchainData,
        reconciliation
    );

    // Step 5: Assemble and Sign Report
    const reportId = buildReportId(issuerAddress, reportingEpoch);
    const reportPayload = {
        reportId,
        issuer: issuerAddress,
        epoch: reportingEpoch,
        periodLabel,
        custodianData,
        onchainData,
        reconciliation,
        llmAnalysis,
        generatedAt: new Date().toISOString(),
    };

    // Official pattern: Serialize to base64 for ReportRequestJson
    runtime.log("Generating signed report...");
    const encodedPayload = Buffer.from(JSON.stringify(reportPayload)).toString('base64');
    const signedReport = await runtime.report({
        encodedPayload,
        encoderName: "json",
        signingAlgo: "ed25519",
        hashingAlgo: "keccak256"
    }).result();

    // Step 6: Publish results to IPFS
    const { cid, reportHash, attestationHash } = await publishToIPFS(
        reportPayload,
        process.env.REPORT_ENCRYPTION_KEY || "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );

    // Step 7: On-chain Submission
    runtime.log("Submitting attestation on-chain...");
    const txHash = await publishToChain(
        runtime,
        config,
        {
            reportId,
            issuer: issuerAddress,
            epoch: BigInt(reportingEpoch),
            reportHash: reportHash as `0x${string}`,
            attestationHash: attestationHash as `0x${string}`,
            ipfsCid: cid,
            discrepancyBps: BigInt(reconciliation.discrepancyBps),
            anomalyFlagged: llmAnalysis.anomalyDetected,
        }
    );

    return {
        success: true,
        reportId,
        txHash,
        cid,
        anomalyDetected: llmAnalysis.anomalyDetected
    };
};

// 3. Main Entry Point for the runner
async function startWorkflow() {
    const runner = await Runner.newRunner({
        configSchema: ConfigSchema
    });

    await runner.run(async (config: Config) => {
        const cron = new CronCapability();

        return [
            handler(
                cron.trigger({ schedule: "0 0 1 * *" }),
                (runtime) => onCronHandler(runtime, config)
            )
        ];
    });
}

// ESM check for direct execution
if (import.meta.url.includes(process.argv[1])) {
    startWorkflow().catch(console.error);
}

export const workflow = { onCronHandler };
