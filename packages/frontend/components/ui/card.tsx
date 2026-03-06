import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-800 backdrop-blur-sm ${className}`}
      style={{ backgroundColor: "rgba(17, 24, 39, 0.8)" }}
    >
      {children}
    </div>
  );
}
