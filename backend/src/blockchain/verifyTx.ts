import { ethers } from "ethers";
import { env } from "../config/env.js";
import { getContract, getContractAddress, getProvider } from "./contract.js";

const POLL_INTERVAL_MS = 2000;

export class TxVerificationError extends Error {}

async function waitForReceipt(txHash: string): Promise<ethers.TransactionReceipt> {
  const provider = getProvider();
  const deadline = Date.now() + env.TX_RECEIPT_TIMEOUT_MS;

  for (;;) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) return receipt;
    if (Date.now() >= deadline) {
      throw new TxVerificationError(`Transaction ${txHash} was not mined within ${env.TX_RECEIPT_TIMEOUT_MS}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

function fieldsMatch(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "bigint" || typeof actual === "bigint") {
    return BigInt(actual as ethers.BigNumberish) === BigInt(expected as ethers.BigNumberish);
  }
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

/**
 * Independently confirms what a client-submitted transaction hash actually
 * did on-chain -- never trust the hash alone. Fetches the receipt, checks it
 * succeeded and targeted the deployed Marketplace contract, decodes the
 * contract's own event logs, and asserts the named event's args match what
 * the backend expects (orderId/buyer/seller/amount), not what the caller
 * claims.
 */
export async function verifyContractEvent(
  txHash: string,
  eventName: "OrderCreated" | "DeliveryConfirmed",
  expected: Record<string, unknown>,
): Promise<ethers.TransactionReceipt> {
  const receipt = await waitForReceipt(txHash);

  if (receipt.status !== 1) {
    throw new TxVerificationError(`Transaction ${txHash} reverted`);
  }

  const contractAddress = await getContractAddress();
  if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
    throw new TxVerificationError(`Transaction ${txHash} was not sent to the Marketplace contract`);
  }

  const contract = await getContract();
  const matchingLog = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === eventName);

  if (!matchingLog) {
    throw new TxVerificationError(`Transaction ${txHash} did not emit ${eventName}`);
  }

  for (const [key, value] of Object.entries(expected)) {
    if (!fieldsMatch(matchingLog.args[key], value)) {
      throw new TxVerificationError(`Transaction ${txHash} event field "${key}" did not match the expected order`);
    }
  }

  return receipt;
}
