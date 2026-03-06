import React from "react";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, delta, highlight }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-4 border border-gray-800"
      style={{ backgroundColor: "#111827" }}
    >
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
      {delta && <p className="text-xs text-gray-400 mt-1">{delta}</p>}
    </div>
  );
}
