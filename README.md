# RegReportCRE

RegReportCRE is a full-stack reference implementation for automated regulatory reporting for tokenized assets.
It combines:

- Chainlink CRE workflow orchestration (cron + confidential capabilities)
- Off-chain custodian data retrieval
- On-chain ERC-20 telemetry collection
- Reconciliation + anomaly detection
- AI-generated compliance narrative
- On-chain attestation via `ReportRegistry`
- Frontend dashboard for monitoring and drill-down

---

## Table of Contents

- [1) Problem and Goals](#1-problem-and-goals)
- [2) What This Project Implements](#2-what-this-project-implements)
- [3) End-to-End Architecture](#3-end-to-end-architecture)
- [4) Monorepo Structure](#4-monorepo-structure)
- [5) Technology Stack](#5-technology-stack)
- [6) Prerequisites](#6-prerequisites)
- [7) Environment Configuration](#7-environment-configuration)
- [8) Installation](#8-installation)
- [9) Running the System](#9-running-the-system)
- [10) Development Workflows](#10-development-workflows)
- [11) API Reference (Backend)](#11-api-reference-backend)
- [12) Smart Contract Reference](#12-smart-contract-reference)
- [13) CRE Workflow Reference](#13-cre-workflow-reference)
- [14) Frontend Reference](#14-frontend-reference)
- [15) Testing and Validation](#15-testing-and-validation)
- [16) Troubleshooting](#16-troubleshooting)
- [17) Demo Script](#17-demo-script)
- [18) Security and Production Notes](#18-security-and-production-notes)
- [19) Deployed Addresses](#19-deployed-addresses)
- [20) Chainlink Usage](#20-chainlink-usage)

---

## 1) Problem and Goals

Regulatory reporting for tokenized funds is often fragmented:

- Custodian systems are off-chain and private
- Token activity is on-chain and public
- Reports are manually assembled and hard to audit end-to-end

RegReportCRE addresses this by creating a deterministic monthly pipeline that:

1. Pulls off-chain and on-chain data for a reporting period
2. Computes reconciliation deltas (basis-point discrepancy + flags)
3. Produces a machine-readable + narrative report payload
4. Stores report artifact metadata and attestation on-chain
5. Exposes query/decrypt endpoints and a dashboard UI

---

## 2) What This Project Implements

### Included

- `ReportRegistry` Solidity contract (`packages/contracts`)
- TypeScript backend API (`packages/backend`)
- Chainlink CRE workflow logic + local simulation (`packages/cre-workflow`)
- Next.js dashboard (`packages/frontend`)
- Docker-compose dev stack (`mock-custodian`, backend, frontend)

### Runtime behavior at a glance

- Trigger: cron schedule (`0 0 1 * *`)
- Sources: mock custodian API + ERC-20 on Sepolia
- Output: report payload, CID/hash metadata, on-chain record

---

## 3) End-to-End Architecture

```text
Monthly Cron Trigger (CRE)
     -> Fetch custodian API data (HTTP capability)
     -> Fetch on-chain ERC-20 telemetry (EVM capability)
     -> Reconcile off-chain vs on-chain state
     -> Generate compliance analysis (LLM via OpenRouter, fallback available)
     -> Build report payload + CRE signed report envelope
     -> Publish report metadata (mocked IPFS publisher in current code)
     -> Publish attestation to ReportRegistry (Sepolia)
     -> Query via backend + display in frontend dashboard
```

### Logical components

- **Contracts:** source of truth for report metadata and attestations
- **Workflow:** execution engine for collection/reconciliation/reporting
- **Backend:** report query/decrypt/simulate API
- **Frontend:** operator dashboard for report visibility

---

## 4) Monorepo Structure

```text
RegReportCRE-main/
├─ package.json
├─ Makefile
├─ docker-compose.yml
└─ packages/
      ├─ backend/        # Express API for health/report/simulate/decrypt routes
      ├─ contracts/      # Hardhat project with ReportRegistry and scripts/tests
      ├─ cre-workflow/   # CRE workflow logic, simulation runtime, mock custodian
      └─ frontend/       # Next.js dashboard UI
```

---

## 5) Technology Stack

- **Language:** TypeScript (plus Solidity for contract)
- **Monorepo:** npm workspaces
- **Contracts:** Hardhat + OpenZeppelin + TypeChain
- **Workflow:** `@chainlink/cre-sdk`
- **Backend:** Express + ethers + zod
- **Frontend:** Next.js 15 + React 19 + React Query + Tailwind
- **Infra (dev):** Docker Compose

---

## 6) Prerequisites

Install before setup:

- Node.js 20+
- npm 10+
- Docker Desktop (for compose flow)
- Access to Sepolia RPC
- A funded Sepolia account for deployment/submission operations

Optional but recommended:

- Etherscan API key (contract verification)
- OpenRouter API key (LLM report generation)

---

## 7) Environment Configuration

Create a root `.env` file at the repository root.

### Minimal `.env` template

```bash
# === Chain / Wallet ===
RPC_URL_SEPOLIA=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0xyour_private_key

# === Contract deployment & backend ===
REGULATOR_ADDRESS=0xYourRegulatorAddress
CONTRACT_ADDRESS=0xDeployedReportRegistryAddress

# === Workflow config ===
ISSUER_ADDRESS=0xYourIssuerERC20Address
CUSTODIAN_API_URL=http://localhost:3001
CUSTODIAN_API_KEY=mock-key

# === AI report generation (optional, enables non-fallback path) ===
OPENROUTER_API_KEY=sk-or-v1-...

# === Optional verification ===
ETHERSCAN_API_KEY=your_etherscan_key

# === Optional / currently not fully wired in publisher mocks ===
PINATA_API_KEY=optional
REPORT_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Variable usage map

- `RPC_URL_SEPOLIA`
     - Used by backend chain reads, workflow simulation, and deploy scripts
- `PRIVATE_KEY`
     - Required for on-chain tx signing in workflow simulation
- `REGULATOR_ADDRESS`
     - Constructor arg for `ReportRegistry` deployment
- `CONTRACT_ADDRESS`
     - Backend reads this contract for report queries
- `ISSUER_ADDRESS`
     - Default simulation issuer
- `CUSTODIAN_API_URL`
     - Workflow source endpoint for custodian telemetry
- `OPENROUTER_API_KEY`
     - Enables LLM API call path; absent key triggers deterministic fallback generation

---

## 8) Installation

From repository root:

```bash
make setup
```

Equivalent:

```bash
npm install
```

---

## 9) Running the System

You can run RegReportCRE using either Docker compose (simplest) or local package-by-package development.

### Option A: Docker Compose (recommended for quick demos)

1. Ensure `.env` is configured at root.
2. Start services:

```bash
make dev
```

3. Open dashboard: `http://localhost:3000`
4. Backend API: `http://localhost:4000`
5. Mock custodian API: `http://localhost:3001`

### Option B: Local processes

Run each service independently:

- Mock custodian (`packages/cre-workflow`):
     ```bash
     npm run mock-custodian
     ```
- Backend (`packages/backend`):
     ```bash
     npm run dev
     ```
- Frontend (`packages/frontend`):
     ```bash
     npm run dev
     ```

---

## 10) Development Workflows

### A) Deploy `ReportRegistry` to Sepolia

From repo root:

```bash
make deploy
```

Or directly:

```bash
cd packages/contracts
npx hardhat run scripts/deploy.ts --network sepolia
```

Output is written to `packages/contracts/deployments/<network>.json`.

### B) Deploy locally (Hardhat network)

```bash
make deploy-local
```

### C) Authorize a workflow/submitter address

```bash
cd packages/contracts
npx ts-node scripts/authorize-submitter.ts --address 0xYourSubmitter
```

### D) Run workflow simulation

Normal simulation:

```bash
make simulate
```

Forced anomaly simulation:

```bash
make simulate-anomaly
```

### E) Build, typecheck, test

```bash
make build
make typecheck
make test
```

---

## 11) API Reference (Backend)

Base URL: `http://localhost:4000`

### `GET /health`

Returns backend/chain health state.

### `GET /reports/:issuerAddress?limit=10&offset=0`

Returns paginated reports for issuer.

- Validates `issuerAddress` is an EVM address
- Response:

```json
{
     "reports": [
          {
               "reportId": "...",
               "issuer": "0x...",
               "epoch": 1700000000,
               "reportHash": "0x...",
               "attestationHash": "0x...",
               "ipfsCid": "Qm...",
               "discrepancyBps": 25,
               "anomalyFlagged": false,
               "timestamp": 1700001234,
               "submitter": "0x..."
          }
     ],
     "total": 1
}
```

### `GET /reports/:issuerAddress/latest`

Returns latest report for issuer.

- `404` when no reports exist

### `GET /reports/detail/:reportId`

Returns a report by exact report ID.

### `GET /reports/detail/:reportId/decrypt?key=<64-hex-chars>`

Fetches encrypted payload from IPFS gateway and decrypts with AES-256-GCM.

Notes:

- `key` must be exactly 64 hex chars
- Returns `400` on invalid key, `404` if report missing, `502` if IPFS fetch fails

### `POST /simulate` (non-production only)

Triggers workflow simulation from backend:

```json
{
     "issuerAddress": "0x...",
     "periodLabel": "Mar-2026",
     "forceAnomaly": true
}
```

---

## 12) Smart Contract Reference

Contract: `packages/contracts/contracts/ReportRegistry.sol`

### Core data model

`ReportRecord` fields:

- `reportId` unique report identifier
- `issuer` tokenized fund/token contract address
- `epoch` period start timestamp
- `reportHash` hash of report payload
- `attestationHash` hash of attestation/proof material
- `ipfsCid` CID reference to off-chain payload
- `discrepancyBps` reconciliation discrepancy in basis points
- `anomalyFlagged` anomaly boolean
- `timestamp` publish timestamp
- `submitter` authorized submitting address

### Access control

- Owner can authorize submitters via `authorizeSubmitter(address)`
- `publishReport` requires `authorizedSubmitters[msg.sender] == true`

### Important methods

- `publishReport(ReportRecord calldata record)`
- `getReport(string reportId)`
- `getIssuerReports(address issuer)`
- `getLatestReport(address issuer)`

### Events

- `ReportPublished(...)`
- `AnomalyFlagged(...)`
- `SubmitterAuthorized(...)`

---

## 13) CRE Workflow Reference

Primary files:

- `packages/cre-workflow/src/Main.ts` (main workflow handler)
- `packages/cre-workflow/src/simulate.ts` (local runtime simulation)
- `packages/cre-workflow/workflow.yaml` (workflow metadata/capabilities/trigger)

### Trigger

- Cron schedule: `0 0 1 * *` (first day of each month at 00:00)

### Pipeline stages

1. Resolve epoch block range (`getBlockAtTimestamp`)
2. Fetch custodian data (`fetchCustodianData`)
3. Fetch on-chain data (`fetchOnchainData`)
4. Reconcile supply/withdrawals (`reconcile`)
5. Generate LLM analysis (`generateReport`)
6. Build report payload + signed envelope (`runtime.report`)
7. Publish metadata/CID (`publishToIPFS`)
8. Submit on-chain attestation (`publishToChain`)

### Reconciliation logic highlights

- Computes supply discrepancy in basis points
- Flags supply mismatch if discrepancy > 10 bps
- Flags any non-zero `unreportedWithdrawals`

### LLM behavior

- Uses OpenRouter endpoint when `OPENROUTER_API_KEY` is set
- Model path in current code: `google/gemini-2.5-flash-lite-preview:free`
- Falls back to deterministic local summary when key is missing

---

## 14) Frontend Reference

Frontend package: `packages/frontend`

### Dashboard behavior

- Shows high-level stats (total reports, anomalies, discrepancy)
- Polls report data every 30 seconds via React Query
- Lists issuer reports with risk/anomaly tags and IPFS links
- Includes simulation modal guidance (API-triggered)

### Frontend environment

- `NEXT_PUBLIC_API_URL` (default: `http://localhost:4000`)

### Main scripts

```bash
cd packages/frontend
npm run dev
npm run build
npm run start
```

---

## 15) Testing and Validation

### Contract tests

```bash
cd packages/contracts
npx hardhat test
```

Coverage includes:

- Submitter authorization
- Publish/report retrieval
- Duplicate protection
- Unauthorized submission rejection
- Anomaly event emission

### Workflow tests

```bash
cd packages/cre-workflow
npm test
```

### Global checks

```bash
make typecheck
make build
```

---

## 16) Troubleshooting

### `CONTRACT_ADDRESS not configured`

- Ensure root `.env` has `CONTRACT_ADDRESS`
- Confirm backend service loads root env values in your run mode

### `REGULATOR_ADDRESS not set in .env`

- Required for contract deployment script

### Simulation fails with signer/provider errors

- Verify `RPC_URL_SEPOLIA` and `PRIVATE_KEY`
- Ensure wallet has Sepolia ETH for write operations

### Backend returns `INVALID_ADDRESS`

- Use a checksummed or valid 20-byte hex EVM address

### `/decrypt` returns IPFS or key errors

- Confirm `ipfsCid` resolves via gateway
- Key must be 64 hex chars (32 bytes)

### Docker services cannot reach each other

- Confirm compose is started from repo root
- Rebuild with `docker-compose up --build`

---

## 17) Demo Script

For a quick guided run:

```bash
cd packages/cre-workflow
./DEMO.sh
```

This script currently:

1. Prints staged demo steps
2. Executes `npm run simulate`
3. Prompts you to inspect tx output

---

## 18) Security and Production Notes

- Do not commit real private keys or API secrets.
- Use dedicated signer keys with scoped permissions.
- Harden CORS and rate limits in backend for production environments.
- Treat current IPFS publishing logic as a simulation/mock path until replaced with real encrypted persistence.
- Add observability (logs, metrics, traces) around workflow execution and on-chain submission retries.

---

## 19) Deployed Addresses

- **ReportRegistry Contract (Sepolia):** `0xEC938A4D7324721356EE4531EF5ee88D64F2B1fB`

---

## 20) Chainlink Usage

This project makes extensive use of the **Chainlink CRE (Confidential Compute) SDK** to orchestrate Proof of Reserve checks.

You can view the exact implementation details illustrating our Chainlink usage here:

- **[Workflow Registration Metadata (workflow.yaml)](https://github.com/RegReportCRE/packages/cre-workflow/workflow.yaml):** Demonstrates our subnet configuration utilizing the `cron` trigger capability, alongside the `http-actions` capability for fetching off-chain API data, and the `evm` capability for fetching ERC-20 telemetry.
- **[Main Pipeline Logic (src/Main.ts)](https://github.com/RegReportCRE/packages/cre-workflow/src/Main.ts):** Details our `onCronHandler` where we leverage the `@chainlink/cre-sdk` `Runtime` to fetch data asynchronously, pass it to an LLM, and build the final signed `runtime.report({...})` payload object.
- **[EVM Attestation Publishing (src/publishers/chain.ts)](https://github.com/RegReportCRE/packages/cre-workflow/src/publishers/chain.ts):** Shows how the workflow translates the mathematically reconciled discrepancy metrics back to the EVM capability `WriteReport` parameter structure to commit the data immutably.


