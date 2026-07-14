import fs from "node:fs";
import { ethers } from "ethers";
import { env } from "../config/env.js";
import marketplaceAbi from "./Marketplace.abi.json" with { type: "json" };

const DEPLOYMENT_KEY = "MarketplaceModule#Marketplace";

let provider: ethers.JsonRpcProvider | undefined;

export function getProvider(): ethers.JsonRpcProvider {
  // cacheTimeout disabled: Hardhat mines instantly, so ethers' default 250ms
  // read-call cache can serve a stale nonce for a signer's very next
  // transaction, causing spurious "nonce too low" errors.
  provider ??= new ethers.JsonRpcProvider(env.RPC_URL, undefined, { cacheTimeout: -1 });
  return provider;
}

let cachedAddress: string | undefined;

/**
 * Resolves the deployed Marketplace contract address. If CONTRACT_ADDRESS is
 * set (e.g. for Sepolia, where there's no local one-shot deploy step), it's
 * used directly. Otherwise falls back to reading the address written by
 * `hardhat ignition deploy` (see contracts/ignition/modules/Marketplace.ts)
 * at CONTRACT_ADDRESS_FILE, retrying briefly since in Docker Compose the
 * backend can start before the one-shot deploy service has finished writing
 * the file.
 */
export async function getContractAddress(): Promise<string> {
  if (cachedAddress) return cachedAddress;

  if (env.CONTRACT_ADDRESS) {
    cachedAddress = env.CONTRACT_ADDRESS;
    return cachedAddress;
  }

  if (!env.CONTRACT_ADDRESS_FILE) {
    throw new Error("Either CONTRACT_ADDRESS or CONTRACT_ADDRESS_FILE must be set");
  }

  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (fs.existsSync(env.CONTRACT_ADDRESS_FILE)) {
      const deployed = JSON.parse(fs.readFileSync(env.CONTRACT_ADDRESS_FILE, "utf8"));
      const address = deployed[DEPLOYMENT_KEY];
      if (address) {
        cachedAddress = address;
        return address;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Marketplace contract address not found at ${env.CONTRACT_ADDRESS_FILE} after ${maxAttempts}s`,
  );
}

export async function getContract(
  runner: ethers.Signer | ethers.Provider = getProvider(),
): Promise<ethers.Contract> {
  const address = await getContractAddress();
  return new ethers.Contract(address, marketplaceAbi, runner);
}
