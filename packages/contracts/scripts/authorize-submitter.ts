import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const addressFlag = args.indexOf("--address");
  if (addressFlag === -1 || !args[addressFlag + 1]) {
    throw new Error("Usage: ts-node authorize-submitter.ts --address <submitterAddress>");
  }
  const submitterAddress = args[addressFlag + 1];

  const network = (await ethers.provider.getNetwork()).name;
  const deploymentsFile = path.resolve(__dirname, `../deployments/${network}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployments file not found: ${deploymentsFile}`);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsFile, "utf-8")) as {
    ReportRegistry: string;
  };
  const contractAddress = deployments.ReportRegistry;

  const ReportRegistry = await ethers.getContractAt("ReportRegistry", contractAddress);
  console.log(`Authorizing submitter ${submitterAddress} on contract ${contractAddress}...`);
  const tx = await ReportRegistry.authorizeSubmitter(submitterAddress);
  await tx.wait();
  console.log(`Submitter authorized. tx: ${tx.hash}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
