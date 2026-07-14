import crypto from "node:crypto";
import { ethers } from "ethers";

const APP_NAME = "Simple Purchase DApp";
const NONCE_TTL_MS = 10 * 60 * 1000;

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildChallengeMessage(nonce: string): string {
  return `Sign this message to link your wallet to ${APP_NAME}.\n\nNonce: ${nonce}`;
}

export function isNonceExpired(issuedAt: Date): boolean {
  return Date.now() - issuedAt.getTime() > NONCE_TTL_MS;
}

export function verifyWalletSignature(message: string, signature: string, expectedAddress: string): boolean {
  const recovered = ethers.verifyMessage(message, signature);
  return recovered.toLowerCase() === expectedAddress.toLowerCase();
}
