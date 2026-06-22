const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying DiplomaRegistry...");
  console.log("Deployer (issuer / owner):", deployer.address);

  // The deployer becomes the registered issuer (Ownable initialOwner).
  const Registry = await hre.ethers.getContractFactory("DiplomaRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("DiplomaRegistry deployed to:", address);

  // Write address + ABI to a config file the frontend reads.
  writeFrontendConfig(address);
}

function writeFrontendConfig(address) {
  const artifact = hre.artifacts.readArtifactSync("DiplomaRegistry");

  const config = {
    address,
    chainId: Number(hre.network.config.chainId ?? 31337),
    network: hre.network.name,
    // Used by Verify mode for read-only calls (no wallet required).
    rpcUrl: hre.network.config.url || "http://127.0.0.1:8545",
    abi: artifact.abi,
  };

  const outDir = path.join(__dirname, "..", "frontend", "src", "contract");
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, "DiplomaRegistry.json");
  fs.writeFileSync(outFile, JSON.stringify(config, null, 2) + "\n");

  console.log("Wrote frontend config to:", outFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
