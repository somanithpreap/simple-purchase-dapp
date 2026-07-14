import { ethers } from "ethers";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/db/prismaClient.js";
import { getProvider } from "../../src/blockchain/contract.js";

export async function resetDb() {
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

let counter = 0;

export async function registerUser(app: Express, role: "SELLER" | "CUSTOMER") {
  counter += 1;
  const email = `${role.toLowerCase()}${counter}@example.com`;
  const res = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    role,
  });
  if (res.status !== 201) {
    throw new Error(`Failed to register test user: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token as string, user: res.body.user };
}

// Hardhat's account #0 -- pre-funded with 10000 ETH on the local dev chain,
// well-known and public (see SECURITY.md). Used only to fund fresh test
// wallets so they can pay gas; never a user's own wallet.
const FUNDED_DEV_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// NonceManager assigns nonces synchronously (before any await), so
// sequential funding sends from this one account within a test run don't
// race for the same nonce -- mirroring the pattern the old custodial faucet
// used (see git history of blockchain/wallet.ts).
let funder: ethers.NonceManager | undefined;

function getFunder(): ethers.NonceManager {
  funder ??= new ethers.NonceManager(new ethers.Wallet(FUNDED_DEV_PRIVATE_KEY, getProvider()));
  return funder;
}

/**
 * Stands in for MetaMask in tests: creates a fresh wallet, funds it so it
 * can pay gas, and links it to the given test user via the same nonce ->
 * sign -> connect flow the frontend drives through window.ethereum. Returns
 * an ethers.Wallet signer the test can use to submit purchase()/
 * confirmDelivery() transactions directly against the contract.
 */
export async function connectTestWallet(app: Express, token: string): Promise<ethers.HDNodeWallet> {
  const provider = getProvider();
  const wallet = ethers.Wallet.createRandom().connect(provider);

  const fundTx = await getFunder().sendTransaction({
    to: wallet.address,
    value: ethers.parseEther("1"),
  });
  await fundTx.wait();

  const nonceRes = await request(app).post("/api/v1/wallet/nonce").set("Authorization", `Bearer ${token}`).send();
  if (nonceRes.status !== 200) {
    throw new Error(`Failed to get wallet nonce: ${JSON.stringify(nonceRes.body)}`);
  }

  const signature = await wallet.signMessage(nonceRes.body.message);

  const connectRes = await request(app)
    .post("/api/v1/wallet/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({ address: wallet.address, signature });
  if (connectRes.status !== 200) {
    throw new Error(`Failed to connect wallet: ${JSON.stringify(connectRes.body)}`);
  }

  return wallet;
}
