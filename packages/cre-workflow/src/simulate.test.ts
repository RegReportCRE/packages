import { test, newTestRuntime, HttpActionsMock, EvmMock, ConsensusMock } from "@chainlink/cre-sdk/test";
import { onCronHandler } from "./Main.js";
import * as dotenv from "dotenv";

dotenv.config();

const mockConfig = {
    issuerAddress: "0x1234567890123456789012345678901234567890",
    reportingEpoch: 1704067200, // Jan 1 2024
    periodLabel: "Jan-2024",
    reportRegistryAddress: "0x0987654321098765432109876543210987654321",
    custodianApiUrl: "https://api.custodian.mock",
    rpcUrlSepolia: "https://ethereum-sepolia.rpc",
    gasLimit: 500000,
};

function bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
}

// Use the SDK's test runner to execute the simulation
test("RegReportCRE Workflow Simulation", async () => {
    const runtime = newTestRuntime();
    // @ts-ignore - inject config into the test runtime
    runtime.config = mockConfig;

    // 1. Mock HTTP (Custodian API)
    const httpMock = HttpActionsMock.testInstance();
    httpMock.sendRequest = (req: any) => {
        // console.log(`[SIM] Mocking HTTP request: ${req.url}`);
        return {
            statusCode: 200,
            body: bytesToBase64(new TextEncoder().encode(JSON.stringify({
                aum: 1000000000,
                navPerShare: 10.5,
                totalShares: 100000,
                redemptions: 500,
                subscriptions: 1000,
                custodianName: "Mock Custodian Service",
                attestationDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                unreportedWithdrawals: 0
            }))),
            multiHeaders: {}
        };
    };

    // 2. Mock Consensus (Report generation)
    const consensusMock = ConsensusMock.testInstance();
    consensusMock.report = (req: any) => {
        // console.log("[SIM] Mocking report consensus...");
        return {
            configDigest: bytesToBase64(new Uint8Array([1, 2, 3])),
            seqNr: "1",
            reportContext: bytesToBase64(new Uint8Array([4, 5, 6])),
            rawReport: bytesToBase64(new Uint8Array([7, 8, 9])),
            sigs: []
        } as any;
    };

    consensusMock.simple = (req: any) => {
        return req.observation.value!!;
    };

    // 3. Mock EVM (On-chain reads and submission)
    const evmMock = EvmMock.testInstance(16015286601757825753n); // Sepolia

    evmMock.headerByNumber = (req: any) => {
        // console.log(`[SIM] Mocking headerByNumber: ${req.blockNumber || 'latest'}`);
        return {
            header: {
                blockNumber: {
                    absVal: bytesToBase64(new Uint8Array([0x0f, 0x42, 0x40])), // 1,000,000
                    sign: "1"
                },
                timestamp: (BigInt(mockConfig.reportingEpoch) + 86400n * 15n).toString(),
                hash: bytesToBase64(new Uint8Array([0xab, 0xcd]))
            }
        } as any;
    };

    evmMock.callContract = (req: any) => {
        // console.log(`[SIM] Mocking callContract to: ${req.call.to}`);
        const dummyData = new Uint8Array(32);
        dummyData[31] = 100;
        return { data: bytesToBase64(dummyData) } as any;
    };

    evmMock.filterLogs = (req: any) => {
        // console.log("[SIM] Mocking filterLogs...");
        return { logs: [] } as any;
    };

    evmMock.writeReport = (req: any) => {
        console.log(`[SIM] Mocking writeReport to: ${req.receiver}`);
        return {
            txHash: bytesToBase64(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
            txStatus: 2 // TX_STATUS_SUCCESS
        } as any;
    };

    // 4. Run Workflow Handler
    console.log("--- Starting Production-Grade Simulation ---");
    try {
        const result = await onCronHandler(runtime as any, mockConfig);
        console.log("--- Simulation Complete ---");
        console.log("SUCCESS:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Simulation failed:", err);
        throw err;
    }
});
