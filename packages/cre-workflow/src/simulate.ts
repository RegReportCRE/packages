import {
    cre,
} from "@chainlink/cre-sdk";
import { onCronHandler } from "./Main.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const mockConfig = {
    issuerAddress: process.env.ISSUER_ADDRESS || "0x9f2EdCE3a34e42eaf8f965d4E14aDDd12Cf865f4",
    reportingEpoch: Math.floor(Date.now() / 1000) - 15 * 24 * 3600, // 15 days ago
    periodLabel: "Mar-2024",
    reportRegistryAddress: process.env.CONTRACT_ADDRESS || "0xEC938A4D7324721356EE4531EF5ee88D64F2B1fB",
    custodianApiUrl: process.env.CUSTODIAN_API_URL || "http://localhost:3001",
    rpcUrlSepolia: process.env.RPC_URL_SEPOLIA || "",
    gasLimit: 1000000,
};

function base64ToBytes(base64: string): Uint8Array {
    return Buffer.from(base64, 'base64');
}

function protoToBigInt(bi: any): bigint {
    if (!bi) return 0n;
    if (typeof bi === 'bigint') return bi;
    if (typeof bi === 'number') return BigInt(bi);
    if (typeof bi === 'string') return BigInt(bi);
    if (bi.absVal) {
        const bytes = typeof bi.absVal === 'string' ? Buffer.from(bi.absVal, 'base64') : bi.absVal;
        let val = 0n;
        for (const byte of bytes) {
            val = (val << 8n) | BigInt(byte);
        }
        if (Number(bi.sign) < 0) val = -val;
        return val;
    }
    return 0n;
}

class SimulationNodeRuntime {
    constructor(
        public readonly config: any,
        private readonly provider: ethers.JsonRpcProvider,
        private readonly wallet: ethers.Wallet
    ) { }

    log(msg: string) { console.log(`[NODE] ${msg}`); }

    callCapability(params: any): { result: () => Promise<any> } {
        return {
            result: () => this.call({
                id: params.capabilityId,
                method: params.method,
                payload: params.payload
            })
        };
    }

    async call(req: any): Promise<any> {
        const { id, method, payload } = req;

        // console.log(`[DEBUG-HOST] ${id}:${method} payload:`, JSON.stringify(payload, (k,v) => typeof v === 'bigint' ? v.toString() : (v instanceof Uint8Array ? Buffer.from(v).toString('hex') : v)));

        if (id.startsWith('http-actions')) {
            if (method === 'SendRequest') {
                const res = await fetch(payload.url, {
                    method: payload.method,
                    headers: payload.headers,
                    body: payload.body ? base64ToBytes(payload.body) as any : undefined
                });
                const bodyArrayBuffer = await res.arrayBuffer();
                const body = new Uint8Array(bodyArrayBuffer);
                return { statusCode: res.status, body, multiHeaders: {} };
            }
        }

        if (id.startsWith('evm')) {
            if (method === 'HeaderByNumber') {
                const blockNum = payload.blockNumber ? protoToBigInt(payload.blockNumber) : 'latest';
                const block = await this.provider.getBlock(blockNum as any);
                return {
                    header: {
                        blockNumber: { absVal: ethers.getBytes(ethers.toBeHex(block!!.number)), sign: "1" },
                        timestamp: block!!.timestamp.toString(),
                        hash: ethers.getBytes(block!!.hash!!)
                    }
                };
            }
            if (method === 'CallContract') {
                const to = typeof payload.call.to === 'string' ? payload.call.to : ethers.hexlify(payload.call.to);
                const data = typeof payload.call.data === 'string' ? payload.call.data : ethers.hexlify(payload.call.data);
                console.log(`[DEBUG-EVM] Calling ${to} with data ${data.slice(0, 10)}...`);
                const res = await this.provider.call({ to, data });
                return { data: ethers.getBytes(res) };
            }
            if (method === 'FilterLogs') {
                const logs = await this.provider.getLogs({
                    fromBlock: payload.filterQuery.fromBlock ? Number(protoToBigInt(payload.filterQuery.fromBlock)) : undefined,
                    toBlock: payload.filterQuery.toBlock ? Number(protoToBigInt(payload.filterQuery.toBlock)) : undefined,
                    address: payload.filterQuery.addresses,
                    topics: payload.filterQuery.topics?.map((t: any) => t.topic)
                });
                return {
                    logs: logs.map(l => ({
                        address: l.address,
                        topics: l.topics.map(t => ethers.getBytes(t)),
                        data: ethers.getBytes(l.data),
                        blockNumber: l.blockNumber.toString(),
                        transactionHash: ethers.getBytes(l.transactionHash),
                        logIndex: l.index.toString()
                    }))
                };
            }
            if (method === 'WriteReport') {
                const tx = await this.wallet.sendTransaction({
                    to: payload.receiver,
                    data: payload.encodedReport,
                    gasLimit: 1000000
                });
                const receipt = await tx.wait();
                return {
                    txHash: ethers.getBytes(receipt!!.hash),
                    txStatus: receipt!!.status === 1 ? "2" : "3"
                };
            }
        }
        throw new Error(`Capability ${id}:${method} not implemented in simulation`);
    }
}

class SimulationRuntime {
    private readonly provider: ethers.JsonRpcProvider;
    private readonly wallet: ethers.Wallet;

    constructor(public readonly config: any) {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrlSepolia);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!!, this.provider);
    }

    log(msg: string) { console.log(`[WORKFLOW] ${msg}`); }

    callCapability(params: any): { result: () => Promise<any> } {
        const nodeRuntime = new SimulationNodeRuntime(this.config, this.provider, this.wallet);
        return nodeRuntime.callCapability(params);
    }

    runInNodeMode(
        fn: (nodeRuntime: any, ...args: any[]) => Promise<any>,
        _aggregator: any
    ): (...args: any[]) => { result: () => Promise<any> } {
        const nodeRuntime = new SimulationNodeRuntime(this.config, this.provider, this.wallet);
        return (...args: any[]) => ({
            result: () => fn(nodeRuntime, ...args)
        });
    }

    report(req: any): { result: () => Promise<any> } {
        const response = {
            rawReport: base64ToBytes(req.encodedPayload),
            sigs: [{ signature: new Uint8Array(64), signerId: 1 }]
        };
        return {
            result: () => Promise.resolve(response)
        };
    }
}

async function run() {
    console.log("--- Starting Production-Grade CRE Workflow Simulation ---");
    const runtime = new SimulationRuntime(mockConfig);
    try {
        const result = await onCronHandler(runtime as any, mockConfig as any);
        console.log("\n--- Workflow Execution Success ---");
        console.log(`Report ID: ${result.reportId}`);
        if (result.txHash) console.log(`Attestation TX: https://sepolia.etherscan.io/tx/${result.txHash}`);
        console.log(`IPFS CID: ${result.cid}`);
        console.log(`Anomaly Detected: ${result.anomalyDetected}`);
        console.log("------------------------------------");
        process.exit(0);
    } catch (err: any) {
        console.error("\n--- Workflow Execution Failed ---");
        console.error(err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

run();
