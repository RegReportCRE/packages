import { CustodianData, OnchainData, ReconciliationResult } from "./types.js";

export function reconcile(
  custodian: CustodianData,
  onchain: OnchainData
): ReconciliationResult {
  const flags: string[] = [];

  // 1. Total Supply Check
  const custodianSupply = BigInt(custodian.totalShares);
  const onchainSupply = BigInt(onchain.totalSupply);

  const supplyDiff = custodianSupply > onchainSupply
    ? custodianSupply - onchainSupply
    : onchainSupply - custodianSupply;

  // Discrepancy in basis points (bps)
  const discrepancyBps = onchainSupply === 0n
    ? 0
    : Number((supplyDiff * 10000n) / onchainSupply);

  if (discrepancyBps > 10) {
    flags.push(`SUPPLY_MISMATCH: ${discrepancyBps}bps difference`);
  }

  // 2. Unreported Withdrawals
  if (custodian.unreportedWithdrawals > 0) {
    flags.push(`UNREPORTED_WITHDRAWALS: ${custodian.unreportedWithdrawals} units`);
  }

  return {
    discrepancyBps,
    onchainSupply: onchain.totalSupply,
    custodianSupply: custodian.totalShares,
    flags,
    clean: flags.length === 0,
    timestamp: new Date().toISOString(),
  };
}
