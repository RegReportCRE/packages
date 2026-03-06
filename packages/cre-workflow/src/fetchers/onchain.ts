import { cre, type Runtime, consensusIdenticalAggregation } from "@chainlink/cre-sdk";
import { OnchainData } from "../types.js";
import { OnchainReadError } from "../errors.js";
import { type Config } from "../Main.js";
import { ethers } from "ethers";

const { EVMClient } = cre.capabilities;

const ERC20_ABI = new ethers.Interface([
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function holderCount() view returns (uint256)",
  "function yieldDistributedInPeriod(uint256 start, uint256 end) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

const blockCache = new Map<number, number>();

function bigIntToNumber(bi: any): number {
  if (!bi) return 0;
  if (typeof bi === 'bigint') return Number(bi);
  if (typeof bi === 'number') return bi;
  if (typeof bi === 'string') return Number(bi);
  // Protobuf BigInt check
  if (bi.absVal) {
    let val = 0n;
    const bytes = typeof bi.absVal === 'string' ? Buffer.from(bi.absVal, 'base64') : bi.absVal;
    for (const byte of bytes) {
      val = (val << 8n) | BigInt(byte);
    }
    if (Number(bi.sign) < 0) val = -val;
    return Number(val);
  }
  return 0;
}

function toBigIntProtobuf(val: bigint | number): any {
  const bi = BigInt(val);
  const sign = bi < 0n ? "-1" : "1";
  let abs = bi < 0n ? -bi : bi;
  const hex = abs.toString(16);
  const evenHex = hex.length % 2 === 0 ? hex : "0" + hex;
  const bytes = Buffer.from(evenHex, 'hex');
  return {
    absVal: bytes.toString('base64'),
    sign: sign
  };
}

export async function getBlockAtTimestamp(
  runtime: Runtime<Config>,
  config: Config,
  timestamp: number
): Promise<number> {
  const cached = blockCache.get(timestamp);
  if (cached !== undefined) {
    return cached;
  }

  const evmClient = new EVMClient(EVMClient.SUPPORTED_CHAIN_SELECTORS['ethereum-testnet-sepolia']);

  const blockNumber = await runtime.runInNodeMode(async (nodeRuntime: any) => {
    const res = await evmClient.headerByNumber(nodeRuntime, {}).result();
    const latestHeader = res.header!!;

    const latestNum = bigIntToNumber(latestHeader.blockNumber);
    const latestTime = Number(latestHeader.timestamp);

    if (timestamp >= latestTime) {
      return latestNum;
    }

    let lo = Math.max(0, latestNum - 200000);
    let hi = latestNum;

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const headerRes = await evmClient.headerByNumber(nodeRuntime, {
        blockNumber: toBigIntProtobuf(mid)
      } as any).result();
      const header = headerRes.header!!;

      if (Number(header.timestamp) < timestamp) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }, consensusIdenticalAggregation<any>() as any)().result();

  blockCache.set(timestamp, blockNumber);
  return blockNumber;
}

export async function fetchOnchainData(
  runtime: Runtime<Config>,
  config: Config,
  issuerAddress: string,
  epochStart: number,
  epochEnd: number
): Promise<OnchainData> {
  const evmClient = new EVMClient(EVMClient.SUPPORTED_CHAIN_SELECTORS['ethereum-testnet-sepolia']);

  try {
    const selector = (name: string) => ERC20_ABI.getFunction(name)!!.selector;

    const [supplyRes, decimalsRes] = await Promise.all([
      evmClient.callContract(runtime, {
        call: {
          to: issuerAddress,
          data: selector("totalSupply")
        }
      } as any).result(),
      evmClient.callContract(runtime, {
        call: {
          to: issuerAddress,
          data: selector("decimals")
        }
      } as any).result()
    ]);

    const totalSupply = ERC20_ABI.decodeFunctionResult("totalSupply", supplyRes.data)[0] as bigint;
    const decimals = ERC20_ABI.decodeFunctionResult("decimals", decimalsRes.data)[0] as bigint;

    let holderCount = 0;
    try {
      const hcRes = await evmClient.callContract(runtime, {
        call: {
          to: issuerAddress,
          data: selector("holderCount")
        }
      } as any).result();
      holderCount = Number(ERC20_ABI.decodeFunctionResult("holderCount", hcRes.data)[0] as bigint);
    } catch { /* ignored */ }

    let yieldDistributed = "0";
    try {
      const ydData = ERC20_ABI.encodeFunctionData("yieldDistributedInPeriod", [BigInt(epochStart), BigInt(epochEnd)]);
      const ydRes = await evmClient.callContract(runtime, {
        call: {
          to: issuerAddress,
          data: ydData
        }
      } as any).result();
      yieldDistributed = (ERC20_ABI.decodeFunctionResult("yieldDistributedInPeriod", ydRes.data)[0] as bigint).toString();
    } catch { /* ignored */ }

    const transferTopic = ERC20_ABI.getEvent("Transfer")!!.topicHash;
    const logsRes = await evmClient.filterLogs(runtime, {
      filterQuery: {
        fromBlock: toBigIntProtobuf(epochStart),
        toBlock: toBigIntProtobuf(epochEnd),
        addresses: [issuerAddress],
        topics: [{ topic: [transferTopic] }]
      }
    } as any).result();

    const logs = logsRes.logs;
    let lastRedemptionBlock = 0;

    for (const log of logs) {
      const topics = log.topics.map((t: any) => "0x" + Buffer.from(t).toString('hex'));
      const data = "0x" + Buffer.from(log.data as any).toString('hex');
      try {
        const decoded = ERC20_ABI.parseLog({ topics, data });
        if (decoded && decoded.args[1] === ethers.ZeroAddress) {
          lastRedemptionBlock = Math.max(lastRedemptionBlock, Number(log.blockNumber));
        }
      } catch { /* skip */ }
    }

    return {
      totalSupply: totalSupply.toString(),
      holderCount,
      totalTransfers: logs.length,
      yieldDistributed,
      lastRedemptionBlock,
    };
  } catch (err: unknown) {
    runtime.log(`Onchain fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    throw new OnchainReadError(
      `Failed to fetch onchain data for ${issuerAddress}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
