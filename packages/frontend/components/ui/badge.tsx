import React from "react";

type BadgeVariant = "clean" | "warning" | "critical" | "anomaly";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  clean: "bg-green-900/50 text-green-400 border-green-800",
  warning: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  critical: "bg-red-900/50 text-red-400 border-red-800",
  anomaly: "bg-orange-900/50 text-orange-400 border-orange-800",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
}
