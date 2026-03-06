import express from "express";

const app = express();
app.use(express.json());

function generateMockData(issuerAddress: string): object {
  const forceAnomaly = process.env.FORCE_ANOMALY === "true";
  const isAnomaly = forceAnomaly || Math.random() < 0.05;
  const baseAum = 100_000_000;
  const aum = isAnomaly ? baseAum * 0.8 : baseAum * (0.95 + Math.random() * 0.1);

  return {
    aum,
    navPerShare: 1.05,
    totalShares: Math.round(aum / 1.05),
    redemptions: Math.round(aum * 0.02),
    subscriptions: Math.round(aum * 0.03),
    unreportedWithdrawals: 0,
    custodianName: "MockCustodian",
    attestationDate: new Date().toISOString().split("T")[0],
    lastUpdated: new Date().toISOString(),
    _issuer: issuerAddress,
    _anomaly: isAnomaly,
  };
}

app.get("/reports/:issuerAddress", (req, res) => {
  const { issuerAddress } = req.params;
  const data = generateMockData(issuerAddress);
  res.json(data);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export function start(port = 3001): ReturnType<typeof app.listen> {
  return app.listen(port, () => {
    console.log(`Mock custodian server running on port ${port}`);
  });
}

if (import.meta.url.includes(process.argv[1])) {
  start();
}
