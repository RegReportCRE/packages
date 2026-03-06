import { cre, type Runtime } from "@chainlink/cre-sdk";
import { type Config } from "../Main.js";

const { EVMClient } = cre.capabilities;

export interface ReportRecord {
  reportId: string;
  issuer: string;
  epoch: bigint;
  reportHash: `0x${string}`;
  attestationHash: `0x${string}`;
  ipfsCid: string;
  discrepancyBps: bigint;
  anomalyFlagged: boolean;
}

export async function publishToChain(
  runtime: Runtime<Config>,
  config: Config,
  record: ReportRecord
): Promise<string> {
  const { reportRegistryAddress } = config;

  runtime.log(`Submitting report to registry at: ${reportRegistryAddress}`);

  const evmClient = new EVMClient(EVMClient.SUPPORTED_CHAIN_SELECTORS['ethereum-testnet-sepolia']);

  const hexToBytes = (hex: string) => {
    const matched = hex.replace("0x", "").match(/.{1,2}/g);
    if (!matched) return new Uint8Array();
    return new Uint8Array(matched.map(byte => parseInt(byte, 16)));
  };

  const bytesToHex = (bytes: Uint8Array) =>
    Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const result = await evmClient.writeReport(runtime, {
    receiver: hexToBytes(reportRegistryAddress),
    // report field should be populated in a full production flow
    $report: true
  }).result();

  return result.txHash ? `0x${bytesToHex(result.txHash)}` : "0x0";
}
