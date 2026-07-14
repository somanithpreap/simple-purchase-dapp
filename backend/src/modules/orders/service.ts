import { prisma } from "../../db/prismaClient.js";
import { HttpError } from "../../utils/httpError.js";
import { connectSigner } from "../../blockchain/wallet.js";
import { getContract } from "../../blockchain/contract.js";
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
  const seller = await prisma.user.findUniqueOrThrow({ where: { id: product.sellerId } });
  const totalPriceWei = product.priceWei * BigInt(input.quantity);

  const order = await prisma.order.create({
    data: {
      buyerId,
      sellerId: product.sellerId,
      productId: product.id,
      quantity: input.quantity,
      totalPriceWei,
      status: "PENDING",
    },
  });

  try {
    const signer = connectSigner(buyer.encryptedPrivateKey);
    const contract = await getContract(signer);
    const tx = await contract.purchase!(order.id, seller.walletAddress, totalPriceWei, {
      value: totalPriceWei,
    });
    await tx.wait();

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "ESCROWED", purchaseTxHash: tx.hash },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { stockQty: { decrement: input.quantity } },
      }),
    ]);
    return updatedOrder;
  } catch (err) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    throw new HttpError(`Purchase failed: ${(err as Error).message}`, 502);
  }
}

export async function confirmDelivery(orderId: number, buyerId: string) {
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

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerId } });
  const signer = connectSigner(buyer.encryptedPrivateKey);
  const contract = await getContract(signer);

  try {
    const tx = await contract.confirmDelivery!(order.id);
    await tx.wait();
    return prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED", confirmTxHash: tx.hash },
    });
  } catch (err) {
    throw new HttpError(`Confirm delivery failed: ${(err as Error).message}`, 502);
  }
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
