// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReportRegistry
 * @notice Registry for regulatory reports submitted by CRE workflows for tokenized asset issuers.
 * @dev Stores report hashes and attestations on-chain; encrypted report payloads are stored on IPFS.
 */
contract ReportRegistry is Ownable, ReentrancyGuard {
    /// @notice A single report record
    struct ReportRecord {
        string reportId;         // unique ID: issuer + epoch + timestamp
        address issuer;          // tokenized fund contract address
        uint256 epoch;           // reporting period (Unix timestamp of period start)
        bytes32 reportHash;      // keccak256 of encrypted report payload
        bytes32 attestationHash; // keccak256 of CRE workflow execution proof
        string ipfsCid;          // IPFS CID of encrypted report
        uint256 discrepancyBps;  // basis points deviation between onchain/offchain data
        bool anomalyFlagged;     // true if LLM detected anomaly
        uint256 timestamp;       // block.timestamp when published
        address submitter;       // CRE workflow address that submitted
    }

    /// @notice Maps reportId to ReportRecord
    mapping(string => ReportRecord) public reports;

    /// @notice Maps issuer address to list of reportIds
    mapping(address => string[]) public issuerReports;

    /// @notice Tracks authorized submitters (CRE workflow addresses)
    mapping(address => bool) public authorizedSubmitters;

    /// @notice Address of the regulator
    address public regulatorAddress;

    /// @notice Total number of published reports
    uint256 public reportCount;

    /// @notice Emitted when a new report is published
    event ReportPublished(
        string reportId,
        address indexed issuer,
        uint256 epoch,
        bytes32 reportHash,
        bool anomalyFlagged
    );

    /// @notice Emitted when an anomaly is flagged in a report
    event AnomalyFlagged(
        string reportId,
        address indexed issuer,
        uint256 discrepancyBps
    );

    /// @notice Emitted when a new submitter is authorized
    event SubmitterAuthorized(address indexed submitter);

    /**
     * @notice Initialize the registry
     * @param _regulator Address of the regulatory body
     */
    constructor(address _regulator) Ownable(msg.sender) {
        regulatorAddress = _regulator;
        authorizedSubmitters[msg.sender] = true;
        emit SubmitterAuthorized(msg.sender);
    }

    /**
     * @notice Authorize a new submitter address (CRE workflow contract)
     * @param submitter Address to authorize
     */
    function authorizeSubmitter(address submitter) external onlyOwner {
        authorizedSubmitters[submitter] = true;
        emit SubmitterAuthorized(submitter);
    }

    /**
     * @notice Publish a new regulatory report
     * @param record The full ReportRecord to store
     */
    function publishReport(ReportRecord calldata record) external nonReentrant {
        require(authorizedSubmitters[msg.sender], "ReportRegistry: not authorized");
        require(
            bytes(reports[record.reportId].reportId).length == 0,
            "ReportRegistry: report already exists"
        );
        require(bytes(record.reportId).length > 0, "ReportRegistry: empty reportId");
        require(record.issuer != address(0), "ReportRegistry: zero issuer");

        reports[record.reportId] = record;
        reports[record.reportId].submitter = msg.sender;
        reports[record.reportId].timestamp = block.timestamp;
        issuerReports[record.issuer].push(record.reportId);
        reportCount++;

        emit ReportPublished(
            record.reportId,
            record.issuer,
            record.epoch,
            record.reportHash,
            record.anomalyFlagged
        );

        if (record.anomalyFlagged || record.discrepancyBps > 0) {
            emit AnomalyFlagged(record.reportId, record.issuer, record.discrepancyBps);
        }
    }

    /**
     * @notice Get a report by its ID
     * @param reportId The unique report identifier
     * @return The ReportRecord struct
     */
    function getReport(string calldata reportId) external view returns (ReportRecord memory) {
        return reports[reportId];
    }

    /**
     * @notice Get all report IDs for an issuer
     * @param issuer The issuer address
     * @return Array of report IDs
     */
    function getIssuerReports(address issuer) external view returns (string[] memory) {
        return issuerReports[issuer];
    }

    /**
     * @notice Get the most recent report for an issuer
     * @param issuer The issuer address
     * @return The most recent ReportRecord
     */
    function getLatestReport(address issuer) external view returns (ReportRecord memory) {
        string[] memory reportIds = issuerReports[issuer];
        require(reportIds.length > 0, "ReportRegistry: no reports for issuer");
        return reports[reportIds[reportIds.length - 1]];
    }
}
