import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { ethers } from "ethers";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prismaClient.js";
import { resetDb, registerUser } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("registers a seller with no wallet linked yet, and returns a token", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "seller1@example.com",
      password: "password123",
      role: "SELLER",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("SELLER");
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.walletAddress).toBeNull();
  });

  it("registers a customer", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "customer1@example.com",
      password: "password123",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("CUSTOMER");
  });

  it("rejects registering the same email twice", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "dupe@example.com",
      password: "password123",
      role: "SELLER",
    });

    const res = await request(app).post("/api/v1/auth/register").send({
      email: "dupe@example.com",
      password: "password123",
      role: "SELLER",
    });

    expect(res.status).toBe(409);
  });

  it("rejects invalid registration payloads", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "not-an-email",
      password: "short",
      role: "SELLER",
    });

    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "login@example.com",
      password: "password123",
      role: "CUSTOMER",
    });

    const good = await request(app).post("/api/v1/auth/login").send({
      email: "login@example.com",
      password: "password123",
    });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeTypeOf("string");

    const bad = await request(app).post("/api/v1/auth/login").send({
      email: "login@example.com",
      password: "wrong-password",
    });
    expect(bad.status).toBe(401);
  });
});

describe("wallet linking", () => {
  it("links a wallet via nonce + signature, matching what MetaMask would produce", async () => {
    const { token } = await registerUser(app, "CUSTOMER");
    const wallet = ethers.Wallet.createRandom();

    const nonceRes = await request(app).post("/api/v1/wallet/nonce").set("Authorization", `Bearer ${token}`).send();
    expect(nonceRes.status).toBe(200);

    const signature = await wallet.signMessage(nonceRes.body.message);

    const connectRes = await request(app)
      .post("/api/v1/wallet/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ address: wallet.address, signature });

    expect(connectRes.status).toBe(200);
    expect(connectRes.body.walletAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it("rejects a signature that doesn't match the claimed address", async () => {
    const { token } = await registerUser(app, "CUSTOMER");
    const claimedWallet = ethers.Wallet.createRandom();
    const signerWallet = ethers.Wallet.createRandom();

    const nonceRes = await request(app).post("/api/v1/wallet/nonce").set("Authorization", `Bearer ${token}`).send();
    const signature = await signerWallet.signMessage(nonceRes.body.message);

    const connectRes = await request(app)
      .post("/api/v1/wallet/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ address: claimedWallet.address, signature });

    expect(connectRes.status).toBe(400);
  });

  it("rejects linking a wallet that's already linked to a different account", async () => {
    const first = await registerUser(app, "CUSTOMER");
    const second = await registerUser(app, "CUSTOMER");
    const wallet = ethers.Wallet.createRandom();

    const firstNonce = await request(app)
      .post("/api/v1/wallet/nonce")
      .set("Authorization", `Bearer ${first.token}`)
      .send();
    const firstSignature = await wallet.signMessage(firstNonce.body.message);
    const firstConnect = await request(app)
      .post("/api/v1/wallet/connect")
      .set("Authorization", `Bearer ${first.token}`)
      .send({ address: wallet.address, signature: firstSignature });
    expect(firstConnect.status).toBe(200);

    const secondNonce = await request(app)
      .post("/api/v1/wallet/nonce")
      .set("Authorization", `Bearer ${second.token}`)
      .send();
    const secondSignature = await wallet.signMessage(secondNonce.body.message);
    const secondConnect = await request(app)
      .post("/api/v1/wallet/connect")
      .set("Authorization", `Bearer ${second.token}`)
      .send({ address: wallet.address, signature: secondSignature });

    expect(secondConnect.status).toBe(409);
  });
});
