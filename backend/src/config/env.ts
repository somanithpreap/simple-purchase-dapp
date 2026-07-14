import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("1h"),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 32 bytes as hex (64 chars)"),
  HARDHAT_RPC_URL: z.string().min(1),
  CONTRACT_ADDRESS_FILE: z.string().min(1),
  FAUCET_PRIVATE_KEY: z.string().min(1),
  FAUCET_AMOUNT_ETH: z.string().default("1"),
});

export const env = envSchema.parse(process.env);
