import type { Product, Order, User } from "../generated/prisma/client.js";

export function serializeProduct(product: Product) {
  return {
    id: product.id,
    sellerId: product.sellerId,
    name: product.name,
    description: product.description,
    priceWei: product.priceWei.toString(),
    stockQty: product.stockQty,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function serializeOrder(order: Order & { product?: Product; buyer?: User }) {
  return {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    productId: order.productId,
    quantity: order.quantity,
    totalPriceWei: order.totalPriceWei.toString(),
    status: order.status,
    purchaseTxHash: order.purchaseTxHash,
    confirmTxHash: order.confirmTxHash,
    cancelTxHash: order.cancelTxHash,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...(order.product ? { product: serializeProduct(order.product) } : {}),
    ...(order.buyer
      ? { buyer: { id: order.buyer.id, email: order.buyer.email, walletAddress: order.buyer.walletAddress } }
      : {}),
  };
}
