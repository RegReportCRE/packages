export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBps(bps: number): string {
  return `${bps.toFixed(1)} bps`;
}

export function riskLevelColor(riskLevel: string): string {
  switch (riskLevel.toUpperCase()) {
    case "LOW":
      return "text-green-400";
    case "MEDIUM":
      return "text-yellow-400";
    case "HIGH":
      return "text-orange-400";
    case "CRITICAL":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

export function formatEpoch(epoch: number): string {
  return new Date(epoch * 1000).toISOString().split("T")[0];
}

export function ipfsGatewayUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export function etherscanTxUrl(txHash: string, network = "sepolia"): string {
  return `https://${network}.etherscan.io/tx/${txHash}`;
}
