import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main(): Promise<void> {
  const regulatorAddress = process.env.REGULATOR_ADDRESS;
  if (!regulatorAddress) {
    throw new Error("REGULATOR_ADDRESS not set in .env");
  }

  console.log("Deploying ReportRegistry...");
  const ReportRegistry = await ethers.getContractFactory("ReportRegistry");
  const registry = await ReportRegistry.deploy(regulatorAddress);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`ReportRegistry deployed to: ${address}`);

  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const network = (await ethers.provider.getNetwork()).name;
  const deploymentsFile = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(deploymentsFile, JSON.stringify({ ReportRegistry: address }, null, 2));
  console.log(`Deployment saved to ${deploymentsFile}`);

  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30000));
    try {
      const { run } = await import("hardhat");
      await run("verify:verify", {
        address,
        constructorArguments: [regulatorAddress],
      });
      console.log("Contract verified on Etherscan");
    } catch (err: unknown) {
      console.warn("Etherscan verification failed:", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
