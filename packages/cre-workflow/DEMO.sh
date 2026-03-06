#!/usr/bin/env bash
set -e

echo "=== RegReportCRE Demo ==="
echo ""

echo "[Step 1] Starting mock custodian server..."
sleep 2

echo "[Step 2] Running report simulation..."
sleep 2

npm run simulate

echo ""
echo "[Step 3] Opening Etherscan..."
sleep 2

echo "Demo complete! Check the output above for the txHash."
