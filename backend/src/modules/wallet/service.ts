import { ethers } from "ethers";
import { prisma } from "../../db/prismaClient.js";
import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../utils/httpError.js";
import {
  generateNonce,
  buildChallengeMessage,
  isNonceExpired,
  verifyWalletSignature,
} from "../../blockchain/walletLink.js";
import type { ConnectWalletInput } from "./schemas.js";

export async function requestNonce(userId: string) {
  const nonce = generateNonce();
  await prisma.user.update({
    where: { id: userId },
    data: { walletNonce: nonce, walletNonceIssuedAt: new Date() },
  });
  return { nonce, message: buildChallengeMessage(nonce) };
}

export async function connectWallet(userId: string, input: ConnectWalletInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.walletNonce || !user.walletNonceIssuedAt) {
    throw new HttpError("No pending wallet connection request; call /wallet/nonce first", 400);
  }
  if (isNonceExpired(user.walletNonceIssuedAt)) {
    throw new HttpError("Wallet connection request expired; call /wallet/nonce again", 400);
  }

  const message = buildChallengeMessage(user.walletNonce);
  if (!verifyWalletSignature(message, input.signature, input.address)) {
    throw new HttpError("Signature does not match the provided address", 400);
  }

  const address = ethers.getAddress(input.address);

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: address, walletNonce: null, walletNonceIssuedAt: null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError("This wallet is already linked to a different account", 409);
    }
    throw err;
  }
}
