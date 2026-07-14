import { z } from "zod";

export const createOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
