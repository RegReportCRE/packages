import { expect } from "chai";
import { ethers } from "hardhat";
import { ReportRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ReportRegistry", function () {
  let registry: ReportRegistry;
  let owner: HardhatEthersSigner;
  let regulator: HardhatEthersSigner;
  let authorized: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;
  let issuer: HardhatEthersSigner;

  const mockRecord = {
    reportId: "0xissuer-1700000000-1700000001",
    issuer: "" as string,
    epoch: 1700000000n,
    reportHash: ethers.keccak256(ethers.toUtf8Bytes("test-report")),
    attestationHash: ethers.keccak256(ethers.toUtf8Bytes("test-attestation")),
    ipfsCid: "QmTestCID123",
    discrepancyBps: 25n,
    anomalyFlagged: false,
    timestamp: 0n,
    submitter: "" as string,
  };

  beforeEach(async function () {
    [owner, regulator, authorized, unauthorized, issuer] = await ethers.getSigners();
    mockRecord.issuer = issuer.address;
    mockRecord.submitter = owner.address;

    const ReportRegistry = await ethers.getContractFactory("ReportRegistry");
    registry = await ReportRegistry.deploy(regulator.address);
    await registry.waitForDeployment();
  });

  it("should deploy with owner as authorized submitter", async function () {
    expect(await registry.authorizedSubmitters(owner.address)).to.be.true;
    expect(await registry.regulatorAddress()).to.equal(regulator.address);
  });

  it("should authorize a new submitter", async function () {
    await expect(registry.authorizeSubmitter(authorized.address))
      .to.emit(registry, "SubmitterAuthorized")
      .withArgs(authorized.address);
    expect(await registry.authorizedSubmitters(authorized.address)).to.be.true;
  });

  it("should reject authorizeSubmitter from non-owner", async function () {
    await expect(
      registry.connect(unauthorized).authorizeSubmitter(authorized.address)
    ).to.be.reverted;
  });

  it("should publish a report from authorized submitter", async function () {
    await expect(registry.publishReport(mockRecord))
      .to.emit(registry, "ReportPublished")
      .withArgs(
        mockRecord.reportId,
        issuer.address,
        mockRecord.epoch,
        mockRecord.reportHash,
        mockRecord.anomalyFlagged
      );

    expect(await registry.reportCount()).to.equal(1n);
  });

  it("should get a published report", async function () {
    await registry.publishReport(mockRecord);
    const report = await registry.getReport(mockRecord.reportId);
    expect(report.reportId).to.equal(mockRecord.reportId);
    expect(report.issuer).to.equal(issuer.address);
    expect(report.reportHash).to.equal(mockRecord.reportHash);
  });

  it("should get issuer reports", async function () {
    await registry.publishReport(mockRecord);
    const reportIds = await registry.getIssuerReports(issuer.address);
    expect(reportIds).to.deep.equal([mockRecord.reportId]);
  });

  it("should get latest report", async function () {
    await registry.publishReport(mockRecord);
    const latest = await registry.getLatestReport(issuer.address);
    expect(latest.reportId).to.equal(mockRecord.reportId);
  });

  it("should reject duplicate reportId", async function () {
    await registry.publishReport(mockRecord);
    await expect(registry.publishReport(mockRecord)).to.be.revertedWith(
      "ReportRegistry: report already exists"
    );
  });

  it("should reject publish from unauthorized submitter", async function () {
    await expect(registry.connect(unauthorized).publishReport(mockRecord)).to.be.revertedWith(
      "ReportRegistry: not authorized"
    );
  });

  it("should emit AnomalyFlagged when discrepancy > 0", async function () {
    const record = { ...mockRecord, reportId: "anomaly-report-1", discrepancyBps: 150n, anomalyFlagged: true };
    await expect(registry.publishReport(record)).to.emit(registry, "AnomalyFlagged");
  });
});
