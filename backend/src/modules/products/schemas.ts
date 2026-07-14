import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().url().optional(),
  priceWei: z.coerce.bigint().positive(),
  stockQty: z.coerce.number().int().nonnegative(),
});

export const updateStockSchema = z.object({
  stockQty: z.coerce.number().int().nonnegative(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  priceWei: z.coerce.bigint().positive().optional(),
});

export const listProductsQuerySchema = z.object({
  sellerId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
