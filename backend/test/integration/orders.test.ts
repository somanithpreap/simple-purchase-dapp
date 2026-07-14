import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { ethers } from "ethers";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prismaClient.js";
import { getContract, getProvider } from "../../src/blockchain/contract.js";
import { resetDb, registerUser, connectTestWallet } from "./helpers.js";

const app = createApp();
const PRICE_WEI = "100000000000000000"; // 0.1 ETH -- comfortably within the test funder's 1 ETH grant

// .connect() on ethers' BaseContract loses the dynamic per-method typing
// that Contract has, hence the cast -- runtime behavior is unaffected.
async function contractAs(signer: ethers.Signer): Promise<ethers.Contract> {
  return (await getContract()).connect(signer) as ethers.Contract;
}

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
    const sellerWallet = await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    const buyerWallet = await connectTestWallet(app, customer.token);
    const product = await createProduct(seller.token, 10);

    const createRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 2 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe("PENDING");
    expect(createRes.body.totalPriceWei).toBe((2n * BigInt(PRICE_WEI)).toString());
    expect(createRes.body.sellerWalletAddress.toLowerCase()).toBe(sellerWallet.address.toLowerCase());

    const stockAfterCreate = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stockAfterCreate.stockQty).toBe(8);

    // Stand in for MetaMask: the buyer signs and submits purchase() directly.
    const contract = await contractAs(buyerWallet);
    const tx = await contract.purchase!(
      createRes.body.id,
      createRes.body.sellerWalletAddress,
      BigInt(createRes.body.totalPriceWei),
      { value: BigInt(createRes.body.totalPriceWei) },
    );
    await tx.wait();

    const submitRes = await request(app)
      .post(`/api/v1/orders/${createRes.body.id}/submit-tx`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ txHash: tx.hash });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("ESCROWED");
    expect(submitRes.body.purchaseTxHash).toBe(tx.hash);

    const onChainOrder = await (await getContract()).orders!(createRes.body.id);
    expect(onChainOrder.status).toBe(1n); // Escrowed
    expect(onChainOrder.buyer.toLowerCase()).toBe(buyerWallet.address.toLowerCase());
    expect(onChainOrder.seller.toLowerCase()).toBe(sellerWallet.address.toLowerCase());
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

  it("rejects purchase creation when the buyer has no wallet linked", async () => {
    const seller = await registerUser(app, "SELLER");
    await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 10);

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

    expect(res.status).toBe(400);
  });

  it("marks the order FAILED and restores stock when the submitted tx doesn't match", async () => {
    const seller = await registerUser(app, "SELLER");
    await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    const buyerWallet = await connectTestWallet(app, customer.token);
    const product = await createProduct(seller.token, 10);

    // Two separate orders; order A's genuine on-chain tx doesn't correspond
    // to order B's id/amount, so submitting it against B should be rejected
    // immediately by the event-field check (not a timeout).
    const orderA = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });
    const orderB = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

    const purchaseTx = await (await contractAs(buyerWallet)).purchase!(
      orderA.body.id,
      orderA.body.sellerWalletAddress,
      BigInt(orderA.body.totalPriceWei),
      { value: BigInt(orderA.body.totalPriceWei) },
    );
    await purchaseTx.wait();

    const submitRes = await request(app)
      .post(`/api/v1/orders/${orderB.body.id}/submit-tx`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ txHash: purchaseTx.hash });

    expect(submitRes.status).toBe(502);

    const failedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderB.body.id } });
    expect(failedOrder.status).toBe("FAILED");

    const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(productAfter.stockQty).toBe(9); // 10 - 1 (order A, still PENDING) - 1 (order B, created then restored)
  });

  it("releases escrowed funds to the seller when the buyer confirms delivery", async () => {
    const seller = await registerUser(app, "SELLER");
    const sellerWallet = await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    const buyerWallet = await connectTestWallet(app, customer.token);
    const product = await createProduct(seller.token, 10);

    const createRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

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

    const provider = getProvider();
    const balanceBefore = await provider.getBalance(sellerWallet.address);

    const confirmTx = await (await contractAs(buyerWallet)).confirmDelivery!(createRes.body.id);
    await confirmTx.wait();

    const confirmRes = await request(app)
      .post(`/api/v1/orders/${createRes.body.id}/submit-confirm-tx`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ txHash: confirmTx.hash });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe("DELIVERED");
    expect(confirmRes.body.confirmTxHash).toBe(confirmTx.hash);

    const balanceAfter = await provider.getBalance(sellerWallet.address);
    expect(balanceAfter - balanceBefore).toBe(BigInt(PRICE_WEI));

    const onChainOrder = await (await getContract()).orders!(createRes.body.id);
    expect(onChainOrder.status).toBe(2n); // Delivered
  });

  it("rejects confirm-delivery from a non-buyer", async () => {
    const seller = await registerUser(app, "SELLER");
    await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    await connectTestWallet(app, customer.token);
    const otherCustomer = await registerUser(app, "CUSTOMER");
    const product = await createProduct(seller.token, 10);

    const createRes = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ productId: product.id, quantity: 1 });

    const res = await request(app)
      .post(`/api/v1/orders/${createRes.body.id}/submit-confirm-tx`)
      .set("Authorization", `Bearer ${otherCustomer.token}`)
      .send({ txHash: `0x${"22".repeat(32)}` });

    expect(res.status).toBe(403);
  });

  it("lists orders for buyer and seller views", async () => {
    const seller = await registerUser(app, "SELLER");
    await connectTestWallet(app, seller.token);
    const customer = await registerUser(app, "CUSTOMER");
    await connectTestWallet(app, customer.token);
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
