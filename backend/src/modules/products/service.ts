import { prisma } from "../../db/prismaClient.js";
import { HttpError } from "../../utils/httpError.js";
import type {
  CreateProductInput,
  UpdateStockInput,
  UpdateProductInput,
  ListProductsQuery,
} from "./schemas.js";

export async function createProduct(sellerId: string, input: CreateProductInput) {
  return prisma.product.create({ data: { sellerId, ...input } });
}

export async function listProducts(query: ListProductsQuery) {
  return prisma.product.findMany({
    where: {
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new HttpError("Product not found", 404);
  }
  return product;
}

async function getOwnedProduct(id: string, sellerId: string) {
  const product = await getProduct(id);
  if (product.sellerId !== sellerId) {
    throw new HttpError("Not your product", 403);
  }
  return product;
}

export async function updateStock(id: string, sellerId: string, input: UpdateStockInput) {
  await getOwnedProduct(id, sellerId);
  return prisma.product.update({ where: { id }, data: { stockQty: input.stockQty } });
}

export async function updateProduct(id: string, sellerId: string, input: UpdateProductInput) {
  await getOwnedProduct(id, sellerId);
  return prisma.product.update({ where: { id }, data: input });
}
