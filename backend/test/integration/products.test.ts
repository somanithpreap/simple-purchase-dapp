import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { ethers } from "ethers";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prismaClient.js";
import { getContract } from "../../src/blockchain/contract.js";
import { resetDb, registerUser, connectTestWallet } from "./helpers.js";

const app = createApp();
const PRICE_WEI = "100000000000000000"; // 0.1 ETH -- comfortably within the test funder's 1 ETH grant

// .connect() on ethers' BaseContract loses the dynamic per-method typing
// that Contract has, hence the cast -- runtime behavior is unaffected.
async function contractAs(signer: ethers.Signer): Promise<ethers.Contract> {
  return (await getContract()).connect(signer) as ethers.Contract;
}

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

  it("lets the owning seller update product details, and rejects other sellers", async () => {
    const seller = await registerUser(app, "SELLER");
    const otherSeller = await registerUser(app, "SELLER");

    const created = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: "1000000000000000000", stockQty: 10 });

    const ownUpdate = await request(app)
      .patch(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Deluxe Widget", priceWei: "2000000000000000000" });
    expect(ownUpdate.status).toBe(200);
    expect(ownUpdate.body.name).toBe("Deluxe Widget");
    expect(ownUpdate.body.priceWei).toBe("2000000000000000000");
    expect(ownUpdate.body.description).toBe("A fine widget");

    const otherUpdate = await request(app)
      .patch(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${otherSeller.token}`)
      .send({ name: "Hijacked" });
    expect(otherUpdate.status).toBe(403);
  });

  it("blocks deleting a product with pending or escrowed orders", async () => {
    const seller = await registerUser(app, "SELLER");
    await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    await connectTestWallet(app, customer.token);
    const created = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: PRICE_WEI, stockQty: 10 });

    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: created.body.id, quantity: 1 });

    const res = await request(app)
      .delete(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(res.status).toBe(409);

    const stillThere = await prisma.product.findUnique({ where: { id: created.body.id } });
    expect(stillThere).not.toBeNull();
  });

  it("lets a seller delete a product once its orders are no longer pending/escrowed, preserving order history", async () => {
    const seller = await registerUser(app, "SELLER");
    const sellerWallet = await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    const buyerWallet = await connectTestWallet(app, customer.token);
    const created = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Widget", description: "A fine widget", priceWei: PRICE_WEI, stockQty: 10 });

    const createRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: created.body.id, quantity: 1 });

    const purchaseTx = await (await contractAs(buyerWallet)).purchase!(
      createRes.body.id,
      createRes.body.sellerWalletAddress,
      BigInt(createRes.body.totalPriceWei),
      { value: BigInt(createRes.body.totalPriceWei) },
    );
    await purchaseTx.wait();
    await request(app)
      .post(`/api/v1/orders/${createRes.body.id}/submit-tx`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ txHash: purchaseTx.hash });

    const confirmTx = await (await contractAs(buyerWallet)).confirmDelivery!(createRes.body.id);
    await confirmTx.wait();
    const confirmRes = await request(app)
      .post(`/api/v1/orders/${createRes.body.id}/submit-confirm-tx`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ txHash: confirmTx.hash });
    expect(confirmRes.body.status).toBe("DELIVERED");

    const deleteRes = await request(app)
      .delete(`/api/v1/products/${created.body.id}`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(deleteRes.status).toBe(204);

    const gone = await prisma.product.findUnique({ where: { id: created.body.id } });
    expect(gone).toBeNull();

    const mine = await request(app)
      .get("/api/v1/orders/mine")
      .set("Authorization", `Bearer ${customer.token}`);
    expect(mine.body[0].productId).toBeNull();
    expect(mine.body[0].productName).toBe("Widget");
    expect(mine.body[0].product).toBeUndefined();
  });
});
