import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
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

describe("products", () => {
  it("lets a seller create a product", async () => {
    const seller = await registerUser(app, "SELLER");

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: "1000000000000000000", stockQty: 10 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Widget");
    expect(res.body.priceWei).toBe("1000000000000000000");
    expect(res.body.stockQty).toBe(10);
    expect(res.body.sellerId).toBe(seller.user.id);
  });

  it("rejects product creation from a customer", async () => {
    const customer = await registerUser(app, "CUSTOMER");

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: "1000000000000000000", stockQty: 10 });

    expect(res.status).toBe(403);
  });

  it("rejects product creation without auth", async () => {
    const res = await request(app)
      .post("/api/v1/products")
      .send({ name: "Widget", description: "A fine widget", priceWei: "1000000000000000000", stockQty: 10 });

    expect(res.status).toBe(401);
  });

  it("lets the owning seller update stock, and rejects other sellers", async () => {
    const seller = await registerUser(app, "SELLER");
    const otherSeller = await registerUser(app, "SELLER");

    const created = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: "1000000000000000000", stockQty: 10 });

    const ownUpdate = await request(app)
      .patch(`/api/v1/products/${created.body.id}/stock`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ stockQty: 5 });
    expect(ownUpdate.status).toBe(200);
    expect(ownUpdate.body.stockQty).toBe(5);

    const otherUpdate = await request(app)
      .patch(`/api/v1/products/${created.body.id}/stock`)
      .set("Authorization", `Bearer ${otherSeller.token}`)
      .send({ stockQty: 99 });
    expect(otherUpdate.status).toBe(403);
  });

  it("publicly lists and fetches products without auth", async () => {
    const seller = await registerUser(app, "SELLER");
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: "1000000000000000000", stockQty: 10 });

    const list = await request(app).get("/api/v1/products");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const detail = await request(app).get(`/api/v1/products/${list.body[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe("Widget");
  });

  it("returns 404 for a missing product", async () => {
    const res = await request(app).get("/api/v1/products/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
