import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { ethers } from "ethers";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prismaClient.js";
import { getProvider } from "../../src/blockchain/contract.js";
import { resetDb } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("registers a seller, funds their wallet, and returns a token", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "seller1@example.com",
      password: "password123",
      role: "SELLER",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("SELLER");
    expect(res.body.token).toBeTypeOf("string");
    expect(ethers.isAddress(res.body.user.walletAddress)).toBe(true);

    const balance = await getProvider().getBalance(res.body.user.walletAddress);
    expect(balance).toBeGreaterThan(0n);
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
