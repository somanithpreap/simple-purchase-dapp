import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/db/prismaClient.js";

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
