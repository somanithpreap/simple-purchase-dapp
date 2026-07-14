import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prismaClient.js";
import { getContract, getProvider } from "../../src/blockchain/contract.js";
import { resetDb, registerUser } from "./helpers.js";

const app = createApp();
const PRICE_WEI = "100000000000000000"; // 0.1 ETH -- comfortably within the faucet's 1 ETH grant

async function createProduct(sellerToken: string, stockQty = 10) {
  const res = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${sellerToken}`)
    .send({ name: "Widget", description: "A fine widget", priceWei: PRICE_WEI, stockQty });
  return res.body;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("orders", () => {
  it("escrows funds on purchase and decrements stock, matching on-chain state", async () => {
    const seller = await registerUser(app, "SELLER");
    const customer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 10);

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ESCROWED");
    expect(res.body.totalPriceWei).toBe((2n * BigInt(PRICE_WEI)).toString());
    expect(res.body.purchaseTxHash).toBeTypeOf("string");

    const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updatedProduct.stockQty).toBe(8);

    const contract = await getContract();
    const onChainOrder = await contract.orders!(res.body.id);
    expect(onChainOrder.status).toBe(1n); // Escrowed
    expect(onChainOrder.buyer.toLowerCase()).toBe(customer.user.walletAddress.toLowerCase());
    expect(onChainOrder.seller.toLowerCase()).toBe(seller.user.walletAddress.toLowerCase());
  });

  it("rejects purchases exceeding available stock", async () => {
    const seller = await registerUser(app, "SELLER");
    const customer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 1);

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 5 });

    expect(res.status).toBe(409);
  });

  it("rejects purchases from sellers", async () => {
    const seller = await registerUser(app, "SELLER");
    const product = await createProduct(seller.token, 10);

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ productId: product.id, quantity: 1 });

    expect(res.status).toBe(403);
  });

  it("releases escrowed funds to the seller when the buyer confirms delivery", async () => {
    const seller = await registerUser(app, "SELLER");
    const customer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 10);

    const purchaseRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

    const provider = getProvider();
    const balanceBefore = await provider.getBalance(seller.user.walletAddress);

    const confirmRes = await request(app)
      .post(`/api/v1/orders/${purchaseRes.body.id}/confirm-delivery`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send();

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe("DELIVERED");
    expect(confirmRes.body.confirmTxHash).toBeTypeOf("string");

    const balanceAfter = await provider.getBalance(seller.user.walletAddress);
    expect(balanceAfter - balanceBefore).toBe(BigInt(PRICE_WEI));

    const contract = await getContract();
    const onChainOrder = await contract.orders!(purchaseRes.body.id);
    expect(onChainOrder.status).toBe(2n); // Delivered
  });

  it("rejects confirm-delivery from a non-buyer", async () => {
    const seller = await registerUser(app, "SELLER");
    const customer = await registerUser(app, "CUSTOMER");
    const otherCustomer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 10);

    const purchaseRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

    const res = await request(app)
      .post(`/api/v1/orders/${purchaseRes.body.id}/confirm-delivery`)
      .set("Authorization", `Bearer ${otherCustomer.token}`)
      .send();

    expect(res.status).toBe(403);
  });

  it("lists orders for buyer and seller views", async () => {
    const seller = await registerUser(app, "SELLER");
    const customer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 10);

    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

    const mine = await request(app)
      .get("/api/v1/orders/mine")
      .set("Authorization", `Bearer ${customer.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].product.name).toBe("Widget");

    const sellerOrders = await request(app)
      .get("/api/v1/orders/seller")
      .set("Authorization", `Bearer ${seller.token}`);
    expect(sellerOrders.status).toBe(200);
    expect(sellerOrders.body).toHaveLength(1);
    expect(sellerOrders.body[0].buyer.id).toBe(customer.user.id);
  });
});
