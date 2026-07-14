import type { User, Product, Order, PendingOrder, Role } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(body?.error ?? res.statusText, res.status);
  }

  return body as T;
}

export function register(email: string, password: string, role: Role) {
  return request<{ user: User; token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export function login(email: string, password: string) {
  return request<{ user: User; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function listProducts() {
  return request<Product[]>("/products");
}

export function createProduct(
  token: string,
  input: { name: string; description: string; imageUrl?: string; priceWei: string; stockQty: number },
) {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(input) }, token);
}

export function updateStock(token: string, productId: string, stockQty: number) {
  return request<Product>(
    `/products/${productId}/stock`,
    { method: "PATCH", body: JSON.stringify({ stockQty }) },
    token,
  );
}

export function purchaseProduct(token: string, productId: string, quantity: number) {
  return request<PendingOrder>(
    "/orders",
    { method: "POST", body: JSON.stringify({ productId, quantity }) },
    token,
  );
}

export function submitPurchaseTx(token: string, orderId: number, txHash: string) {
  return request<Order>(`/orders/${orderId}/submit-tx`, { method: "POST", body: JSON.stringify({ txHash }) }, token);
}

export function submitConfirmTx(token: string, orderId: number, txHash: string) {
  return request<Order>(
    `/orders/${orderId}/submit-confirm-tx`,
    { method: "POST", body: JSON.stringify({ txHash }) },
    token,
  );
}

export function listMyOrders(token: string) {
  return request<Order[]>("/orders/mine", {}, token);
}

export function listSellerOrders(token: string) {
  return request<Order[]>("/orders/seller", {}, token);
}

export function getBalance(token: string) {
  return request<{ walletAddress: string; balanceWei: string }>("/auth/me/balance", {}, token);
}

export function getContractInfo() {
  return request<{ address: string; chainId: number }>("/contract-info");
}

export function getWalletNonce(token: string) {
  return request<{ nonce: string; message: string }>("/wallet/nonce", { method: "POST" }, token);
}

export function connectWallet(token: string, address: string, signature: string) {
  return request<{ walletAddress: string }>(
    "/wallet/connect",
    { method: "POST", body: JSON.stringify({ address, signature }) },
    token,
  );
}
