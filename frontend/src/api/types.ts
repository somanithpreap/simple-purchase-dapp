export type Role = "SELLER" | "CUSTOMER";

export interface User {
  id: string;
  email: string;
  role: Role;
  walletAddress: string | null;
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceWei: string;
  stockQty: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "PENDING" | "ESCROWED" | "DELIVERED" | "CANCELLED" | "FAILED";

export interface Order {
  id: number;
  buyerId: string;
  sellerId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  totalPriceWei: string;
  status: OrderStatus;
  purchaseTxHash: string | null;
  confirmTxHash: string | null;
  cancelTxHash: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  buyer?: { id: string; email: string; walletAddress: string | null };
}

/** Response for a freshly created (PENDING) order -- includes what the
 * frontend needs to build the on-chain purchase() tx via MetaMask. */
export interface PendingOrder extends Order {
  sellerWalletAddress: string;
}
