import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RegReportCRE — Regulatory Dashboard",
  description: "Automated regulatory report generator for tokenized asset issuers using Chainlink CRE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className} style={{ backgroundColor: "#0a0f1e", color: "#e5e7eb" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
