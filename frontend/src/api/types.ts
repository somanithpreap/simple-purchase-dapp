export type Role = "SELLER" | "CUSTOMER";

export interface User {
  id: string;
  email: string;
  role: Role;
  walletAddress: string;
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
  productId: string;
  quantity: number;
  totalPriceWei: string;
  status: OrderStatus;
  purchaseTxHash: string | null;
  confirmTxHash: string | null;
  cancelTxHash: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  buyer?: { id: string; email: string; walletAddress: string };
}
