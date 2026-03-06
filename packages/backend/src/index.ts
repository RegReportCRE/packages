import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { ethers } from "ethers";
import { z } from "zod";
import * as crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
});
app.use(limiter);

const REPORT_REGISTRY_ABI = [
  "function getReport(string calldata reportId) external view returns (tuple(string reportId, address issuer, uint256 epoch, bytes32 reportHash, bytes32 attestationHash, string ipfsCid, uint256 discrepancyBps, bool anomalyFlagged, uint256 timestamp, address submitter))",
  "function getIssuerReports(address issuer) external view returns (string[])",
  "function getLatestReport(address issuer) external view returns (tuple(string reportId, address issuer, uint256 epoch, bytes32 reportHash, bytes32 attestationHash, string ipfsCid, uint256 discrepancyBps, bool anomalyFlagged, uint256 timestamp, address submitter))",
  "function reportCount() external view returns (uint256)",
];

let provider: ethers.JsonRpcProvider | null = null;
let registry: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
  }
  return provider;
}

function getRegistry(): ethers.Contract {
  if (!registry) {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error("CONTRACT_ADDRESS not configured");
    }
    registry = new ethers.Contract(contractAddress, REPORT_REGISTRY_ABI, getProvider());
  }
  return registry;
}

// Health check
app.get("/health", async (_req: Request, res: Response) => {
  try {
    const blockNumber = await getProvider().getBlockNumber();
    res.json({
      status: "ok",
      blockNumber,
      contractAddress: process.env.CONTRACT_ADDRESS || null,
    });
  } catch (err: unknown) {
    res.json({
      status: "degraded",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// GET /reports/:issuerAddress
app.get("/reports/:issuerAddress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { issuerAddress } = req.params;
    if (!ethers.isAddress(issuerAddress)) {
      res.status(400).json({ error: "Invalid Ethereum address", code: "INVALID_ADDRESS" });
      return;
    }

    const limit = parseInt((req.query["limit"] as string) || "10", 10);
    const offset = parseInt((req.query["offset"] as string) || "0", 10);

    const reg = getRegistry();
    const reportIds = (await reg.getIssuerReports(issuerAddress)) as string[];
    const total = reportIds.length;
    const sliced = reportIds.slice(offset, offset + limit);

    const reports = await Promise.all(
      sliced.map((id) => reg.getReport(id))
    );

    res.json({ reports, total });
  } catch (err: unknown) {
    next(err);
  }
});

// GET /reports/:issuerAddress/latest
app.get("/reports/:issuerAddress/latest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { issuerAddress } = req.params;
    if (!ethers.isAddress(issuerAddress)) {
      res.status(400).json({ error: "Invalid Ethereum address", code: "INVALID_ADDRESS" });
      return;
    }

    try {
      const reg = getRegistry();
      const report = await reg.getLatestReport(issuerAddress);
      res.json(report);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("no reports")) {
        res.status(404).json({ error: "No reports found for issuer", code: "NOT_FOUND" });
        return;
      }
      throw err;
    }
  } catch (err: unknown) {
    next(err);
  }
});

// GET /reports/detail/:reportId
app.get("/reports/detail/:reportId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportId } = req.params;
    const reg = getRegistry();
    const report = await reg.getReport(reportId);
    if (!report.reportId) {
      res.status(404).json({ error: "Report not found", code: "NOT_FOUND" });
      return;
    }
    res.json(report);
  } catch (err: unknown) {
    next(err);
  }
});

// GET /reports/detail/:reportId/decrypt
app.get("/reports/detail/:reportId/decrypt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportId } = req.params;
    const key = req.query["key"] as string;

    if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
      res.status(400).json({ error: "Invalid decryption key", code: "INVALID_KEY" });
      return;
    }

    const reg = getRegistry();
    const report = await reg.getReport(reportId);
    if (!report.reportId) {
      res.status(404).json({ error: "Report not found", code: "NOT_FOUND" });
      return;
    }

    // Fetch from IPFS
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${report.ipfsCid as string}`;
    const ipfsResponse = await fetch(ipfsUrl);
    if (!ipfsResponse.ok) {
      res.status(502).json({ error: "Failed to fetch from IPFS", code: "IPFS_ERROR" });
      return;
    }

    const ipfsData = (await ipfsResponse.json()) as { encrypted: string };
    const encryptedPayload = ipfsData.encrypted;

    // Decrypt AES-256-GCM
    const [ivHex, authTagHex, ciphertextHex] = encryptedPayload.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const payload: unknown = JSON.parse(decrypted.toString("utf8"));
    res.json(payload);
  } catch (err: unknown) {
    next(err);
  }
});

// POST /simulate (dev only)
if (process.env.NODE_ENV !== "production") {
  const SimulateBodySchema = z.object({
    issuerAddress: z.string().min(1),
    periodLabel: z.string().min(1),
    forceAnomaly: z.boolean().optional(),
  });

  app.post("/simulate", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SimulateBodySchema.parse(req.body);

      if (body.forceAnomaly) {
        process.env.FORCE_ANOMALY = "true";
      } else {
        delete process.env.FORCE_ANOMALY;
      }

      const { regReportWorkflow } = await import("@regreportcre/cre-workflow/src/workflow");
      const ctx = {
        log: {
          info: (msg: string) => console.log(`[INFO] ${msg}`),
          warn: (msg: string) => console.warn(`[WARN] ${msg}`),
          error: (msg: string) => console.error(`[ERROR] ${msg}`),
        },
        workflow: { address: "0x0000000000000000000000000000000000000001" },
      };

      const result = await regReportWorkflow.handler(
        {
          issuerAddress: body.issuerAddress,
          reportingEpoch: Math.floor(Date.now() / 1000 - 30 * 24 * 3600),
          periodLabel: body.periodLabel,
        },
        ctx
      );

      res.json(result);
    } catch (err: unknown) {
      next(err);
    }
  });
}

// Error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Validation error", code: "VALIDATION_ERROR", details: err.errors });
    return;
  }
  res.status(500).json({
    error: err instanceof Error ? err.message : "Internal server error",
    code: "INTERNAL_ERROR",
  });
});

const server = app.listen(PORT, () => {
  console.log(`RegReportCRE backend running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
