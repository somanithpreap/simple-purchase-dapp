import { z } from "zod";

export const createOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

export const submitTxSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SubmitTxInput = z.infer<typeof submitTxSchema>;
