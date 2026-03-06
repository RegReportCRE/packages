"use client";
import { useState } from "react";
import { useDashboardStats } from "../lib/hooks/useDashboardStats";
import { useReports } from "../lib/hooks/useReports";
import { StatCard } from "../components/ui/stat";
import { Badge } from "../components/ui/badge";
import { formatAddress, formatBps, formatEpoch, ipfsGatewayUrl } from "../lib/utils";

const DEMO_ISSUERS = [
  "0x742d35Cc6634C0532925a3b8D9C7b7d2F5e7b1aF",
  "0x1234567890123456789012345678901234567890",
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
];

export default function DashboardPage() {
  const [selectedIssuer, setSelectedIssuer] = useState(DEMO_ISSUERS[0]);
  const [showSimulate, setShowSimulate] = useState(false);
  const { stats, isLoading: statsLoading } = useDashboardStats(DEMO_ISSUERS);
  const { reports, total, isLoading: reportsLoading } = useReports(selectedIssuer);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0f1e", color: "#e5e7eb" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#375BD2" }}>
            <span className="text-white font-bold text-xs">CRE</span>
          </div>
          <span className="font-bold text-lg">RegReportCRE</span>
        </div>
        <button
          onClick={() => setShowSimulate(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#375BD2" }}
        >
          Simulate Report
        </button>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-800 p-4">
          <h2 className="text-xs font-semibold uppercase text-gray-400 mb-3">Issuers</h2>
          {DEMO_ISSUERS.map((issuer) => (
            <button
              key={issuer}
              onClick={() => setSelectedIssuer(issuer)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                selectedIssuer === issuer
                  ? "text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
              style={selectedIssuer === issuer ? { backgroundColor: "#375BD2" } : {}}
            >
              {formatAddress(issuer)}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 p-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Reports" value={statsLoading ? "..." : String(stats.totalReports)} />
            <StatCard label="This Month" value={statsLoading ? "..." : String(stats.reportsThisMonth)} />
            <StatCard
              label="Anomalies"
              value={statsLoading ? "..." : String(stats.anomaliesDetected)}
              highlight={stats.anomaliesDetected > 0}
            />
            <StatCard label="Avg Discrepancy" value={statsLoading ? "..." : formatBps(stats.avgDiscrepancyBps)} />
          </div>

          {/* Reports Table */}
          <div className="rounded-xl overflow-hidden border border-gray-800">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Reports for {formatAddress(selectedIssuer)}</h3>
              <span className="text-xs text-gray-400">{total} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="px-4 py-3 text-left">Report ID</th>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Risk</th>
                    <th className="px-4 py-3 text-left">Discrepancy</th>
                    <th className="px-4 py-3 text-left">Anomaly</th>
                    <th className="px-4 py-3 text-left">IPFS</th>
                    <th className="px-4 py-3 text-left">Tx Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        No reports found
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr key={report.reportId as string} className="border-b border-gray-800 hover:bg-gray-900">
                        <td className="px-4 py-3 font-mono text-xs">{(report.reportId as string).slice(0, 20)}...</td>
                        <td className="px-4 py-3">{formatEpoch(Number(report.epoch))}</td>
                        <td className="px-4 py-3">
                          <Badge variant={report.anomalyFlagged ? "anomaly" : "clean"}>
                            {report.anomalyFlagged ? "HIGH" : "LOW"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{formatBps(Number(report.discrepancyBps))}</td>
                        <td className="px-4 py-3">
                          {report.anomalyFlagged ? (
                            <Badge variant="critical">Yes</Badge>
                          ) : (
                            <Badge variant="clean">No</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={ipfsGatewayUrl(report.ipfsCid as string)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline font-mono text-xs"
                          >
                            {(report.ipfsCid as string).slice(0, 10)}...
                          </a>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          —
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {showSimulate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSimulate(false)}>
          <div className="rounded-xl p-6 max-w-md w-full mx-4" style={{ backgroundColor: "#111827" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Simulate Report</h2>
            <p className="text-gray-400 text-sm mb-4">Use the backend API POST /simulate endpoint to trigger a simulation.</p>
            <button onClick={() => setShowSimulate(false)} className="px-4 py-2 rounded-lg bg-gray-700 text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
