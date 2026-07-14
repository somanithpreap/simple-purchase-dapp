import { z } from "zod";

export const connectWalletSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().min(1),
});

export type ConnectWalletInput = z.infer<typeof connectWalletSchema>;
