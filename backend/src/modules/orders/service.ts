import { prisma } from "../../db/prismaClient.js";
import { HttpError } from "../../utils/httpError.js";
import { verifyContractEvent, TxVerificationError } from "../../blockchain/verifyTx.js";
import type { CreateOrderInput } from "./schemas.js";

export async function purchase(buyerId: string, input: CreateOrderInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new HttpError("Product not found", 404);
  }
  if (product.stockQty < input.quantity) {
    throw new HttpError("Insufficient stock", 409);
  }

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerId } });
  if (!buyer.walletAddress) {
    throw new HttpError("Connect a wallet before purchasing", 400);
  }
  const seller = await prisma.user.findUniqueOrThrow({ where: { id: product.sellerId } });
  if (!seller.walletAddress) {
    throw new HttpError("This seller has no wallet connected yet", 409);
  }
  const totalPriceWei = product.priceWei * BigInt(input.quantity);

  // Stock is reserved now (not at confirmation) so two buyers can't both
  // "win" the last unit while their transactions are in flight; restored if
  // the buyer never submits a valid on-chain tx (see submitPurchaseTx).
  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        buyerId,
        sellerId: product.sellerId,
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        totalPriceWei,
        status: "PENDING",
      },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { stockQty: { decrement: input.quantity } },
    }),
  ]);

  return { order, sellerWalletAddress: seller.walletAddress };
}

/**
 * Phase 2 of purchase: the buyer signed and submitted `purchase()` via
 * MetaMask themselves. The backend never trusts the tx hash it's handed --
 * it independently fetches the receipt and decodes the contract's own
 * OrderCreated event to confirm the order was actually escrowed as expected.
 */
export async function submitPurchaseTx(orderId: number, buyerId: string, txHash: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new HttpError("Order not found", 404);
  }
  if (order.buyerId !== buyerId) {
    throw new HttpError("Not your order", 403);
  }
  if (order.status !== "PENDING") {
    throw new HttpError(`Order is not pending (status: ${order.status})`, 409);
  }

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: order.buyerId } });
  const seller = await prisma.user.findUniqueOrThrow({ where: { id: order.sellerId } });

  try {
    await verifyContractEvent(txHash, "OrderCreated", {
      orderId: BigInt(order.id),
      buyer: buyer.walletAddress,
      seller: seller.walletAddress,
      amount: order.totalPriceWei,
    });
  } catch (err) {
    if (err instanceof TxVerificationError) {
      // A PENDING order's product can't have been deleted (deleteProduct blocks
      // on active orders), so productId is always still set here.
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } }),
        ...(order.productId
          ? [
              prisma.product.update({
                where: { id: order.productId },
                data: { stockQty: { increment: order.quantity } },
              }),
            ]
          : []),
      ]);
      throw new HttpError(`Purchase verification failed: ${err.message}`, 502);
    }
    throw err;
  }

  return prisma.order.update({
    where: { id: order.id },
    data: { status: "ESCROWED", purchaseTxHash: txHash },
  });
}

/**
 * Phase 2 of confirm-delivery: same pattern as submitPurchaseTx, verifying
 * the buyer's client-submitted confirmDelivery() tx against the contract's
 * DeliveryConfirmed event before releasing the order from escrow.
 */
export async function submitConfirmTx(orderId: number, buyerId: string, txHash: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new HttpError("Order not found", 404);
  }
  if (order.buyerId !== buyerId) {
    throw new HttpError("Not your order", 403);
  }
  if (order.status !== "ESCROWED") {
    throw new HttpError(`Order is not escrowed (status: ${order.status})`, 409);
  }

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: order.buyerId } });
  const seller = await prisma.user.findUniqueOrThrow({ where: { id: order.sellerId } });

  try {
    await verifyContractEvent(txHash, "DeliveryConfirmed", {
      orderId: BigInt(order.id),
      buyer: buyer.walletAddress,
      seller: seller.walletAddress,
      amount: order.totalPriceWei,
    });
  } catch (err) {
    if (err instanceof TxVerificationError) {
      throw new HttpError(`Confirm delivery verification failed: ${err.message}`, 502);
    }
    throw err;
  }

  return prisma.order.update({
    where: { id: order.id },
    data: { status: "DELIVERED", confirmTxHash: txHash },
  });
}

export async function listBuyerOrders(buyerId: string) {
  return prisma.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });
}

export async function listSellerOrders(sellerId: string) {
  return prisma.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: { product: true, buyer: true },
  });
}
