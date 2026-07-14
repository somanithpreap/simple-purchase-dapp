import crypto from "node:crypto";
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { getProvider } from "./contract.js";

const ALGORITHM = "aes-256-gcm";

export interface GeneratedWallet {
  address: string;
  encryptedPrivateKey: string;
}

export function generateWallet(): GeneratedWallet {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
  };
}

/** Ciphertext is stored as `iv:authTag:encrypted`, all hex-encoded. */
export function encryptPrivateKey(privateKey: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptPrivateKey(ciphertext: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Malformed encrypted private key");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// A single shared faucet account funds every new registration. NonceManager
// assigns nonces synchronously (before any await), so concurrent
// registrations don't race for the same nonce on this one account.
let faucetSigner: ethers.NonceManager | undefined;

function getFaucetSigner(): ethers.NonceManager {
  faucetSigner ??= new ethers.NonceManager(new ethers.Wallet(env.FAUCET_PRIVATE_KEY, getProvider()));
  return faucetSigner;
}

/**
 * Sends starter ETH from one of Hardhat's pre-funded default accounts so a
 * freshly registered user's custodial wallet can pay gas on the local chain.
 * Dev/CI only -- FAUCET_PRIVATE_KEY is a well-known Hardhat test key.
 */
export async function fundNewWallet(address: string): Promise<string> {
  const tx = await getFaucetSigner().sendTransaction({
    to: address,
    value: ethers.parseEther(env.FAUCET_AMOUNT_ETH),
  });
  await tx.wait();
  return tx.hash;
}

export function connectSigner(encryptedPrivateKey: string) {
  const privateKey = decryptPrivateKey(encryptedPrivateKey);
  return new ethers.Wallet(privateKey, getProvider());
}
